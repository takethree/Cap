import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getPlatformDownload } from "@/app/(site)/download/[platform]/route";
import { GET as getCmdInstaller } from "@/app/install-cli.cmd/route";
import { GET as getPowerShellInstaller } from "@/app/install-cli.ps1/route";
import {
	getCliInstallCommand,
	getCliInstallerBaseUrl,
	isNewerVersion,
	isTake3Origin,
	TAKE3_WEB_URL,
} from "@/utils/take3-desktop-release";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Take-3 desktop release helpers", () => {
	it("detects the Take-3 origin", () => {
		expect(isTake3Origin("https://cap.take3tech.dev")).toBe(true);
		expect(isTake3Origin("https://cap.so")).toBe(false);
	});

	it("builds CLI install commands from the provided base URL", () => {
		expect(getCliInstallCommand("windows", TAKE3_WEB_URL)).toBe(
			"irm https://cap.take3tech.dev/install-cli.ps1 | iex",
		);
		expect(getCliInstallCommand("macos", TAKE3_WEB_URL)).toBe(
			"curl -fsSL https://cap.take3tech.dev/install-cli.sh | sh",
		);
	});

	it("uses request origin for Take-3 installer scripts", () => {
		const request = new Request("https://cap.take3tech.dev/install-cli.ps1");
		expect(getCliInstallerBaseUrl(request)).toBe(TAKE3_WEB_URL);
	});

	it("compares updater versions numerically", () => {
		expect(isNewerVersion("0.5.120", "0.5.119")).toBe(true);
		expect(isNewerVersion("0.5.120", "0.5.120")).toBe(false);
		expect(isNewerVersion("0.5.119", "0.5.120")).toBe(false);
	});
});

describe("Take-3 installer script routes", () => {
	it("serves a PowerShell installer that downloads from Take-3", async () => {
		const response = await getPowerShellInstaller(
			new Request("https://cap.take3tech.dev/install-cli.ps1"),
		);
		const text = await response.text();

		expect(text).toContain(
			'$downloadUrl = "https://cap.take3tech.dev/download/windows"',
		);
		expect(text).not.toContain("https://cap.so/download/windows");
	});

	it("serves a cmd installer that chains to Take-3 PowerShell script", async () => {
		const response = await getCmdInstaller(
			new Request("https://cap.take3tech.dev/install-cli.cmd"),
		);
		const text = await response.text();

		expect(text).toContain(
			"Invoke-RestMethod https://cap.take3tech.dev/install-cli.ps1",
		);
		expect(text).not.toContain("https://cap.so/install-cli.ps1");
	});
});

describe("Take-3 download route", () => {
	it("redirects Windows downloads to the latest Take-3 installer", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([
						{
							tag_name: "take3-desktop-0.5.120",
							published_at: "2026-06-12T00:00:00.000Z",
							draft: false,
							assets: [
								{
									name: "take3-desktop-manifest.json",
									browser_download_url:
										"https://github.com/example/repo/releases/download/take3-desktop-0.5.120/take3-desktop-manifest.json",
								},
							],
						},
					]),
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						version: "0.5.120",
						commitSha: "abc123",
						publishedAt: "2026-06-12T00:00:00.000Z",
						windows: {
							installerUrl:
								"https://github.com/example/repo/releases/download/take3-desktop-0.5.120/Cap-Take3.exe",
							updaterUrl:
								"https://github.com/example/repo/releases/download/take3-desktop-0.5.120/Cap-Take3.exe",
							signature: "signature",
						},
					}),
				),
			);

		const response = await getPlatformDownload(
			new Request("https://cap.take3tech.dev/download/windows"),
			{ params: Promise.resolve({ platform: "windows" }) },
		);

		expect(response.headers.get("location")).toBe(
			"https://github.com/example/repo/releases/download/take3-desktop-0.5.120/Cap-Take3.exe",
		);
	});
});
