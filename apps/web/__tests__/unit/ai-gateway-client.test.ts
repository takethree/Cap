import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
	current: {} as Record<string, string | undefined>,
}));

vi.mock("@cap/env", () => ({
	serverEnv: () => env.current,
}));

import {
	callAiGatewayChat,
	DEFAULT_AI_GATEWAY_MODEL,
	isAiProviderConfigured,
} from "@/lib/ai-gateway-client";

describe("ai-gateway-client", () => {
	beforeEach(() => {
		env.current = {
			NODE_ENV: "production",
			AI_GATEWAY_BASE_URL:
				"http://ai-gateway-litellm.ai-gateway.svc.cluster.local:4000/v1/",
			AI_GATEWAY_API_KEY: "test-key",
			AI_GATEWAY_MODEL: "openai/gpt-oss-120b",
		};
		vi.restoreAllMocks();
	});

	it("calls the OpenAI-compatible LiteLLM chat completions endpoint", async () => {
		const fetchMock = vi.fn(
			async (_input: Parameters<typeof fetch>[0], _init?: RequestInit) =>
				({
					ok: true,
					json: async () => ({
						choices: [{ message: { content: "gateway response" } }],
					}),
				}) as Response,
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await callAiGatewayChat({
			messages: [{ role: "user", content: "hello" }],
			temperature: 0.2,
			maxTokens: 128,
		});

		expect(result).toBe("gateway response");
		expect(fetchMock).toHaveBeenCalledWith(
			"http://ai-gateway-litellm.ai-gateway.svc.cluster.local:4000/v1/chat/completions",
			expect.objectContaining({
				method: "POST",
				headers: {
					Authorization: "Bearer test-key",
					"Content-Type": "application/json",
				},
			}),
		);
		const [, requestInit] = fetchMock.mock.calls[0] ?? [];
		expect(requestInit).toBeDefined();
		const body = JSON.parse(requestInit?.body as string);
		expect(body).toMatchObject({
			model: "openai/gpt-oss-120b",
			messages: [{ role: "user", content: "hello" }],
			temperature: 0.2,
			max_tokens: 128,
		});
	});

	it("uses the default CAP route model when the model env var is omitted", async () => {
		env.current.AI_GATEWAY_MODEL = undefined;
		const fetchMock = vi.fn(
			async (_input: Parameters<typeof fetch>[0], _init?: RequestInit) =>
				({
					ok: true,
					json: async () => ({
						choices: [{ message: { content: "ok" } }],
					}),
				}) as Response,
		);
		vi.stubGlobal("fetch", fetchMock);

		await callAiGatewayChat({
			messages: [{ role: "user", content: "hello" }],
		});

		const [, requestInit] = fetchMock.mock.calls[0] ?? [];
		expect(requestInit).toBeDefined();
		const body = JSON.parse(requestInit?.body as string);
		expect(body.model).toBe(DEFAULT_AI_GATEWAY_MODEL);
	});

	it("raises a clear error for invalid gateway JSON", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => {
					throw new SyntaxError("bad json");
				},
			})),
		);

		await expect(
			callAiGatewayChat({
				messages: [{ role: "user", content: "hello" }],
			}),
		).rejects.toThrow("AI gateway returned invalid JSON");
	});

	it("does not treat direct Groq or OpenAI keys as production AI configuration", () => {
		env.current = {
			NODE_ENV: "production",
			GROQ_API_KEY: "legacy-groq",
			OPENAI_API_KEY: "legacy-openai",
		};

		expect(isAiProviderConfigured()).toBe(false);
	});
});
