import { Organisation } from "@cap/web-domain";

export function getSignupOrganizationId(email: string) {
	const raw = process.env.CAP_SIGNUP_DOMAIN_ORGANIZATION_MAP?.trim();
	if (!raw) return null;
	const mappings: unknown = JSON.parse(raw);
	if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) {
		throw new Error(
			"CAP_SIGNUP_DOMAIN_ORGANIZATION_MAP must be a domain-to-organization object",
		);
	}
	const normalized = new Map<string, string>();
	for (const [domain, organizationId] of Object.entries(mappings)) {
		const key = domain.trim().toLowerCase();
		if (
			!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(key) ||
			typeof organizationId !== "string" ||
			!/^[a-zA-Z0-9-]{1,15}$/.test(organizationId.trim()) ||
			normalized.has(key)
		) {
			throw new Error("Invalid or duplicate signup organization mapping");
		}
		normalized.set(key, organizationId.trim());
	}
	const parts = email.trim().toLowerCase().split("@");
	const id =
		parts.length === 2 && parts[0] ? normalized.get(parts[1] ?? "") : null;
	return id ? Organisation.OrganisationId.make(id) : null;
}
