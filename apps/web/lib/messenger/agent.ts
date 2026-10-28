import "server-only";

import type { MessengerMessageRole } from "@cap/database/schema";
import {
	callAiGatewayChat,
	isAiGatewayConfigured,
} from "@/lib/ai-gateway-client";
import { CAP_REFERENCE_GUIDE, MESSENGER_AGENT_PROMPT } from "./constants";
import { getKnowledgeTag, searchSupermemory } from "./supermemory";

type ConversationMessage = {
	role: MessengerMessageRole;
	content: string;
};

const normalizeContext = (sections: string[]) =>
	sections
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
		.slice(0, 6)
		.join("\n\n")
		.slice(0, 7000);

const buildSystemPrompt = ({
	userIdentity,
	context,
}: {
	userIdentity: string;
	context: string;
}) =>
	[
		MESSENGER_AGENT_PROMPT,
		`You are chatting with a Cap user in a live support chat. This is a real conversation, not a ticket. Write like you're messaging a colleague, not composing a formal email.

Critical rules:
- You ARE a Cap employee. Cap is YOUR company. ALWAYS use "we", "our", "us" when talking about Cap, its features, plans, and decisions. Never refer to Cap in the third person like an outsider. For example say "we built this to be lightweight" not "Cap is lightweight", say "our Pro plan includes..." not "Cap Pro includes...", say "we support Mac and Windows" not "Cap works on Mac and Windows". You're on the team, talk like it.
- NEVER use em dashes (the long dash character). Use commas, periods, or just start a new sentence instead.
- NEVER use markdown formatting (no **bold**, no *italics*, no headers, no code blocks unless sharing actual code snippets).
- Don't over-explain. If the answer is simple, keep it simple.
- Match the user's message length roughly. If they send a short message, don't write an essay. But NEVER mirror rudeness, frustration, or negativity. Always stay polite, friendly, and helpful regardless of the user's tone. If they're upset, acknowledge it warmly and focus on solving their problem.
- If a user reports a problem vaguely, don't just mirror the vagueness back. Ask specific diagnostic questions (platform, what they were doing, what they see, error messages) to actually move toward a fix.
- When someone says they have a technical issue, ALWAYS ask at least 2 specific questions to narrow it down. Never respond with just "what's going on?" or "tell me more". Be a support engineer, not a greeter.
- If you reference Cap knowledge context below, weave it in naturally. Don't say "according to our documentation" or "based on our resources".
- Never make up features, pricing, dates, or technical details. If you're not sure, say so honestly. Always use the Cap Reference Guide below for accurate facts, URLs, and pricing.
- When linking to Cap pages, ALWAYS use the full URL from the reference guide (e.g. https://cap.so/download, not just "cap.so"). Get the exact URL right.
- If you genuinely can't help, say something like "I'm not sure on that one, let me get someone from the team to take a look" rather than stiff corporate escalation language.
- Keep responses focused, usually 1-3 short paragraphs max. This is a chat, not an email.
- Be genuinely helpful, personable, and respectful. You represent Cap and should leave the user feeling good about the interaction.
- ONLY discuss Cap and topics directly related to Cap (screen recording, sharing, account, billing, technical issues with Cap, etc.). If a user asks about other apps, competitors, or unrelated topics, politely steer the conversation back to Cap. Never recommend, compare, or discuss competing products or unrelated software.
- If you notice the conversation is going in circles, the user seems frustrated, or their issue isn't getting resolved after a few back-and-forth messages, gently suggest they email the team directly at hello@cap.so for more hands-on help. Say something natural like "this one might need a closer look from the team, if you shoot an email to hello@cap.so we can dig into it properly" rather than stiff escalation language.`,
		CAP_REFERENCE_GUIDE,
		`The person you're talking to: ${userIdentity}`,
		context
			? `Additional context from knowledge base (use it to inform your answer naturally, don't quote it directly):\n${context}`
			: "",
	]
		.filter((line) => line.length > 0)
		.join("\n\n");

const mapHistoryForLlm = (history: ConversationMessage[]) =>
	history.slice(-20).map((message) => ({
		role: message.role === "user" ? ("user" as const) : ("assistant" as const),
		content: message.content.slice(0, 6000),
	}));

const callAiGateway = async ({
	systemPrompt,
	history,
}: {
	systemPrompt: string;
	history: ConversationMessage[];
}) => {
	if (!isAiGatewayConfigured()) return null;

	return callAiGatewayChat({
		temperature: 0.65,
		maxTokens: 500,
		messages: [
			{ role: "system", content: systemPrompt },
			...mapHistoryForLlm(history),
		],
		signal: AbortSignal.timeout(35000),
	});
};

export const generateMessengerAgentReply = async ({
	userIdentity,
	identityTag,
	query,
	history,
}: {
	userIdentity: string;
	identityTag: string;
	query: string;
	history: ConversationMessage[];
}) => {
	const [personalContext, knowledgeContext] = await Promise.all([
		searchSupermemory({ query, containerTag: identityTag, limit: 4 }).catch(
			() => [],
		),
		searchSupermemory({
			query,
			containerTag: getKnowledgeTag(),
			limit: 4,
		}).catch(() => []),
	]);

	const systemPrompt = buildSystemPrompt({
		userIdentity,
		context: normalizeContext([...knowledgeContext, ...personalContext]),
	});

	const fromGateway = await callAiGateway({ systemPrompt, history }).catch(
		() => null,
	);
	if (fromGateway) return fromGateway;

	return "Oh no, I'm so sorry about this! I'm having a little technical hiccup on my end. Someone from the team will jump in here shortly to help you out though!";
};
