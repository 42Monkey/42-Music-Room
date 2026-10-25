import { IsEmail } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ResendVerificationDto {
	@ApiProperty({ example: '42Monkey@example.com' })
	@IsEmail()
	email: string;
}
