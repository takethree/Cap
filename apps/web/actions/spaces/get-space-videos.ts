"use server";

import { db } from "@cap/database";
import { getCurrentUser } from "@cap/database/auth/session";
import { sharedVideos, spaceVideos, videos } from "@cap/database/schema";
import type { Space } from "@cap/web-domain";
import { and, eq, isNull } from "drizzle-orm";
import { requireOrganizationAccess } from "@/actions/organization/authorization";
import { getSpaceAccess } from "@/actions/organization/space-authorization";

export async function getSpaceVideoIds(spaceId: Space.SpaceIdOrOrganisationId) {
	try {
		const user = await getCurrentUser();

		if (!user || !user.id) {
			throw new Error("Unauthorized");
		}

		if (!spaceId) {
			throw new Error("Space ID is required");
		}

		const isAllSpacesEntry = user.activeOrganizationId === spaceId;
		let organizationId = user.activeOrganizationId;
		if (isAllSpacesEntry) {
			await requireOrganizationAccess(user.id, spaceId);
		} else {
			const access = await getSpaceAccess(user.id, spaceId);
			if (!access || (!access.spaceRole && !access.canManage))
				throw new Error("Forbidden");
			organizationId = access.organizationId;
		}

		const videoIds = isAllSpacesEntry
			? await db()
					.select({
						videoId: sharedVideos.videoId,
					})
					.from(sharedVideos)
					.innerJoin(videos, eq(sharedVideos.videoId, videos.id))
					.where(
						and(
							eq(sharedVideos.organizationId, spaceId),
							eq(videos.orgId, organizationId),
							isNull(sharedVideos.folderId),
						),
					)
			: await db()
					.select({
						videoId: spaceVideos.videoId,
					})
					.from(spaceVideos)
					.innerJoin(videos, eq(spaceVideos.videoId, videos.id))
					.where(
						and(
							eq(spaceVideos.spaceId, spaceId),
							eq(videos.orgId, organizationId),
							isNull(spaceVideos.folderId),
						),
					);

		return {
			success: true,
			data: videoIds.map((v) => v.videoId),
		};
	} catch (error) {
		console.error("Error fetching space video IDs:", error);
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to fetch space videos",
		};
	}
}
