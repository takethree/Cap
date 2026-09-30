import {
	organizationInvites,
	organizationMembers,
	organizations,
	spaceMembers,
	users,
} from "@cap/database/schema";
import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getFirstIncompleteOnboardingStep } from "@/app/(org)/onboarding/[...steps]/layout";
import {
	DrizzleAdapter,
	getDefaultSignupOrganizationId,
} from "../../../../packages/database/auth/drizzle-adapter";

vi.mock("@cap/utils", () => ({
	STRIPE_AVAILABLE: () => false,
	stripe: vi.fn(),
}));

type Operation =
	| {
			kind: "insert";
			table: string;
			values: unknown;
	  }
	| {
			kind: "update";
			table: string;
			values: unknown;
	  };

const originalDefaultSignupOrganizationId =
	process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID;
const originalSpaceMap = process.env.CAP_SIGNUP_DOMAIN_SPACE_MAP;

afterEach(() => {
	if (originalSpaceMap === undefined)
		delete process.env.CAP_SIGNUP_DOMAIN_SPACE_MAP;
	else process.env.CAP_SIGNUP_DOMAIN_SPACE_MAP = originalSpaceMap;
	if (originalDefaultSignupOrganizationId === undefined) {
		delete process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID;
	} else {
		process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID =
			originalDefaultSignupOrganizationId;
	}
});

const tableName = (table: unknown) => {
	if (table === users) return "users";
	if (table === organizations) return "organizations";
	if (table === organizationMembers) return "organization_members";
	if (table === organizationInvites) return "organization_invites";
	if (table === spaceMembers) return "space_members";
	return "unknown";
};

function createMockDb(selectResults: unknown[][]) {
	const operations: Operation[] = [];
	const conditions: SQL[] = [];

	const makeApi = () => ({
		select: (_selection?: unknown) => ({
			from: (_table: unknown) => ({
				where: (condition: SQL) => {
					conditions.push(condition);
					return { limit: (_limit: number) => selectResults.shift() ?? [] };
				},
			}),
		}),
		insert: (table: unknown) => ({
			values: async (values: unknown) => {
				operations.push({ kind: "insert", table: tableName(table), values });
				return [{ affectedRows: 1 }];
			},
		}),
		update: (table: unknown) => ({
			set: (values: unknown) => ({
				where: async (_condition: unknown) => {
					operations.push({ kind: "update", table: tableName(table), values });
					return [{ affectedRows: 1 }];
				},
			}),
		}),
	});

	const api = {
		...makeApi(),
		transaction: async (
			callback: (tx: ReturnType<typeof makeApi>) => unknown,
		) => callback(makeApi()),
	};

	return { db: api as unknown as MySql2Database, operations, conditions };
}

const userRow = {
	id: "user-1",
	email: "new@take3tech.com",
	emailVerified: null,
	name: "New User",
	image: null,
	activeOrganizationId: "org-1",
	defaultOrgId: "org-1",
	onboardingSteps: null,
};

