import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/friends.dto';
import type { Request } from 'express';

interface AuthenticatedUser {
	sub: string;
	email: string | null;
}

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
	constructor(private friendsService: FriendsService) {}

	@Post('request')
	sendRequest(
		@Req() req: Request & { user: AuthenticatedUser },
		@Body() dto: SendFriendRequestDto,
	) {
		return this.friendsService.sendRequest(req.user.sub, dto.receiverId);
	}

	@Post(':id/accept')
	acceptRequest(
		@Req() req: Request & { user: AuthenticatedUser },
		@Param('id') senderId: string,
	) {
		return this.friendsService.acceptRequest(senderId, req.user.sub);
	}

	@Get()
	listFriends(@Req() req: Request & { user: AuthenticatedUser }) {
		return this.friendsService.listFriends(req.user.sub);
	}
}
