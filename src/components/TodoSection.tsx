'use client';

import React, { useState } from 'react';
import { Todo, Branch } from '../types';
import styles from './TodoSection.module.css';

// Anchor/current date for reference
const TODAY_STR = '2026-06-02';

// Pure date utility helpers
const getStartOfWeek = (date: Date) => {
  const result = new Date(date);
  const day = result.getDay();
  // Adjust to make Monday the first day of the week
  const diff = result.getDate() - day + (day === 0 ? -6 : 1);
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const formatDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (dateStr: string, days: number) => {
  const date = new Date(dateStr || TODAY_STR);
  date.setDate(date.getDate() + days);
  return formatDateString(date);
};

const getWeekDays = (anchor: Date) => {
  const start = getStartOfWeek(anchor);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
};

const getDayName = (dayIndex: number) => {
  const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return names[dayIndex];
};

const getCategoryIcon = (cat: Todo['category']) => {
  switch (cat) {
    case 'dev': return '💻';
    case 'personal': return '🏠';
    case 'shopping': return '🛒';
    case 'learning': return '📚';
    case 'workout': return '💪';
    default: return '📝';
  }
};

const statusLabelMap: Record<Todo['status'], string> = {
  backlog: '待规划',
  todo: '待办',
  'in-progress': '进行中',
  review: '评审中',
  done: '已完成',
};

const priorityLabelMap: Record<Todo['priority'], string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急',
};

const categoryLabelMap: Record<Todo['category'], string> = {
  dev: '开发',
  personal: '个人',
  shopping: '购物',
  learning: '学习',
  workout: '锻炼',
};

