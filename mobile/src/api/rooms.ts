import type { Room } from '@/types/api';
import { api } from './client';

// Rooms the user can see: public, owned or invited to
export const listRooms = () => api.get<Room[]>('/rooms');
