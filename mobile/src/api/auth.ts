import type { Message, RegisterInput, RegisteredUser, ResetPasswordInput, Tokens } from '@/types/api';
import { api } from './client';

// Email + password login, the screen hands the tokens to signIn
export const login = (email: string, password: string) => api.post<Tokens>('/auth/login', { email, password });

// New account, a verification code is sent by email
export const register = (input: RegisterInput) => api.post<RegisteredUser>('/auth/register', input);

// Sends a reset code by email (same answer whether the account exists or not)
export const requestPasswordReset = (email: string) => api.post<Message>('/auth/request-password-reset', { email });

// New password with the code from the email
export const resetPassword = (input: ResetPasswordInput) => api.post<Message>('/auth/reset-password', input);

// Checks the 6-digit code sent by email after sign-up
export const verifyEmail = (email: string, code: string) =>
	api.get<Message>(`/auth/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(code)}`);

// Sends a new verification code (same answer whether the account exists or not)
export const resendVerification = (email: string) => api.post<Message>('/auth/resend-verification', { email });

// Log in or sign up with the id token Google gave the app, same tokens as login
export const googleLogin = (idToken: string) => api.post<Tokens>('/auth/google/mobile', { idToken });
