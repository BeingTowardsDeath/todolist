'use client';

import { useMemo, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import type { Note, NoteColor, NoteInput, NoteUpdateInput } from '@/types';

import styles from './NoteSection.module.css';

type NoteColorFilter = NoteColor | 'all';

interface NoteSectionProps {
  notes: Note[];
  onAddNote: (note: NoteInput) => Promise<void>;
  onUpdateNote: (noteId: string, updates: NoteUpdateInput) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

interface NoteEditorProps {
  color: NoteColor;
  content: string;
  formError: string | null;
  isPinned: boolean;
  isSubmitting: boolean;
  selectedNote: Note | null;
  title: string;
  onCancel: () => void;
  onColorChange: (color: NoteColor) => void;
  onContentChange: (value: string) => void;
  onDelete: () => void;
  onPinnedChange: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
}

interface NoteListItemProps {
  isActive: boolean;
  note: Note;
  onSelect: (note: Note) => void;
}

const noteColors: NoteColor[] = ['default', 'blue', 'green', 'yellow', 'rose'];

const noteColorLabelMap: Record<NoteColor, string> = {
  default: '默认',
  blue: '蓝色',
  green: '绿色',
  yellow: '黄色',
  rose: '玫红',
};

const joinClassNames = (...classes: Array<string | false | undefined>): string =>
  classes.filter(Boolean).join(' ');

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

const getPreview = (note: Note): string => {
  const source = note.content.trim() || note.title.trim();
  return source || '空白文档';
};

function AddIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 17v5" />
      <path d="M5 17h14" />
      <path d="M7 3h10l-2 8 3 6H6l3-6-2-8Z" />
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

function NoteListItem({ isActive, note, onSelect }: NoteListItemProps) {
  return (
    <button
      type="button"
      className={joinClassNames(styles.noteListItem, isActive && styles.activeNoteItem)}
      onClick={() => onSelect(note)}
    >
      <span className={joinClassNames(styles.fileGlyph, styles[`file-${note.color}`])}>
        <FileIcon />
      </span>
      <span className={styles.noteListText}>
        <span className={styles.noteListTitle}>
          {note.title || '未命名文档'}
          {note.isPinned && <span className={styles.notePinMark}>置顶</span>}
        </span>
        <span className={styles.noteListPreview}>{getPreview(note)}</span>
        <span className={styles.noteListMeta}>更新于 {formatDateTime(note.updatedAt)}</span>
      </span>
    </button>
  );
}

function NoteEditor({
  color,
  content,
  formError,
  isPinned,
  isSubmitting,
  selectedNote,
  title,
  onCancel,
  onColorChange,
  onContentChange,
  onDelete,
  onPinnedChange,
  onSubmit,
  onTitleChange,
}: NoteEditorProps) {
  const handleEditorKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';

    if (!isSaveShortcut) {
      return;
    }

    event.preventDefault();

    if (!isSubmitting && !event.repeat) {
      event.currentTarget.requestSubmit();
    }
  };

  return (
    <form className={styles.editorPanel} onKeyDown={handleEditorKeyDown} onSubmit={onSubmit}>
      <div className={styles.editorToolbar}>
        <div className={styles.editorState}>
          <span className={joinClassNames(styles.editorFileDot, styles[`file-${color}`])} />
          <span>{selectedNote ? `编辑 ${formatDateTime(selectedNote.updatedAt)}` : '新建文档'}</span>
        </div>

        <div className={styles.editorActions}>
          {selectedNote && (
            <>
              <button
                type="button"
                className={joinClassNames(styles.toolButton, isPinned && styles.activeToolButton)}
                onClick={onPinnedChange}
                title={isPinned ? '取消置顶' : '置顶文档'}
                aria-pressed={isPinned}
              >
                <PinIcon />
              </button>
              <button type="button" className={styles.dangerToolButton} onClick={onDelete} title="删除文档">
                <DeleteIcon />
              </button>
            </>
          )}
          <button type="button" className={styles.secondaryButton} onClick={onCancel}>
            清空
          </button>
          <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
            {isSubmitting ? '保存中...' : selectedNote ? '保存' : '创建'}
          </button>
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="未命名文档"
        className={styles.titleInput}
        aria-label="文档标题"
      />

      <div className={styles.formatBar}>
        <span>标记颜色</span>
        <div className={styles.colorGroup}>
          {noteColors.map((noteColor) => (
            <button
              key={noteColor}
              type="button"
              className={joinClassNames(
                styles.colorButton,
                styles[`color-${noteColor}`],
                color === noteColor && styles.activeColor
              )}
              onClick={() => onColorChange(noteColor)}
              title={noteColorLabelMap[noteColor]}
              aria-label={`选择${noteColorLabelMap[noteColor]}文档`}
              aria-pressed={color === noteColor}
            />
          ))}
        </div>
      </div>

      <textarea
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="开始输入内容..."
        className={styles.editorTextarea}
        aria-label="文档内容"
      />

      <div className={styles.editorFooter}>
        <span>{content.length} 字符</span>
        {formError && <p className={styles.formError}>{formError}</p>}
      </div>
    </form>
  );
}

export function NoteSection({ notes, onAddNote, onUpdateNote, onDeleteNote }: NoteSectionProps) {
  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState<NoteColorFilter>('all');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<NoteColor>('default');
  const [isPinned, setIsPinned] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt)),
    [notes]
  );

  const pinnedCount = useMemo(() => notes.filter((note) => note.isPinned).length, [notes]);
  const selectedNote = selectedNoteId ? notes.find((note) => note.id === selectedNoteId) ?? null : null;

  const filteredNotes = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return sortedNotes.filter((note) => {
      const matchesSearch = !keyword
        || note.title.toLowerCase().includes(keyword)
        || note.content.toLowerCase().includes(keyword);
      const matchesColor = colorFilter === 'all' || note.color === colorFilter;
      const matchesPinned = !showPinnedOnly || note.isPinned;

      return matchesSearch && matchesColor && matchesPinned;
    });
  }, [colorFilter, search, showPinnedOnly, sortedNotes]);

  const resetEditor = () => {
    setSelectedNoteId(null);
    setTitle('');
    setContent('');
    setColor('default');
    setIsPinned(false);
    setFormError(null);
  };

  const handleSelectNote = (note: Note) => {
    setSelectedNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setColor(note.color);
    setIsPinned(note.isPinned);
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextNote = {
      title: title.trim(),
      content: content.trim(),
      color,
    };

    if (!nextNote.title && !nextNote.content) {
      setFormError('请至少填写标题或内容。');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (selectedNote) {
        await onUpdateNote(selectedNote.id, { ...nextNote, isPinned });
      } else {
        await onAddNote(nextNote);
        resetEditor();
      }
    } catch {
      setFormError('保存失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinnedChange = async () => {
    if (!selectedNote) {
      return;
    }

    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    await onUpdateNote(selectedNote.id, { isPinned: nextPinned });
  };

  const handleDeleteSelected = async () => {
    if (!selectedNote) {
      return;
    }

    await onDeleteNote(selectedNote.id);
    resetEditor();
  };

  const emptyMessage = notes.length === 0
    ? '还没有文档。点击新建后在右侧编辑器里记录内容。'
    : '没有匹配的文档。请调整搜索或筛选条件。';

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1>文本编辑器</h1>
          <p>以文档方式管理记事，左侧选择文件，右侧直接编辑内容。</p>
        </div>
        <button type="button" className={styles.createButton} onClick={resetEditor}>
          <AddIcon />
          新建文档
        </button>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.filePane} aria-label="文档列表">
          <div className={styles.searchPane}>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索文档..."
              className={styles.searchField}
            />
          </div>

          <div className={styles.filterGroup} aria-label="文档筛选">
            <button
              type="button"
              className={joinClassNames(styles.filterButton, colorFilter === 'all' && !showPinnedOnly && styles.activeFilter)}
              onClick={() => {
                setColorFilter('all');
                setShowPinnedOnly(false);
              }}
            >
              全部
              <span>{notes.length}</span>
            </button>
            <button
              type="button"
              className={joinClassNames(styles.filterButton, showPinnedOnly && styles.activeFilter)}
              onClick={() => setShowPinnedOnly((currentValue) => !currentValue)}
            >
              置顶
              <span>{pinnedCount}</span>
            </button>
          </div>

          <div className={styles.colorFilters} aria-label="颜色筛选">
            {noteColors.map((noteColor) => (
              <button
                key={noteColor}
                type="button"
                className={joinClassNames(
                  styles.colorFilterButton,
                  styles[`color-${noteColor}`],
                  colorFilter === noteColor && styles.activeColorFilter
                )}
                onClick={() => setColorFilter(noteColor)}
                title={noteColorLabelMap[noteColor]}
                aria-label={`筛选${noteColorLabelMap[noteColor]}文档`}
              />
            ))}
          </div>

          <div className={styles.noteList}>
            {filteredNotes.map((note) => (
              <NoteListItem
                key={note.id}
                isActive={note.id === selectedNoteId}
                note={note}
                onSelect={handleSelectNote}
              />
            ))}
          </div>

          {filteredNotes.length === 0 && (
            <div className={styles.emptyState}>
              <h2>暂无文档</h2>
              <p>{emptyMessage}</p>
            </div>
          )}
        </aside>

        <NoteEditor
          color={color}
          content={content}
          formError={formError}
          isPinned={isPinned}
          isSubmitting={isSubmitting}
          selectedNote={selectedNote}
          title={title}
          onCancel={resetEditor}
          onColorChange={setColor}
          onContentChange={setContent}
          onDelete={handleDeleteSelected}
          onPinnedChange={() => void handlePinnedChange()}
          onSubmit={handleSubmit}
          onTitleChange={setTitle}
        />
      </div>
    </section>
  );
}
