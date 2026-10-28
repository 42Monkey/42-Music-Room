import { ApiProperty } from '@nestjs/swagger';

export class FriendshipResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  senderId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  receiverId: string;

  @ApiProperty({ example: 'PENDING', enum: ['PENDING', 'ACCEPTED'] })
  status: string;

  @ApiProperty({ example: '2026-10-28T10:23:00.000Z' })
  createdAt: string;
}

export class FriendMessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}
