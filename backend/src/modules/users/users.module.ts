import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController, FriendsController],
  providers: [UsersService, FriendsService],
  exports: [UsersService, FriendsService],
})
export class UsersModule {}
