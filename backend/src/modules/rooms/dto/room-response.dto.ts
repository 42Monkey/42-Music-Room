import { ApiProperty } from '@nestjs/swagger';

export class RoomResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Chill Lofi Beats' })
  name: string;

  @ApiProperty({ example: 'public', enum: ['public', 'private'] })
  visibility: string;

  @ApiProperty({ example: 'open', enum: ['open', 'invite-only', 'restricted'] })
  accessPolicy: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  ownerId: string;

  @ApiProperty({ example: '2026-10-28T10:23:00.000Z' })
  createdAt: string;
}

export class RoomMessageResponseDto {
  @ApiProperty({ example: 'Access granted' })
  message: string;
}
