import { Body, Controller, Delete, Param, Post, Get, Patch, Req, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessPolicyGuard } from '../rooms/guards/access.guard';
import { TracksService } from './tracks.service';
import { AddTrackDto } from './dto/add-track.dto';
import { ReorderTrackDto } from './dto/reorder-track.dto';
import { SearchTracksDto } from './dto/search-track.dto';
import type { Request } from 'express';

interface AuthenticatedUser {
	id: string;
	email: string | null;
}

@ApiTags('Tracks')
@ApiBearerAuth('access-token')
@Controller('rooms/:roomId/tracks')
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
export class TracksController {
	constructor(private tracksService: TracksService) {}

	@Post()
	@ApiOperation({ summary: 'Add a track to the room queue' })
	@ApiParam({ name: 'roomId', description: 'Room id' })
	@ApiBody({ type: AddTrackDto })
	@ApiResponse({ status: 201, description: 'Track added to queue' })
	addTrack(
		@Param('roomId') roomId: string,
		@Body() dto: AddTrackDto,
	) {
		return this.tracksService.addTrack(roomId, dto.deezerTrackId);
	}

	@Delete(':trackId')
	@ApiOperation({ summary: 'Remove a track from the queue' })
	@ApiParam({ name: 'roomId', description: 'Room id' })
	@ApiParam({ name: 'trackId', description: 'Track id in room queue' })
	@ApiResponse({ status: 200, description: 'Track removed' })
	removeTrack(
		@Param('roomId') roomId: string,
		@Param('trackId') trackId: string,
		@Req() req: Request & { user: AuthenticatedUser },
	) {
			return this.tracksService.removeTrack(roomId, trackId, req.user.id);
	}

	@Post(':trackId/vote')
	@ApiOperation({ summary: 'Vote for a track' })
	@ApiParam({ name: 'roomId', description: 'Room id' })
	@ApiParam({ name: 'trackId', description: 'Track id in room queue' })
	@ApiResponse({ status: 201, description: 'Vote added' })
	vote(
		@Param('roomId') roomId: string,
		@Param('trackId') trackId: string,
		@Req() req: Request & { user: AuthenticatedUser },
	) {
		return this.tracksService.voteForTrack(roomId, trackId, req.user.id);
	}

	@Delete(':trackId/vote')
	@ApiOperation({ summary: 'Remove a vote from a track' })
	@ApiParam({ name: 'roomId', description: 'Room id' })
	@ApiParam({ name: 'trackId', description: 'Track id in room queue' })
	@ApiResponse({ status: 200, description: 'Vote removed' })
	unvote(
		@Param('roomId') roomId: string,
		@Param('trackId') trackId: string,
		@Req() req: Request & { user: AuthenticatedUser },
	) {
		return this.tracksService.unvoteTrack(roomId, trackId, req.user.id);
	}

	@Get()
	@ApiOperation({ summary: 'Get the current room queue' })
	@ApiParam({ name: 'roomId', description: 'Room id' })
	@ApiResponse({ status: 200, description: 'Queue returned, votedByMe says if the caller voted for each track' })
	getQueue(
		@Param('roomId') roomId: string,
		@Req() req: Request & { user: AuthenticatedUser },
	) {
		return this.tracksService.getQueue(roomId, req.user.id);
	}

	@Patch(':trackId/position')
	@ApiOperation({ summary: 'Reorder a track in the queue' })
	@ApiParam({ name: 'roomId', description: 'Room id' })
	@ApiParam({ name: 'trackId', description: 'Track id in room queue' })
	@ApiBody({ type: ReorderTrackDto })
	@ApiResponse({ status: 200, description: 'Queue reordered' })
	reorder(
		@Param('roomId') roomId: string,
		@Param('trackId') trackId: string,
		@Body() dto: ReorderTrackDto,
	) {
		return this.tracksService.reorderTrack(roomId, trackId, dto.afterTrackId ?? null);
	}

	@Get('search')
	@ApiOperation({ summary: 'Search for tracks' })
	@ApiParam({ name: 'roomId', description: 'Room id' })
	@ApiQuery({ name: 'query', required: true, description: 'Track search query' })
	@ApiResponse({ status: 200, description: 'Matching tracks returned' })
	searchTracks(
		@Param('roomId') roomId: string,
		@Query() dto: SearchTracksDto,
	) {
		return this.tracksService.searchTracks(dto.query);
	}

	@Post('next')
	@ApiOperation({ summary: 'Advance to the next track in the room' })
	@ApiParam({ name: 'roomId', description: 'Room id' })
	@ApiResponse({ status: 200, description: 'Next track triggered' })
	triggerNext(
		@Param('roomId') roomId: string,
		@Req() req: Request & { user: AuthenticatedUser },
	) {
		return this.tracksService.triggerNext(roomId, req.user.id);
	}
}
