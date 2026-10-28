import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembersService } from './members.service';
import { InviteMemberDto } from './dto/invite.dto';
import { MemberResponseDto, MemberMessageResponseDto } from './dto/member-response.dto';
import type { Request } from 'express';

interface AuthenticatedUser {
  id: string;
  email: string | null;
}

@ApiTags('Room Members')
@ApiBearerAuth('access-token')
@Controller('rooms/:roomId/members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private roomMembersService: MembersService) {}

  @Post()
  @ApiOperation({ summary: 'Invite a member to a room' })
  @ApiParam({ name: 'roomId', description: 'Room id' })
  @ApiBody({ type: InviteMemberDto })
  @ApiResponse({ status: 201, description: 'Member invited', type: MemberResponseDto })
  invite(
    @Param('roomId') roomId: string,
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: InviteMemberDto,
  ) {
    return this.roomMembersService.invite(roomId, req.user.id, dto.userId);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove a member from a room' })
  @ApiParam({ name: 'roomId', description: 'Room id' })
  @ApiParam({ name: 'userId', description: 'Member user id' })
  @ApiResponse({ status: 200, description: 'Member removed', type: MemberMessageResponseDto })
  remove(
    @Param('roomId') roomId: string,
    @Param('userId') targetUserId: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.roomMembersService.remove(roomId, req.user.id, targetUserId);
  }

  @Get()
  @ApiOperation({ summary: 'List room members' })
  @ApiParam({ name: 'roomId', description: 'Room id' })
  @ApiResponse({ status: 200, description: 'Room members returned', type: MemberResponseDto, isArray: true })
  list(
    @Param('roomId') roomId: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.roomMembersService.listMembers(roomId, req.user.id);
  }
}
