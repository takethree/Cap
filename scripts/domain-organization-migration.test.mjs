import assert from "node:assert/strict";
import { test } from "node:test";
import { migrateDomainOrganization } from "./domain-organization-migration.mjs";

const options = {
	domain: "customer.example",
	sourceOrganizationId: "source-org",
	targetOrganizationId: "target-org",
	targetName: "Customer",
	ownerId: "user-1",
	expectedUserIds: ["user-1"],
	expectedVideoIds: ["video-1"],
	publicLinkPolicy: "preserve",
};
function connection() {
	const writes = [];
	const transactions = [];
	return {
		writes,
		transactions,
		async query(sql) {
			transactions.push(sql);
		},
		async commit() {
			transactions.push("COMMIT");
		},
		async rollback() {
			transactions.push("ROLLBACK");
		},
		async execute(sql, params) {
			if (!sql.startsWith("SELECT")) {
				writes.push({ sql, params });
				return [{ affectedRows: 1 }];
			}
			if (sql.includes("FROM organizations WHERE id IN"))
				return [
					[
						{
							id: "source-org",
							name: "Source",
							ownerId: "staff-1",
							settings: null,
							allowedEmailDomain: null,
							tombstoneAt: null,
						},
					],
				];
			if (sql.includes("FROM users u"))
				return [
					[
						{
							id: "user-1",
							email: "one@customer.example",
							sourceRole: "member",
							targetRole: null,
							customBucket: null,
						},
					],
				];
			if (sql.includes("FROM videos WHERE ownerId"))
				return [
					[
						{
							id: "video-1",
							name: "Recording",
							ownerId: "user-1",
							orgId: "source-org",
							public: 1,
							folderId: null,
							bucket: null,
							storageIntegrationId: null,
						},
					],
				];
			return [[]];
		},
	};
}
test("dry run opens a read-only transaction and performs no writes", async () => {
	const db = connection();
	const plan = await migrateDomainOrganization(db, options);
	assert.deepEqual(plan.blockers, []);
	assert.deepEqual(db.transactions, [
		"START TRANSACTION READ ONLY",
		"ROLLBACK",
	]);
	assert.deepEqual(db.writes, []);
});
test("apply rejects stale review before any mutation", async () => {
	const db = connection();
	await assert.rejects(
		migrateDomainOrganization(db, {
			...options,
			apply: true,
			expectedPlanHash: "stale",
		}),
		/fingerprint/,
	);
	assert.deepEqual(db.writes, []);
	assert.deepEqual(db.transactions, ["START TRANSACTION", "ROLLBACK"]);
});
test("reviewed apply moves only inventoried content and commits", async () => {
	const plan = await migrateDomainOrganization(connection(), options);
	const db = connection();
	await migrateDomainOrganization(db, {
		...options,
		apply: true,
		expectedPlanHash: plan.fingerprint,
	});
	assert.equal(db.writes.length, 5);
	assert.deepEqual(db.writes.at(-1).params, [
		"target-org",
		"video-1",
		"source-org",
	]);
	assert.equal(db.transactions.at(-1), "COMMIT");
});
test("failed mutation rolls back the transaction", async () => {
	const plan = await migrateDomainOrganization(connection(), options);
	const db = connection();
	const execute = db.execute;
	db.execute = async (sql, params) => {
		if (sql.startsWith("UPDATE videos")) throw new Error("write failed");
		return execute(sql, params);
	};
	await assert.rejects(
		migrateDomainOrganization(db, {
			...options,
			apply: true,
			expectedPlanHash: plan.fingerprint,
		}),
		/write failed/,
	);
	assert.equal(db.transactions.at(-1), "ROLLBACK");
	assert.ok(!db.transactions.includes("COMMIT"));
});
test("rollback failure preserves the original apply error", async () => {
	const db = connection();
	db.rollback = async () => {
		throw new Error("connection lost");
	};
	await assert.rejects(
		migrateDomainOrganization(db, {
			...options,
			apply: true,
			expectedPlanHash: "stale",
		}),
		/fingerprint/,
	);
});
test("failed dry-run rollback is not retried", async () => {
	const db = connection();
	let attempts = 0;
	db.rollback = async () => {
		attempts++;
		throw new Error("connection lost");
	};
	await assert.rejects(
		migrateDomainOrganization(db, options),
		/connection lost/,
	);
	assert.equal(attempts, 1);
});
