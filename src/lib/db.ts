import type {
  Branch as BranchModel,
  Todo as TodoModel,
  Idea as IdeaModel,
  ConsoleLog as ConsoleLogModel,
  BranchHistoryItem as BranchHistoryItemModel,
} from '@prisma/client';
import { prisma } from './prisma';
import type { Branch, Todo, Idea, ConsoleLog, BranchHistoryItem, WorkspaceSnapshot } from '@/types';

// Snapshot shape returned to the client. Every write endpoint returns this so the
// existing useGitTodoState hook keeps working without changes.
export type DbSnapshot = WorkspaceSnapshot;

type BranchWithHistory = BranchModel & { history: BranchHistoryItemModel[] };

// --- Shared utilities (previously duplicated across every route) ---

export const generateId = (): string => Math.random().toString(36).substring(2, 11);

export const getTimestamp = (): string => {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
};

// Type-safe error message extraction (avoids `any` in route catch blocks).
export const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export interface PendingLog {
  id: string;
  userId: string;
  timestamp: string;
  type: string;
  text: string;
}

// Buffers console logs in business order, then flushed in one createMany so the
// autoincrement `seq` (and thus terminal display order) matches push order.
export const createLogBuffer = (userId: string) => {
  const items: PendingLog[] = [];
  const push = (type: ConsoleLog['type'], text: string): void => {
    items.push({ id: generateId(), userId, timestamp: getTimestamp(), type, text });
  };
  return { push, items };
};

// --- Prisma row -> public type mappers (drop internal columns like `seq`) ---

export const toHistoryItem = (item: BranchHistoryItemModel): BranchHistoryItem => ({
  id: item.id,
  timestamp: item.timestamp,
  action: item.action,
  details: item.details ?? undefined,
});

export const toBranch = (branch: BranchWithHistory): Branch => ({
  id: branch.id,
  seq: branch.seq,
  name: branch.name,
  impact: branch.impact,
  base: branch.base,
  dev: branch.dev,
  qa: branch.qa,
  uat: branch.uat,
  pro: branch.pro,
  pinned: (branch as any).pinned ?? false,
  // Values are constrained to the unions in src/types at the application layer.
  status: branch.status as Branch['status'],
  type: branch.type ? (branch.type as Branch['type']) : undefined,
  history: branch.history.map(toHistoryItem),
});

export const toTodo = (todo: TodoModel): Todo => ({
  id: todo.id,
  title: todo.title,
  description: todo.description,
  category: todo.category as Todo['category'],
  priority: todo.priority as Todo['priority'],
  status: todo.status as Todo['status'],
  branchId: todo.branchId,
  dueDate: todo.dueDate,
  createdAt: todo.createdAt,
});

export const toIdea = (idea: IdeaModel): Idea => ({
  id: idea.id,
  title: idea.title,
  content: idea.content,
  status: idea.status as Idea['status'],
  createdAt: idea.createdAt,
  updatedAt: idea.updatedAt,
});

export const toLog = (log: ConsoleLogModel): ConsoleLog => ({
  id: log.id,
  timestamp: log.timestamp,
  type: log.type as ConsoleLog['type'],
  text: log.text,
});

// --- Full database snapshot ---
// todos: newest first (seq desc); branches/logs/history: creation order (seq asc).

export async function getSnapshot(userId: string): Promise<DbSnapshot> {
  const [branches, todos, ideas, logs] = await Promise.all([
    prisma.branch.findMany({
      where: { userId },
      orderBy: { seq: 'asc' },
      include: { history: { orderBy: { seq: 'asc' } } },
    }),
    prisma.todo.findMany({ where: { userId }, orderBy: { seq: 'desc' } }),
    prisma.idea.findMany({ where: { userId }, orderBy: { seq: 'desc' } }),
    prisma.consoleLog.findMany({ where: { userId }, orderBy: { seq: 'asc' } }),
  ]);

  return {
    todos: todos.map(toTodo),
    branches: branches.map(toBranch),
    ideas: ideas.map(toIdea),
    logs: logs.map(toLog),
  };
}
