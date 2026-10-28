import { UnauthorizedException } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

describe('AllExceptionsFilter', () => {
  it('logs a refused login once, with the account it aimed at', async () => {
    const create = jest.fn().mockResolvedValue({});
    const findUnique = jest.fn().mockResolvedValue({ id: 'u1' });
    const filter = new AllExceptionsFilter({
      actionLog: { create },
      user: { findUnique },
    } as any);
    const json = jest.fn();
    const response = { status: jest.fn(() => ({ json })) };
    const request = {
      method: 'POST',
      url: '/auth/login',
      originalUrl: '/auth/login',
      route: { path: '/auth/login' },
      headers: {},
      body: { email: 'User1@Test.com' },
    };
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    };

    filter.catch(new UnauthorizedException('Invalid credentials'), host);
    // let the user lookup and the log write run
    await new Promise((resolve) => setImmediate(resolve));

    expect(response.status).toHaveBeenCalledWith(401);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'user1@test.com' } }),
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({
      userId: 'u1',
      action: 'BLOCKED POST /auth/login',
    });
  });
});
