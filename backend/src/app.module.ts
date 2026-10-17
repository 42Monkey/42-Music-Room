import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { TracksModule } from './modules/tracks/tracks.module';
import { LogsModule } from './modules/logs/logs.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ActionLogInterceptor } from './common/interceptors/log.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			validationSchema: envValidationSchema,
		}),
		ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => [
                {
                    ttl: 60000,
                    limit: config.get('LOAD_TEST') === 'true' ? 10000 : 100,
                },
            ],
        }),
		EventEmitterModule.forRoot(),
		PrismaModule,
		AuthModule,
		UsersModule,
		RoomsModule,
		TracksModule,
		LogsModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: ActionLogInterceptor,
		},
		{
			provide: APP_FILTER,
			useClass: AllExceptionsFilter,
		}
	],
})
export class AppModule {}
