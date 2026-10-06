import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { LogsService } from './logs.service';

@ApiTags('Logs')
@ApiBearerAuth('access-token')
@Controller('logs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class LogsController {
	constructor(private logsService: LogsService) {}

	@Get()
	@ApiOperation({ summary: 'List recent action logs (admin only)' })
	@ApiQuery({ name: 'limit', required: false, description: 'Max rows to return (default 50)' })
	@ApiResponse({ status: 200, description: 'Recent action log entries' })
	@ApiResponse({ status: 403, description: 'Admin access required' })
	findRecent(@Query('limit') limit?: string) {
		const parsed = limit ? parseInt(limit, 10) : undefined;
		return this.logsService.findRecent(parsed);
	}
}
