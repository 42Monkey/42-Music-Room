import type { Profile, ProfileChanges, User } from '@/types/api';
import { api } from './client';

// Only the fields sent are changed
export const updateMe = (changes: ProfileChanges) => api.patch<User>('/users/me', changes);

// Someone else, with only what the backend lets the user see
export const getUser = (userId: string) => api.get<Profile>(`/users/${userId}`);
