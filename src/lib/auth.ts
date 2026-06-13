import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

const scrypt = promisify(scryptCallback);

const SESSION_COOKIE_NAME = 'gittodo_session';
const SESSION_COOKIE_SECURE_ENV = 'SESSION_COOKIE_SECURE';
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_KEY_LENGTH = 64;

export interface AuthUser {
  id: string;
  username: string;
}

export const normalizeUsername = (username: string): string => username.trim().toLowerCase();

export const validateUsername = (username: string): string | null => {
  if (username.length < 3 || username.length > 32) {
    return '用户名长度必须为 3 到 32 个字符。';
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return '用户名只能包含字母、数字、下划线和连字符。';
  }

  return null;
};

export const validatePassword = (password: string): string | null => {
  if (password.length < 8) {
    return '密码至少需要 8 个字符。';
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return '密码必须至少包含一个字母和一个数字。';
  }

  return null;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) {
    return false;
  }

  const storedKey = Buffer.from(key, 'hex');
  const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer;

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const isSessionCookieSecure = (): boolean => {
  const configuredValue = process.env[SESSION_COOKIE_SECURE_ENV]?.trim().toLowerCase();

  if (configuredValue === 'true') {
    return true;
  }

  if (configuredValue === 'false') {
    return false;
  }

  return process.env.NODE_ENV === 'production';
};

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  await prisma.session.create({
    data: {
      id: randomBytes(16).toString('hex'),
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
    },
  });

  return token;
}

export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
  };
}

export async function deleteCurrentSession(request: NextRequest): Promise<void> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return;
  }

  await prisma.session.deleteMany({
    where: { tokenHash: hashSessionToken(token) },
  });
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSessionCookieSecure(),
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSessionCookieSecure(),
    path: '/',
    maxAge: 0,
  });
}

export const unauthorizedResponse = (): NextResponse =>
  NextResponse.json({ error: '请先登录。' }, { status: 401 });
