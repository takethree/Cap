import * as Db from "@cap/database/schema";
import type { Space, User, Video } from "@cap/web-domain";
import * as Dz from "drizzle-orm";
import { Array, Effect } from "effect";

import { Database } from "../Database.ts";

export class SpacesRepo extends Effect.Service<SpacesRepo>()("SpacesRepo", {
	effect: Effect.gen(function* () {
		const db = yield* Database;

		return {
			membershipForVideo: (userId: User.UserId, videoId: Video.VideoId) =>
				db
					.use((db) =>
						db
							.select({ membershipId: Db.spaceMembers.id })
							.from(Db.spaceMembers)
							.leftJoin(
								Db.spaceVideos,
								Dz.eq(Db.spaceMembers.spaceId, Db.spaceVideos.spaceId),
							)
							.innerJoin(Db.spaces, Dz.eq(Db.spaces.id, Db.spaceVideos.spaceId))
							.innerJoin(
								Db.videos,
								Dz.and(
									Dz.eq(Db.videos.id, Db.spaceVideos.videoId),
									Dz.eq(Db.videos.orgId, Db.spaces.organizationId),
								),
							)
							.innerJoin(
								Db.organizations,
								Dz.eq(Db.organizations.id, Db.spaces.organizationId),
							)
							.leftJoin(
								Db.organizationMembers,
								Dz.and(
									Dz.eq(
										Db.organizationMembers.organizationId,
										Db.spaces.organizationId,
									),
									Dz.eq(Db.organizationMembers.userId, userId),
								),
							)
							.where(
								Dz.and(
									Dz.eq(Db.spaceMembers.userId, userId),
									Dz.eq(Db.spaceVideos.videoId, videoId),
									Dz.or(
										Dz.eq(Db.organizations.ownerId, userId),
										Dz.eq(Db.organizationMembers.userId, userId),
									),
								),
							),
					)
					.pipe(Effect.map(Array.get(0))),

			passwordsForVideo: (videoId: Video.VideoId) =>
				db.use((db) =>
					db
						.select({
							id: Db.spaces.id,
							name: Db.spaces.name,
							password: Db.spaces.password,
						})
						.from(Db.spaceVideos)
						.innerJoin(Db.spaces, Dz.eq(Db.spaceVideos.spaceId, Db.spaces.id))
						.where(Dz.eq(Db.spaceVideos.videoId, videoId)),
				),

			membership: (
				userId: User.UserId,
				spaceId: Space.SpaceIdOrOrganisationId,
			) =>
				db
					.use((db) =>
						db
							.select({
								membershipId: Db.spaceMembers.id,
								role: Db.spaceMembers.role,
							})
							.from(Db.spaceMembers)
							.where(
								Dz.and(
									Dz.eq(Db.spaceMembers.userId, userId),
									Dz.eq(Db.spaceMembers.spaceId, spaceId),
								),
							),
					)
					.pipe(Effect.map(Array.get(0))),

			getById: (spaceId: Space.SpaceIdOrOrganisationId) =>
				db
					.use((db) =>
						db.select().from(Db.spaces).where(Dz.eq(Db.spaces.id, spaceId)),
					)
					.pipe(Effect.map(Array.get(0))),
		};
	}),
	dependencies: [Database.Default],
}) {}
