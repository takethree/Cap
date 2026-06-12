import { getCliInstallerBaseUrl } from "@/utils/take3-desktop-release";

const script = (baseUrl: string) => `@echo off
setlocal
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Invoke-RestMethod ${baseUrl}/install-cli.ps1 | Invoke-Expression"
exit /b %ERRORLEVEL%
`;

export async function GET(request: Request) {
	return new Response(script(getCliInstallerBaseUrl(request)), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
