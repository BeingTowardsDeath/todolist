'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';

import type { Idea, IdeaInput, IdeaUpdateInput } from '@/types';

import styles from './IdeaSection.module.css';

type IdeaStatusFilter = Idea['status'] | 'all';

interface MasonryLayout {
  columnCount: number;
  containerRef: RefObject<HTMLDivElement | null>;
}

interface IdeaSectionProps {
  ideas: Idea[];
  onAddIdea: (idea: IdeaInput) => Promise<void>;
  onUpdateIdea: (ideaId: string, updates: IdeaUpdateInput) => Promise<void>;
  onDeleteIdea: (ideaId: string) => Promise<void>;
}

interface IdeaCardProps {
  idea: Idea;
  onEdit: (idea: Idea) => void;
  onUpdateIdea: (ideaId: string, updates: IdeaUpdateInput) => Promise<void>;
  onDeleteIdea: (ideaId: string) => Promise<void>;
}

interface IdeaCaptureFormProps {
  content: string;
  editingIdea: Idea | null;
  formError: string | null;
  isSubmitting: boolean;
  title: string;
  onCancelEdit: () => void;
  onContentChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
}

const joinClassNames = (...classes: Array<string | false | undefined>): string =>
  classes.filter(Boolean).join(' ');

const MASONRY_COLUMN_MIN_WIDTH = 280;
const MASONRY_COLUMN_GAP = 12;

const ideaStatusLabelMap: Record<Idea['status'], string> = {
  open: '待整理',
  archived: '已归档',
};

const getMasonryColumnCount = (containerWidth: number): number => {
  const availableWidth = containerWidth + MASONRY_COLUMN_GAP;
  const columnWidth = MASONRY_COLUMN_MIN_WIDTH + MASONRY_COLUMN_GAP;
  return Math.max(1, Math.floor(availableWidth / columnWidth));
};

const getEstimatedIdeaCardHeight = (idea: Idea): number => {
  const titleLines = Math.max(1, Math.ceil(idea.title.length / 18));
  const contentLines = idea.content
    ? Math.max(1, idea.content.split('\n').length + Math.ceil(idea.content.length / 44))
    : 1;
  return 108 + titleLines * 22 + contentLines * 21;
};

const distributeIdeasIntoColumns = (ideas: Idea[], columnCount: number): Idea[][] => {
  const columns = Array.from({ length: columnCount }, () => [] as Idea[]);
  const columnHeights = Array.from({ length: columnCount }, () => 0);

  ideas.forEach((idea) => {
    const shortestHeight = Math.min(...columnHeights);
    const targetColumnIndex = columnHeights.indexOf(shortestHeight);
    columns[targetColumnIndex].push(idea);
    columnHeights[targetColumnIndex] += getEstimatedIdeaCardHeight(idea);
  });

  return columns.filter((column) => column.length > 0);
};

function useMasonryLayout(): MasonryLayout {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const updateColumnCount = (width: number) => {
      const nextColumnCount = getMasonryColumnCount(width);
      setColumnCount((currentColumnCount) =>
        currentColumnCount === nextColumnCount ? currentColumnCount : nextColumnCount
      );
    };

    updateColumnCount(container.getBoundingClientRect().width);
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (entry) {
        updateColumnCount(entry.contentRect.width);
      }
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  return { columnCount, containerRef };
}

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 1-15-6.7L3 13" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IdeaCaptureForm({
  content,
  editingIdea,
  formError,
  isSubmitting,
  title,
  onCancelEdit,
  onContentChange,
  onSubmit,
  onTitleChange,
}: IdeaCaptureFormProps) {
  return (
    <form className={styles.capturePanel} onSubmit={onSubmit}>
      <div className={styles.captureHeader}>
        <div>
          <h2>{editingIdea ? '编辑想法' : '快速记录'}</h2>
          <p>把脑子里刚出现的内容先放进来，稍后再整理。</p>
        </div>
        {editingIdea && (
          <button type="button" className={styles.secondaryButton} onClick={onCancelEdit}>
            取消编辑
          </button>
        )}
      </div>

      <div className={styles.formGrid}>
        <label className={styles.formGroup}>
          <span>标题</span>
          <input
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="一句话概括这个想法"
            className={styles.inputField}
          />
        </label>
        <label className={styles.formGroup}>
          <span>内容</span>
          <textarea
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            placeholder="记录触发点、背景、下一步或任何片段..."
            className={styles.textareaField}
          />
        </label>
      </div>

      <div className={styles.formFooter}>
        {formError && <p className={styles.formError}>{formError}</p>}
        <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {isSubmitting ? '保存中...' : editingIdea ? '保存想法' : '记录想法'}
        </button>
      </div>
    </form>
  );
}

