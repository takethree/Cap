import assert from "node:assert/strict";
import { test } from "node:test";
import { bootstrapOrganizationOwner } from "./bootstrap-organization-owner.mjs";

const options = {
	sourceOrganizationId: "source-org",
	targetOrganizationId: "target-org",
	targetName: "Customer",
	ownerId: "owner-1",
	ownerName: "Owner",
	ownerEmail: "owner@customer.example",
};
function fixture(existing = false) {
	const writes = [];
	const transactions = [];
	return {
		writes,
		transactions,
		query: async (sql) => transactions.push(sql),
		commit: async () => transactions.push("COMMIT"),
		rollback: async () => transactions.push("ROLLBACK"),
		execute: async (sql, params) => {
			if (!sql.startsWith("SELECT")) {
				writes.push({ sql, params });
				return [{}];
			}
			if (sql.includes("FROM organizations WHERE id IN"))
				return [
					[
						{ id: "source-org", settings: null, allowedEmailDomain: null },
						...(existing
							? [{ id: "target-org", name: "Customer", ownerId: "owner-1" }]
							: []),
					],
				];
			if (sql.includes("FROM users"))
				return [
					existing
						? [
								{
									id: "owner-1",
									email: "owner@customer.example",
									activeOrganizationId: "target-org",
									defaultOrgId: "target-org",
								},
							]
						: [],
				];
			if (sql.includes("FROM organization_members"))
				return [
					existing ? [{ organizationId: "target-org", role: "owner" }] : [],
				];
			return [[]];
		},
	};
}
test("bootstrap dry run makes no writes or authentication grants", async () => {
	const db = fixture();
	const plan = await bootstrapOrganizationOwner(db, options);
	assert.equal(plan.authenticationGranted, false);
	assert.equal(db.writes.length, 0);
	assert.equal(db.transactions[0], "START TRANSACTION READ ONLY");
});
test("reviewed bootstrap creates only an unverified profile, organization and owner membership", async () => {
	const plan = await bootstrapOrganizationOwner(fixture(), options);
	const db = fixture();
	await bootstrapOrganizationOwner(db, {
		...options,
		apply: true,
		expectedPlanHash: plan.fingerprint,
	});
	assert.equal(db.writes.length, 3);
	assert.ok(db.writes[0].sql.includes("NULL"));
	assert.ok(
		db.writes.every(
			(write) => !/(accounts|sessions|verification_tokens)/.test(write.sql),
		),
	);
	assert.equal(db.transactions.at(-1), "COMMIT");
});
test("repeated bootstrap does not recreate or update any records", async () => {
	const plan = await bootstrapOrganizationOwner(fixture(true), options);
	const db = fixture(true);
	await bootstrapOrganizationOwner(db, {
		...options,
		apply: true,
		expectedPlanHash: plan.fingerprint,
	});
	assert.equal(db.writes.length, 0);
});
test("bootstrap rejects stale fingerprint before writes", async () => {
	const db = fixture();
	await assert.rejects(
		bootstrapOrganizationOwner(db, {
			...options,
			apply: true,
			expectedPlanHash: "stale",
		}),
		/fingerprint/,
	);
	assert.equal(db.writes.length, 0);
});
test("bootstrap rejects conflicting profile identity", async () => {
	await assert.rejects(
		bootstrapOrganizationOwner(fixture(true), {
			...options,
			ownerId: "different",
		}),
		/profile|identity/,
	);
});
