import { ApiProperty } from '@nestjs/swagger';

export class ActionLogResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'GET /auth/me' })
  action: string;

  @ApiProperty({ example: '172.18.0.1' })
  ipAddress: string;

  @ApiProperty({ example: '2026-10-28T10:23:00.000Z' })
  createdAt: string;
}
