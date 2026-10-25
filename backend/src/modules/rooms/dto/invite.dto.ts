import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteMemberDto {
  @ApiProperty({ example: 'unique_uuid_invited_user' })
  @IsUUID()
  userId: string;
}
