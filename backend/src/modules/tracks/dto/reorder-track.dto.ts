import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReorderTrackDto {
	@ApiPropertyOptional({ example: 'room_id'})
	@IsOptional()
	@IsUUID()
	afterTrackId?: string | null;
}
