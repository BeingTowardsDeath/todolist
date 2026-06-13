'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useRef, useState } from 'react';

import type { Branch, BranchImportSummary } from '@/types';

import styles from './BranchSection.module.css';

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
    field: 'name' | 'impact' | 'base',
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

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

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
  
  // State to track original value when editing text areas inline (to log to history onBlur)
  const [activeEdit, setActiveEdit] = useState<{
    branchId: string;
    field: 'name' | 'impact' | 'base';
    originalValue: string;
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

  const totalPages = Math.ceil(filteredBranches.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBranches = filteredBranches.slice(startIndex, startIndex + pageSize);

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

      <div className={styles.tableWrapper}>
        {filteredBranches.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <p>没有找到匹配的分支。可以新建一个分支开始管理。</p>
          </div>
        ) : (
          <table className={styles.branchTable}>
            <thead>
              <tr>
                <th>分支</th>
                <th style={{ width: '100px' }}>类型</th>
                <th>内容 / 影响</th>
                <th>基础分支</th>
                <th style={{ textAlign: 'center', width: '70px' }}>dev</th>
                <th style={{ textAlign: 'center', width: '70px' }}>qa</th>
                <th style={{ textAlign: 'center', width: '70px' }}>uat</th>
                <th style={{ textAlign: 'center', width: '70px' }}>pro</th>
                <th style={{ textAlign: 'center', width: '100px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBranches.map((branch) => (
                <tr key={branch.id}>
                  <td className={styles.branchCell}>
                    <textarea 
                      value={branch.name} 
                      onChange={(e) => onUpdateBranch(branch.id, { name: e.target.value })} 
                      onFocus={() => setActiveEdit({ branchId: branch.id, field: 'name', originalValue: branch.name })}
                      onBlur={() => {
                        if (activeEdit && activeEdit.branchId === branch.id && activeEdit.field === 'name') {
                          const oldVal = activeEdit.originalValue.trim();
                          const newVal = branch.name.trim();
                          if (oldVal !== newVal) {
                            onLogBranchEdit(branch.id, 'name', oldVal, newVal);
                          }
                        }
                        setActiveEdit(null);
                      }}
                      className={styles.editableTextarea + ' ' + styles.boldTextarea} 
                      rows={getRows(branch.name, 22)}
                    />
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
                    <textarea
                      value={branch.impact || ''}
                      onChange={(e) => onUpdateBranch(branch.id, { impact: e.target.value })}
                      onFocus={() => setActiveEdit({ branchId: branch.id, field: 'impact', originalValue: branch.impact || '' })}
                      onBlur={() => {
                        if (activeEdit && activeEdit.branchId === branch.id && activeEdit.field === 'impact') {
                          const oldVal = activeEdit.originalValue.trim();
                          const newVal = (branch.impact || '').trim();
                          if (oldVal !== newVal) {
                            onLogBranchEdit(branch.id, 'impact', oldVal, newVal);
                          }
                        }
                        setActiveEdit(null);
                      }}
                      className={styles.editableTextarea}
                      rows={getRows(branch.impact || '', 30)}
                    />
                  </td>
                  <td className={styles.baseCell}>
                    <textarea 
                      value={branch.base} 
                      onChange={(e) => onUpdateBranch(branch.id, { base: e.target.value })} 
                      onFocus={() => setActiveEdit({ branchId: branch.id, field: 'base', originalValue: branch.base })}
                      onBlur={() => {
                        if (activeEdit && activeEdit.branchId === branch.id && activeEdit.field === 'base') {
                          const oldVal = activeEdit.originalValue.trim();
                          const newVal = branch.base.trim();
                          if (oldVal !== newVal) {
                            onLogBranchEdit(branch.id, 'base', oldVal, newVal);
                          }
                        }
                        setActiveEdit(null);
                      }}
                      className={styles.editableTextarea + ' ' + styles.monoTextarea} 
                      rows={getRows(branch.base, 10)}
                      style={{ width: '80px' }}
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
                        onChange={(e) => onUpdateBranchEnv(branch.id, 'pro', e.target.checked)}
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
        )}
      </div>

      {filteredBranches.length > 0 && (
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
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className={styles.pageBtn}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              上一页
            </button>
            <span className={styles.pageInfo}>
              第 <strong>{totalPages > 0 ? currentPage : 0}</strong> 页，共 {totalPages} 页
            </span>
            <button 
              disabled={currentPage === totalPages || totalPages === 0} 
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
    </div>
  );
}
