import type { RegisterInput } from '@/types/api';

export type LoginForm = {
	email: string;
	password: string;
};

export type LoginFormErrors = {
	email?: string;
	password?: string;
};

export type LoginFormResult = { ok: true; input: LoginForm } | { ok: false; errors: LoginFormErrors };

// Loose on purpose: catches typos, the backend does the strict check
export function isEmail(text: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

// Email field: required and shaped like an email
function emailError(email: string): string | undefined {
	if (!email) return 'Enter your email.';
	if (!isEmail(email)) return 'Enter a valid email, like name@example.com.';
	return undefined;
}

// Checks the login form and builds the body for POST /auth/login
export function validateLoginForm(form: LoginForm): LoginFormResult {
	const errors: LoginFormErrors = {};
	// Trimmed but not lowercased: the backend matches the email exactly as it was registered
	const email = form.email.trim();
	const emailProblem = emailError(email);
	if (emailProblem) errors.email = emailProblem;
	// No length rule on login: only register and reset choose a password
	if (!form.password) errors.password = 'Enter your password.';

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return { ok: true, input: { email, password: form.password } };
}

export type RegisterForm = {
	displayName: string;
	email: string;
	password: string;
};

export type RegisterFormErrors = {
	displayName?: string;
	email?: string;
	password?: string;
};

export type RegisterFormResult = { ok: true; input: RegisterInput } | { ok: false; errors: RegisterFormErrors };

// Same limits as the backend: 2 to register, 50 to edit the profile later
const NAME_MIN = 2;
const NAME_MAX = 50;
const PASSWORD_MIN = 8;

// Checks the sign-up form and builds the body for POST /auth/register
export function validateRegisterForm(form: RegisterForm): RegisterFormResult {
	const errors: RegisterFormErrors = {};
	const displayName = form.displayName.trim();
	if (displayName.length < NAME_MIN) errors.displayName = `Enter a name of at least ${NAME_MIN} characters.`;
	else if (displayName.length > NAME_MAX) errors.displayName = `Keep the name under ${NAME_MAX} characters.`;

	const email = form.email.trim();
	const emailProblem = emailError(email);
	if (emailProblem) errors.email = emailProblem;

	// Not trimmed: spaces can be part of a password
	if (form.password.length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters.`;

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return { ok: true, input: { displayName, email, password: form.password } };
}
