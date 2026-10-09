import { IsOptional, IsString, IsObject, MaxLength, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
	@ApiPropertyOptional({ example: 'El Monkey', maxLength: 50})
	@IsOptional()
	@IsString()
	@MaxLength(50)
	displayName?: string;

	@ApiPropertyOptional({ example: 'Not a monkey', maxLength: 500 })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	bio?: string;

	@ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
	@IsOptional()
	@IsString()
	avatarUrl?: string;

	@ApiPropertyOptional({ example: 'Pyongyan, North Korea', maxLength: 100 })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	location?: string;

	@ApiPropertyOptional({ example: '+1234567890', maxLength: 30 })
	@IsOptional()
	@IsString()
	@MaxLength(30)
	phoneNumber?: string;

	@ApiPropertyOptional({ example: { genres: ['jazz', 'blues', 'classical'] } })
	@IsOptional()
	@IsObject()
	musicPreference?: Record<string, any>;

	@ApiPropertyOptional({ example: '1995-05-15', description: 'User birth date (ISO date string, strictly private)' })
	@IsOptional()
	@IsDateString()
	birthDate?: string;
}
