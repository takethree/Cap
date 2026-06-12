import { Organisation } from "@cap/web-domain";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	parseAutoJoinOrganizationRules,
	resolveAutoJoinOrganizationIdForEmail,
	resolveNewUserOrganizationPlan,
	shouldAutoShareVideoToOrganization,
	shouldCreateOrganizationRootShare,
} from "../../../../packages/database/auth/domain-utils";

const envMock = vi.hoisted(() => ({
	autoJoinRules: "",
}));

vi.mock("@cap/env", () => ({
	serverEnv: () => ({
		CAP_AUTO_JOIN_ORGANIZATION_RULES: envMock.autoJoinRules,
	}),
}));

vi.mock("@cap/utils", () => ({
	STRIPE_AVAILABLE: () => false,
	stripe: vi.fn(),
}));

type QueryChain = {
	from: ReturnType<typeof vi.fn>;
	where: ReturnType<typeof vi.fn>;
	limit: ReturnType<typeof vi.fn>;
	catch: ReturnType<typeof vi.fn>;
};

type InsertCall = {
	values: unknown;
};

type UpdateCall = {
	values: Record<string, unknown>;
};

function makeQueryChain(rows: unknown[]): QueryChain {
	const chain = {
		from: vi.fn(),
		where: vi.fn(),
		limit: vi.fn(),
		catch: vi.fn(),
	};
	chain.from.mockReturnValue(chain);
	chain.where.mockReturnValue(chain);
	chain.limit.mockResolvedValue(rows);
	chain.catch.mockReturnValue(chain);
	return chain;
}

function makeInsertRecorder(calls: InsertCall[]) {
	return vi.fn((_table: unknown) => ({
		values: vi.fn(async (values: unknown) => {
			calls.push({ values });
		}),
	}));
}

function makeUpdateRecorder(calls: UpdateCall[]) {
	return vi.fn((_table: unknown) => ({
		set: vi.fn((values: Record<string, unknown>) => ({
			where: vi.fn(async () => {
				calls.push({ values });
			}),
		})),
	}));
}

function makeAdapterDb(selectResults: unknown[][]) {
	const insertCalls: InsertCall[] = [];
	const updateCalls: UpdateCall[] = [];
	const nextRows = () => selectResults.shift() ?? [];
	const tx = {
		select: vi.fn(() => makeQueryChain(nextRows())),
		insert: makeInsertRecorder(insertCalls),
		update: makeUpdateRecorder(updateCalls),
	};
	const db = {
		transaction: vi.fn(async (fn: (tx: typeof tx) => Promise<void>) => fn(tx)),
		select: vi.fn(() => makeQueryChain(nextRows())),
		insert: makeInsertRecorder(insertCalls),
		update: makeUpdateRecorder(updateCalls),
	};

	return {
		db: db as unknown as MySql2Database,
		insertCalls,
		updateCalls,
	};
}

describe("domain organization auto-join", () => {
	const take3OrgId = Organisation.OrganisationId.make("m0tmhvagbmea7aj");
	const rules = "take3tech.com=m0tmhvagbmea7aj, other.com=otherorgid0000";

	beforeEach(() => {
		envMock.autoJoinRules = "";
	});

	it("parses normalized domain to organization rules", () => {
		expect(parseAutoJoinOrganizationRules(rules)).toEqual([
			{ domain: "take3tech.com", organizationId: take3OrgId },
			{
				domain: "other.com",
				organizationId: Organisation.OrganisationId.make("otherorgid0000"),
			},
		]);
	});

	it("ignores invalid and empty rule entries", () => {
		expect(
			parseAutoJoinOrganizationRules(
				"take3tech.com=m0tmhvagbmea7aj, bad-domain=org, missing-org=, =org",
			),
		).toEqual([{ domain: "take3tech.com", organizationId: take3OrgId }]);
		expect(parseAutoJoinOrganizationRules("")).toEqual([]);
	});

	it("resolves exact email domain matches case-insensitively", () => {
		expect(
			resolveAutoJoinOrganizationIdForEmail("Person@Take3Tech.com", rules),
		).toBe(take3OrgId);
		expect(
			resolveAutoJoinOrganizationIdForEmail("person@sub.take3tech.com", rules),
		).toBeNull();
	});

	it("keeps pending invites ahead of domain auto-join", () => {
		expect(
			resolveNewUserOrganizationPlan({
				email: "person@take3tech.com",
				hasPendingInvite: true,
				rulesConfig: rules,
			}),
		).toEqual({ type: "pending-invite" });
	});

	it("plans auto-join or personal organization for new users", () => {
		expect(
			resolveNewUserOrganizationPlan({
				email: "person@take3tech.com",
				hasPendingInvite: false,
				rulesConfig: rules,
			}),
		).toEqual({ type: "auto-join", organizationId: take3OrgId });
		expect(
			resolveNewUserOrganizationPlan({
				email: "person@example.com",
				hasPendingInvite: false,
				rulesConfig: rules,
			}),
		).toEqual({ type: "personal-organization" });
	});

	it("detects organization-root auto-share only for enabled auto-join organizations", () => {
		expect(
			shouldAutoShareVideoToOrganization({
				organizationId: take3OrgId,
				rulesConfig: rules,
				autoShareEnabled: false,
			}),
		).toBe(false);
		expect(
			shouldAutoShareVideoToOrganization({
				organizationId: take3OrgId,
				rulesConfig: rules,
				autoShareEnabled: true,
			}),
		).toBe(true);
		expect(
			shouldAutoShareVideoToOrganization({
				organizationId: Organisation.OrganisationId.make("nomatchorg0000"),
				rulesConfig: rules,
				autoShareEnabled: true,
			}),
		).toBe(false);
	});

	it("avoids duplicate organization-root shares", () => {
		expect(
			shouldCreateOrganizationRootShare({
				organizationId: take3OrgId,
				rulesConfig: rules,
				autoShareEnabled: true,
				hasExistingShare: true,
			}),
		).toBe(false);
		expect(
			shouldCreateOrganizationRootShare({
				organizationId: take3OrgId,
				rulesConfig: rules,
				autoShareEnabled: true,
				hasExistingShare: false,
			}),
		).toBe(true);
	});
});