interface TaskCardProps {
  todo: Todo;
  branches: Branch[];
  onUpdateTodoStatus: (todoId: string, status: Todo['status']) => void;
  onUpdateTodoDueDate: (todoId: string, dueDate: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onEditTodo: (todo: Todo) => void;
  cardMode?: 'detailed' | 'compact';
}

const formatDueDate = (dateStr: string) => {
  if (!dateStr) return '未安排';
  if (dateStr === TODAY_STR) return '今天';
  const nextDate = addDays(TODAY_STR, 1);
  if (dateStr === nextDate) return '明天';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

function CompactTaskCard({
  todo,
  onEditTodo,
  onDeleteTodo,
  onUpdateTodoStatus,
}: {
  todo: Todo;
  onEditTodo: (todo: Todo) => void;
  onDeleteTodo: (todoId: string) => void;
  onUpdateTodoStatus: (todoId: string, status: Todo['status']) => void;
}) {
  return (
    <div 
      className={`${styles.taskCard} ${styles.compactCard} ${styles[`compactCat-${todo.category}`]}`} 
      onClick={() => onEditTodo(todo)}
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.compactMain}>
        <div className={styles.compactLeft}>
          <span className={`${styles.priorityDot} ${styles[`dot-${todo.priority}`]}`} title={`优先级：${priorityLabelMap[todo.priority]}`} />
          <span className={styles.compactTitle} title={todo.title}>{todo.title}</span>
        </div>
        <span className={styles.compactDate}>{formatDueDate(todo.dueDate)}</span>
      </div>

      <div className={styles.cardHoverActions} onClick={(e) => e.stopPropagation()}>
        <select
          value={todo.status}
          onChange={(e) => onUpdateTodoStatus(todo.id, e.target.value as Todo['status'])}
          className={styles.statusDropdownCompact}
        >
          <option value="backlog">{statusLabelMap.backlog}</option>
          <option value="todo">{statusLabelMap.todo}</option>
          <option value="in-progress">{statusLabelMap['in-progress']}</option>
          <option value="review">{statusLabelMap.review}</option>
          <option value="done">{statusLabelMap.done}</option>
        </select>
        <button 
          type="button" 
          className={styles.actionIconButton} 
          onClick={() => onEditTodo(todo)}
          title="编辑"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button 
          type="button" 
          className={styles.actionIconButton} 
          onClick={() => onDeleteTodo(todo.id)}
          title="删除"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface BranchLinkProps {
  linkedBranch: Branch;
}

function BranchLink({ linkedBranch }: BranchLinkProps) {
  return (
    <div className={styles.branchLink} onClick={(e) => e.stopPropagation()}>
      <div className={styles.branchInfo} title={linkedBranch.name}>
        <span className={styles.branchIcon}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
        </span>
        <span>{linkedBranch.name}</span>
      </div>
      <div className={styles.envPills}>
        <span className={`${styles.envPill} ${linkedBranch.dev ? styles['envPillActive-dev'] : ''}`} title="已发布到 DEV">D</span>
        <span className={`${styles.envPill} ${linkedBranch.qa ? styles['envPillActive-qa'] : ''}`} title="已发布到 QA">Q</span>
        <span className={`${styles.envPill} ${linkedBranch.uat ? styles['envPillActive-uat'] : ''}`} title="已发布到 UAT">U</span>
        <span className={`${styles.envPill} ${linkedBranch.pro ? styles['envPillActive-pro'] : ''}`} title="已发布到 PROD">P</span>
      </div>
    </div>
  );
}

interface RescheduleBarProps {
  todo: Todo;
  onUpdateTodoDueDate: (todoId: string, dueDate: string) => void;
}

function RescheduleBar({ todo, onUpdateTodoDueDate }: RescheduleBarProps) {
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onUpdateTodoDueDate(todo.id, e.target.value);
    }
  };

  const handleSetToday = () => {
    onUpdateTodoDueDate(todo.id, TODAY_STR);
  };

  const handleDeferOneDay = () => {
    const nextDate = addDays(todo.dueDate || TODAY_STR, 1);
    onUpdateTodoDueDate(todo.id, nextDate);
  };

  return (
    <div className={styles.rescheduleBar} onClick={(e) => e.stopPropagation()}>
      <div className={styles.dateSelectorWrapper}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.calendarIcon}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <input
          type="date"
          value={todo.dueDate || ''}
          onChange={handleDateChange}
          className={styles.dateInput}
          title="修改截止日期"
        />
      </div>
      <div className={styles.quickDates}>
        {todo.dueDate !== TODAY_STR && (
          <button 
            type="button"
            onClick={handleSetToday}
            className={styles.quickDateBtn}
            title="设为今天"
          >
            今天
          </button>
        )}
        <button 
          type="button"
          onClick={handleDeferOneDay}
          className={styles.quickDateBtn}
          title="顺延 1 天"
        >
          +1d
        </button>
      </div>
    </div>
  );
}

interface TaskHeaderProps {
  todo: Todo;
}

function TaskHeader({ todo }: TaskHeaderProps) {
  return (
    <div className={styles.taskHeader}>
      <div className={styles.taskTitleRow}>
        <span className={styles.categoryIcon}>{getCategoryIcon(todo.category)}</span>
        <span className={styles.taskTitle}>{todo.title}</span>
      </div>
      <span className={`${styles.priorityBadge} ${styles[`priority-${todo.priority}`]}`}>
        {priorityLabelMap[todo.priority]}
      </span>
    </div>
  );
}

interface TaskActionsOverlayProps {
  todo: Todo;
  onEditTodo: (todo: Todo) => void;
  onDeleteTodo: (todoId: string) => void;
  onUpdateTodoDueDate: (todoId: string, dueDate: string) => void;
}

