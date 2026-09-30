import { afterEach, describe, expect, it, vi } from "vitest";
import { getSignupOrganizationId } from "../../../../packages/database/auth/signup-organization";

afterEach(() => vi.unstubAllEnvs());
describe("native organization signup routing", () => {
	it("stays disabled without a map", () => {
		vi.stubEnv("CAP_SIGNUP_DOMAIN_ORGANIZATION_MAP", "");
		expect(getSignupOrganizationId("user@customer.example")).toBeNull();
	});
	it("matches normalized exact domains, preserving other domains", () => {
		vi.stubEnv(
			"CAP_SIGNUP_DOMAIN_ORGANIZATION_MAP",
			'{"Customer.Example":" customer-org "}',
		);
		expect(getSignupOrganizationId("USER@Customer.Example")).toBe(
			"customer-org",
		);
		for (const email of [
			"user@take3tech.com",
			"user@sub.customer.example",
			"user@customer.example.evil",
			"user@@customer.example",
		])
			expect(getSignupOrganizationId(email)).toBeNull();
	});
	it.each([
		"null",
		"[]",
		"invalid",
		'{"customer.example":1}',
		'{"customer.example":" "}',
		'{"customer.example":"org","CUSTOMER.EXAMPLE":"other"}',
		'{"customer.example":"id-longer-than-fifteen"}',
	])("rejects malformed mapping %s", (raw) => {
		vi.stubEnv("CAP_SIGNUP_DOMAIN_ORGANIZATION_MAP", raw);
		expect(() => getSignupOrganizationId("user@customer.example")).toThrow();
	});
});
