import type { Profile, ProfileChanges, User } from '@/types/api';
import { api } from './client';

// The logged-in user, with every field
export const getMe = () => api.get<User>('/users/me');

// Only the fields sent are changed
export const updateMe = (changes: ProfileChanges) => api.patch<User>('/users/me', changes);

// Someone else, with only what the backend lets the user see
export const getUser = (userId: string) => api.get<Profile>(`/users/${userId}`);
