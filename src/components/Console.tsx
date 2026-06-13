'use client';

import React, { useEffect, useRef } from 'react';
import { ConsoleLog } from '../types';
import styles from './Console.module.css';

interface ConsoleProps {
  logs: ConsoleLog[];
  onClearLogs: () => void;
}

export default function Console({ logs, onClearLogs }: ConsoleProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Smooth scroll to bottom when logs update
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>开发控制台</h1>
          <p>实时查看模拟命令输出、构建日志和环境变更记录。</p>
        </div>
        <div className={styles.controls}>
          <button className={styles.clearButton} onClick={onClearLogs} title="清空终端日志">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            清空终端
          </button>
        </div>
      </div>

      <div className={styles.terminalShell}>
        <div className={styles.terminalHeader}>
          <div className={styles.windowButtons}>
            <div className={`${styles.windowDot} ${styles.dotRed}`} />
            <div className={`${styles.windowDot} ${styles.dotYellow}`} />
            <div className={`${styles.windowDot} ${styles.dotGreen}`} />
          </div>
          <span className={styles.terminalTitle}>bash - git-todo-simulated-shell</span>
          <span style={{ width: '52px' }} /> {/* Balance spacer */}
        </div>

        <div className={styles.terminalBody}>
          <div className={styles.welcomeMsg}>
            <div className={styles.welcomeHeading}>欢迎使用 GitTodo 模拟开发终端</div>
            <div>状态：正在监听环境发布和数据库事件。</div>
            <div>数据库检查完成。服务监听正常。</div>
          </div>

          {logs.map((log) => (
            <div key={log.id} className={styles.logRow}>
              <span className={styles.timestamp}>[{log.timestamp}]</span>
              <span className={`${styles.logText} ${styles[`type-${log.type}`]}`}>
                {log.type === 'command' ? `$ ${log.text}` : log.text}
              </span>
            </div>
          ))}

          <div className={styles.cursorRow}>
            <span>$</span>
            <span className={styles.cursor} />
          </div>
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
