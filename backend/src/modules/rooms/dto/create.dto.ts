import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { RoomKind, Visibility, AccessPolicy } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ example: 'New Orleans Jazz', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'A public room for jazz lovers',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: RoomKind, example: RoomKind.VOTE })
  @IsEnum(RoomKind)
  kind: RoomKind;

  @ApiPropertyOptional({ enum: Visibility, example: Visibility.PUBLIC })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @ApiPropertyOptional({ enum: AccessPolicy, example: AccessPolicy.OPEN })
  @IsOptional()
  @IsEnum(AccessPolicy)
  accessPolicy?: AccessPolicy;

  @ApiPropertyOptional({ example: 48.8566 })
  @IsOptional()
  @IsNumber()
  locationLat?: number;

  @ApiPropertyOptional({ example: 2.3522 })
  @IsOptional()
  @IsNumber()
  locationLng?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  locationRadiusM?: number;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00Z' })
  @IsOptional()
  @IsString()
  windowStart?: string;

  @ApiPropertyOptional({ example: '2026-12-31T00:00:00Z' })
  @IsOptional()
  @IsString()
  windowEnd?: string;
}
