import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActionLogInterceptor implements NestInterceptor {
	constructor(private prisma: PrismaService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const req = context.switchToHttp().getRequest();
		const method = req.method;

		return next.handle().pipe(
			finalize(() => {
				const userId = req.user?.id ?? null;
				this.prisma.actionLog.create({
					data: {
						userId,
						action: `${method} ${req.route?.path ?? req.url}`,
						endpoint: req.originalUrl ?? req.url,
						method,
						platform: req.headers['x-platform'] ?? null,
						device: req.headers['x-device'] ?? null,
						appVersion: req.headers['x-app-version'] ?? null,
						ipAddress: req.ip ?? null,
					},
				}).catch((err) => {
					console.error('ActionLog write failed:', err);
				});
			}),
		);
	}
}
