import crypto from "node:crypto";
import process from "node:process";
import mysql from "mysql2/promise";

const ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

function nanoId() {
	let id = "";
	const bytes = crypto.randomBytes(15);
	for (const byte of bytes) {
		id += ID_ALPHABET[byte % ID_ALPHABET.length];
	}
	return id;
}

function parseArgs(argv) {
	const args = new Set(argv.slice(2));
	return {
		apply: args.has("--apply"),
		setActiveDefault: args.has("--set-active-default"),
		shareExistingVideos: args.has("--share-existing-videos"),
	};
}

function parseDatabaseUrl(url) {
	if (!url) throw new Error("DATABASE_URL environment variable is required");
	if (!url.startsWith("mysql://"))
		throw new Error("DATABASE_URL is not a MySQL URL");

	const parsed = new URL(url);
	return {
		host: parsed.hostname,
		port: parsed.port ? Number.parseInt(parsed.port, 10) : 3306,
		user: parsed.username,
		password: parsed.password,
		database: parsed.pathname.slice(1),
		ssl: { rejectUnauthorized: false },
	};
}

function isValidDomain(domain) {
	return /^(?=.{1,253}$)(^((?!-)[a-zA-Z0-9-]{1,63}(?<!-)\.)+[a-zA-Z]{2,63}$|localhost)$/.test(
		domain,
	);
}

function parseRules(config) {
	if (!config?.trim()) return [];

	return config
		.split(",")
		.map((entry) => entry.trim())
		.flatMap((entry) => {
			const [domain, organizationId] = entry
				.split("=")
				.map((part) => part.trim());
			if (!domain || !organizationId || !isValidDomain(domain)) return [];
			return [{ domain: domain.toLowerCase(), organizationId }];
		});
}

async function loadCandidates(connection, rule) {
	const [rows] = await connection.execute(
		`SELECT users.id, users.email, users.activeOrganizationId, users.defaultOrgId
		 FROM users
		 LEFT JOIN organization_members
		   ON organization_members.userId = users.id
		  AND organization_members.organizationId = ?
		 WHERE LOWER(users.email) LIKE ?
		   AND organization_members.id IS NULL`,
		[rule.organizationId, `%@${rule.domain}`],
	);
	return rows;
}

async function ensureOrganization(connection, organizationId) {
	const [rows] = await connection.execute(
		"SELECT id FROM organizations WHERE id = ? AND tombstoneAt IS NULL LIMIT 1",
		[organizationId],
	);
	if (rows.length === 0) {
		throw new Error(
			`Organization ${organizationId} does not exist or is tombstoned`,
		);
	}
}

async function shareExistingVideos(connection, userId, organizationId) {
	const [videos] = await connection.execute(
		`SELECT videos.id
		 FROM videos
		 LEFT JOIN shared_videos
		   ON shared_videos.videoId = videos.id
		  AND shared_videos.organizationId = ?
		 WHERE videos.ownerId = ?
		   AND shared_videos.id IS NULL`,
		[organizationId, userId],
	);

	for (const video of videos) {
		await connection.execute(
			`INSERT INTO shared_videos (id, videoId, organizationId, sharedByUserId, sharedAt)
			 VALUES (?, ?, ?, ?, NOW())`,
			[nanoId(), video.id, organizationId, userId],
		);
	}

	return videos.length;
}

async function applyCandidate(connection, candidate, rule, options) {
	await connection.execute(
		`INSERT INTO organization_members (id, userId, organizationId, role, hasProSeat, createdAt, updatedAt)
		 VALUES (?, ?, ?, 'member', false, NOW(), NOW())`,
		[nanoId(), candidate.id, rule.organizationId],
	);

	if (options.setActiveDefault) {
		await connection.execute(
			"UPDATE users SET activeOrganizationId = ?, defaultOrgId = ?, updated_at = NOW() WHERE id = ?",
			[rule.organizationId, rule.organizationId, candidate.id],
		);
	}

	const sharedVideoCount = options.shareExistingVideos
		? await shareExistingVideos(connection, candidate.id, rule.organizationId)
		: 0;

	return { sharedVideoCount };
}

async function main() {
	const options = parseArgs(process.argv);
	const rules = parseRules(process.env.CAP_AUTO_JOIN_ORGANIZATION_RULES);

	if (rules.length === 0) {
		throw new Error("CAP_AUTO_JOIN_ORGANIZATION_RULES has no valid rules");
	}

	const connection = await mysql.createConnection(
		parseDatabaseUrl(process.env.DATABASE_URL),
	);

	try {
		const summary = {
			mode: options.apply ? "apply" : "dry-run",
			setActiveDefault: options.setActiveDefault,
			shareExistingVideos: options.shareExistingVideos,
			rules: [],
			totalCandidates: 0,
			totalSharedVideos: 0,
		};

		for (const rule of rules) {
			await ensureOrganization(connection, rule.organizationId);
			const candidates = await loadCandidates(connection, rule);
			const ruleSummary = {
				domain: rule.domain,
				organizationId: rule.organizationId,
				candidates: candidates.map((candidate) => ({
					id: candidate.id,
					email: candidate.email,
					activeOrganizationId: candidate.activeOrganizationId,
					defaultOrgId: candidate.defaultOrgId,
				})),
				applied: 0,
				sharedVideos: 0,
			};

			summary.totalCandidates += candidates.length;

			if (options.apply) {
				await connection.beginTransaction();
				try {
					for (const candidate of candidates) {
						const result = await applyCandidate(
							connection,
							candidate,
							rule,
							options,
						);
						ruleSummary.applied += 1;
						ruleSummary.sharedVideos += result.sharedVideoCount;
					}
					await connection.commit();
				} catch (error) {
					await connection.rollback();
					throw error;
				}
			}

			summary.totalSharedVideos += ruleSummary.sharedVideos;
			summary.rules.push(ruleSummary);
		}

		console.log(JSON.stringify(summary, null, 2));
	} finally {
		await connection.end();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
