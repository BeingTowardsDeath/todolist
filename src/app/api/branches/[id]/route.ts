import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import {
  getSnapshot,
  errorMessage,
  generateId,
  getTimestamp,
  createLogBuffer,
  toBranch,
} from '@/lib/db';
import type { Branch } from '@/types';

type EnvKey = 'dev' | 'qa' | 'uat' | 'pro';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const branch = await prisma.branch.findFirst({
      where: { id, userId: user.id },
      include: { history: { orderBy: { seq: 'asc' } } },
    });
    if (!branch) {
      return NextResponse.json({ error: '分支不存在。' }, { status: 404 });
    }

    return NextResponse.json(toBranch(branch));
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '获取分支失败') },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const body = (await request.json()) as {
      envPromotion?: { env: EnvKey; value: boolean };
      statusUpdate?: Branch['status'];
      editField?: { field: 'name' | 'impact' | 'base'; oldValue: string; newValue: string };
      updates?: Partial<Branch>;
    };
    const { envPromotion, statusUpdate, editField, updates } = body;

    const branch = await prisma.branch.findFirst({ where: { id, userId: user.id } });
    if (!branch) {
      return NextResponse.json({ error: '分支不存在。' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const logs = createLogBuffer(user.id);

      if (envPromotion) {
        const { env, value } = envPromotion;
        let newStatus = branch.status;
        let statusUpdatedText = '';
        const envName = env.toUpperCase();

        if (value) {
          logs.push('command', `deploy-tool promote --branch ${branch.name} --env ${envName}`);

          if (env === 'dev') {
            logs.push('info', `正在切换到 'develop'。`);
            logs.push('info', `正在将 '${branch.name}' 合并到 'develop'。`);
            logs.push('success', `DEV 构建已触发：image: gcr.io/kare-dev/${branch.name.replace(/\//g, '-')}:latest`);
            logs.push('success', `DEV 发布完成。Pod 运行节点：dev-kube-node-3`);
            if (newStatus === 'Draft') {
              newStatus = 'Testing';
              statusUpdatedText = '（状态已更新为 Testing）';
            }
          } else if (env === 'qa') {
            logs.push('info', `正在切换到 'qa'。`);
            logs.push('info', `正在将 '${branch.name}' 合并到 'qa'。`);
            logs.push('info', `正在运行集成测试和 Sonar 扫描。`);
            logs.push('success', `Sonar Gate：PASSED（质量评级 A）。`);
            logs.push('success', `QA 构建成功，已发布到 QA Kubernetes 集群（Namespace: qa）。`);
            if (newStatus === 'Draft' || newStatus === 'PR Open') {
              newStatus = 'Testing';
              statusUpdatedText = '（状态已更新为 Testing）';
            }
          } else if (env === 'uat') {
            logs.push('info', `正在启动 Release Candidate 验证。`);
            logs.push('info', `正在将 '${branch.name}' 合并到 'release/uat'。`);
            logs.push('success', `UAT 发布完成，可访问：https://uat.internal.kare-flow.com`);
            logs.push('warning', `等待客户 / 产品负责人验收确认。`);
            if (newStatus !== 'Merged') {
              newStatus = 'Approved';
              statusUpdatedText = '（状态已更新为 Approved）';
            }
          } else if (env === 'pro') {
            logs.push('command', `git checkout master`);
            logs.push('command', `git merge release/uat --no-ff -m "Merge production release of ${branch.name}"`);
            logs.push('info', `正在执行 Webpack 生产构建与资源压缩。`);
            logs.push('info', `Bundle 大小：main.js (148KB), vendor.js (420KB)。Gzip：OK。`);
            logs.push('success', `PROD 发布成功。线上流量已 100% 切换到新版本。`);
            newStatus = 'Merged';
            statusUpdatedText = '（状态已更新为 Merged）';

            const linkedTodos = await tx.todo.findMany({
              where: { branchId: id, userId: user.id, status: { not: 'done' } },
            });
            for (const todo of linkedTodos) {
              logs.push('success', `关联任务已因 PROD 合并自动完成："${todo.title}"。`);
            }
            await tx.todo.updateMany({
              where: { branchId: id, userId: user.id, status: { not: 'done' } },
              data: { status: 'done' },
            });
          }
        } else {
          logs.push('command', `deploy-tool rollback --branch ${branch.name} --env ${envName}`);
          logs.push('warning', `已将 '${branch.name}' 从 ${envName} 环境回滚。`);
          if (env === 'pro') {
            newStatus = 'Approved';
            statusUpdatedText = '（状态已更新为 Approved）';
          }
        }

        await tx.branchHistoryItem.create({
          data: {
            id: 'h-' + generateId(),
            branchId: id,
            timestamp: new Date().toISOString(),
            action: value ? `发布到 ${envName}` : `从 ${envName} 回滚`,
            details: `${value ? '通过环境勾选发布' : '通过环境勾选回滚'}。${statusUpdatedText}`,
          },
        });

        const data: Prisma.BranchUpdateInput = { status: newStatus };
        if (env === 'dev') data.dev = value;
        else if (env === 'qa') data.qa = value;
        else if (env === 'uat') data.uat = value;
        else if (env === 'pro') data.pro = value;
        await tx.branch.update({ where: { id }, data });
      } else if (statusUpdate) {
        const status = statusUpdate;
        logs.push('info', `分支 '${branch.name}' 的状态已更新：${branch.status} -> ${status}`);
        await tx.branchHistoryItem.create({
          data: {
            id: 'h-' + generateId(),
            branchId: id,
            timestamp: new Date().toISOString(),
            action: '更新状态',
            details: `状态从 ${branch.status} 更新为 ${status}`,
          },
        });
        await tx.branch.update({ where: { id }, data: { status } });
      } else if (editField) {
        const { field, oldValue, newValue } = editField;
        const fieldLabels: Record<typeof field, string> = {
          name: '分支名称',
          impact: '内容 / 影响',
          base: '基础分支',
        };

        if (field === 'name') {
          logs.push('info', `分支名称已更新：${oldValue} -> ${newValue}`);
        } else if (field === 'base') {
          logs.push('info', `分支 '${branch.name}' 的基础分支已更新：${oldValue} -> ${newValue}`);
        }

        await tx.branchHistoryItem.create({
          data: {
            id: 'h-' + generateId(),
            branchId: id,
            timestamp: new Date().toISOString(),
            action: `编辑${fieldLabels[field]}`,
            details: `从 "${oldValue}" 修改为 "${newValue}"`,
          },
        });

        await tx.branch.update({ where: { id }, data: { [field]: newValue } });
      } else if (updates) {
        if (updates.type && updates.type !== branch.type) {
          await tx.branchHistoryItem.create({
            data: {
              id: 'h-' + generateId(),
              branchId: id,
              timestamp: new Date().toISOString(),
              action: '更新类型',
              details: `类型从 ${branch.type || '无'} 更新为 ${updates.type}`,
            },
          });
        }

        const scalar = { ...updates };
        delete scalar.history;
        delete scalar.id;
        await tx.branch.update({ where: { id }, data: scalar as Prisma.BranchUpdateInput });
      }

      if (logs.items.length > 0) {
        await tx.consoleLog.createMany({ data: logs.items });
      }
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '更新分支失败') },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const branch = await prisma.branch.findFirst({ where: { id, userId: user.id } });
    if (!branch) {
      return NextResponse.json({ error: '分支不存在。' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.todo.updateMany({ where: { branchId: id, userId: user.id }, data: { branchId: null } });
      await tx.branch.delete({ where: { id } });
      await tx.consoleLog.create({
        data: {
          id: generateId(),
          userId: user.id,
          timestamp: getTimestamp(),
          type: 'warning',
          text: `已删除分支：'${branch.name}'`,
        },
      });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '删除分支失败') },
      { status: 500 }
    );
  }
}
