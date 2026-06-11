import { buildEnv, serverEnv } from "@cap/env";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import type { JSXElementConstructor, ReactElement } from "react";
import { Resend } from "resend";

type EmailProvider = "resend" | "smtp";

export const resend = () =>
	serverEnv().RESEND_API_KEY ? new Resend(serverEnv().RESEND_API_KEY) : null;

const provider = (): EmailProvider | null => {
	const env = serverEnv();
	if (env.EMAIL_PROVIDER) return env.EMAIL_PROVIDER;
	if (env.RESEND_API_KEY) return "resend";
	if (env.SMTP_HOST && env.SMTP_USERNAME && env.SMTP_PASSWORD && env.SMTP_FROM)
		return "smtp";
	return null;
};

export const isEmailConfigured = () => {
	const env = serverEnv();
	const p = provider();
	if (p === "resend") return !!env.RESEND_API_KEY;
	if (p === "smtp")
		return !!(
			env.SMTP_HOST &&
			env.SMTP_USERNAME &&
			env.SMTP_PASSWORD &&
			env.SMTP_FROM
		);
	return false;
};

export const supportsScheduledEmail = () =>
	provider() === "resend" && isEmailConfigured();

const fromAddress = ({
	provider,
	marketing,
	fromOverride,
}: {
	provider: EmailProvider;
	marketing?: boolean;
	fromOverride?: string;
}) => {
	const env = serverEnv();
	if (provider === "smtp") return env.SMTP_FROM;
	if (fromOverride) return fromOverride;
	if (marketing) return "Richie from Cap <richie@send.cap.so>";
	if (buildEnv.NEXT_PUBLIC_IS_CAP) return "Cap Auth <no-reply@auth.cap.so>";
	return `auth@${env.RESEND_FROM_DOMAIN}`;
};

export const sendEmail = async ({
	email,
	subject,
	react,
	marketing,
	test,
	scheduledAt,
	cc,
	replyTo,
	fromOverride,
}: {
	email: string;
	subject: string;
	react: ReactElement<unknown, string | JSXElementConstructor<unknown>>;
	marketing?: boolean;
	test?: boolean;
	scheduledAt?: string;
	cc?: string | string[];
	replyTo?: string;
	fromOverride?: string;
}) => {
	const p = provider();
	if (!p) {
		return Promise.resolve();
	}

	if (marketing && !buildEnv.NEXT_PUBLIC_IS_CAP) return;

	const from = fromAddress({ provider: p, marketing, fromOverride });
	if (!from) return Promise.resolve();

	if (p === "resend") {
		const r = resend();
		if (!r) return Promise.resolve();

		return r.emails.send({
			from,
			to: test ? "delivered@resend.dev" : email,
			subject,
			react,
			scheduledAt,
			cc: test ? undefined : cc,
			replyTo: replyTo,
		});
	}

	if (scheduledAt) return Promise.resolve();

	const env = serverEnv();
	if (!env.SMTP_HOST || !env.SMTP_USERNAME || !env.SMTP_PASSWORD) {
		return Promise.resolve();
	}

	const port = Number.parseInt(env.SMTP_PORT ?? "587", 10);
	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: Number.isFinite(port) ? port : 587,
		secure: env.SMTP_SECURE,
		requireTLS: env.SMTP_REQUIRE_TLS,
		auth: {
			user: env.SMTP_USERNAME,
			pass: env.SMTP_PASSWORD,
		},
	});
	const headers = env.SMTP_MESSAGE_STREAM
		? { "X-PM-MESSAGE-STREAM": env.SMTP_MESSAGE_STREAM }
		: undefined;

	return transporter.sendMail({
		from,
		to: email,
		subject,
		html: await render(react),
		text: await render(react, { plainText: true }),
		cc,
		replyTo,
		headers,
	});
};
