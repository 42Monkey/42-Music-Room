import { IsEmail } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordResetDto {
	@ApiProperty({ example: '42Monkey@example.com' })
	@IsEmail()
	email: string;
}
