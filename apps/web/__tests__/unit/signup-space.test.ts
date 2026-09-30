import { afterEach, describe, expect, it, vi } from "vitest";
import { getSignupSpaceId } from "../../../../packages/database/auth/signup-space";

afterEach(() => vi.unstubAllEnvs());

describe("signup domain space configuration", () => {
	it("is disabled by default", () => {
		vi.stubEnv("CAP_SIGNUP_DOMAIN_SPACE_MAP", "");
		expect(getSignupSpaceId("user@customer.example")).toBeNull();
	});
	it("matches normalized exact domains only", () => {
		vi.stubEnv(
			"CAP_SIGNUP_DOMAIN_SPACE_MAP",
			'{"Customer.Example":" space-1 "}',
		);
		expect(getSignupSpaceId("User@CUSTOMER.EXAMPLE")).toBe("space-1");
		for (const email of [
			"user@sub.customer.example",
			"user@customer.example.evil",
			"user@internal.example",
			"user@@customer.example",
		])
			expect(getSignupSpaceId(email)).toBeNull();
	});
	it.each([
		"null",
		"[]",
		"invalid",
		'{"customer.example":42}',
		'{"customer.example":""}',
		'{"customer.example":"a","CUSTOMER.EXAMPLE":"b"}',
		'{"@customer.example":"a"}',
	])("rejects invalid configuration %s", (raw) => {
		vi.stubEnv("CAP_SIGNUP_DOMAIN_SPACE_MAP", raw);
		expect(() => getSignupSpaceId("user@customer.example")).toThrow();
	});
});
