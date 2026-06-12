export const TAKE3_WEB_URL = "https://cap.take3tech.dev";

const DEFAULT_REPOSITORY = "CapSoftware/Cap";
const DEFAULT_TAG_PREFIX = "take3-desktop-";
const MANIFEST_ASSET_NAME = "take3-desktop-manifest.json";

export interface Take3DesktopManifest {
	version: string;
	commitSha: string;
	publishedAt: string;
	windows: {
		installerUrl: string;
		updaterUrl: string;
		signature: string;
	};
}

interface GitHubAsset {
	name: string;
	browser_download_url: string;
}

interface GitHubRelease {
	tag_name: string;
	published_at: string | null;
	draft: boolean;
	assets: GitHubAsset[];
}

export function isTake3Origin(origin: string): boolean {
	try {
		return new URL(origin).origin === TAKE3_WEB_URL;
	} catch {
		return false;
	}
}

export function getRequestOrigin(request: Request): string {
	return new URL(request.url).origin;
}

export function getCliInstallerBaseUrl(request: Request): string {
	const origin = getRequestOrigin(request);
	if (isTake3Origin(origin)) return origin;

	const publicWebUrl = process.env.NEXT_PUBLIC_WEB_URL;
	if (publicWebUrl && isTake3Origin(publicWebUrl)) return TAKE3_WEB_URL;

	return origin;
}

export function getCliInstallCommand(platform: string | null, baseUrl: string) {
	return platform === "windows"
		? `irm ${baseUrl}/install-cli.ps1 | iex`
		: `curl -fsSL ${baseUrl}/install-cli.sh | sh`;
}

export function shouldUseTake3DesktopChannel(request: Request): boolean {
	const origin = getRequestOrigin(request);
	if (isTake3Origin(origin)) return true;

	return process.env.NEXT_PUBLIC_WEB_URL
		? isTake3Origin(process.env.NEXT_PUBLIC_WEB_URL)
		: false;
}

function releaseRepository() {
	return process.env.TAKE3_DESKTOP_RELEASE_REPOSITORY || DEFAULT_REPOSITORY;
}

function releaseTagPrefix() {
	return process.env.TAKE3_DESKTOP_RELEASE_TAG_PREFIX || DEFAULT_TAG_PREFIX;
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, {
		headers: {
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "Cap-Take3-Desktop-Release-Resolver",
		},
		next: {
			revalidate: 300,
		},
	});

	if (!response.ok) {
		throw new Error(`GitHub release lookup failed: ${response.status}`);
	}

	return response.json() as Promise<T>;
}

function findReleaseAsset(
	release: GitHubRelease,
	predicate: (name: string) => boolean,
) {
	return release.assets.find((asset) => predicate(asset.name));
}

export async function getLatestTake3DesktopManifest(): Promise<Take3DesktopManifest | null> {
	const repository = releaseRepository();
	const releases = await fetchJson<GitHubRelease[]>(
		`https://api.github.com/repos/${repository}/releases?per_page=50`,
	);

	const release = releases
		.filter((release) => !release.draft)
		.filter((release) => release.tag_name.startsWith(releaseTagPrefix()))
		.sort((a, b) => {
			return (
				new Date(b.published_at ?? 0).getTime() -
				new Date(a.published_at ?? 0).getTime()
			);
		})[0];

	if (!release) return null;

	const manifestAsset = findReleaseAsset(
		release,
		(name) => name === MANIFEST_ASSET_NAME,
	);
	if (manifestAsset) {
		return fetchJson<Take3DesktopManifest>(manifestAsset.browser_download_url);
	}

	const installer = findReleaseAsset(
		release,
		(name) => name.endsWith(".exe") && !name.endsWith(".sig"),
	);
	const updater =
		findReleaseAsset(release, (name) => name.endsWith(".nsis.zip")) ??
		installer;
	const signature = updater
		? findReleaseAsset(release, (name) => name === `${updater.name}.sig`)
		: undefined;

	if (!installer || !updater || !signature) return null;

	return {
		version: release.tag_name.replace(releaseTagPrefix(), ""),
		commitSha: "",
		publishedAt: release.published_at ?? new Date(0).toISOString(),
		windows: {
			installerUrl: installer.browser_download_url,
			updaterUrl: updater.browser_download_url,
			signature: await fetch(signature.browser_download_url).then((response) =>
				response.text(),
			),
		},
	};
}

export function isNewerVersion(candidate: string, current: string): boolean {
	const candidateParts = candidate.split(/[.+-]/).map((part) => Number(part));
	const currentParts = current.split(/[.+-]/).map((part) => Number(part));
	const maxLength = Math.max(candidateParts.length, currentParts.length);

	for (let index = 0; index < maxLength; index += 1) {
		const candidatePart = candidateParts[index] ?? 0;
		const currentPart = currentParts[index] ?? 0;
		if (Number.isNaN(candidatePart) || Number.isNaN(currentPart)) {
			return candidate !== current;
		}
		if (candidatePart > currentPart) return true;
		if (candidatePart < currentPart) return false;
	}

	return false;
}
