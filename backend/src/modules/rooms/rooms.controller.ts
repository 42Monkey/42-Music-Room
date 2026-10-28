import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create.dto';
import { UpdateRoomDto } from './dto/update.dto';
import { RoomResponseDto, RoomMessageResponseDto } from './dto/room-response.dto';
import { AccessPolicyGuard } from './guards/access.guard';
import type { Request } from 'express';

interface AuthenticatedUser {
  id: string;
  email: string | null;
}

@ApiTags('Rooms')
@ApiBearerAuth('access-token')
@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new room' })
  @ApiBody({ type: CreateRoomDto })
  @ApiResponse({ status: 201, description: 'Room created', type: RoomResponseDto })
  create(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List rooms visible to the authenticated user' })
  @ApiResponse({ status: 200, description: 'Rooms list returned', type: RoomResponseDto, isArray: true })
  findAll(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.roomsService.findAllVisibleTo(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a room by id' })
  @ApiParam({ name: 'id', description: 'Room id' })
  @ApiResponse({ status: 200, description: 'Room returned', type: RoomResponseDto })
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.roomsService.findOneVisibleTo(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a room' })
  @ApiParam({ name: 'id', description: 'Room id' })
  @ApiBody({ type: UpdateRoomDto })
  @ApiResponse({ status: 200, description: 'Room updated', type: RoomResponseDto })
  update(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a room' })
  @ApiParam({ name: 'id', description: 'Room id' })
  @ApiResponse({ status: 200, description: 'Room deleted', type: RoomMessageResponseDto })
  remove(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.roomsService.remove(id, req.user.id);
  }

  // for testing purposes only, remove for Phase 3
  @Get(':roomId/test-access')
  @UseGuards(AccessPolicyGuard)
  @ApiOperation({ summary: 'Check room access policy' })
  @ApiParam({ name: 'roomId', description: 'Room id' })
  @ApiResponse({ status: 200, description: 'Access granted', type: RoomMessageResponseDto })
  testAccess() {
    return { message: 'Access granted' };
  }
}
