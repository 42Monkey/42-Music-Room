import { IsEmail, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
	@ApiProperty({ example: '42Monkey@example.com' })
	@IsEmail()
	email: string;

	@ApiProperty({ example: 'password123', minLength: 8 })
	@IsString()
	@MinLength(8)
	password: string;

	@ApiProperty({ example: 'Tony Tony Chopper', minLength: 2 })
	@IsString()
	@MinLength(2)
	displayName: string;
}
