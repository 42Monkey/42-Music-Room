import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '../../../common/decorators/normalize-email.decorator';

export class RequestPasswordResetDto {
  @ApiProperty({ example: '42Monkey@example.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;
}
