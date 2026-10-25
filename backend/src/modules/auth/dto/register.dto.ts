import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '../../../common/decorators/normalize-email.decorator';

export class RegisterDto {
  @ApiProperty({ example: '42Monkey@example.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Tony Tony Chopper', minLength: 2 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName: string;
}
