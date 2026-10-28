import { PrismaService } from '../../prisma/prisma.service';

type AuditRequest = {
  user?: { id: string };
  route?: { path?: string };
  body?: { email?: unknown };
};

// who an action belongs to, also on the /auth routes that carry no login token:
// - login, Google sign-in and token renewal answer with a token holding the user id
// - sign-up answers with the new user
// - otherwise the email sent in the body (password reset, code resend, failed login)
export async function auditUserId(
  prisma: PrismaService,
  req: AuditRequest,
  result?: { accessToken?: unknown; id?: unknown },
): Promise<string | null> {
  if (req.user?.id) return req.user.id;

  const fromToken = tokenSubject(result?.accessToken);
  if (fromToken) return fromToken;

  if (req.route?.path === '/auth/register' && typeof result?.id === 'string') {
    return result.id;
  }

  const email = req.body?.email;
  if (typeof email !== 'string') return null;
  // same trim + lowercase as @NormalizeEmail, the raw body isn't transformed
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  return user?.id ?? null;
}

// user id ("sub") of a token we just issued ourselves, so no signature check is needed
function tokenSubject(token: unknown): string | null {
  if (typeof token !== 'string') return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
