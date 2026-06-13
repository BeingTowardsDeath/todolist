import { NextRequest, NextResponse } from 'next/server';

import {
  createSession,
  normalizeUsername,
  setSessionCookie,
  validatePassword,
  validateUsername,
  verifyPassword,
} from '@/lib/auth';
import { errorMessage } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = normalizeUsername(body.username ?? '');
    const password = body.password ?? '';

    const usernameError = validateUsername(username);
    const passwordError = validatePassword(password);
    if (usernameError || passwordError) {
      return NextResponse.json({ error: '用户名或密码不正确。' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    const isValidPassword = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !isValidPassword) {
      return NextResponse.json({ error: '用户名或密码不正确。' }, { status: 401 });
    }

    const token = await createSession(user.id);
    const response = NextResponse.json({ user: { id: user.id, username: user.username } });
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '登录失败') },
      { status: 500 }
    );
  }
}
