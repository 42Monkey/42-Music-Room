import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { auditUserId } from './audit-user';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// refused requests are logged once, as BLOCKED, by AllExceptionsFilter
const BLOCKED_STATUSES = [HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN];

@Injectable()
export class ActionLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (result) => this.write(req, method, result),
        error: (err) => {
          const status =
            err instanceof HttpException
              ? err.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR;
          if (!BLOCKED_STATUSES.includes(status)) this.write(req, method);
        },
      }),
    );
  }

  private write(req: any, method: string, result?: any) {
    auditUserId(this.prisma, req, result)
      .then((userId) =>
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
        }),
      )
      .catch((err) => {
        console.error('ActionLog write failed:', err);
      });
  }
}
