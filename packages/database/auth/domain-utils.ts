import { Organisation } from "@cap/web-domain";
import { z } from "zod";

export type AutoJoinOrganizationRule = {
	domain: string;
	organizationId: Organisation.OrganisationId;
};

export type NewUserOrganizationPlan =
	| { type: "pending-invite" }
	| { type: "auto-join"; organizationId: Organisation.OrganisationId }
	| { type: "personal-organization" };

export function isEmailAllowedForSignup(
	email: string,
	allowedDomainsConfig?: string,
): boolean {
	// If no domain restrictions are configured, allow all signups
	if (!allowedDomainsConfig || allowedDomainsConfig.trim() === "") {
		return true;
	}

	const emailDomain = extractDomainFromEmail(email);
	if (!emailDomain) {
		return false;
	}

	const allowedDomains = parseAllowedDomains(allowedDomainsConfig);
	return allowedDomains.includes(emailDomain.toLowerCase());
}

export function resolveAutoJoinOrganizationIdForEmail(
	email: string,
	rulesConfig?: string,
): Organisation.OrganisationId | null {
	const emailDomain = extractDomainFromEmail(email);
	if (!emailDomain) {
		return null;
	}

	const rule = parseAutoJoinOrganizationRules(rulesConfig).find(
		(rule) => rule.domain === emailDomain.toLowerCase(),
	);

	return rule?.organizationId ?? null;
}

export function resolveNewUserOrganizationPlan({
	email,
	hasPendingInvite,
	rulesConfig,
}: {
	email: string;
	hasPendingInvite: boolean;
	rulesConfig?: string;
}): NewUserOrganizationPlan {
	if (hasPendingInvite) {
		return { type: "pending-invite" };
	}

	const organizationId = resolveAutoJoinOrganizationIdForEmail(
		email,
		rulesConfig,
	);

	if (organizationId) {
		return { type: "auto-join", organizationId };
	}

	return { type: "personal-organization" };
}

export function shouldAutoShareVideoToOrganization({
	organizationId,
	rulesConfig,
	autoShareEnabled,
}: {
	organizationId: Organisation.OrganisationId;
	rulesConfig?: string;
	autoShareEnabled: boolean;
}): boolean {
	if (!autoShareEnabled) {
		return false;
	}

	return parseAutoJoinOrganizationRules(rulesConfig).some(
		(rule) => rule.organizationId === organizationId,
	);
}

export function shouldCreateOrganizationRootShare({
	organizationId,
	rulesConfig,
	autoShareEnabled,
	hasExistingShare,
}: {
	organizationId: Organisation.OrganisationId;
	rulesConfig?: string;
	autoShareEnabled: boolean;
	hasExistingShare: boolean;
}): boolean {
	if (hasExistingShare) {
		return false;
	}

	return shouldAutoShareVideoToOrganization({
		organizationId,
		rulesConfig,
		autoShareEnabled,
	});
}

export function parseAutoJoinOrganizationRules(
	rulesConfig?: string,
): AutoJoinOrganizationRule[] {
	if (!rulesConfig?.trim()) {
		return [];
	}

	return rulesConfig
		.split(",")
		.map((entry) => entry.trim())
		.map((entry) => {
			const [domain, organizationId] = entry
				.split("=")
				.map((part) => part.trim());
			if (!domain || !organizationId || !isValidDomain(domain)) {
				return null;
			}

			return {
				domain: domain.toLowerCase(),
				organizationId: Organisation.OrganisationId.make(organizationId),
			};
		})
		.filter((rule): rule is AutoJoinOrganizationRule => rule !== null);
}

export function extractDomainFromEmail(email: string): string | null {
	// TODO: replace with zod v4's z.email()
	const emailValidation = z.string().email().safeParse(email);
	if (!emailValidation.success) {
		return null;
	}

	// Extract domain from validated email
	const atIndex = email.lastIndexOf("@");
	return atIndex !== -1 ? email.substring(atIndex + 1) : null;
}

function parseAllowedDomains(allowedDomainsConfig: string): string[] {
	return allowedDomainsConfig
		.split(",")
		.map((domain) => domain.trim().toLowerCase())
		.filter((domain) => domain.length > 0 && isValidDomain(domain));
}

function isValidDomain(domain: string): boolean {
	// TODO: replace this polyfill with zod v4's z.hostname()
	const hostnameRegex =
		/^(?=.{1,253}$)(^((?!-)[a-zA-Z0-9-]{1,63}(?<!-)\.)+[a-zA-Z]{2,63}$|localhost)$/;
	return z
		.string()
		.refine((val) => hostnameRegex.test(val), {
			message: "Invalid hostname",
		})
		.safeParse(domain).success;
}
