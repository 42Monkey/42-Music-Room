import { PartialType } from '@nestjs/mapped-types';
import { CreateRoomDto } from './create.dto';

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}
