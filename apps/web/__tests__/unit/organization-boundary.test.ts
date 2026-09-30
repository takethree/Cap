import type { Organisation, Space, User } from "@cap/web-domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock("@cap/database", () => ({
	db: () => {
		const query = {
			from: () => query,
			innerJoin: () => query,
			leftJoin: () => query,
			where: () =>
				Object.assign(Promise.resolve(fixture.rows), {
					limit: async () => fixture.rows,
				}),
			limit: async () => fixture.rows,
		};
		return { select: () => query };
	},
}));

import { assertUsersBelongToOrganization } from "@/actions/organization/authorization";
import { getSpaceAccess } from "@/actions/organization/space-authorization";

const userId = "customer-1" as User.UserId;
const organizationId = "customer-org" as Organisation.OrganisationId;
const spaceId = "customer-space" as Space.SpaceIdOrOrganisationId;
beforeEach(() => {
	fixture.rows = [];
});
describe("organization boundaries", () => {
	it("rejects stale space admin membership after organization membership removal", async () => {
		fixture.rows = [
			{
				id: spaceId,
				organizationId,
				ownerId: "other-owner",
				createdById: userId,
				organizationMemberRole: null,
				spaceMemberRole: "admin",
			},
		];
		expect(await getSpaceAccess(userId, spaceId)).toBeNull();
	});
	it("allows an organization member to retain their space role", async () => {
		fixture.rows = [
			{
				id: spaceId,
				organizationId,
				ownerId: "other-owner",
				createdById: "creator-1",
				organizationMemberRole: "member",
				spaceMemberRole: "member",
			},
		];
		const access = await getSpaceAccess(userId, spaceId);
		expect(access?.organizationRole).toBe("member");
		expect(access?.canManage).toBe(false);
	});
	it("allows the native organization owner without a separate membership row", async () => {
		fixture.rows = [
			{
				id: spaceId,
				organizationId,
				ownerId: userId,
				createdById: "creator-1",
				organizationMemberRole: null,
				spaceMemberRole: null,
			},
		];
		expect((await getSpaceAccess(userId, spaceId))?.canManage).toBe(true);
	});
	it("rejects adding an outsider as a space member", async () => {
		fixture.rows = [{ userId }];
		await expect(
			assertUsersBelongToOrganization(
				organizationId,
				"owner-1" as User.UserId,
				[userId, "outsider-1" as User.UserId],
			),
		).rejects.toThrow("must belong");
	});
	it("accepts native members and the owner without granting others access", async () => {
		fixture.rows = [{ userId }];
		await expect(
			assertUsersBelongToOrganization(
				organizationId,
				"owner-1" as User.UserId,
				[userId, "owner-1" as User.UserId],
			),
		).resolves.toBeUndefined();
	});
});
