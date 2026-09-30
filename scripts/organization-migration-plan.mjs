import { createHash } from "node:crypto";

export function planOrganizationMigration(snapshot, options) {
	const {
		sourceOrganizationId,
		targetOrganizationId,
		targetName,
		ownerId,
		expectedUserIds,
		expectedVideoIds,
	} = options;
	if (
		sourceOrganizationId === targetOrganizationId ||
		!sourceOrganizationId ||
		!targetOrganizationId ||
		!targetName
	)
		throw new Error("Distinct source and target organizations are required");
	const blockers = [];
	const matchedIds = snapshot.users.map((user) => user.id).sort();
	const equalIds = (actual, expected) =>
		Array.isArray(expected) &&
		JSON.stringify([...new Set(expected)].sort()) ===
			JSON.stringify([...new Set(actual)].sort());
	if (!equalIds(matchedIds, expectedUserIds))
		blockers.push("Review and supply the exact user inventory");
	if (!ownerId || !matchedIds.includes(ownerId))
		blockers.push(
			"An explicitly approved owner from the target domain is required",
		);
	if (
		snapshot.target &&
		(snapshot.target.name !== targetName ||
			snapshot.target.ownerId !== ownerId ||
			snapshot.target.tombstoneAt)
	)
		blockers.push(
			"Existing target organization does not match the approved identity and owner",
		);
	if (
		snapshot.targetMembers.some((member) => !matchedIds.includes(member.userId))
	)
		blockers.push(
			"Target contains additional members; review their access explicitly",
		);
	if (
		snapshot.users.some(
			(user) =>
				user.targetRole &&
				user.targetRole !== (user.id === ownerId ? "owner" : "member"),
		)
	)
		blockers.push(
			"Existing target roles differ from the approved owner and members",
		);
	if (
		snapshot.users.some(
			(user) => user.sourceRole && user.sourceRole !== "member",
		)
	)
		blockers.push("Source administrators cannot be migrated automatically");
	if (snapshot.users.some((user) => user.id === snapshot.source.ownerId))
		blockers.push("Source organization owner cannot be migrated");
	if (snapshot.otherMemberships.length)
		blockers.push(
			"Additional organization memberships require an explicit decision",
		);
	if (
		snapshot.assets.some(
			(video) =>
				![sourceOrganizationId, targetOrganizationId].includes(video.orgId),
		)
	)
		blockers.push(
			"Owned videos in additional organizations require a separate plan",
		);
	if (
		!equalIds(
			snapshot.assets.map((video) => video.id),
			expectedVideoIds,
		)
	)
		blockers.push("Review and supply the exact owned-video inventory");
	if (
		snapshot.assets.some(
			(video) => video.folderId || video.bucket || video.storageIntegrationId,
		)
	)
		blockers.push(
			"Folder or custom-storage attachments require a separate data-preserving plan",
		);
	if (
		snapshot.users.some((user) => user.customBucket) ||
		snapshot.assetSpaceShares.length
	)
		blockers.push(
			"Custom user buckets or video space shares require a separate plan",
		);
	if (
		snapshot.folders.length ||
		snapshot.storage.length ||
		snapshot.spaceMemberships.length ||
		snapshot.createdSpaces.length ||
		snapshot.notifications.length
	)
		blockers.push(
			"Attached folders, storage, spaces or notifications require a separate plan",
		);
	if (snapshot.invites.length)
		blockers.push("Pending source invitations must be reconciled explicitly");
	if (
		snapshot.assetShares.some(
			(share) =>
				share.folderId ||
				![sourceOrganizationId, targetOrganizationId].includes(
					share.organizationId,
				),
		)
	)
		blockers.push(
			"Owned-video folder shares or additional organization shares require a separate plan",
		);
	if (options.publicLinkPolicy !== "preserve")
		blockers.push(
			"Confirm whether public links remain public; restrictive link enforcement is not implemented by this migration",
		);
	const fingerprint = createHash("sha256")
		.update(
			JSON.stringify({
				snapshot,
				options: {
					sourceOrganizationId,
					targetOrganizationId,
					targetName,
					ownerId,
					expectedUserIds,
					expectedVideoIds,
					publicLinkPolicy: options.publicLinkPolicy,
				},
			}),
		)
		.digest("hex");
	return {
		fingerprint,
		blockers,
		createOrganization: !snapshot.target,
		users: snapshot.users.map((user) => ({
			id: user.id,
			email: user.email,
			sourceRole: user.sourceRole,
			targetRole: user.targetRole,
		})),
		videos: snapshot.assets.map((video) => ({
			id: video.id,
			name: video.name,
			ownerId: video.ownerId,
			fromOrganizationId: video.orgId,
			toOrganizationId: targetOrganizationId,
			public: video.public,
		})),
		moveVideoIds: snapshot.assets
			.filter((video) => video.orgId === sourceOrganizationId)
			.map((video) => video.id),
		moveShareIds: snapshot.assetShares
			.filter((share) => share.organizationId === sourceOrganizationId)
			.map((share) => share.id),
		preservePublicLinks: true,
		isolationVerified: false,
	};
}
