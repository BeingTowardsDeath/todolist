'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { downloadTextFile } from '@/lib/textExport';
import type { Branch, BranchImportSummary } from '@/types';

import styles from './BranchSection.module.css';

type EditableBranchField = 'name' | 'impact' | 'base';

interface InlineBranchTextareaProps {
  ariaLabel: string;
  className: string;
  rowsChars?: number;
  rows?: number;
  value: string;
  onCommit: (nextValue: string) => void;
}

interface BranchSectionProps {
  branches: Branch[];
  onAddBranch: (branch: {
    name: string;
    impact: string;
    base: string;
    status: Branch['status'];
    type?: Branch['type'];
  }) => void;
  onImportBranchFile: (file: File) => Promise<BranchImportSummary>;
  onUpdateBranchEnv: (branchId: string, env: 'dev' | 'qa' | 'uat' | 'pro', value: boolean) => void;
  onUpdateBranchStatus: (branchId: string, status: Branch['status']) => void;
  onUpdateBranch: (branchId: string, updates: Partial<Branch>) => void;
  onDeleteBranch: (branchId: string) => void;
  onLogBranchEdit: (
    branchId: string,
    field: EditableBranchField,
    oldValue: string,
    newValue: string
  ) => void;
}

// Helper to calculate required rows for textareas with wrapping and newlines
const getRows = (text: string, charsPerLine: number = 30) => {
  if (!text) return 1;
  const lines = text.split('\n');
  let rowCount = 0;
  for (const line of lines) {
    rowCount += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  return rowCount;
};

const branchTypeLabelMap: Record<NonNullable<Branch['type']>, string> = {
  Story: '需求',
  Task: '任务',
  Bug: '缺陷',
};

interface ImportFeedback {
  type: 'success' | 'error';
  message: string;
}

const branchImportTemplateHref = '/templates/branch-upload-template.xlsx';

const branchEnvironmentKeys = ['dev', 'qa', 'uat', 'pro'] as const;

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const getBranchFieldValue = (branch: Branch, field: EditableBranchField): string => branch[field] ?? '';

const normalizeBaseBranchValue = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim();

const getDateStamp = (): string => new Date().toISOString().slice(0, 10);

const getEnvironmentMark = (value: boolean): string => value ? '[x]' : '[ ]';

const formatBranchHistoryDate = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', { hour12: false });
};

const buildBranchExportLine = (branch: Branch, index: number): string => {
  const environments = branchEnvironmentKeys
    .map((environment) => `${environment.toUpperCase()} ${getEnvironmentMark(branch[environment])}`)
    .join(' | ');

  return [
    `${index + 1}. ${branch.name}`,
    `   类型：${branch.type ? branchTypeLabelMap[branch.type] : '未设置'}`,
    `   状态：${branch.status}${branch.pinned ? ' / 置顶' : ''}`,
    `   基础分支：${normalizeBaseBranchValue(branch.base) || '-'}`,
    `   矩阵：${environments}`,
    `   内容 / 影响：${branch.impact || '-'}`,
  ].join('\n');
};

const buildBranchGroupExport = (title: string, branches: Branch[]): string => {
  if (branches.length === 0) {
    return [`## ${title}`, '', '暂无分支'].join('\n');
  }

  return [
    `## ${title}（${branches.length}）`,
    '',
    branches.map(buildBranchExportLine).join('\n\n'),
  ].join('\n');
};

const buildBranchMatrixExportContent = ({
  activeBranches,
  completedBranches,
  envFilter,
  search,
  typeFilter,
}: {
  activeBranches: Branch[];
  completedBranches: Branch[];
  envFilter: string;
  search: string;
  typeFilter: string;
}): string => {
  const exportedAt = formatBranchHistoryDate(new Date().toISOString());
  const filterSummary = [
    `搜索：${search.trim() || '全部'}`,
    `环境：${envFilter}`,
    `类型：${typeFilter === 'all' ? '全部' : branchTypeLabelMap[typeFilter as NonNullable<Branch['type']>]}`,
  ];

  return [
    '# 分支矩阵导出',
    '',
    `导出时间：${exportedAt}`,
    `筛选条件：${filterSummary.join(' / ')}`,
    `分支数量：${activeBranches.length + completedBranches.length}`,
    '',
    buildBranchGroupExport('活跃分支', activeBranches),
    '',
    buildBranchGroupExport('已完成分支', completedBranches),
  ].join('\n');
};

