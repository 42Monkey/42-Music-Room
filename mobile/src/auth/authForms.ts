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