function IdeaCard({ idea, onEdit, onUpdateIdea, onDeleteIdea }: IdeaCardProps) {
  const isArchived = idea.status === 'archived';
  const nextStatus: Idea['status'] = isArchived ? 'open' : 'archived';

  return (
    <article className={joinClassNames(styles.ideaCard, isArchived && styles.archivedCard)}>
      <div className={styles.ideaCardHeader}>
        <div className={styles.ideaTitleGroup}>
          <h3>{idea.title}</h3>
          <span className={styles.ideaTime}>更新于 {formatDateTime(idea.updatedAt)}</span>
        </div>
        <span className={joinClassNames(styles.statusBadge, isArchived && styles.archivedBadge)}>
          {ideaStatusLabelMap[idea.status]}
        </span>
      </div>

      <p className={joinClassNames(styles.ideaContent, !idea.content && styles.emptyContent)}>
        {idea.content || '暂无补充内容'}
      </p>

      <div className={styles.ideaActions}>
        <button type="button" className={styles.iconButton} onClick={() => onEdit(idea)} title="编辑想法">
          <EditIcon />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => void onUpdateIdea(idea.id, { status: nextStatus })}
          title={isArchived ? '恢复想法' : '归档想法'}
        >
          {isArchived ? <RestoreIcon /> : <ArchiveIcon />}
        </button>
        <button
          type="button"
          className={joinClassNames(styles.iconButton, styles.deleteButton)}
          onClick={() => void onDeleteIdea(idea.id)}
          title="删除想法"
        >
          <DeleteIcon />
        </button>
      </div>
    </article>
  );
}

export function IdeaSection({ ideas, onAddIdea, onUpdateIdea, onDeleteIdea }: IdeaSectionProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<IdeaStatusFilter>('open');
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { columnCount, containerRef } = useMasonryLayout();

  const counts = useMemo(() => ({
    all: ideas.length,
    open: ideas.filter((idea) => idea.status === 'open').length,
    archived: ideas.filter((idea) => idea.status === 'archived').length,
  }), [ideas]);

  const filteredIdeas = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return ideas.filter((idea) => {
      const matchesStatus = statusFilter === 'all' || idea.status === statusFilter;
      const matchesSearch = !keyword
        || idea.title.toLowerCase().includes(keyword)
        || idea.content.toLowerCase().includes(keyword);
      return matchesStatus && matchesSearch;
    });
  }, [ideas, search, statusFilter]);

  const masonryColumns = useMemo(
    () => distributeIdeasIntoColumns(filteredIdeas, columnCount),
    [columnCount, filteredIdeas]
  );

  const resetForm = () => {
    setEditingIdea(null);
    setTitle('');
    setContent('');
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextIdea = { title: title.trim(), content: content.trim() };

    if (!nextIdea.title && !nextIdea.content) {
      setFormError('请至少填写标题或内容。');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingIdea) {
        await onUpdateIdea(editingIdea.id, nextIdea);
      } else {
        await onAddIdea(nextIdea);
      }
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (idea: Idea) => {
    setEditingIdea(idea);
    setTitle(idea.title);
    setContent(idea.content);
    setFormError(null);
  };

  const emptyMessage = ideas.length === 0
    ? '还没有记录想法。先写下一条，之后再整理。'
    : '没有匹配的想法。请调整搜索或筛选条件。';

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>想法清单</h1>
          <p>快速捕捉灵感、待办念头和后续可以发展的点子。</p>
        </div>
      </div>

      <IdeaCaptureForm
        content={content}
        editingIdea={editingIdea}
        formError={formError}
        isSubmitting={isSubmitting}
        title={title}
        onCancelEdit={resetForm}
        onContentChange={setContent}
        onSubmit={handleSubmit}
        onTitleChange={setTitle}
      />

      <div className={styles.toolbar}>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索想法..."
          className={styles.searchField}
        />
        <div className={styles.filterGroup} aria-label="想法状态筛选">
          {(['open', 'all', 'archived'] as IdeaStatusFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              className={joinClassNames(styles.filterButton, statusFilter === filter && styles.activeFilter)}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'all' ? '全部' : ideaStatusLabelMap[filter]}
              <span>{counts[filter]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.ideaGrid} ref={containerRef}>
        {masonryColumns.map((column, columnIndex) => (
          <div className={styles.ideaColumn} key={`idea-column-${columnIndex}`}>
            {column.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onEdit={handleEdit}
                onUpdateIdea={onUpdateIdea}
                onDeleteIdea={onDeleteIdea}
              />
            ))}
          </div>
        ))}
      </div>

      {filteredIdeas.length === 0 && (
        <div className={styles.emptyState}>
          <h2>暂无内容</h2>
          <p>{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}
