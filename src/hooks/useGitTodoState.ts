import { useCallback, useEffect, useState } from 'react';

import type {
  Branch,
  BranchImportInput,
  BranchImportSummary,
  ConsoleLog,
  Idea,
  IdeaInput,
  IdeaUpdateInput,
  Todo,
  WorkspaceSnapshot,
} from '@/types';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const getApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
};

export function useGitTodoState(enabled = true) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    if (!enabled) {
      setTodos([]);
      setBranches([]);
      setIdeas([]);
      setLogs([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/data');
      if (!res.ok) {
        throw new Error('无法从后端加载任务和分支数据。');
      }
      const data = (await res.json()) as Partial<WorkspaceSnapshot>;
      setTodos(data.todos ?? []);
      setBranches(data.branches ?? []);
      setIdeas(data.ideas ?? []);
      setLogs(data.logs ?? []);
    } catch (err) {
      setError(getErrorMessage(err, '加载初始状态时发生错误。'));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Fetch initial data from the database
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshData]);

  // Centralized helper to update the local React state when the DB responds
  const updateState = (data: WorkspaceSnapshot) => {
    setTodos(data.todos);
    setBranches(data.branches);
    setIdeas(data.ideas);
    setLogs(data.logs);
  };

  // Add Todo (optionally creates a dynamic branch)
  const handleAddTodo = async (
    newTodo: {
      title: string;
      description: string;
      category: Todo['category'];
      priority: Todo['priority'];
      status: Todo['status'];
      branchId: string | null;
      dueDate: string;
    },
    createBranchName?: string
  ) => {
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTodo, createBranchName }),
      });
      if (!res.ok) {
        throw new Error('服务器创建任务失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '创建任务失败。'));
    }
  };

  // Update Todo Status
  const handleUpdateTodoStatus = async (todoId: string, status: Todo['status']) => {
    try {
      const res = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { status } }),
      });
      if (!res.ok) {
        throw new Error('服务器更新任务状态失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '更新任务状态失败。'));
    }
  };

  // Update Todo DueDate
  const handleUpdateTodoDueDate = async (todoId: string, dueDate: string) => {
    try {
      const res = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { dueDate } }),
      });
      if (!res.ok) {
        throw new Error('服务器更新任务截止日期失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '更新任务截止日期失败。'));
    }
  };

  // Update Todo general details
  const handleUpdateTodo = async (
    todoId: string,
    updates: Partial<Todo>,
    createBranchName?: string
  ) => {
    try {
      const res = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, createBranchName }),
      });
      if (!res.ok) {
        throw new Error('服务器更新任务详情失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '更新任务详情失败。'));
    }
  };

  // Delete Todo
  const handleDeleteTodo = async (todoId: string) => {
    try {
      const res = await fetch(`/api/todos/${todoId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('服务器删除任务失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '删除任务失败。'));
    }
  };

  const handleAddIdea = async (idea: IdeaInput) => {
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(idea),
      });
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '服务器创建想法失败。'));
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '创建想法失败。'));
    }
  };

  const handleUpdateIdea = async (ideaId: string, updates: IdeaUpdateInput) => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '服务器更新想法失败。'));
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '更新想法失败。'));
    }
  };

  const handleDeleteIdea = async (ideaId: string) => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '服务器删除想法失败。'));
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '删除想法失败。'));
    }
  };

  // Add Branch
  const handleAddBranch = async (newBranch: {
    name: string;
    impact: string;
    base: string;
    status: Branch['status'];
    type?: Branch['type'];
  }) => {
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBranch),
      });
      if (!res.ok) {
        throw new Error('服务器创建分支失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '创建分支失败。'));
    }
  };

  // Import branches from the CSV/TSV template.
  const handleImportBranches = async (
    importedBranches: BranchImportInput[]
  ): Promise<BranchImportSummary> => {
    try {
      const res = await fetch('/api/branches/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branches: importedBranches }),
      });
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, '导入分支失败。'));
      }
      const data = (await res.json()) as WorkspaceSnapshot & { summary: BranchImportSummary };
      updateState(data);
      return data.summary;
    } catch (err) {
      throw new Error(getErrorMessage(err, '导入分支失败。'));
    }
  };

  // Update Branch environment promotion
  const handleUpdateBranchEnv = async (
    branchId: string,
    env: 'dev' | 'qa' | 'uat' | 'pro',
    value: boolean
  ) => {
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envPromotion: { env, value } }),
      });
      if (!res.ok) {
        throw new Error('服务器更新分支环境失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '更新分支环境失败。'));
    }
  };

  // Update Branch Status
  const handleUpdateBranchStatus = async (branchId: string, status: Branch['status']) => {
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusUpdate: status }),
      });
      if (!res.ok) {
        throw new Error('服务器更新分支状态失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '更新分支状态失败。'));
    }
  };

  // Update Branch general properties
  const handleUpdateBranch = async (branchId: string, updates: Partial<Branch>) => {
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        throw new Error('服务器更新分支详情失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '更新分支详情失败。'));
    }
  };

  // Log branch edits (like renaming, impact modifications or base changes)
  const handleLogBranchEdit = async (
    branchId: string,
    field: 'name' | 'impact' | 'base',
    oldValue: string,
    newValue: string
  ) => {
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editField: { field, oldValue, newValue } }),
      });
      if (!res.ok) {
        throw new Error('服务器保存分支修改历史失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '记录分支修改失败。'));
    }
  };

  // Delete Branch
  const handleDeleteBranch = async (branchId: string) => {
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('服务器删除分支失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '删除分支失败。'));
    }
  };

  // Clear Console Logs
  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/logs', {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('服务器清空日志失败。');
      }
      const data = (await res.json()) as WorkspaceSnapshot;
      updateState(data);
    } catch (err) {
      setError(getErrorMessage(err, '清空控制台日志失败。'));
    }
  };

  return {
    todos,
    branches,
    ideas,
    logs,
    loading,
    error,
    refreshData,
    handleAddTodo,
    handleUpdateTodoStatus,
    handleUpdateTodoDueDate,
    handleUpdateTodo,
    handleDeleteTodo,
    handleAddIdea,
    handleUpdateIdea,
    handleDeleteIdea,
    handleAddBranch,
    handleImportBranches,
    handleUpdateBranchEnv,
    handleUpdateBranchStatus,
    handleUpdateBranch,
    handleLogBranchEdit,
    handleDeleteBranch,
    handleClearLogs,
  };
}
