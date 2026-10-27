import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { AccessPolicyGuard } from './guards/access.guard';
import { RoomsGateway } from './rooms.gateway';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RoomsController, MembersController],
  providers: [RoomsService, MembersService, AccessPolicyGuard, RoomsGateway],
  exports: [RoomsService, MembersService, AccessPolicyGuard],
})
export class RoomsModule {}
