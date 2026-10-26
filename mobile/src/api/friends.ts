import type { FriendRequest, UserSummary } from '@/types/api';
import { api } from './client';

// People who accepted, either way
export const listFriends = () => api.get<UserSummary[]>('/friends');

// Requests sent to the user, not accepted yet
export const listFriendRequests = () => api.get<FriendRequest[]>('/friends/requests');

export const sendFriendRequest = (userId: string) => api.post<unknown>('/friends/request', { receiverId: userId });

// Takes the sender's id, not the request's
export const acceptFriendRequest = (senderId: string) => api.post<unknown>(`/friends/${senderId}/accept`);
