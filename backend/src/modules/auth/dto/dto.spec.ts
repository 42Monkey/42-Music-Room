import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { EmailDto } from './email.dto';
import { ResendVerificationDto } from './resend-verification.dto';
import { ResetPasswordDto } from './reset-password.dto';
import { RequestPasswordResetDto } from './request-password-reset.dto';
import { plainToInstance } from 'class-transformer';

async function errorFields(dto: object): Promise<string[]> {
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

jest.mock('@nestjs/swagger', () => ({
	ApiProperty: () => () => undefined,
	ApiPropertyOptional: () => () => undefined,
}));

describe('Auth DTOs', () => {
  describe('LoginDto (#2)', () => {
    it('check a short wrong password is not rejected for its length', async () => {
      const dto = Object.assign(new LoginDto(), {
        email: 'mia@test.com',
        password: 'abc',
      });
      expect(await errorFields(dto)).toEqual([]);
    });

    it('check an empty password is rejected', async () => {
      const dto = Object.assign(new LoginDto(), {
        email: 'mia@test.com',
        password: '',
      });
      expect(await errorFields(dto)).toContain('password');
    });
  });

  describe('RegisterDto (#5)', () => {
    const base = { email: 'mia@test.com', password: 'password123' };

    it('check a 50 character display name is accepted', async () => {
      const dto = Object.assign(new RegisterDto(), {
        ...base,
        displayName: 'a'.repeat(50),
      });
      expect(await errorFields(dto)).toEqual([]);
    });

    it('check a 51 character display name is rejected', async () => {
      const dto = Object.assign(new RegisterDto(), {
        ...base,
        displayName: 'a'.repeat(51),
      });
      expect(await errorFields(dto)).toContain('displayName');
    });

    it('check the 8 character minimum on the register password is still enforced', async () => {
      const dto = Object.assign(new RegisterDto(), {
        ...base,
        password: 'short',
        displayName: 'Mia',
      });
      expect(await errorFields(dto)).toContain('password');
    });
  });

  describe('Email normalization (#3)', () => {
    const cases: [string, new () => { email: string }, object][] = [
      ['LoginDto', LoginDto, { password: 'x' }],
      [
        'RegisterDto',
        RegisterDto,
        { password: 'password123', displayName: 'Mia' },
      ],
      ['ResendVerificationDto', ResendVerificationDto, {}],
      ['RequestPasswordResetDto', RequestPasswordResetDto, {}],
      ['EmailDto', EmailDto, { token: '123456' }],
      [
        'ResetPasswordDto',
        ResetPasswordDto,
        { token: '123456', newPassword: 'password123' },
      ],
    ];

    it.each(cases)(
      'check %s trims and lowercases the email',
      (_name, Dto, rest) => {
        const dto = plainToInstance(Dto, { email: '  Mia@Test.COM ', ...rest });
        expect(dto.email).toBe('mia@test.com');
      },
    );
  });
});
