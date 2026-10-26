import type { Profile, ProfileChanges, User, UserSummary } from '@/types/api';
import { api } from './client';

// Only the fields sent are changed
export const updateMe = (changes: ProfileChanges) => api.patch<User>('/users/me', changes);

// People by name or email (to invite, to add as friends)
export const searchUsers = (text: string) => api.get<UserSummary[]>(`/users?search=${encodeURIComponent(text)}`);

// Someone else, with only what the backend lets the user see
export const getUser = (userId: string) => api.get<Profile>(`/users/${userId}`);
