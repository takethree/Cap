import { Space } from "@cap/web-domain";

export function getSignupSpaceId(email: string) {
	const raw = process.env.CAP_SIGNUP_DOMAIN_SPACE_MAP?.trim();
	if (!raw) return null;
	const mappings: unknown = JSON.parse(raw);
	if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) {
		throw new Error(
			"CAP_SIGNUP_DOMAIN_SPACE_MAP must be a domain-to-space object",
		);
	}
	const normalized = new Map<string, string>();
	for (const [domain, spaceId] of Object.entries(mappings)) {
		const key = domain.trim().toLowerCase();
		if (
			!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(key) ||
			typeof spaceId !== "string" ||
			!spaceId.trim() ||
			normalized.has(key)
		) {
			throw new Error("Invalid or duplicate signup space mapping");
		}
		normalized.set(key, spaceId.trim());
	}
	const parts = email.trim().toLowerCase().split("@");
	const id =
		parts.length === 2 && parts[0] ? normalized.get(parts[1] ?? "") : null;
	return id ? Space.SpaceId.make(id) : null;
}
