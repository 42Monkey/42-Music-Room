import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/friends.dto';
import type { Request } from 'express';

interface AuthenticatedUser {
	id: string;
	email: string | null;
}

@ApiTags('Friends')
@ApiBearerAuth('access-token')
@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
	constructor(private friendsService: FriendsService) {}

	@Post('request')
	@ApiOperation({ summary: 'Send a friend request' })
	@ApiBody({ type: SendFriendRequestDto })
	@ApiResponse({ status: 201, description: 'Friend request sent' })
	sendRequest(
		@Req() req: Request & { user: AuthenticatedUser },
		@Body() dto: SendFriendRequestDto,
	) {
		return this.friendsService.sendRequest(req.user.id, dto.receiverId);
	}

	@Post(':id/accept')
	@ApiOperation({ summary: 'Accept an incoming friend request' })
	@ApiParam({ name: 'id', description: 'Sender user ID' })
	@ApiResponse({ status: 200, description: 'Friend request accepted' })
	acceptRequest(
		@Req() req: Request & { user: AuthenticatedUser },
		@Param('id') senderId: string,
	) {
		return this.friendsService.acceptRequest(senderId, req.user.id);
	}

	@Get('requests')
	@ApiOperation({ summary: 'Get pending friend requests received by the current user' })
	@ApiResponse({ status: 200, description: 'List of pending friend requests' })
	getPendingRequests(@Req() req: Request & { user: AuthenticatedUser }) {
		return this.friendsService.getPendingRequests(req.user.id);
	}

	@Get()
	@ApiOperation({ summary: 'List accepted friends for current user' })
	@ApiResponse({ status: 200, description: 'List of friends' })
	listFriends(@Req() req: Request & { user: AuthenticatedUser }) {
		return this.friendsService.listFriends(req.user.id);
	}
}