function TaskActionsOverlay({ todo, onEditTodo, onDeleteTodo, onUpdateTodoDueDate }: TaskActionsOverlayProps) {
  return (
    <div className={styles.cardHoverActions} onClick={(e) => e.stopPropagation()}>
      <button 
        type="button" 
        className={styles.actionIconButton} 
        onClick={() => onUpdateTodoDueDate(todo.id, addDays(todo.dueDate || TODAY_STR, 1))} 
        title="顺延 1 天"
      >
        <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>+1d</span>
      </button>
      <button 
        type="button" 
        className={styles.actionIconButton} 
        onClick={() => onEditTodo(todo)} 
        title="编辑任务"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button 
        type="button" 
        className={styles.actionIconButton} 
        onClick={() => onDeleteTodo(todo.id)} 
        title="删除任务"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}

// Standalone modular TaskCard component to satisfy functions < 40 lines
function TaskCard({
  todo,
  branches,
  onUpdateTodoStatus,
  onUpdateTodoDueDate,
  onDeleteTodo,
  onEditTodo,
  cardMode = 'detailed',
}: TaskCardProps) {
  if (cardMode === 'compact') {
    return (
      <CompactTaskCard
        todo={todo}
        onEditTodo={onEditTodo}
        onDeleteTodo={onDeleteTodo}
        onUpdateTodoStatus={onUpdateTodoStatus}
      />
    );
  }
  const branch = todo.category === 'dev' && todo.branchId 
    ? branches.find((b) => b.id === todo.branchId) : null;

  return (
    <div className={`${styles.taskCard} ${styles[`cat-border-${todo.category}`]}`} onClick={() => onEditTodo(todo)}>
      <TaskHeader todo={todo} />
      {todo.description && <div className={styles.taskDesc} title={todo.description}>{todo.description}</div>}
      {branch && <BranchLink linkedBranch={branch} />}
      <div className={styles.taskFooter}>
        <div className={styles.dueDateBadge} title="截止日期">📅 {formatDueDate(todo.dueDate)}</div>
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={todo.status}
            onChange={(e) => onUpdateTodoStatus(todo.id, e.target.value as Todo['status'])}
            className={styles.statusDropdown}
          >
            <option value="backlog">{statusLabelMap.backlog}</option>
            <option value="todo">{statusLabelMap.todo}</option>
            <option value="in-progress">{statusLabelMap['in-progress']}</option>
            <option value="review">{statusLabelMap.review}</option>
            <option value="done">{statusLabelMap.done}</option>
          </select>
        </div>
      </div>
      <TaskActionsOverlay todo={todo} onEditTodo={onEditTodo} onDeleteTodo={onDeleteTodo} onUpdateTodoDueDate={onUpdateTodoDueDate} />
    </div>
  );
}

interface GroupedTimeline {
  title: string;
  dateStr: string | null;
  isToday?: boolean;
  isTomorrow?: boolean;
  isOverdue?: boolean;
  isUnscheduled?: boolean;
  tasks: Todo[];
}

interface TodoSectionProps {
  todos: Todo[];
  branches: Branch[];
  onAddTodo: (todo: {
    title: string;
    description: string;
    category: Todo['category'];
    priority: Todo['priority'];
    status: Todo['status'];
    branchId: string | null;
    dueDate: string;
  }, createBranchName?: string) => void;
  onUpdateTodo: (todoId: string, updates: Partial<Todo>, createBranchName?: string) => void;
  onUpdateTodoStatus: (todoId: string, status: Todo['status']) => void;
  onUpdateTodoDueDate: (todoId: string, dueDate: string) => void;
  onDeleteTodo: (todoId: string) => void;
}

export default function TodoSection({
  todos,
  branches,
  onAddTodo,
  onUpdateTodo,
  onUpdateTodoStatus,
  onUpdateTodoDueDate,
  onDeleteTodo,
}: TodoSectionProps) {
  // Navigation & View State
  const [viewMode, setViewMode] = useState<'week' | 'timeline' | 'grid'>('week');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date(TODAY_STR));
  const [cardMode, setCardMode] = useState<'detailed' | 'compact'>('detailed');

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Todo['category']>('dev');
  const [priority, setPriority] = useState<Todo['priority']>('medium');
  const [status, setStatus] = useState<Todo['status']>('todo');
  const [branchId, setBranchId] = useState<string>('none');
  const [createNewBranch, setCreateNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchBase, setNewBranchBase] = useState('master');
  const [dueDate, setDueDate] = useState(() => TODAY_STR);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    if (createNewBranch && category === 'dev') {
      const slug = e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setNewBranchName(`sprint36/story/${slug || 'feature'}`);
    }
  };

  const handleCreateNewBranchToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setCreateNewBranch(checked);
    if (checked) {
      setBranchId('none');
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setNewBranchName(`sprint36/story/${slug || 'feature'}`);
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as Todo['category'];
    setCategory(value);
    if (value !== 'dev') {
      setBranchId('none');
      setCreateNewBranch(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalBranchId = (category === 'dev' && !createNewBranch && branchId !== 'none') ? branchId : null;
    const branchToCreate = (category === 'dev' && createNewBranch) ? newBranchName : undefined;

    if (editingTodo) {
      onUpdateTodo(editingTodo.id, {
        title,
        description,
        category,
        priority,
        status,
        branchId: finalBranchId,
        dueDate,
      }, branchToCreate);
    } else {
      onAddTodo({
        title,
        description,
        category,
        priority,
        status,
        branchId: finalBranchId,
        dueDate,
      }, branchToCreate);
    }

    // Reset Form
    setTitle('');
    setDescription('');
    setCategory('dev');
    setPriority('medium');
    setStatus('todo');
    setBranchId('none');
    setCreateNewBranch(false);
    setNewBranchName('');
    setEditingTodo(null);
    setIsModalOpen(false);
  };

  const openCreateModal = (dateStr: string) => {
    setEditingTodo(null);
    setTitle('');
    setDescription('');
    setCategory('dev');
    setPriority('medium');
    setStatus('todo');
    setBranchId('none');
    setCreateNewBranch(false);
    setNewBranchName('');
    setDueDate(dateStr);
    setIsModalOpen(true);
  };

  const openEditModal = (todo: Todo) => {
    setEditingTodo(todo);
    setTitle(todo.title);
    setDescription(todo.description);
    setCategory(todo.category);
    setPriority(todo.priority);
    setStatus(todo.status);
    setBranchId(todo.branchId || 'none');
    setCreateNewBranch(false);
    setNewBranchName('');
    setDueDate(todo.dueDate || '');
    setIsModalOpen(true);
  };

  // Navigate week
  const handlePrevWeek = () => {
    setAnchorDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setAnchorDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleJumpToToday = () => {
    setAnchorDate(new Date(TODAY_STR));
  };

  // Filtering
  const filteredTodos = todos.filter((todo) => {
    const matchesSearch = todo.title.toLowerCase().includes(search.toLowerCase()) || 
                          todo.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : todo.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' ? true : todo.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'all' ? true : todo.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  // Calculate timeline week range and days
  const weekDays = getWeekDays(anchorDate);
  const startOfWeekDate = weekDays[0];
  const endOfWeekDate = weekDays[6];
  const startOfWeekStr = formatDateString(startOfWeekDate);
  const endOfWeekStr = formatDateString(endOfWeekDate);

  const formatRangeLabel = (start: Date, end: Date) => {
    const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const yearOpt: Intl.DateTimeFormatOptions = { year: 'numeric' };
    return `${start.toLocaleDateString('en-US', opt)} - ${end.toLocaleDateString('en-US', opt)}, ${end.toLocaleDateString('en-US', yearOpt)}`;
  };

  // Grouped tasks for Vertical Timeline View
  const getGroupedTimeline = (todosList: Todo[]): GroupedTimeline[] => {
    const groups: { [key: string]: GroupedTimeline } = {};
    const unscheduled: Todo[] = [];
    const overdue: Todo[] = [];
    const todayTasks: Todo[] = [];
    const tomorrowTasks: Todo[] = [];
    
    const todayDate = new Date(TODAY_STR);
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(todayDate.getDate() + 1);
    const tomorrowStr = formatDateString(tomorrowDate);

    todosList.forEach((todo) => {
      if (!todo.dueDate) {
        unscheduled.push(todo);
      } else if (todo.dueDate < TODAY_STR && todo.status !== 'done') {
        overdue.push(todo);
      } else if (todo.dueDate === TODAY_STR) {
        todayTasks.push(todo);
      } else if (todo.dueDate === tomorrowStr) {
        tomorrowTasks.push(todo);
      } else {
        if (!groups[todo.dueDate]) {
          groups[todo.dueDate] = {
            title: new Date(todo.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            dateStr: todo.dueDate,
            tasks: [],
          };
        }
        groups[todo.dueDate].tasks.push(todo);
      }
    });

    const timelineGroups: GroupedTimeline[] = [];

    if (overdue.length > 0) {
      timelineGroups.push({
        title: '⚠️ 已逾期',
        dateStr: null,
        isOverdue: true,
        tasks: overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      });
    }

    timelineGroups.push({
      title: '📅 今天',
      dateStr: TODAY_STR,
      isToday: true,
      tasks: todayTasks,
    });

    timelineGroups.push({
      title: '🌅 明天',
      dateStr: tomorrowStr,
      isTomorrow: true,
      tasks: tomorrowTasks,
    });

    const sortedDates = Object.keys(groups).sort();
    sortedDates.forEach((date) => {
      if (groups[date].tasks.length > 0) {
        timelineGroups.push(groups[date]);
      }
    });

    if (unscheduled.length > 0) {
      timelineGroups.push({
        title: '📥 未安排 / 收件箱',
        dateStr: null,
        isUnscheduled: true,
        tasks: unscheduled,
      });
    }

    return timelineGroups.filter((g) => g.tasks.length > 0 || g.isToday);
  };

  const timelineGroups = getGroupedTimeline(filteredTodos);

  // Filter tasks for Inbox / Overdue Column (Unscheduled or past due)
  const unscheduledOrOverdueTasks = filteredTodos.filter(
    (todo) => !todo.dueDate || (todo.dueDate < startOfWeekStr && todo.status !== 'done')
  );

  return (
    <div className={styles.container}>
      {/* Header controls & toggles */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>任务工作区</h1>
          <p>统一管理开发分支、个人事项、购物清单、学习计划和日程安排。</p>
        </div>

        {/* View Mode Selectors */}
        <div className={styles.viewToggleGroup}>
          <button 
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === 'week' ? styles.activeView : ''}`}
            onClick={() => setViewMode('week')}
          >
            📅 周视图
          </button>
          <button 
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === 'timeline' ? styles.activeView : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            ⏱️ 时间线
          </button>
          <button 
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.activeView : ''}`}
            onClick={() => setViewMode('grid')}
          >
            🎛️ 全部任务
          </button>
        </div>

        {/* Card Mode Selectors */}
        <div className={styles.detailToggleGroup}>
          <button 
            type="button"
            className={`${styles.detailToggleBtn} ${cardMode === 'detailed' ? styles.activeDetail : ''}`}
            onClick={() => setCardMode('detailed')}
          >
            📄 详细模式
          </button>
          <button 
            type="button"
            className={`${styles.detailToggleBtn} ${cardMode === 'compact' ? styles.activeDetail : ''}`}
            onClick={() => setCardMode('compact')}
          >
            🔍 紧凑模式
          </button>
        </div>

        {/* Schedule Nav Controls (only in Week View) */}
        {viewMode === 'week' && (
          <div className={styles.scheduleNav}>
            <button type="button" onClick={handlePrevWeek} className={styles.navBtn} title="上一周">
              &larr;
            </button>
            <button type="button" onClick={handleJumpToToday} className={styles.todayBtn}>
              今天
            </button>
            <span className={styles.dateRangeLabel}>
              {formatRangeLabel(startOfWeekDate, endOfWeekDate)}
            </span>
            <button type="button" onClick={handleNextWeek} className={styles.navBtn} title="下一周">
              &rarr;
            </button>
          </div>
        )}

        <div className={styles.controls}>
          <input
            type="text"
            placeholder="搜索任务..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchBar}
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">全部分类</option>
            <option value="dev">💻 {categoryLabelMap.dev}</option>
            <option value="personal">🏠 {categoryLabelMap.personal}</option>
            <option value="shopping">🛒 {categoryLabelMap.shopping}</option>
            <option value="learning">📚 {categoryLabelMap.learning}</option>
            <option value="workout">💪 {categoryLabelMap.workout}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">全部状态</option>
            <option value="backlog">{statusLabelMap.backlog}</option>
            <option value="todo">{statusLabelMap.todo}</option>
            <option value="in-progress">{statusLabelMap['in-progress']}</option>
            <option value="review">{statusLabelMap.review}</option>
            <option value="done">{statusLabelMap.done}</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">全部优先级</option>
            <option value="low">{priorityLabelMap.low}</option>
            <option value="medium">{priorityLabelMap.medium}</option>
            <option value="high">{priorityLabelMap.high}</option>
            <option value="critical">{priorityLabelMap.critical}</option>
          </select>
          <button type="button" className={styles.createButton} onClick={() => openCreateModal(TODAY_STR)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建任务
          </button>
        </div>
      </div>

      {/* Main Board Content Area */}
      
      {/* 1. WEEKLY COLUMNS VIEW (DAILY PLANNER) */}
      {viewMode === 'week' && (
        <div className={styles.weeklyContainer}>
          <div className={styles.weeklyGrid}>
            
            {/* Inbox / Overdue Column */}
            <div className={`${styles.weeklyCol} ${styles.inboxCol}`}>
              <div className={styles.weeklyColHeader}>
                <div className={styles.colTitleWrap}>
                  <span className={styles.colTitleIcon}>📥</span>
                  <div>
                    <h3>收件箱与逾期</h3>
                    <p className={styles.colSubtitle}>未安排日期或已逾期</p>
                  </div>
                </div>
                <span className={styles.colCountBadge}>{unscheduledOrOverdueTasks.length}</span>
              </div>
              <div className={styles.weeklyColContent}>
                {unscheduledOrOverdueTasks.map((todo) => (
                  <TaskCard
                    key={todo.id}
                    todo={todo}
                    branches={branches}
                    onUpdateTodoStatus={onUpdateTodoStatus}
                    onUpdateTodoDueDate={onUpdateTodoDueDate}
                    onDeleteTodo={onDeleteTodo}
                    onEditTodo={openEditModal}
                    cardMode={cardMode}
                  />
                ))}
                {unscheduledOrOverdueTasks.length === 0 && (
                  <div className={styles.emptyColPlaceholder}>暂无待处理</div>
                )}
              </div>
              <button 
                type="button" 
                className={styles.colQuickAddBtn} 
                onClick={() => openCreateModal('')}
              >
                + 新建未安排任务
              </button>
            </div>

            {/* 7 Day Columns */}
            {weekDays.map((day, idx) => {
              const dateStr = formatDateString(day);
              const isToday = dateStr === TODAY_STR;
              const dayName = getDayName(idx);
              const dayTasks = filteredTodos.filter((t) => t.dueDate === dateStr);
              
              return (
                <div 
                  key={dateStr} 
                  className={`${styles.weeklyCol} ${isToday ? styles.todayCol : ''}`}
                >
                  <div className={styles.weeklyColHeader}>
                    <div className={styles.colTitleWrap}>
                      <span className={`${styles.dayBadge} ${isToday ? styles.todayBadgeActive : ''}`}>
                        {day.getDate()}
                      </span>
                      <div>
                        <h3>{dayName}</h3>
                        <p className={styles.colSubtitle}>
                          {day.toLocaleDateString('zh-CN', { month: 'short' })}
                        </p>
                      </div>
                    </div>
                    {isToday && <span className={styles.todayPill}>今天</span>}
                    <span className={styles.colCountBadge}>{dayTasks.length}</span>
                  </div>
                  <div className={styles.weeklyColContent}>
                    {dayTasks.map((todo) => (
                      <TaskCard
                        key={todo.id}
                        todo={todo}
                        branches={branches}
                        onUpdateTodoStatus={onUpdateTodoStatus}
                        onUpdateTodoDueDate={onUpdateTodoDueDate}
                        onDeleteTodo={onDeleteTodo}
                        onEditTodo={openEditModal}
                        cardMode={cardMode}
                      />
                    ))}
                    {dayTasks.length === 0 && (
                      <div className={styles.emptyColPlaceholder}>暂无任务</div>
                    )}
                  </div>
                  <button 
                    type="button" 
                    className={styles.colQuickAddBtn} 
                    onClick={() => openCreateModal(dateStr)}
                  >
                    + 添加到{dayName}
                  </button>
                </div>
              );
            })}

          </div>
        </div>
      )}

      {/* 2. VERTICAL TIMELINE VIEW */}
      {viewMode === 'timeline' && (
        <div className={styles.timelineContainer}>
          <div className={styles.timelineList}>
            {timelineGroups.map((group) => (
              <div 
                key={group.title} 
                className={`${styles.timelineGroup} ${
                  group.isToday ? styles.timelineTodayGroup : ''
                } ${group.isOverdue ? styles.timelineOverdueGroup : ''}`}
              >
                {/* Timeline Left Column: Dates */}
                <div className={styles.timelineDateCol}>
                  <div className={styles.timelineDateSticky}>
                    <div className={styles.timelineGroupIcon}>
                      {group.isOverdue ? '⚠️' : group.isToday ? '📅' : group.isTomorrow ? '🌅' : group.isUnscheduled ? '📥' : '🗓️'}
                    </div>
                    <div>
                      <h2 className={styles.timelineGroupTitle}>{group.title}</h2>
                      {group.dateStr && (
                        <p className={styles.timelineGroupSubtitle}>
                          {new Date(group.dateStr).toLocaleDateString('zh-CN', { weekday: 'long' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline Middle: Node Line */}
                <div className={styles.timelineIndicatorCol}>
                  <div className={styles.timelineLine} />
                  <div className={`${styles.timelineDot} ${
                    group.isToday ? styles.timelineDotToday : group.isOverdue ? styles.timelineDotOverdue : ''
                  }`} />
                </div>

                {/* Timeline Right: Cards */}
                <div className={styles.timelineTasksCol}>
                  <div className={styles.timelineGrid}>
                    {group.tasks.map((todo) => (
                      <TaskCard
                        key={todo.id}
                        todo={todo}
                        branches={branches}
                        onUpdateTodoStatus={onUpdateTodoStatus}
                        onUpdateTodoDueDate={onUpdateTodoDueDate}
                        onDeleteTodo={onDeleteTodo}
                        onEditTodo={openEditModal}
                        cardMode={cardMode}
                      />
                    ))}
                    {group.tasks.length === 0 && group.isToday && (
                      <div className={styles.timelineEmptyState}>
                        <p>今天还没有安排任务。</p>
                        <button 
                          type="button" 
                          className={styles.timelineAddTodayBtn}
                          onClick={() => openCreateModal(TODAY_STR)}
                        >
                          + 安排任务
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {timelineGroups.length === 0 && (
              <div className={styles.timelineEmptyAll}>
                <p>没有找到任务。请调整筛选条件或搜索关键词。</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. STANDARD GRID VIEW */}
      {viewMode === 'grid' && (
        <div className={styles.boardGrid}>
          {filteredTodos.map((todo) => (
            <TaskCard
              key={todo.id}
              todo={todo}
              branches={branches}
              onUpdateTodoStatus={onUpdateTodoStatus}
              onUpdateTodoDueDate={onUpdateTodoDueDate}
              onDeleteTodo={onDeleteTodo}
              onEditTodo={openEditModal}
              cardMode={cardMode}
            />
          ))}
          {filteredTodos.length === 0 && (
            <div className={styles.emptyGridPlaceholder}>
              <h3>没有找到任务</h3>
              <p>请调整筛选条件，或新建一个任务。</p>
            </div>
          )}
        </div>
      )}

      {/* CREATE/EDIT TASK MODAL */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{editingTodo ? '编辑任务' : '新建任务'}</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label>任务标题</label>
                <input
                  type="text"
                  placeholder="例如：购买日用品、阅读 Rust 指南、开发登录页"
                  value={title}
                  onChange={handleTitleChange}
                  className={styles.inputField}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>描述</label>
                <textarea
                  placeholder="填写任务详情..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={styles.textareaField}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label>分类</label>
                  <select
                    value={category}
                    onChange={handleCategoryChange}
                    className={styles.selectField}
                  >
                    <option value="dev">💻 {categoryLabelMap.dev}</option>
                    <option value="personal">🏠 {categoryLabelMap.personal}</option>
                    <option value="shopping">🛒 {categoryLabelMap.shopping}</option>
                    <option value="learning">📚 {categoryLabelMap.learning}</option>
                    <option value="workout">💪 {categoryLabelMap.workout}</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>优先级</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Todo['priority'])}
                    className={styles.selectField}
                  >
                    <option value="low">{priorityLabelMap.low}</option>
                    <option value="medium">{priorityLabelMap.medium}</option>
                    <option value="high">{priorityLabelMap.high}</option>
                    <option value="critical">{priorityLabelMap.critical}</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label>状态</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Todo['status'])}
                    className={styles.selectField}
                  >
                    <option value="backlog">{statusLabelMap.backlog}</option>
                    <option value="todo">{statusLabelMap.todo}</option>
                    <option value="in-progress">{statusLabelMap['in-progress']}</option>
                    <option value="review">{statusLabelMap.review}</option>
                    <option value="done">{statusLabelMap.done}</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>截止日期</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={styles.inputField}
                  />
                </div>
              </div>

              {category === 'dev' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div className={styles.formGroup}>
                      <label>Git 关联</label>
                      <select
                        value={branchId}
                        onChange={(e) => {
                          setBranchId(e.target.value);
                          if (e.target.value !== 'none') {
                            setCreateNewBranch(false);
                          }
                        }}
                        className={styles.selectField}
                        disabled={createNewBranch}
                      >
                        <option value="none">不关联分支</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ marginTop: '0.25rem' }}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={createNewBranch}
                        onChange={handleCreateNewBranchToggle}
                      />
                      <span>为这个任务创建新的 Git 分支</span>
                    </label>
                  </div>

                  {createNewBranch && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                      <div className={styles.formGroup}>
                        <label>分支名称</label>
                        <input
                          type="text"
                          placeholder="sprint36/story/your-feature"
                          value={newBranchName}
                          onChange={(e) => setNewBranchName(e.target.value)}
                          className={styles.inputField}
                          style={{ fontFamily: 'var(--font-mono)' }}
                          required
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>基础分支</label>
                        <select
                          value={newBranchBase}
                          onChange={(e) => setNewBranchBase(e.target.value)}
                          className={styles.selectField}
                        >
                          <option value="master">master</option>
                          <option value="prod">prod</option>
                          <option value="develop">develop</option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                  取消
                </button>
                <button type="submit" className={styles.saveBtn}>
                  {editingTodo ? '保存修改' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
