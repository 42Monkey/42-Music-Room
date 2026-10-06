import { IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
	@ApiProperty({ example: 'reset_token '})
	@IsString()
	token: string;

	@ApiProperty({ example: 'newPassword123', minLength: 8 })
	@IsString()
	@MinLength(8)
	newPassword: string;
}
