import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";

const alphabet = "0123456789abcdefghjkmnpqrstvwxyz";

const nanoId = () =>
	Array.from(randomBytes(15), (byte) => alphabet[byte % alphabet.length]).join(
		"",
	);

const readArg = (name) => {
	const prefix = `${name}=`;
	const value = process.argv.find((arg) => arg.startsWith(prefix));
	if (value) return value.slice(prefix.length);
	const index = process.argv.indexOf(name);
	if (index >= 0) return process.argv[index + 1];
	return undefined;
};

const isApply = process.argv.includes("--apply");
const email = (readArg("--email") ?? "mholifield@take3tech.com").toLowerCase();
const targetOrgId =
	readArg("--target-org-id") ?? process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID;

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is required");
}

if (!targetOrgId) {
	throw new Error(
		"--target-org-id or CAP_DEFAULT_SIGNUP_ORGANIZATION_ID is required",
	);
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const queryRows = async (sql, params = []) => {
	const [rows] = await connection.execute(sql, params);
	return rows;
};

const countRows = async (sql, params) => {
	const rows = await queryRows(sql, params);
	return Number(rows[0]?.count ?? 0);
};

const parseJsonObject = (value) => {
	if (!value) return {};
	if (typeof value === "object") return value;
	if (typeof value !== "string") return {};
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
};

const getPreflight = async () => {
	const users = await queryRows(
		"SELECT id, email, activeOrganizationId, defaultOrgId, onboardingSteps FROM users WHERE LOWER(email) = ? LIMIT 1",
		[email],
	);
	const user = users[0] ?? null;

	const targetOrganizations = await queryRows(
		"SELECT id, name, ownerId FROM organizations WHERE id = ? AND tombstoneAt IS NULL LIMIT 1",
		[targetOrgId],
	);
	const targetOrganization = targetOrganizations[0] ?? null;

	if (!user) {
		return {
			ok: false,
			reason: "user-not-found",
			email,
			targetOrgId,
			targetOrganization,
		};
	}

	const accidentalOrganizations = await queryRows(
		"SELECT id, name, createdAt FROM organizations WHERE ownerId = ? AND id <> ? AND tombstoneAt IS NULL ORDER BY createdAt",
		[user.id, targetOrgId],
	);

	const memberships = await queryRows(
		"SELECT id, organizationId, role, hasProSeat FROM organization_members WHERE userId = ? ORDER BY createdAt",
		[user.id],
	);

	const accidentalOrganization =
		accidentalOrganizations.length === 1 ? accidentalOrganizations[0] : null;

	const assetCounts = accidentalOrganization
		? {
				videos: await countRows(
					"SELECT COUNT(*) AS count FROM videos WHERE orgId = ?",
					[accidentalOrganization.id],
				),
				sharedVideos: await countRows(
					"SELECT COUNT(*) AS count FROM shared_videos WHERE organizationId = ?",
					[accidentalOrganization.id],
				),
				spaces: await countRows(
					"SELECT COUNT(*) AS count FROM spaces WHERE organizationId = ?",
					[accidentalOrganization.id],
				),
				folders: await countRows(
					"SELECT COUNT(*) AS count FROM folders WHERE organizationId = ?",
					[accidentalOrganization.id],
				),
				storageIntegrations: await countRows(
					"SELECT COUNT(*) AS count FROM storage_integrations WHERE organizationId = ?",
					[accidentalOrganization.id],
				),
			}
		: null;

	const assetTotal = assetCounts
		? Object.values(assetCounts).reduce((total, count) => total + count, 0)
		: null;

	return {
		ok:
			Boolean(user) &&
			Boolean(targetOrganization) &&
			Boolean(accidentalOrganization) &&
			assetTotal === 0,
		email,
		user,
		targetOrganization,
		accidentalOrganizations,
		accidentalOrganization,
		memberships,
		assetCounts,
		assetTotal,
	};
};

const applyRepair = async (preflight) => {
	if (!preflight.user) throw new Error("User was not found");
	if (!preflight.targetOrganization)
		throw new Error("Target organization was not found");
	if (!preflight.accidentalOrganization) {
		throw new Error("Exactly one accidental organization is required");
	}
	if (preflight.assetTotal !== 0) {
		throw new Error("Accidental organization has attached assets");
	}

	await connection.beginTransaction();
	try {
		const lockedUsers = await queryRows(
			"SELECT id, onboardingSteps FROM users WHERE id = ? FOR UPDATE",
			[preflight.user.id],
		);
		const lockedUser = lockedUsers[0];
		if (!lockedUser) throw new Error("User disappeared during repair");

		const existingMemberships = await queryRows(
			"SELECT id FROM organization_members WHERE userId = ? AND organizationId = ? LIMIT 1",
			[preflight.user.id, preflight.targetOrganization.id],
		);

		if (existingMemberships.length === 0) {
			await queryRows(
				"INSERT INTO organization_members (id, userId, organizationId, role, hasProSeat) VALUES (?, ?, ?, ?, ?)",
				[
					nanoId(),
					preflight.user.id,
					preflight.targetOrganization.id,
					"member",
					false,
				],
			);
		}

		const onboardingSteps = {
			...parseJsonObject(lockedUser.onboardingSteps),
			organizationSetup: true,
			customDomain: true,
			inviteTeam: true,
		};

		await queryRows(
			"UPDATE users SET activeOrganizationId = ?, defaultOrgId = ?, onboardingSteps = ? WHERE id = ?",
			[
				preflight.targetOrganization.id,
				preflight.targetOrganization.id,
				JSON.stringify(onboardingSteps),
				preflight.user.id,
			],
		);

		await queryRows(
			"DELETE FROM organization_members WHERE userId = ? AND organizationId = ?",
			[preflight.user.id, preflight.accidentalOrganization.id],
		);

		await queryRows(
			"UPDATE organizations SET tombstoneAt = NOW() WHERE id = ? AND ownerId = ? AND tombstoneAt IS NULL",
			[preflight.accidentalOrganization.id, preflight.user.id],
		);

		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	}
};

try {
	const preflight = await getPreflight();
	console.log(
		JSON.stringify(
			{ mode: isApply ? "apply" : "preflight", preflight },
			null,
			2,
		),
	);

	if (isApply) {
		await applyRepair(preflight);
		const verification = await getPreflight();
		console.log(
			JSON.stringify({ mode: "verification", verification }, null, 2),
		);
	}
} finally {
	await connection.end();
}
