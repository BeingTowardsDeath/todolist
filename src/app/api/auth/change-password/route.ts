import { NextRequest, NextResponse } from 'next/server';

import {
  createSession,
  getCurrentUser,
  hashPassword,
  setSessionCookie,
  unauthorizedResponse,
  validatePassword,
  verifyPassword,
} from '@/lib/auth';
import { errorMessage } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    const currentPassword = body.currentPassword ?? '';
    const newPassword = body.newPassword ?? '';
    const passwordError = validatePassword(newPassword);

    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !(await verifyPassword(currentPassword, dbUser.passwordHash))) {
      return NextResponse.json({ error: '当前密码不正确。' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await prisma.session.deleteMany({ where: { userId: user.id } });

    const token = await createSession(user.id);
    const response = NextResponse.json({ user });
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '修改密码失败') },
      { status: 500 }
    );
  }
}
