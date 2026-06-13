import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { createLogBuffer, errorMessage, generateId, getSnapshot } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import type { Branch } from '@/types';

type EnvSnapshot = Pick<NormalizedImportBranch, 'dev' | 'qa' | 'uat' | 'pro'>;

interface NormalizedImportBranch {
  name: string;
  impact: string;
  base: string;
  dev: boolean;
  qa: boolean;
  uat: boolean;
  pro: boolean;
  status: Branch['status'];
  type?: Branch['type'];
}

interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
}

const IMPORT_LIMIT = 500;

const branchStatuses: Branch['status'][] = [
  'Draft',
  'PR Open',
  'Testing',
  'Approved',
  'Merged',
  'Stale',
];

const branchTypes: NonNullable<Branch['type']>[] = ['Story', 'Task', 'Bug'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const booleanValue = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = stringValue(value).toLowerCase();
  return ['1', 'true', 'yes', 'y', '是', '已发布', '发布'].includes(normalized);
};

const isBranchStatus = (value: string): value is Branch['status'] =>
  branchStatuses.includes(value as Branch['status']);

const isBranchType = (value: string): value is NonNullable<Branch['type']> =>
  branchTypes.includes(value as NonNullable<Branch['type']>);

const deriveStatus = ({ dev, qa, uat, pro }: EnvSnapshot): Branch['status'] => {
  if (pro) return 'Merged';
  if (uat) return 'Approved';
  if (qa || dev) return 'Testing';
  return 'Draft';
};

const normalizeImportedBranch = (value: unknown): NormalizedImportBranch | null => {
  if (!isRecord(value)) return null;

  const name = stringValue(value.name);
  if (!name) return null;

  const dev = booleanValue(value.dev);
  const qa = booleanValue(value.qa);
  const uat = booleanValue(value.uat);
  const pro = booleanValue(value.pro);
  const statusValue = stringValue(value.status);
  const typeValue = stringValue(value.type);

  return {
    name,
    impact: stringValue(value.impact),
    base: stringValue(value.base) || 'master',
    dev,
    qa,
    uat,
    pro,
    status: isBranchStatus(statusValue) ? statusValue : deriveStatus({ dev, qa, uat, pro }),
    type: isBranchType(typeValue) ? typeValue : undefined,
  };
};

const isNormalizedImportBranch = (
  value: NormalizedImportBranch | null
): value is NormalizedImportBranch => value !== null;

const dedupeBranches = (branches: NormalizedImportBranch[]) => {
  const rows: NormalizedImportBranch[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const branch of branches) {
    const key = branch.name.toLowerCase();
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    rows.push(branch);
  }

  return { rows, skipped };
};

const getBranchUpdateData = (
  existing: {
    impact: string;
    base: string;
    dev: boolean;
    qa: boolean;
    uat: boolean;
    pro: boolean;
    status: string;
    type: string | null;
  },
  branch: NormalizedImportBranch
): Prisma.BranchUpdateInput => {
  const data: Prisma.BranchUpdateInput = {};

  if (existing.impact !== branch.impact) data.impact = branch.impact;
  if (existing.base !== branch.base) data.base = branch.base;
  if (existing.dev !== branch.dev) data.dev = branch.dev;
  if (existing.qa !== branch.qa) data.qa = branch.qa;
  if (existing.uat !== branch.uat) data.uat = branch.uat;
  if (existing.pro !== branch.pro) data.pro = branch.pro;
  if (existing.status !== branch.status) data.status = branch.status;
  if (branch.type !== undefined && existing.type !== branch.type) data.type = branch.type;

  return data;
};

const formatFlag = (value: boolean): string => (value ? '1' : '0');

const getImportDetails = (branch: NormalizedImportBranch): string =>
  [
    `base: ${branch.base}`,
    `dev: ${formatFlag(branch.dev)}`,
    `qa: ${formatFlag(branch.qa)}`,
    `uat: ${formatFlag(branch.uat)}`,
    `pro: ${formatFlag(branch.pro)}`,
  ].join('，');

// POST /api/branches/import
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = (await request.json()) as unknown;
    const rawBranches = isRecord(body) && Array.isArray(body.branches) ? body.branches : [];
    if (rawBranches.length === 0) {
      return NextResponse.json({ error: '导入文件没有可用的分支数据。' }, { status: 400 });
    }
    if (rawBranches.length > IMPORT_LIMIT) {
      return NextResponse.json(
        { error: `单次最多导入 ${IMPORT_LIMIT} 条分支。` },
        { status: 400 }
      );
    }

    const normalizedBranches = rawBranches
      .map(normalizeImportedBranch)
      .filter(isNormalizedImportBranch);
    const { rows, skipped } = dedupeBranches(normalizedBranches);

    if (rows.length === 0) {
      return NextResponse.json({ error: '导入文件缺少分支名称。' }, { status: 400 });
    }

    const summary: ImportSummary = {
      total: rows.length,
      created: 0,
      updated: 0,
      skipped,
    };

    await prisma.$transaction(async (tx) => {
      for (const branch of rows) {
        const existing = await tx.branch.findFirst({
          where: { userId: user.id, name: branch.name },
        });

        if (!existing) {
          await tx.branch.create({
            data: {
              id: generateId(),
              userId: user.id,
              name: branch.name,
              impact: branch.impact,
              base: branch.base,
              dev: branch.dev,
              qa: branch.qa,
              uat: branch.uat,
              pro: branch.pro,
              status: branch.status,
              type: branch.type ?? null,
              history: {
                create: {
                  id: 'h-' + generateId(),
                  timestamp: new Date().toISOString(),
                  action: '导入分支',
                  details: getImportDetails(branch),
                },
              },
            },
          });
          summary.created += 1;
          continue;
        }

        const updateData = getBranchUpdateData(existing, branch);
        if (Object.keys(updateData).length === 0) {
          summary.skipped += 1;
          continue;
        }

        await tx.branch.update({ where: { id: existing.id }, data: updateData });
        await tx.branchHistoryItem.create({
          data: {
            id: 'h-' + generateId(),
            branchId: existing.id,
            timestamp: new Date().toISOString(),
            action: '导入更新分支',
            details: getImportDetails(branch),
          },
        });
        summary.updated += 1;
      }

      const logs = createLogBuffer(user.id);
      logs.push(
        'success',
        `分支导入完成：新增 ${summary.created}，更新 ${summary.updated}，跳过 ${summary.skipped}。`
      );
      await tx.consoleLog.createMany({ data: logs.items });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json({ ...snapshot, summary });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '导入分支失败') },
      { status: 500 }
    );
  }
}
