import { IsEmail, IsString, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger';

export class EmailDto {
	@ApiProperty({ example: '42Monkey@example.com' })
	@IsEmail()
	email: string;

	@ApiProperty({ example: '123456' })
	@IsString()
	@Length(6, 6)
	token: string;
}
