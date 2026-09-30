import { createHash, randomBytes } from "node:crypto";

export async function bootstrapOrganizationOwner(connection, options) {
	const {
		sourceOrganizationId,
		targetOrganizationId,
		targetName,
		ownerId,
		ownerName,
		apply = false,
	} = options;
	const ownerEmail = options.ownerEmail?.trim().toLowerCase();
	if (
		!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail ?? "") ||
		![sourceOrganizationId, targetOrganizationId, ownerId].every((id) =>
			/^[a-zA-Z0-9-]{1,15}$/.test(id ?? ""),
		) ||
		sourceOrganizationId === targetOrganizationId ||
		!targetName?.trim() ||
		!ownerName?.trim()
	)
		throw new Error(
			"Explicit owner profile and distinct organization identities are required",
		);
	const rows = async (sql, params = []) =>
		(await connection.execute(sql, params))[0];
	const lock = apply ? " FOR UPDATE" : "";
	await connection.query(
		apply ? "START TRANSACTION" : "START TRANSACTION READ ONLY",
	);
	let rollbackAttempted = false;
	try {
		const organizations = await rows(
			`SELECT id,name,ownerId,settings,allowedEmailDomain,tombstoneAt FROM organizations WHERE id IN (?, ?) ORDER BY id${lock}`,
			[sourceOrganizationId, targetOrganizationId],
		);
		const source = organizations.find(
			(org) => org.id === sourceOrganizationId && !org.tombstoneAt,
		);
		const target = organizations.find((org) => org.id === targetOrganizationId);
		if (!source) throw new Error("Active source organization not found");
		if (
			target &&
			(target.name !== targetName ||
				target.ownerId !== ownerId ||
				target.tombstoneAt)
		)
			throw new Error("Target identity conflicts with the approved owner");
		const collisions = await rows(
			`SELECT id FROM organizations WHERE name = ? AND id <> ? AND tombstoneAt IS NULL${lock}`,
			[targetName, targetOrganizationId],
		);
		if (collisions.length)
			throw new Error("Target name already belongs to another organization");
		const profiles = await rows(
			`SELECT id,email,activeOrganizationId,defaultOrgId FROM users WHERE LOWER(email) = ? OR id = ? ORDER BY id${lock}`,
			[ownerEmail, ownerId],
		);
		if (
			profiles.length > 1 ||
			profiles.some(
				(user) =>
					user.id !== ownerId ||
					user.email.toLowerCase() !== ownerEmail ||
					user.activeOrganizationId !== targetOrganizationId ||
					user.defaultOrgId !== targetOrganizationId,
			)
		)
			throw new Error(
				"Existing owner profile requires separate reconciliation",
			);
		const memberships = await rows(
			`SELECT organizationId,role FROM organization_members WHERE userId = ? ORDER BY organizationId${lock}`,
			[ownerId],
		);
		if (
			memberships.some(
				(member) =>
					member.organizationId !== targetOrganizationId ||
					member.role !== "owner",
			) ||
			memberships.length > 1
		)
			throw new Error("Owner membership conflicts with isolated provisioning");
		const fingerprint = createHash("sha256")
			.update(
				JSON.stringify({
					organizations,
					profiles,
					memberships,
					ownerEmail,
					ownerId,
					ownerName,
					targetName,
					targetOrganizationId,
				}),
			)
			.digest("hex");
		const plan = {
			fingerprint,
			createProfile: !profiles.length,
			createOrganization: !target,
			createMembership: !memberships.length,
			ownerId,
			targetOrganizationId,
			authenticationGranted: false,
		};
		if (apply) {
			if (options.expectedPlanHash !== fingerprint)
				throw new Error(
					"Reviewed bootstrap fingerprint does not match current data",
				);
			if (!profiles.length)
				await rows(
					"INSERT INTO users (id,name,email,emailVerified,activeOrganizationId,defaultOrgId,onboardingSteps) VALUES (?, ?, ?, NULL, ?, ?, ?)",
					[
						ownerId,
						ownerName,
						ownerEmail,
						targetOrganizationId,
						targetOrganizationId,
						JSON.stringify({
							organizationSetup: true,
							customDomain: true,
							inviteTeam: true,
						}),
					],
				);
			if (!target)
				await rows(
					"INSERT INTO organizations (id,name,ownerId,settings,allowedEmailDomain) VALUES (?, ?, ?, ?, ?)",
					[
						targetOrganizationId,
						targetName,
						ownerId,
						source.settings
							? JSON.stringify(
									typeof source.settings === "string"
										? JSON.parse(source.settings)
										: source.settings,
								)
							: null,
						source.allowedEmailDomain,
					],
				);
			if (!memberships.length)
				await rows(
					"INSERT INTO organization_members (id,userId,organizationId,role) VALUES (?, ?, ?, 'owner')",
					[
						randomBytes(8).toString("hex").slice(0, 15),
						ownerId,
						targetOrganizationId,
					],
				);
			await connection.commit();
		} else {
			rollbackAttempted = true;
			await connection.rollback();
		}
		return plan;
	} catch (error) {
		if (!rollbackAttempted) await connection.rollback().catch(() => {});
		throw error;
	}
}
