export interface BranchHistoryItem {
  id: string;
  timestamp: string;
  action: string;
  details?: string;
}

export interface Branch {
  id: string;
  name: string;
  impact: string;
  base: string;
  dev: boolean;
  qa: boolean;
  uat: boolean;
  pro: boolean;
  status: 'Draft' | 'PR Open' | 'Testing' | 'Approved' | 'Merged' | 'Stale';
  type?: 'Story' | 'Task' | 'Bug';
  history?: BranchHistoryItem[];
}

export interface BranchImportInput {
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

export interface BranchImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  category: 'dev' | 'personal' | 'shopping' | 'learning' | 'workout';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
  branchId: string | null; // linked branch
  dueDate: string;
  createdAt: string;
}

export interface Idea {
  id: string;
  title: string;
  content: string;
  status: 'open' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface IdeaInput {
  title: string;
  content: string;
}

export interface IdeaUpdateInput {
  title?: string;
  content?: string;
  status?: Idea['status'];
}

export interface ConsoleLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'command' | 'error' | 'warning';
  text: string;
}

export interface User {
  id: string;
  username: string;
}

export type AppTab = 'tasks' | 'ideas' | 'branches' | 'terminal';

export interface WorkspaceSnapshot {
  todos: Todo[];
  branches: Branch[];
  ideas: Idea[];
  logs: ConsoleLog[];
}