function InlineBranchTextarea({
  ariaLabel,
  className,
  rows,
  rowsChars = 30,
  value,
  onCommit,
}: InlineBranchTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const displayValue = isEditing ? draftValue : value;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize height of textarea to match content exactly
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [displayValue]);

  const handleFocus = () => {
    setDraftValue(value);
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onCommit(draftValue);
  };

  return (
    <textarea
      ref={textareaRef}
      aria-label={ariaLabel}
      value={displayValue}
      onChange={(event) => setDraftValue(event.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      rows={rows ?? getRows(displayValue, rowsChars)}
    />
  );
}

export default function BranchSection({
  branches,
  onAddBranch,
  onImportBranchFile,
  onUpdateBranchEnv,
  onUpdateBranch,
  onDeleteBranch,
  onLogBranchEdit,
}: BranchSectionProps) {
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<ImportFeedback | null>(null);

  // State for branch classification tab ('active' | 'completed')
  const [activeBranchTab, setActiveBranchTab] = useState<'active' | 'completed'>('active');
  // State for pending PROD update confirmation
  const [pendingProUpdate, setPendingProUpdate] = useState<{
    branchId: string;
    value: boolean;
  } | null>(null);

  // State to track branch history being viewed
  const [selectedHistoryBranchId, setSelectedHistoryBranchId] = useState<string | null>(null);

  const selectedHistoryBranch = branches.find(b => b.id === selectedHistoryBranchId) || null;

  // Form State
  const [name, setName] = useState('');
  const [impact, setImpact] = useState('');
  const [type, setType] = useState<Branch['type']>('Story');
  const [base, setBase] = useState('master');
  const [status, setStatus] = useState<Branch['status']>('Draft');

  const resetPage = () => setCurrentPage(1);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddBranch({
      name,
      impact,
      base,
      status,
      type,
    });

    // Reset
    setName('');
    setImpact('');
    setType('Story');
    setBase('master');
    setStatus('Draft');
    setIsModalOpen(false);
  };

  const handleImportClick = () => {
    setImportFeedback(null);
    importFileInputRef.current?.click();
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportFeedback(null);

    try {
      const summary = await onImportBranchFile(file);
      setImportFeedback({
        type: 'success',
        message: `导入完成：新增 ${summary.created}，更新 ${summary.updated}，跳过 ${summary.skipped}。`,
      });
      resetPage();
    } catch (error) {
      setImportFeedback({
        type: 'error',
        message: getErrorMessage(error, '导入失败，请检查模板格式。'),
      });
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const handleExportBranches = () => {
    const content = buildBranchMatrixExportContent({
      activeBranches,
      completedBranches,
      envFilter,
      search,
      typeFilter,
    });

    downloadTextFile(`branch-matrix-${getDateStamp()}.txt`, content);
  };

  const handleProChange = (branchId: string, checked: boolean) => {
    setPendingProUpdate({ branchId, value: checked });
  };

  const commitInlineEdit = (branch: Branch, field: EditableBranchField, nextValue: string) => {
    const oldValue = getBranchFieldValue(branch, field).trim();
    const newValue = field === 'base' ? normalizeBaseBranchValue(nextValue) : nextValue.trim();

    if (oldValue !== newValue) {
      onLogBranchEdit(branch.id, field, oldValue, newValue);
    }
  };

  // Filter branches
  const filteredBranches = branches.filter((branch) => {
    const matchesSearch = 
      branch.name.toLowerCase().includes(search.toLowerCase()) || 
      branch.impact.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    if (envFilter === 'all') return true;
    if (envFilter === 'dev') return branch.dev;
    if (envFilter === 'qa') return branch.qa;
    if (envFilter === 'uat') return branch.uat;
    if (envFilter === 'pro') return branch.pro;
    if (envFilter === 'none') return !branch.dev && !branch.qa && !branch.uat && !branch.pro;

    return true;
  }).filter((branch) => {
    if (typeFilter === 'all') return true;
    return branch.type === typeFilter;
  });

  const sortFunc = (a: Branch, b: Branch) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.seq - a.seq; // newer branches (larger seq) on top
  };

  const activeBranches = filteredBranches.filter(b => !b.pro).sort(sortFunc);
  const completedBranches = filteredBranches.filter(b => b.pro).sort(sortFunc);

  const currentTabList = activeBranchTab === 'active' ? activeBranches : completedBranches;
  const totalPages = Math.max(1, Math.ceil(currentTabList.length / pageSize));
  const adjustedCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (adjustedCurrentPage - 1) * pageSize;
  const paginatedBranches = currentTabList.slice(startIndex, startIndex + pageSize);

  const renderBranchTable = (list: Branch[]) => {
    return (
      <table className={styles.branchTable}>
        <thead>
          <tr>
            <th>分支</th>
            <th style={{ width: '100px' }}>类型</th>
            <th>内容 / 影响</th>
            <th className={styles.baseHeader}>基础分支</th>
            <th style={{ textAlign: 'center', width: '70px' }}>dev</th>
            <th style={{ textAlign: 'center', width: '70px' }}>qa</th>
            <th style={{ textAlign: 'center', width: '70px' }}>uat</th>
            <th style={{ textAlign: 'center', width: '70px' }}>pro</th>
            <th style={{ textAlign: 'center', width: '100px' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {list.map((branch) => (
            <tr key={branch.id}>
              <td className={styles.branchCell}>
                <div className={styles.branchNameWrapper}>
                  <button
                    type="button"
                    className={`${styles.pinBtn} ${branch.pinned ? styles.pinnedActive : ''}`}
                    onClick={() => onUpdateBranch(branch.id, { pinned: !branch.pinned })}
                    title={branch.pinned ? "取消置顶" : "置顶分支"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={branch.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                  <InlineBranchTextarea
                    ariaLabel="编辑分支名称"
                    value={branch.name}
                    onCommit={(nextValue) => commitInlineEdit(branch, 'name', nextValue)}
                    className={styles.editableTextarea + ' ' + styles.boldTextarea}
                    rowsChars={22}
                  />
                </div>
              </td>
              <td>
                <select
                  value={branch.type || ''}
                  onChange={(e) => onUpdateBranch(branch.id, { type: e.target.value as Branch['type'] })}
                  className={`${styles.editableSelect} ${styles.typeBadge} ${styles[`type-${branch.type || 'None'}`]}`}
                >
                  <option value="" disabled>选择类型...</option>
                  <option value="Story">{branchTypeLabelMap.Story}</option>
                  <option value="Task">{branchTypeLabelMap.Task}</option>
                  <option value="Bug">{branchTypeLabelMap.Bug}</option>
                </select>
              </td>
              <td className={styles.impactCell} title="点击编辑">
                <InlineBranchTextarea
                  ariaLabel="编辑分支内容或影响"
                  value={branch.impact || ''}
                  onCommit={(nextValue) => commitInlineEdit(branch, 'impact', nextValue)}
                  className={styles.editableTextarea}
                  rowsChars={30}
                />
              </td>
              <td className={styles.baseCell} title={normalizeBaseBranchValue(branch.base)}>
                <InlineBranchTextarea
                  ariaLabel="编辑基础分支"
                  value={normalizeBaseBranchValue(branch.base)}
                  onCommit={(nextValue) => commitInlineEdit(branch, 'base', nextValue)}
                  className={styles.editableTextarea + ' ' + styles.monoTextarea + ' ' + styles.baseTextarea}
                  rowsChars={22}
                />
              </td>
              
              {/* DEV checkbox */}
              <td style={{ textAlign: 'center' }}>
                <label className="env-checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={branch.dev}
                    onChange={(e) => onUpdateBranchEnv(branch.id, 'dev', e.target.checked)}
                    className="env-checkbox-input"
                  />
                  <div className="env-checkbox-box env-dev">
                    <svg viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </label>
              </td>

              {/* QA checkbox */}
              <td style={{ textAlign: 'center' }}>
                <label className="env-checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={branch.qa}
                    onChange={(e) => onUpdateBranchEnv(branch.id, 'qa', e.target.checked)}
                    className="env-checkbox-input"
                  />
                  <div className="env-checkbox-box env-qa">
                    <svg viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </label>
              </td>

              {/* UAT checkbox */}
              <td style={{ textAlign: 'center' }}>
                <label className="env-checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={branch.uat}
                    onChange={(e) => onUpdateBranchEnv(branch.id, 'uat', e.target.checked)}
                    className="env-checkbox-input"
                  />
                  <div className="env-checkbox-box env-uat">
                    <svg viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </label>
              </td>

              {/* PRO checkbox */}
              <td style={{ textAlign: 'center' }}>
                <label className="env-checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={branch.pro}
                    onChange={(e) => handleProChange(branch.id, e.target.checked)}
                    className="env-checkbox-input"
                  />
                  <div className="env-checkbox-box env-pro">
                    <svg viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </label>
              </td>

              {/* ACTIONS */}
              <td style={{ textAlign: 'center' }}>
                <div className={styles.actionsCell}>
                  <button 
                    className={styles.historyBtn} 
                    onClick={() => setSelectedHistoryBranchId(branch.id)} 
                    title="查看修改历史"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <polyline points="3 3 3 8 8 8" />
                      <line x1="12" y1="7" x2="12" y2="12" />
                      <line x1="12" y1="12" x2="16" y2="14" />
                    </svg>
                  </button>
                  <button className={styles.actionBtn} onClick={() => onDeleteBranch(branch.id)} title="删除分支">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const isSearchEmpty = filteredBranches.length === 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>分支管理</h1>
          <p>跟踪活跃功能从 DEV 到 QA、UAT、PROD 的环境发布状态。</p>
        </div>
        <div className={styles.controls}>
          <input
            type="text"
            placeholder="搜索分支..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            className={styles.searchBar}
          />
          <select
            value={envFilter}
            onChange={(e) => {
              setEnvFilter(e.target.value);
              resetPage();
            }}
            className={styles.filterSelect}
          >
            <option value="all">全部环境</option>
            <option value="dev">已发布：DEV</option>
            <option value="qa">已发布：QA</option>
            <option value="uat">已发布：UAT</option>
            <option value="pro">已发布：PROD</option>
            <option value="none">未发布</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              resetPage();
            }}
            className={styles.filterSelect + ' ' + styles.typeFilterSelect}
          >
            <option value="all">全部类型</option>
            <option value="Story">{branchTypeLabelMap.Story}</option>
            <option value="Task">{branchTypeLabelMap.Task}</option>
            <option value="Bug">{branchTypeLabelMap.Bug}</option>
          </select>
          <a
            className={`${styles.importButton} ${styles.templateButton}`}
            href={branchImportTemplateHref}
            download="branch-upload-template.xlsx"
            title="下载分支导入模板"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            下载模板
          </a>
          <button
            type="button"
            className={styles.importButton}
            onClick={handleExportBranches}
            disabled={filteredBranches.length === 0}
            title="导出当前分支矩阵为 TXT"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            导出
          </button>
          <button
            type="button"
            className={styles.importButton}
            onClick={handleImportClick}
            disabled={isImporting}
            title="按模板导入分支"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {isImporting ? '导入中' : '导入'}
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
            className={styles.hiddenFileInput}
            onChange={handleImportFileChange}
          />
          <button type="button" className={styles.createButton} onClick={() => setIsModalOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建分支
          </button>
        </div>
      </div>

      {importFeedback && (
        <div
          className={[
            styles.importFeedback,
            importFeedback.type === 'error' ? styles.importFeedbackError : styles.importFeedbackSuccess,
          ].join(' ')}
          role={importFeedback.type === 'error' ? 'alert' : 'status'}
        >
          {importFeedback.message}
        </div>
      )}

      {/* Tab Container */}
      <div className={styles.tabContainer}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeBranchTab === 'active' ? styles.tabBtnActive : ''}`}
          onClick={() => {
            setActiveBranchTab('active');
            resetPage();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: activeBranchTab === 'active' ? 'var(--accent-purple)' : 'inherit' }}>
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          活跃分支
          <span className={`${styles.tabBadge} ${activeBranchTab === 'active' ? styles.tabBadgeActive : ''}`}>
            {activeBranches.length}
          </span>
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeBranchTab === 'completed' ? styles.tabBtnActiveCompleted : ''}`}
          onClick={() => {
            setActiveBranchTab('completed');
            resetPage();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: activeBranchTab === 'completed' ? '#10b981' : 'inherit' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          已完成分支
          <span className={`${styles.tabBadge} ${activeBranchTab === 'completed' ? styles.tabBadgeCompletedActive : ''}`}>
            {completedBranches.length}
          </span>
        </button>
      </div>

      {isSearchEmpty ? (
        <div className={styles.tableWrapper}>
          <div className={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <p>没有找到匹配的分支。可以新建一个分支开始管理。</p>
          </div>
        </div>
      ) : (
        <div className={styles.tableWrapper} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {currentTabList.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: '3rem' }}>
              <p>{activeBranchTab === 'active' ? '暂无活跃分支' : '暂无已完成分支'}</p>
            </div>
          ) : (
            renderBranchTable(paginatedBranches)
          )}
        </div>
      )}

      {!isSearchEmpty && currentTabList.length > 0 && (
        <div className={styles.pagination}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              每页行数：
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                resetPage();
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              disabled={adjustedCurrentPage === 1} 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className={styles.pageBtn}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              上一页
            </button>
            <span className={styles.pageInfo}>
              第 <strong>{totalPages > 0 ? adjustedCurrentPage : 0}</strong> 页，共 {totalPages} 页
            </span>
            <button 
              disabled={adjustedCurrentPage === totalPages || totalPages === 0} 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className={styles.pageBtn}
            >
              下一页
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>新建分支</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className={styles.formGroup}>
                <label>分支名称</label>
                <input
                  type="text"
                  placeholder="例如：sprint35/story/28244"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.inputField}
                  style={{ fontFamily: 'var(--font-mono)' }}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>内容 / 影响</label>
                <textarea
                  placeholder="例如：移除管理端的旧命名逻辑"
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  className={styles.inputField}
                  rows={3}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label>类型</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Branch['type'])}
                    className={styles.selectField}
                  >
                    <option value="Story">{branchTypeLabelMap.Story}</option>
                    <option value="Task">{branchTypeLabelMap.Task}</option>
                    <option value="Bug">{branchTypeLabelMap.Bug}</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>基础分支</label>
                  <input
                    type="text"
                    value={base}
                    onChange={(e) => setBase(e.target.value)}
                    className={styles.inputField}
                    placeholder="例如：master"
                  />
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                  取消
                </button>
                <button type="submit" className={styles.saveBtn}>
                  创建分支
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedHistoryBranch && (
        <div className={styles.modalOverlay}>
          <div className={styles.historyModalContent}>
            <div className={styles.modalHeader}>
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--accent-purple)' }}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  分支修改历史
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {selectedHistoryBranch.name}
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedHistoryBranchId(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.historyBody}>
              {(!selectedHistoryBranch.history || selectedHistoryBranch.history.length === 0) ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  暂无修改历史记录
                </div>
              ) : (
                <div className={styles.timeline}>
                  {[...selectedHistoryBranch.history]
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((item) => {
                      let markerClass = styles.timelineMarker;
                      const actionLower = item.action.toLowerCase();
                      if (actionLower.includes('created')) {
                        markerClass += ' ' + styles.timelineMarkerCreated;
                      } else if (actionLower.includes('promoted') || actionLower.includes('rollback')) {
                        markerClass += ' ' + styles.timelineMarkerPromoted;
                      } else if (actionLower.includes('status')) {
                        markerClass += ' ' + styles.timelineMarkerStatus;
                      } else {
                        markerClass += ' ' + styles.timelineMarkerEdited;
                      }

                      return (
                        <div key={item.id} className={styles.timelineItem}>
                          <div className={markerClass} />
                          <div className={styles.timelineHeader}>
                            <span className={styles.timelineAction}>{item.action}</span>
                            <span className={styles.timelineTime}>
                              {new Date(item.timestamp).toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                              })}
                            </span>
                          </div>
                          {item.details && (
                            <div className={styles.timelineDetails}>{item.details}</div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className={styles.formActions} style={{ margin: 0 }}>
              <button className={styles.cancelBtn} onClick={() => setSelectedHistoryBranchId(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingProUpdate && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModalContent}>
            <div className={styles.confirmModalHeader}>
              <div className={styles.warningIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3>{pendingProUpdate.value ? '确认发布到 PROD 环境？' : '确认从 PROD 环境回滚？'}</h3>
            </div>
            <p className={styles.confirmModalBody}>
              {pendingProUpdate.value 
                ? '发布到 PROD 会将分支合并到 master 分支并上线。对应的关联任务将自动更新为已完成状态，且该分支将移动至“已完成分支”分类。' 
                : '从 PROD 回滚分支会将生产发布状态撤销。对应的关联任务状态不会改变，但该分支将移回“活跃分支”分类。'}
            </p>
            <div className={styles.confirmModalActions}>
              <button 
                type="button" 
                className={styles.cancelBtn} 
                onClick={() => setPendingProUpdate(null)}
              >
                取消
              </button>
              <button 
                type="button" 
                className={pendingProUpdate.value ? styles.confirmProBtn : styles.confirmRollbackBtn} 
                onClick={() => {
                  onUpdateBranchEnv(pendingProUpdate.branchId, 'pro', pendingProUpdate.value);
                  setPendingProUpdate(null);
                }}
              >
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
