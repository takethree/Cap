import { randomBytes } from "node:crypto";

const nanoId = () => randomBytes(8).toString("hex").slice(0, 15);

export async function migrateDomainSpace(connection, options) {
	const {
		organizationId,
		spaceId,
		spaceName,
		creatorId,
		apply = false,
	} = options;
	const domain = options.domain?.trim().toLowerCase();
	if (
		options.sourceSpaceIds !== undefined &&
		!Array.isArray(options.sourceSpaceIds)
	) {
		throw new Error("sourceSpaceIds must be an array");
	}
	const sourceSpaceIds = [...new Set(options.sourceSpaceIds ?? [])];
	if (
		![organizationId, spaceId, spaceName, creatorId].every(
			(value) => typeof value === "string" && value.trim(),
		) ||
		![organizationId, spaceId, creatorId, ...sourceSpaceIds].every(
			(value) =>
				typeof value === "string" && /^[a-zA-Z0-9-]{1,15}$/.test(value),
		) ||
		spaceName.length > 255 ||
		!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain ?? "") ||
		sourceSpaceIds.includes(spaceId) ||
		sourceSpaceIds.includes(organizationId)
	) {
		throw new Error(
			"Explicit organization, space, creator, domain and distinct real source spaces are required",
		);
	}
	const rows = async (sql, params = []) => {
		const [result] = await connection.execute(sql, params);
		return result;
	};
	await connection.query(
		apply ? "START TRANSACTION" : "START TRANSACTION READ ONLY",
	);
	try {
		const [org] = await rows(
			`SELECT id FROM organizations WHERE id = ? AND tombstoneAt IS NULL${apply ? " FOR UPDATE" : ""}`,
			[organizationId],
		);
		if (!org) throw new Error("Active organization not found");
		const [creator] = await rows(
			"SELECT u.id FROM users u INNER JOIN organizations o ON o.id = ? LEFT JOIN organization_members m ON m.organizationId = o.id AND m.userId = u.id WHERE u.id = ? AND (o.ownerId = u.id OR m.role IN ('owner', 'admin'))",
			[organizationId, creatorId],
		);
		if (!creator)
			throw new Error("Creator must be an existing organization administrator");
		const targets = await rows(
			`SELECT id, name, organizationId, privacy, public FROM spaces WHERE id = ? OR (organizationId = ? AND name = ?)${apply ? " FOR UPDATE" : ""}`,
			[spaceId, organizationId, spaceName],
		);
		if (targets.length > 1) throw new Error("Ambiguous target space");
		const target = targets[0];
		if (
			target &&
			(target.id !== spaceId ||
				target.organizationId !== organizationId ||
				target.name !== spaceName ||
				target.privacy !== "Private" ||
				Number(target.public) !== 0)
		) {
			throw new Error(
				"Target must match the supplied ID, name, organization and private settings",
			);
		}
		const sources = [];
		for (const sourceId of sourceSpaceIds) {
			const [source] = await rows(
				`SELECT id, createdById FROM spaces WHERE id = ? AND organizationId = ?${apply ? " FOR UPDATE" : ""}`,
				[sourceId, organizationId],
			);
			if (!source)
				throw new Error("Source must be a real space in the same organization");
			sources.push(source);
		}
		const members = await rows(
			"SELECT DISTINCT u.id FROM users u INNER JOIN organization_members m ON m.userId = u.id WHERE m.organizationId = ? AND LOWER(SUBSTRING_INDEX(u.email, '@', -1)) = ? AND LENGTH(u.email) - LENGTH(REPLACE(u.email, '@', '')) = 1",
			[organizationId, domain],
		);
		const additions = [];
		const removals = [];
		for (const member of members) {
			if (sources.some((source) => source.createdById === member.id)) {
				throw new Error("Source creator access requires a separate decision");
			}
			const existing = await rows(
				"SELECT id FROM space_members WHERE spaceId = ? AND userId = ?",
				[spaceId, member.id],
			);
			if (existing.length === 0) additions.push(member.id);
			for (const sourceId of sourceSpaceIds) {
				const sourceMembers = await rows(
					`SELECT id, role FROM space_members WHERE spaceId = ? AND userId = ?${apply ? " FOR UPDATE" : ""}`,
					[sourceId, member.id],
				);
				if (sourceMembers.some((entry) => entry.role !== "member"))
					throw new Error(
						"Source admin membership requires a separate decision",
					);
				removals.push(...sourceMembers.map((entry) => entry.id));
			}
		}
		const [shared] = await rows(
			"SELECT COUNT(*) AS count FROM shared_videos WHERE organizationId = ?",
			[organizationId],
		);
		const [publicSpaces] = await rows(
			"SELECT COUNT(*) AS count FROM spaces WHERE organizationId = ? AND (privacy = 'Public' OR public = 1)",
			[organizationId],
		);
		const plan = {
			mode: apply ? "apply" : "dry-run",
			spaceId,
			createSpace: !target,
			matchedMembers: members.length,
			addMembers: additions.length,
			removeMemberships: removals.length,
			organizationSharedVideos: Number(shared.count),
			publicSpaces: Number(publicSpaces.count),
			isolationVerified: false,
		};
		if (apply) {
			if (!target)
				await rows(
					"INSERT INTO spaces (id, name, organizationId, createdById, privacy, public) VALUES (?, ?, ?, ?, 'Private', 0)",
					[spaceId, spaceName, organizationId, creatorId],
				);
			for (const userId of additions)
				await rows(
					"INSERT INTO space_members (id, spaceId, userId, role) VALUES (?, ?, ?, 'member') ON DUPLICATE KEY UPDATE id = id",
					[nanoId(), spaceId, userId],
				);
			for (const id of removals)
				await rows(
					"DELETE FROM space_members WHERE id = ? AND role = 'member'",
					[id],
				);
			await connection.commit();
		} else {
			await connection.rollback();
		}
		return plan;
	} catch (error) {
		await connection.rollback();
		throw error;
	}
}
