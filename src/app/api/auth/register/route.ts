import { NextRequest, NextResponse } from 'next/server';

import {
  createSession,
  hashPassword,
  normalizeUsername,
  setSessionCookie,
  validatePassword,
  validateUsername,
} from '@/lib/auth';
import { errorMessage, generateId } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = normalizeUsername(body.username ?? '');
    const password = body.password ?? '';

    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return NextResponse.json({ error: '该用户名已被注册。' }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        id: generateId(),
        username,
        passwordHash: await hashPassword(password),
      },
    });

    const token = await createSession(user.id);
    const response = NextResponse.json({ user: { id: user.id, username: user.username } });
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '创建账号失败') },
      { status: 500 }
    );
  }
}
