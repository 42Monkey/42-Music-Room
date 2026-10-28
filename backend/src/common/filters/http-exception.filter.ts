import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { auditUserId } from '../interceptors/audit-user';

const SECURITY_STATUSES = [HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN];

// @Catch() intercepts every unhandled exception in the app
// - deliberate HTTP error thrown (ex: 401 Unauthorized)
// - validation error from the pipe
// - or a backend crash (db failure or a null pointer error)
// it standardizes the responses, forcing every error response into a JSON
// logs server-side for 500s, and writes a security ActionLog entry for 401/403s
// (ActionLogInterceptor skips them, so each refused request is logged once)
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly prisma: PrismaService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: { id: string } }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    // the user when logged in, else the account aimed at (failed login by email)
    if (SECURITY_STATUSES.includes(status)) {
      auditUserId(this.prisma, request)
        .then((userId) =>
          this.prisma.actionLog.create({
            data: {
              userId,
              action: `BLOCKED ${request.method} ${request.route?.path ?? request.url}`,
              endpoint: request.originalUrl ?? request.url,
              method: request.method,
              platform: (request.headers['x-platform'] as string) ?? null,
              device: (request.headers['x-device'] as string) ?? null,
              appVersion: (request.headers['x-app-version'] as string) ?? null,
              ipAddress: request.ip ?? null,
            },
          }),
        )
        .catch((err) => {
          this.logger.error('ActionLog write failed (blocked attempt): ' + err);
        });
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message:
        typeof message === 'string'
          ? message
          : ((message as { message?: string | string[] }).message ?? message),
    });
  }
}
