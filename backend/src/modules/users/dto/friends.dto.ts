import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendFriendRequestDto {
  @ApiProperty({ example: 'unique_uuid' })
  @IsUUID()
  receiverId: string;
}
