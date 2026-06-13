import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { errorMessage } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '加载当前用户失败') },
      { status: 500 }
    );
  }
}
