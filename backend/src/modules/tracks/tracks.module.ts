import { Module } from '@nestjs/common';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';
import { DeezerService } from './deezer.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TracksController],
  providers: [TracksService, DeezerService],
  exports: [TracksService, DeezerService],
})
export class TracksModule {}
