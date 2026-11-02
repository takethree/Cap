import { serverEnv } from "@cap/env";

const TRANSCRIPTION_PATH = "/media/cap/nova-3/transcribe";
const PUBLIC_GATEWAY = "https://ai-gateway.take3tech.dev";
const INTERNAL_GATEWAY =
	"http://ai-gateway-litellm.ai-gateway.svc.cluster.local:4000";

export function getTranscriptionGatewayConfig() {
	const env = serverEnv();
	const endpoint = env.AI_GATEWAY_TRANSCRIPTION_URL?.trim();
	const apiKey = env.AI_GATEWAY_TRANSCRIPTION_API_KEY?.trim();
	if (!endpoint || !apiKey) return null;

	try {
		const url = new URL(endpoint);
		if (
			![PUBLIC_GATEWAY, INTERNAL_GATEWAY].includes(url.origin) ||
			url.pathname !== TRANSCRIPTION_PATH ||
			url.username ||
			url.password ||
			url.search ||
			url.hash
		) {
			return null;
		}
		const accessId = env.AI_GATEWAY_CF_ACCESS_CLIENT_ID?.trim();
		const accessSecret = env.AI_GATEWAY_CF_ACCESS_CLIENT_SECRET?.trim();
		if (
			Boolean(accessId) !== Boolean(accessSecret) ||
			(url.origin === PUBLIC_GATEWAY && !accessId)
		) {
			return null;
		}
		const headers: Record<string, string> = {
			Authorization: `Bearer ${apiKey}`,
		};
		if (accessId && accessSecret) {
			headers["CF-Access-Client-Id"] = accessId;
			headers["CF-Access-Client-Secret"] = accessSecret;
		}
		return { endpoint: url.toString(), apiKey, headers };
	} catch {
		return null;
	}
}

export function isTranscriptionConfigured() {
	return getTranscriptionGatewayConfig() !== null;
}
