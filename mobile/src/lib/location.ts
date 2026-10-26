import * as Location from 'expo-location';
import type { Position } from '@/types/api';

// Location refused by the user, or not found by the phone
export class LocationError extends Error {
	constructor(public readonly reason: 'denied' | 'unavailable') {
		super(`Location ${reason}`);
		this.name = 'LocationError';
	}
}

// Asks permission once, then reads where the phone is
export async function currentPosition(): Promise<Position> {
	const { status } = await Location.requestForegroundPermissionsAsync();
	if (status !== 'granted') throw new LocationError('denied');
	try {
		const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
		return { lat: coords.latitude, lng: coords.longitude };
	} catch {
		throw new LocationError('unavailable');
	}
}
