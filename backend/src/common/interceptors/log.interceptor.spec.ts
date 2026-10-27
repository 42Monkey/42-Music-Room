import { of } from 'rxjs';
import { ActionLogInterceptor } from './log.interceptor';

describe('ActionLogInterceptor', () => {
  const create = jest.fn().mockResolvedValue({});
  const interceptor = new ActionLogInterceptor({
    actionLog: { create },
  } as any);

  const run = async (method: string) => {
    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          url: '/rooms',
          originalUrl: '/rooms',
          headers: {},
          user: { id: 'u1' },
        }),
      }),
    };
    await new Promise<void>((resolve) =>
      interceptor
        .intercept(ctx, { handle: () => of('ok') })
        .subscribe({ complete: () => resolve() }),
    );
    await new Promise((resolve) => setImmediate(resolve)); // let finalize() run
  };

  beforeEach(() => create.mockClear());

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'check %s requests are not logged',
    async (method) => {
      await run(method);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'check %s requests are logged',
    async (method) => {
      await run(method);
      expect(create).toHaveBeenCalledTimes(1);
    },
  );
});
