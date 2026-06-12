import {
	organizationInvites,
	organizationMembers,
	organizations,
	users,
} from "@cap/database/schema";
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

afterEach(() => {
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
	return "unknown";
};

function createMockDb(selectResults: unknown[][]) {
	const operations: Operation[] = [];

	const makeApi = () => ({
		select: (_selection?: unknown) => ({
			from: (_table: unknown) => ({
				where: (_condition: unknown) => ({
					limit: (_limit: number) => selectResults.shift() ?? [],
				}),
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

	return { db: api as unknown as MySql2Database, operations };
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
