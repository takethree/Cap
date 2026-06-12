import {
	getLatestTake3DesktopManifest,
	isNewerVersion,
} from "@/utils/take3-desktop-release";

export async function GET(
	_req: Request,
	props: {
		params: Promise<{ targetArch: string; currentVersion: string }>;
	},
) {
	const { currentVersion } = await props.params;
	const manifest = await getLatestTake3DesktopManifest().catch(() => null);

	if (!manifest || !isNewerVersion(manifest.version, currentVersion)) {
		return new Response(null, { status: 204 });
	}

	return Response.json({
		version: manifest.version,
		notes: `Take-3 desktop build ${manifest.commitSha}`,
		pub_date: manifest.publishedAt,
		url: manifest.windows.updaterUrl,
		signature: manifest.windows.signature,
	});
}
