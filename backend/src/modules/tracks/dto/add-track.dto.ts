import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddTrackDto {
	@ApiProperty({ example: 'deezer_track_id' })
	@IsString()
	deezerTrackId: string;
}
