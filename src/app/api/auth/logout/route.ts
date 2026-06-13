import { NextRequest, NextResponse } from 'next/server';

import { clearSessionCookie, deleteCurrentSession } from '@/lib/auth';
import { errorMessage } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    await deleteCurrentSession(request);

    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '退出登录失败') },
      { status: 500 }
    );
  }
}
