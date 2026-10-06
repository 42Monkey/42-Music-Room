import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {  ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis-io.adapter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const config = app.get(ConfigService);

	app.useGlobalPipes(
		new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
	);

	const swagConfig = new DocumentBuilder()
		.setTitle('Music Room API')
		.setDescription('Music Room Backend')
		.setVersion('1.0')
		.addBearerAuth(
			{ type: 'http', scheme: 'bearer', bearerFormat: 'JWT'},
			'access-token',
		)
		.build();
	const swaggerDocument = SwaggerModule.createDocument(app, swagConfig);
	SwaggerModule.setup('docs', app, swaggerDocument);

	const redisIoAdapter = new RedisIoAdapter(app);
	await redisIoAdapter.connectToRedis(
		config.get<string>('REDIS_HOST')!,
		config.get<number>('REDIS_PORT')!,
	);
	app.useWebSocketAdapter(redisIoAdapter);

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
