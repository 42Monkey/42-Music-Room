import { Injectable, BadGatewayException, NotFoundException } from '@nestjs/common';
import axios from 'axios';

export interface DeezerApi {
	id: string;
	title: string;
	artist: {
		name: string;
	}
	duration: number;
	preview?: string;
	album?: {
		cover_medium?: string;
	}
}

export interface DeezerTrack {
	providerId: string;
	title: string;
	artist: string;
	durationMs: number;
	previewUrl?: string;
	albumCoverUrl?: string;
}

// subject requirements are quite clear
// this wrapper fetches metadata and nothing else
@Injectable()
export class DeezerService {
	async getTrackById(deezerId: string): Promise<DeezerTrack> {
		try {
			const { data } = await axios.get(`https://api.deezer.com/track/${deezerId}`);

		if (data.error) {
			throw new NotFoundException('Track not found on Deezer');
		}

		return {
			providerId: String(data.id),
			title: data.title,
			artist: data.artist?.name ?? 'Unknown artist',
			durationMs: (data.duration ?? 0) * 1000,
			previewUrl: data.preview,
			albumCoverUrl: data.album?.cover_medium,
		};
	} catch (err) {
		if (err instanceof NotFoundException)
			throw err;

		throw new BadGatewayException('Could not reach Deezer');
		}
	}

	async searchTracks(query: string, limit = 10): Promise<DeezerTrack[]> {
		try {
			const { data } = await axios.get(`https://api.deezer.com/search/track`, {
				params: { q: query, limit },
			});

			return (data.data ?? []).map((track: DeezerApi) => ({
				providerId: String(track.id),
				title: track.title,
				artist: track.artist.name,
				durationMs: (track.duration ?? 0) * 1000,
				previewUrl: track.preview,
				albumCoverUrl: track.album?.cover_medium,
			}));
		} catch {
			throw new BadGatewayException('Could not reach Deezer');
		}
	}
}
