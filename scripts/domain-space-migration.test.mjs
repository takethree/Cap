import assert from "node:assert/strict";
import { test } from "node:test";
import { migrateDomainSpace } from "./domain-space-migration.mjs";

const options = {
	organizationId: "org-1",
	spaceId: "space-1",
	spaceName: "Customer",
	creatorId: "admin-1",
	domain: "customer.example",
};
function fixture({
	target = [],
	existing = false,
	sourceRole = "member",
} = {}) {
	const calls = [];
	const connection = {
		query: async (sql) => {
			calls.push(sql);
		},
		commit: async () => {
			calls.push("COMMIT");
		},
		rollback: async () => {
			calls.push("ROLLBACK");
		},
		execute: async (sql, params) => {
			calls.push(sql);
			if (sql.startsWith("SELECT id FROM organizations"))
				return [[{ id: "org-1" }]];
			if (sql.startsWith("SELECT u.id")) return [[{ id: "admin-1" }]];
			if (sql.startsWith("SELECT id, name")) return [target];
			if (sql.startsWith("SELECT id, createdById FROM spaces"))
				return [[{ id: "source-1" }]];
			if (sql.startsWith("SELECT DISTINCT"))
				return [[{ id: "user-1" }, { id: "user-2" }]];
			if (sql.startsWith("SELECT id, role"))
				return [[{ id: "membership-1", role: sourceRole }]];
			if (sql.startsWith("SELECT id FROM space_members"))
				return [existing ? [{ id: params[1] }] : []];
			if (sql.startsWith("SELECT COUNT")) return [[{ count: 2 }]];
			return [{}];
		},
	};
	return { connection, calls };
}
test("default dry-run is read-only and reports residual organization access", async () => {
	const { connection, calls } = fixture();
	const plan = await migrateDomainSpace(connection, options);
	assert.equal(plan.addMembers, 2);
	assert.equal(plan.isolationVerified, false);
	assert.equal(plan.organizationSharedVideos, 2);
	assert.equal(calls[0], "START TRANSACTION READ ONLY");
	assert.equal(
		calls.some((sql) => /^(INSERT|DELETE|UPDATE)/.test(sql)),
		false,
	);
});
test("apply creates a private space and two member assignments", async () => {
	const { connection, calls } = fixture();
	await migrateDomainSpace(connection, { ...options, apply: true });
	assert.equal(
		calls.filter((sql) => sql.startsWith("INSERT INTO spaces")).length,
		1,
	);
	assert.equal(
		calls.filter((sql) => sql.startsWith("INSERT INTO space_members")).length,
		2,
	);
	assert.equal(calls.at(-1), "COMMIT");
});
test("rerun preserves existing membership roles and creates nothing", async () => {
	const { connection, calls } = fixture({
		target: [
			{
				id: "space-1",
				name: "Customer",
				organizationId: "org-1",
				privacy: "Private",
				public: 0,
			},
		],
		existing: true,
	});
	const plan = await migrateDomainSpace(connection, {
		...options,
		apply: true,
	});
	assert.equal(plan.createSpace, false);
	assert.equal(plan.addMembers, 0);
	assert.equal(
		calls.some((sql) => sql.startsWith("INSERT")),
		false,
	);
});
test("rejects target collision and rolls back without mutation", async () => {
	const { connection, calls } = fixture({ target: [{ id: "foreign" }] });
	await assert.rejects(
		migrateDomainSpace(connection, { ...options, apply: true }),
		/Target must match/,
	);
	assert.equal(calls.at(-1), "ROLLBACK");
	assert.equal(
		calls.some((sql) => sql.startsWith("INSERT")),
		false,
	);
});
test("rejects synthetic org entry as a source", async () => {
	const { connection } = fixture();
	await assert.rejects(
		migrateDomainSpace(connection, { ...options, sourceSpaceIds: ["org-1"] }),
	);
});
test("requires an explicit decision for source admins", async () => {
	const { connection, calls } = fixture({ sourceRole: "admin" });
	await assert.rejects(
		migrateDomainSpace(connection, {
			...options,
			apply: true,
			sourceSpaceIds: ["source-1"],
		}),
		/separate decision/,
	);
	assert.equal(
		calls.some((sql) => sql.startsWith("INSERT")),
		false,
	);
});
