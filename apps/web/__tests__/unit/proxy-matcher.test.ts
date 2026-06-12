import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@cap/database", () => ({
	db: vi.fn(),
}));

vi.mock("@cap/database/schema", () => ({
	organizations: {
		customDomain: "customDomain",
		domainVerified: "domainVerified",
	},
}));

vi.mock("@cap/env", () => ({
	buildEnv: {
		NEXT_PUBLIC_IS_CAP: "",
	},
	serverEnv: () => ({
		WEB_URL: "https://cap.test",
		VERCEL_BRANCH_URL_HOST: undefined,
		VERCEL_PROJECT_PRODUCTION_URL_HOST: undefined,
		VERCEL_URL_HOST: undefined,
	}),
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn(),
}));

import { config } from "../../proxy";

const doesProxyMatch = (path: string) =>
	unstable_doesMiddlewareMatch({
		config,
		nextConfig: {},
		url: new URL(path, "https://cap.test").toString(),
	});

describe("proxy matcher", () => {
	it("skips public static asset requests", () => {
		for (const path of [
			"/site.webmanifest",
			"/theme-script.js",
			"/rive/main.riv",
			"/favicon-32x32.png",
			"/android-chrome-192x192.png",
			"/safari-pinned-tab.svg",
			"/og.png",
		]) {
			expect(doesProxyMatch(path), path).toBe(false);
		}
	});

	it("keeps route-like app and workflow requests in the proxy", () => {
		for (const path of [
			"/",
			"/dashboard/caps",
			"/s/dezxvbfyv1jy83c",
			"/.well-known/workflow/v1/flow",
		]) {
			expect(doesProxyMatch(path), path).toBe(true);
		}
	});
});
