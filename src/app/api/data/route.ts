import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { getSnapshot, errorMessage } from '@/lib/db';

// Full database snapshot: { todos, branches, logs }.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '获取数据失败') },
      { status: 500 }
    );
  }
}
