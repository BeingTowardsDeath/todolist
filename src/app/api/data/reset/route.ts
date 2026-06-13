import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { errorMessage, getSnapshot } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { clearUserWorkspace } from '@/lib/workspace';

// Reset only the current user's workspace.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    await clearUserWorkspace(prisma, user.id);
    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '重置数据失败') },
      { status: 500 }
    );
  }
}
