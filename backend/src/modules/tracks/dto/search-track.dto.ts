import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchTracksDto {
  @ApiProperty({ example: 'Miles Davis' })
  @IsString()
  @IsNotEmpty()
  query: string;
}
