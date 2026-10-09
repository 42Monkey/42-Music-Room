import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update.dto';
import type { Request } from 'express';

interface AuthenticatedUser {
  id: string;
  email: string | null;
}

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
	constructor(private usersService: UsersService) {}

	@Get()
	@ApiOperation({ summary: 'Search users by display name or email' })
	@ApiQuery({ name: 'search', required: false, description: 'Query string to search users' })
	@ApiResponse({ status: 200, description: 'List of matching users with public profile fields only' })
	searchUsers(@Query('search') search?: string) {
		return this.usersService.searchUsers(search);
	}

	@Get('me')
	@ApiOperation({ summary: 'Get the authenticated user profile' })
	@ApiResponse({ status: 200, description: 'Current user profile' })
	getOwnProfile(@Req() req: Request & { user: AuthenticatedUser }) {
		return this.usersService.getOwnProfile(req.user.id);
	}

	@Patch('me')
	@ApiOperation({ summary: 'Update the authenticated user profile' })
	@ApiBody({ type: UpdateProfileDto })
	@ApiResponse({ status: 200, description: 'Profile updated' })
	updateProfile(@Req() req: Request & { user: AuthenticatedUser }, @Body() dto: UpdateProfileDto) {
		return this.usersService.updateProfile(req.user.id, dto);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get a user profile by id' })
	@ApiParam({ name: 'id', description: 'User id' })
	@ApiResponse({ status: 200, description: 'User profile returned' })
	getUserProfile(@Param('id') id: string, @Req() req: Request & { user: AuthenticatedUser }) {
		return this.usersService.getProfileForViewer(id, req.user.id);
	}
}
