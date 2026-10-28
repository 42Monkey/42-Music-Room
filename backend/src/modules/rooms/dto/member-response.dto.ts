import { ApiProperty } from '@nestjs/swagger';

export class MemberResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  roomId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  userId: string;

  @ApiProperty({ example: 'MEMBER', enum: ['OWNER', 'ADMIN', 'MEMBER'] })
  role: string;

  @ApiProperty({ example: '2026-10-28T10:23:00.000Z' })
  createdAt: string;
}

export class MemberMessageResponseDto {
  @ApiProperty({ example: 'Member removed successfully' })
  message: string;
}
