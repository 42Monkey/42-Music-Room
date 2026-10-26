import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleMobileAuthDto {
	@ApiProperty({
		example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
		description: 'Google ID token issued to the mobile app upon Google Sign-In',
	})
	@IsString()
	@IsNotEmpty()
	idToken: string;
}
