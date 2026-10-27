import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { INestApplicationContext } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(host: string, port: number): Promise<void> {
    const pubClient = new Redis({ host, port });
    const subClient = pubClient.duplicate();

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  // tried to not use any as much as possible
  // platform-socket has its own nested copy of socket.io in its node-modules
  // this creates a type collision with the top-level socket.io and redis-adapter packages
  // using any here to bridge the two type trees clearnly at compile time, often happens with Redis
  createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
