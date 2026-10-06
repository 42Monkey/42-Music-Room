import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { Socket } from 'socket.io';

interface AuthedSocket extends Socket {
	user?: { id: string; email: string | null; role: string };
}

@Injectable()
export class WsJwtGuard implements CanActivate {
	constructor(
		private jwt: JwtService,
		private authService: AuthService,
	) {}

	// intercepts WebSocket connection attempts to validate auth tokens
	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Cast the client to our AuthedSocket type
		const client: AuthedSocket = context.switchToWs().getClient();

		// extracts the JWT token from auth
		const token = client.handshake.auth?.token;

		// rejects connection if no token is provided
		if (!token) {
			throw new UnauthorizedException('No token provided');
		}

		try {
			// verifies the token signature and expiration
			const payload = await this.jwt.verifyAsync(token);

			// checks if user is still exists in the database
			const user = await this.authService.validateUser(payload);

			// attaches user data directly to the typed socket object
			client.user = user;
			return true;
		} catch {
			throw new UnauthorizedException('Invalid or expired token');
		}
	}
}
