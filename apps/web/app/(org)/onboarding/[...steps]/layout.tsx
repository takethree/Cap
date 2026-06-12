import { getCurrentUser } from "@cap/database/auth/session";
import { redirect } from "next/navigation";

const orderedOnboardingSteps = [
	"welcome",
	"organization-setup",
	"custom-domain",
	"invite-team",
	"download",
] as const;

type OrderedOnboardingStep = (typeof orderedOnboardingSteps)[number];

type UserOnboardingSteps = {
	welcome?: boolean;
	organizationSetup?: boolean;
	customDomain?: boolean;
	inviteTeam?: boolean;
	download?: boolean;
};

export function getFirstIncompleteOnboardingStep({
	steps,
	userName,
}: {
	steps: UserOnboardingSteps;
	userName: string | null;
}) {
	const isComplete = (step: OrderedOnboardingStep) =>
		step === "welcome"
			? Boolean(steps.welcome && userName)
			: step === "organization-setup"
				? Boolean(steps.organizationSetup)
				: step === "custom-domain"
					? Boolean(steps.customDomain)
					: step === "invite-team"
						? Boolean(steps.inviteTeam)
						: Boolean(steps.download);

	return orderedOnboardingSteps.find((step) => !isComplete(step)) ?? "download";
}

export default async function OnboardingStepLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ steps: string[] }>;
}) {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/login");
	}

	const steps = user.onboardingSteps || {};
	const currentStep = (await params).steps?.[0] ?? "welcome";
	const firstIncomplete = getFirstIncompleteOnboardingStep({
		steps,
		userName: user.name,
	});

	if (currentStep !== firstIncomplete) {
		redirect(`/onboarding/${firstIncomplete}`);
	}

	return children;
}
