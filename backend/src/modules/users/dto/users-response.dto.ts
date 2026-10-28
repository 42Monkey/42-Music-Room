import { ApiProperty } from '@nestjs/swagger';

export class UserProfileResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '42Monkey@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: 'Tony Tony Chopper' })
  displayName?: string;
}
