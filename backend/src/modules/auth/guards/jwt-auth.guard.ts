import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// @nestjs/passport does the heavy work
// extracts the header, check signature and calls the strategy's validate()
// JwtAuthGuard give it a name, easier to reference with @UseGuards
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
