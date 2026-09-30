import assert from "node:assert/strict";
import { test } from "node:test";
import { planOrganizationMigration } from "./organization-migration-plan.mjs";

const options = {
	sourceOrganizationId: "source-org",
	targetOrganizationId: "target-org",
	targetName: "Customer",
	ownerId: "user-1",
	expectedUserIds: ["user-1", "user-2"],
	expectedVideoIds: ["video-1"],
	publicLinkPolicy: "preserve",
};
const snapshot = () => ({
	source: { id: "source-org", ownerId: "staff-1" },
	target: null,
	users: [
		{ id: "user-1", email: "one@customer.example", sourceRole: "member" },
		{ id: "user-2", email: "two@customer.example", sourceRole: "member" },
	],
	targetMembers: [],
	otherMemberships: [],
	assets: [
		{
			id: "video-1",
			name: "Owned recording",
			ownerId: "user-1",
			orgId: "source-org",
			public: 1,
			folderId: null,
			bucket: null,
			storageIntegrationId: null,
		},
	],
	assetShares: [],
	assetSpaceShares: [],
	folders: [],
	storage: [],
	spaceMemberships: [],
	createdSpaces: [],
	notifications: [],
	invites: [],
});
test("plans only the explicitly inventoried owned video, preserving public status", () => {
	const plan = planOrganizationMigration(snapshot(), options);
	assert.deepEqual(plan.blockers, []);
	assert.deepEqual(plan.moveVideoIds, ["video-1"]);
	assert.deepEqual(plan.moveShareIds, []);
	assert.equal(plan.videos[0].public, 1);
	assert.equal(plan.isolationVerified, false);
});
test("requires an explicit owner and public-link decision", () => {
	const plan = planOrganizationMigration(snapshot(), {
		...options,
		ownerId: undefined,
		publicLinkPolicy: undefined,
	});
	assert.equal(plan.blockers.length, 2);
});
test("rejects inventory drift and additional organization memberships", () => {
	const data = snapshot();
	data.assets.push({ ...data.assets[0], id: "unexpected" });
	data.otherMemberships.push({ userId: "user-1", organizationId: "other-org" });
	assert.equal(planOrganizationMigration(data, options).blockers.length, 2);
});
test("blocks attached folder, storage, space shares and source admins", () => {
	const data = snapshot();
	data.users[0].sourceRole = "admin";
	data.assets[0].folderId = "folder-1";
	data.assetSpaceShares.push({ id: "space-share" });
	assert.equal(planOrganizationMigration(data, options).blockers.length, 3);
});
test("rerun against a completed migration moves no content or share rows", () => {
	const data = snapshot();
	data.target = { name: "Customer", ownerId: "user-1", tombstoneAt: null };
	data.assets[0].orgId = "target-org";
	for (const user of data.users) {
		user.sourceRole = null;
		user.targetRole = user.id === "user-1" ? "owner" : "member";
	}
	const plan = planOrganizationMigration(data, options);
	assert.deepEqual(plan.blockers, []);
	assert.equal(plan.createOrganization, false);
	assert.deepEqual(plan.moveVideoIds, []);
});
test("a changed public flag changes the reviewed fingerprint", () => {
	const data = snapshot();
	const before = planOrganizationMigration(data, options).fingerprint;
	data.assets[0].public = 0;
	assert.notEqual(planOrganizationMigration(data, options).fingerprint, before);
});
