import { IsEmail, IsString, Min, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
	@ApiProperty({ example: '42Monkey@example.com' })
	@IsEmail()
	email: string;

	@ApiProperty({ example: 'password123', minLength: 8 })
	@IsString()
	@MinLength(8)
	password: string;
}
