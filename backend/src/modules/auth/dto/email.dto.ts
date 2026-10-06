import { IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger';

export class EmailDto {
	@ApiProperty({ example: 'verification_token' })
	@IsString()
	token: string;
}