describe("DrizzleAdapter domain organization auto-join", () => {
	const user = {
		id: "user12345678901",
		email: "person@take3tech.com",
		activeOrganizationId: "m0tmhvagbmea7aj",
		defaultOrgId: "m0tmhvagbmea7aj",
	};

	beforeEach(() => {
		envMock.autoJoinRules = "take3tech.com=m0tmhvagbmea7aj";
	});

	it("auto-joins matching users as members and assigns active/default org", async () => {
		const { DrizzleAdapter } = await import(
			"../../../../packages/database/auth/drizzle-adapter"
		);
		const { db, insertCalls, updateCalls } = makeAdapterDb([
			[],
			[{ id: "m0tmhvagbmea7aj" }],
			[user],
		]);

		await DrizzleAdapter(db).createUser({
			email: "Person@Take3Tech.com",
			name: "Person",
		});

		expect(insertCalls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					values: expect.objectContaining({
						email: "person@take3tech.com",
					}),
				}),
				expect.objectContaining({
					values: expect.objectContaining({
						organizationId: "m0tmhvagbmea7aj",
						role: "member",
					}),
				}),
			]),
		);
		expect(updateCalls).toContainEqual({
			values: {
				activeOrganizationId: "m0tmhvagbmea7aj",
				defaultOrgId: "m0tmhvagbmea7aj",
			},
		});
	});

	it("does not auto-join when a pending invite exists", async () => {
		const { DrizzleAdapter } = await import(
			"../../../../packages/database/auth/drizzle-adapter"
		);
		const { db, insertCalls, updateCalls } = makeAdapterDb([
			[{ id: "invite-1" }],
			[{ ...user, activeOrganizationId: "", defaultOrgId: null }],
		]);

		await DrizzleAdapter(db).createUser({
			email: "person@take3tech.com",
			name: "Person",
		});

		expect(insertCalls).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					values: expect.objectContaining({ role: "member" }),
				}),
			]),
		);
		expect(updateCalls).toEqual([]);
	});

	it("keeps personal organization creation for non-matching users", async () => {
		envMock.autoJoinRules = "take3tech.com=m0tmhvagbmea7aj";
		const { DrizzleAdapter } = await import(
			"../../../../packages/database/auth/drizzle-adapter"
		);
		const { db, insertCalls, updateCalls } = makeAdapterDb([
			[],
			[
				{
					...user,
					email: "person@example.com",
					activeOrganizationId: "personal",
				},
			],
		]);

		await DrizzleAdapter(db).createUser({
			email: "person@example.com",
			name: "Person",
		});

		expect(insertCalls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					values: expect.objectContaining({ name: "My Organization" }),
				}),
				expect.objectContaining({
					values: expect.objectContaining({ role: "owner" }),
				}),
			]),
		);
		expect(updateCalls[0]?.values).toEqual(
			expect.objectContaining({
				activeOrganizationId: expect.any(String),
				defaultOrgId: expect.any(String),
			}),
		);
	});

	it("fails safely when the configured organization is unavailable", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const { DrizzleAdapter } = await import(
			"../../../../packages/database/auth/drizzle-adapter"
		);
		const { db, insertCalls } = makeAdapterDb([[], []]);

		await expect(
			DrizzleAdapter(db).createUser({
				email: "person@take3tech.com",
				name: "Person",
			}),
		).rejects.toThrow("Auto-join organization is unavailable");

		expect(insertCalls).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					values: expect.objectContaining({ name: "My Organization" }),
				}),
			]),
		);
		expect(consoleError).toHaveBeenCalledWith(
			"Auto-join organization is unavailable",
			{
				emailDomain: "take3tech.com",
				organizationId: "m0tmhvagbmea7aj",
			},
		);
	});
});