describe("Take Three signup organization membership", () => {
	it("assigns a matching domain to an existing private space as an ordinary member", async () => {
		process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID = "org-1";
		process.env.CAP_SIGNUP_DOMAIN_SPACE_MAP = '{"customer.example":"space-1"}';
		const { db, operations, conditions } = createMockDb([
			[],
			[{ id: "org-1" }],
			[{ id: "space-1" }],
			[userRow],
		]);
		await DrizzleAdapter(db).createUser?.({
			email: "New@Customer.Example",
			emailVerified: null,
			name: "User",
			image: null,
		});
		expect(
			operations.find((operation) => operation.table === "space_members")
				?.values,
		).toMatchObject({ spaceId: "space-1", role: "member" });
		expect(
			operations.some((operation) => operation.table === "organizations"),
		).toBe(false);
		const spaceGuard = new MySqlDialect().sqlToQuery(conditions[2] as SQL);
		expect(spaceGuard.sql).toContain("`spaces`.`organizationId` = ?");
		expect(spaceGuard.sql).toContain("`spaces`.`privacy` = ?");
		expect(spaceGuard.sql).toContain("`spaces`.`public` = ?");
		expect(spaceGuard.params).toEqual(["space-1", "org-1", "Private", false]);
	});

	it.each([null, "org-1"])(
		"fails mapped signup when the default organization is unavailable: %s",
		async (organizationId) => {
			if (organizationId)
				process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID = organizationId;
			else delete process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID;
			process.env.CAP_SIGNUP_DOMAIN_SPACE_MAP =
				'{"customer.example":"space-1"}';
			const { db, operations } = createMockDb([[], []]);
			await expect(
				DrizzleAdapter(db).createUser?.({
					email: "user@customer.example",
					emailVerified: null,
					name: "User",
					image: null,
				}),
			).rejects.toThrow();
			expect(
				operations.some(
					(operation) =>
						operation.table === "organizations" ||
						operation.table === "organization_members" ||
						operation.table === "space_members",
				),
			).toBe(false);
		},
	);

	it("leaves the internal domain path unchanged with routing configured", async () => {
		process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID = "org-1";
		process.env.CAP_SIGNUP_DOMAIN_SPACE_MAP = '{"customer.example":"space-1"}';
		const { db, operations } = createMockDb([[], [{ id: "org-1" }], [userRow]]);
		await DrizzleAdapter(db).createUser?.({
			email: userRow.email,
			emailVerified: null,
			name: "User",
			image: null,
		});
		expect(
			operations.some((operation) => operation.table === "space_members"),
		).toBe(false);
	});

	it("rejects a missing, foreign, or non-private configured space without adding organization membership", async () => {
		process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID = "org-1";
		process.env.CAP_SIGNUP_DOMAIN_SPACE_MAP = '{"customer.example":"space-1"}';
		const { db, operations } = createMockDb([[], [{ id: "org-1" }], []]);
		await expect(
			DrizzleAdapter(db).createUser?.({
				email: "new@customer.example",
				emailVerified: null,
				name: "User",
				image: null,
			}),
		).rejects.toThrow("Configured signup space");
		expect(
			operations.some(
				(operation) => operation.table === "organization_members",
			),
		).toBe(false);
	});

	it("preserves pending invite handling for mapped domains", async () => {
		process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID = "org-1";
		process.env.CAP_SIGNUP_DOMAIN_SPACE_MAP = '{"customer.example":"space-1"}';
		const { db, operations } = createMockDb([[{ id: "invite-1" }], [userRow]]);
		await DrizzleAdapter(db).createUser?.({
			email: "new@customer.example",
			emailVerified: null,
			name: "User",
			image: null,
		});
		expect(
			operations.some((operation) => operation.table === "space_members"),
		).toBe(false);
	});
	it("creates a personal organization when no default signup organization is configured", async () => {
		delete process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID;
		const { db, operations } = createMockDb([[], [userRow]]);
		const adapter = DrizzleAdapter(db);

		await adapter.createUser?.({
			email: "New@Take3Tech.com",
			emailVerified: null,
			name: "New User",
			image: null,
		});

		const organizationInsert = operations.find(
			(operation) =>
				operation.kind === "insert" && operation.table === "organizations",
		);
		expect(organizationInsert?.values).toMatchObject({
			name: "My Organization",
		});
	});

	it("adds the user to a valid configured organization without creating a personal organization", async () => {
		process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID = "take3-org";
		const { db, operations } = createMockDb([
			[],
			[{ id: "take3-org" }],
			[
				{
					...userRow,
					activeOrganizationId: "take3-org",
					defaultOrgId: "take3-org",
				},
			],
		]);
		const adapter = DrizzleAdapter(db);

		await adapter.createUser?.({
			email: "New@Take3Tech.com",
			emailVerified: null,
			name: "New User",
			image: null,
		});

		expect(
			operations.some(
				(operation) =>
					operation.kind === "insert" && operation.table === "organizations",
			),
		).toBe(false);
		const membershipInsert = operations.find(
			(operation) =>
				operation.kind === "insert" &&
				operation.table === "organization_members",
		);
		expect(membershipInsert?.values).toMatchObject({
			organizationId: "take3-org",
			role: "member",
		});

		const userUpdate = operations.find(
			(operation) => operation.kind === "update" && operation.table === "users",
		);
		expect(userUpdate?.values).toMatchObject({
			activeOrganizationId: "take3-org",
			defaultOrgId: "take3-org",
			onboardingSteps: {
				organizationSetup: true,
				customDomain: true,
				inviteTeam: true,
			},
		});
	});

	it("does not auto-join the configured organization when a pending invite exists", async () => {
		process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID = "take3-org";
		const { db, operations } = createMockDb([[{ id: "invite-1" }], [userRow]]);
		const adapter = DrizzleAdapter(db);

		await adapter.createUser?.({
			email: "New@Take3Tech.com",
			emailVerified: null,
			name: "New User",
			image: null,
		});

		expect(
			operations.some(
				(operation) =>
					operation.kind === "insert" &&
					operation.table === "organization_members",
			),
		).toBe(false);
		expect(
			operations.some(
				(operation) =>
					operation.kind === "insert" && operation.table === "organizations",
			),
		).toBe(false);
	});

	it("trims empty default signup organization configuration", () => {
		process.env.CAP_DEFAULT_SIGNUP_ORGANIZATION_ID = "  ";

		expect(getDefaultSignupOrganizationId()).toBeNull();
	});
});

describe("Take Three onboarding routing", () => {
	it("skips organization setup after organization onboarding flags are complete", () => {
		expect(
			getFirstIncompleteOnboardingStep({
				userName: "Michael",
				steps: {
					welcome: true,
					organizationSetup: true,
					customDomain: true,
					inviteTeam: true,
				},
			}),
		).toBe("download");
	});
});
