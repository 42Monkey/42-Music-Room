import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ActionLogInterceptor } from './log.interceptor';

// fake token holding { sub }, like the ones the auth routes answer with
const tokenFor = (sub: string) =>
  `header.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.signature`;

describe('ActionLogInterceptor', () => {
  const create = jest.fn().mockResolvedValue({});
  const findUnique = jest.fn().mockResolvedValue(null);
  const interceptor = new ActionLogInterceptor({
    actionLog: { create },
    user: { findUnique },
  } as any);

  type Run = {
    method?: string;
    path?: string;
    // null: no login token on the request (the /auth routes)
    user?: { id: string } | null;
    body?: object;
    result?: unknown;
    error?: Error;
  };

  const run = async ({
    method = 'POST',
    path = '/rooms',
    user = { id: 'u1' },
    body = {},
    result = 'ok',
    error,
  }: Run = {}) => {
    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          url: path,
          originalUrl: path,
          route: { path },
          headers: {},
          user: user ?? undefined,
          body,
        }),
      }),
    };
    const handle = () => (error ? throwError(() => error) : of(result));
    await new Promise<void>((resolve) =>
      interceptor
        .intercept(ctx, { handle })
        .subscribe({ complete: () => resolve(), error: () => resolve() }),
    );
    // let the user lookup and the log write run
    await new Promise((resolve) => setImmediate(resolve));
  };

  const loggedUser = () => create.mock.calls[0][0].data.userId;

  beforeEach(() => {
    create.mockClear();
    findUnique.mockReset().mockResolvedValue(null);
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'check %s requests are not logged',
    async (method) => {
      await run({ method });
      expect(create).not.toHaveBeenCalled();
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'check %s requests are logged',
    async (method) => {
      await run({ method });
      expect(create).toHaveBeenCalledTimes(1);
    },
  );

  it('logs the user from the token in a login answer', async () => {
    await run({
      path: '/auth/login',
      user: null,
      result: { accessToken: tokenFor('u9'), refreshToken: 'r' },
    });
    expect(loggedUser()).toBe('u9');
  });

  it('logs the new user of a sign-up', async () => {
    await run({
      path: '/auth/register',
      user: null,
      result: { id: 'u7', email: 'new@test.com' },
    });
    expect(loggedUser()).toBe('u7');
  });

  it('finds the user from the email sent when the answer has none', async () => {
    findUnique.mockResolvedValue({ id: 'u3' });
    await run({
      path: '/auth/request-password-reset',
      user: null,
      body: { email: '  User3@Test.com ' },
      result: { message: 'sent' },
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'user3@test.com' } }),
    );
    expect(loggedUser()).toBe('u3');
  });

  it('logs other failures with their user', async () => {
    await run({ error: new ConflictException('already voted') });
    expect(create).toHaveBeenCalledTimes(1);
    expect(loggedUser()).toBe('u1');
  });

  it('leaves refused requests to the exception filter (logged once)', async () => {
    await run({
      path: '/auth/login',
      user: null,
      error: new UnauthorizedException(),
    });
    expect(create).not.toHaveBeenCalled();
  });
});
