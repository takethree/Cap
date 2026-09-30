import { randomBytes } from "node:crypto";
import { planOrganizationMigration } from "./organization-migration-plan.mjs";

const nanoId = () => randomBytes(8).toString("hex").slice(0, 15);

export async function migrateDomainOrganization(connection, options) {
	const {
		sourceOrganizationId,
		targetOrganizationId,
		targetName,
		ownerId,
		apply = false,
	} = options;
	const domain = options.domain?.trim().toLowerCase();
	if (
		!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain ?? "") ||
		![sourceOrganizationId, targetOrganizationId].every(
			(id) => typeof id === "string" && /^[a-zA-Z0-9-]{1,15}$/.test(id),
		) ||
		sourceOrganizationId === targetOrganizationId ||
		typeof targetName !== "string" ||
		!targetName.trim() ||
		targetName.length > 255
	)
		throw new Error(
			"Explicit valid source, target, name and domain are required",
		);
	const rows = async (sql, params = []) =>
		(await connection.execute(sql, params))[0];
	const lock = apply ? " FOR UPDATE" : "";
	await connection.query(
		apply ? "START TRANSACTION" : "START TRANSACTION READ ONLY",
	);
	try {
		const organizations = await rows(
			`SELECT id, name, ownerId, settings, allowedEmailDomain, tombstoneAt FROM organizations WHERE id IN (?, ?) ORDER BY id${lock}`,
			[sourceOrganizationId, targetOrganizationId],
		);
		const source = organizations.find(
			(org) => org.id === sourceOrganizationId && !org.tombstoneAt,
		);
		if (!source) throw new Error("Active source organization not found");
		const target =
			organizations.find((org) => org.id === targetOrganizationId) ?? null;
		const collisions = await rows(
			"SELECT id FROM organizations WHERE name = ? AND id <> ? AND tombstoneAt IS NULL",
			[targetName, targetOrganizationId],
		);
		if (collisions.length)
			throw new Error("Ambiguous target organization name");
		const users = await rows(
			`SELECT u.id, u.email, u.activeOrganizationId, u.defaultOrgId, u.customBucket, sm.role sourceRole, tm.role targetRole FROM users u LEFT JOIN organization_members sm ON sm.userId = u.id AND sm.organizationId = ? LEFT JOIN organization_members tm ON tm.userId = u.id AND tm.organizationId = ? WHERE LOWER(SUBSTRING_INDEX(u.email, '@', -1)) = ? ORDER BY u.id${lock}`,
			[sourceOrganizationId, targetOrganizationId, domain],
		);
		if (new Set(users.map((user) => user.id)).size !== users.length)
			throw new Error(
				"Duplicate organization memberships require reconciliation",
			);
		const targetMembers = await rows(
			`SELECT userId, role FROM organization_members WHERE organizationId = ? ORDER BY userId${lock}`,
			[targetOrganizationId],
		);
		const snapshot = {
			source,
			target,
			users,
			targetMembers,
			otherMemberships: [],
			assets: [],
			assetShares: [],
			assetSpaceShares: [],
			folders: [],
			storage: [],
			spaceMemberships: [],
			createdSpaces: [],
			notifications: [],
			invites: [],
		};
		if (users.length) {
			const userIds = users.map((user) => user.id);
			const placeholders = userIds.map(() => "?").join(",");
			snapshot.otherMemberships = await rows(
				`SELECT userId, organizationId FROM organization_members WHERE userId IN (${placeholders}) AND organizationId NOT IN (?, ?) ORDER BY userId, organizationId${lock}`,
				[...userIds, sourceOrganizationId, targetOrganizationId],
			);
			snapshot.assets = await rows(
				`SELECT id, name, ownerId, orgId, public, folderId, bucket, storageIntegrationId FROM videos WHERE ownerId IN (${placeholders}) ORDER BY id${lock}`,
				userIds,
			);
			snapshot.folders = await rows(
				`SELECT id FROM folders WHERE createdById IN (${placeholders}) ORDER BY id${lock}`,
				userIds,
			);
			snapshot.storage = await rows(
				`SELECT id FROM storage_integrations WHERE ownerId IN (${placeholders}) ORDER BY id${lock}`,
				userIds,
			);
			snapshot.spaceMemberships = await rows(
				`SELECT sm.id FROM space_members sm JOIN spaces s ON s.id = sm.spaceId WHERE sm.userId IN (${placeholders}) AND s.organizationId = ? ORDER BY sm.id${lock}`,
				[...userIds, sourceOrganizationId],
			);
			snapshot.createdSpaces = await rows(
				`SELECT id FROM spaces WHERE createdById IN (${placeholders}) AND organizationId = ? ORDER BY id${lock}`,
				[...userIds, sourceOrganizationId],
			);
			snapshot.invites = await rows(
				`SELECT id FROM organization_invites WHERE organizationId = ? AND LOWER(SUBSTRING_INDEX(invitedEmail, '@', -1)) = ? AND status = 'pending' ORDER BY id${lock}`,
				[sourceOrganizationId, domain],
			);
			if (snapshot.assets.length) {
				const videoIds = snapshot.assets.map((video) => video.id);
				const videoPlaceholders = videoIds.map(() => "?").join(",");
				snapshot.assetShares = await rows(
					`SELECT id, videoId, organizationId, folderId FROM shared_videos WHERE videoId IN (${videoPlaceholders}) ORDER BY id${lock}`,
					videoIds,
				);
				snapshot.assetSpaceShares = await rows(
					`SELECT id FROM space_videos WHERE videoId IN (${videoPlaceholders}) ORDER BY id${lock}`,
					videoIds,
				);
				snapshot.notifications = await rows(
					`SELECT id FROM notifications WHERE videoId IN (${videoPlaceholders}) ORDER BY id${lock}`,
					videoIds,
				);
			}
		}
		const plan = planOrganizationMigration(snapshot, options);
		if (apply) {
			if (plan.blockers.length)
				throw new Error(`Migration blocked: ${plan.blockers.join("; ")}`);
			if (options.expectedPlanHash !== plan.fingerprint)
				throw new Error(
					"Reviewed dry-run fingerprint does not match current data",
				);
			if (!target)
				await rows(
					"INSERT INTO organizations (id, name, ownerId, settings, allowedEmailDomain) VALUES (?, ?, ?, ?, ?)",
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
			for (const user of users) {
				if (!user.targetRole)
					await rows(
						"INSERT INTO organization_members (id, userId, organizationId, role) VALUES (?, ?, ?, ?)",
						[
							nanoId(),
							user.id,
							targetOrganizationId,
							user.id === ownerId ? "owner" : "member",
						],
					);
				await rows(
					"UPDATE users SET activeOrganizationId = ?, defaultOrgId = ? WHERE id = ?",
					[targetOrganizationId, targetOrganizationId, user.id],
				);
				await rows(
					"DELETE FROM organization_members WHERE userId = ? AND organizationId = ? AND role = 'member'",
					[user.id, sourceOrganizationId],
				);
			}
			for (const videoId of plan.moveVideoIds)
				await rows("UPDATE videos SET orgId = ? WHERE id = ? AND orgId = ?", [
					targetOrganizationId,
					videoId,
					sourceOrganizationId,
				]);
			for (const shareId of plan.moveShareIds)
				await rows(
					"UPDATE shared_videos SET organizationId = ? WHERE id = ? AND organizationId = ?",
					[targetOrganizationId, shareId, sourceOrganizationId],
				);
			await connection.commit();
		} else await connection.rollback();
		return plan;
	} catch (error) {
		await connection.rollback();
		throw error;
	}
}
