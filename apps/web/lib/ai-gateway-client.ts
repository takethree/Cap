import { serverEnv } from "@cap/env";

export const DEFAULT_AI_GATEWAY_MODEL = "openai/gpt-oss-120b";

type ChatMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

type AiGatewayConfig = {
	baseUrl: string;
	apiKey: string;
	model: string;
};

type ChatCompletionOptions = {
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
	signal?: AbortSignal;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export function getAiGatewayConfig(): AiGatewayConfig | null {
	const env = serverEnv();
	const baseUrl = env.AI_GATEWAY_BASE_URL?.trim();
	const apiKey = env.AI_GATEWAY_API_KEY?.trim();

	if (!baseUrl || !apiKey) return null;

	return {
		baseUrl: trimTrailingSlash(baseUrl),
		apiKey,
		model: env.AI_GATEWAY_MODEL?.trim() || DEFAULT_AI_GATEWAY_MODEL,
	};
}

export function isAiGatewayConfigured() {
	return getAiGatewayConfig() !== null;
}

export function isLegacyDirectAiEnabled() {
	return serverEnv().NODE_ENV !== "production";
}

export function isAiProviderConfigured() {
	const env = serverEnv();
	return (
		isAiGatewayConfigured() ||
		(isLegacyDirectAiEnabled() &&
			Boolean(env.GROQ_API_KEY || env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY))
	);
}

function parseOpenAiChatContent(payload: unknown): string | null {
	if (!payload || typeof payload !== "object") return null;
	const choices = (payload as { choices?: unknown }).choices;
	if (!Array.isArray(choices) || choices.length === 0) return null;
	const first = choices[0] as {
		message?: {
			content?: unknown;
		};
	};
	const content = first.message?.content;
	return typeof content === "string" ? content.trim() : null;
}

export async function callAiGatewayChat({
	messages,
	temperature,
	maxTokens,
	signal,
}: ChatCompletionOptions): Promise<string> {
	const config = getAiGatewayConfig();
	if (!config) throw new Error("AI gateway is not configured");

	const response = await fetch(`${config.baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: config.model,
			messages,
			...(temperature !== undefined ? { temperature } : {}),
			...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
		}),
		signal,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`AI gateway chat failed: ${response.status} ${text}`);
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new Error("AI gateway returned invalid JSON");
	}

	const content = parseOpenAiChatContent(payload);
	if (!content)
		throw new Error("AI gateway response did not include message content");
	return content;
}
