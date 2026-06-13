'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

import type { User } from '@/types';

import styles from './AuthPanel.module.css';

interface AuthPanelProps {
  onAuthenticated: (user: User) => void;
}

type AuthMode = 'login' | 'register';

interface AuthResponse {
  user?: User;
  error?: string;
}

export default function AuthPanel({ onAuthenticated }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as AuthResponse;

      if (!response.ok || !data.user) {
        throw new Error(data.error ?? '认证失败。');
      }

      onAuthenticated(data.user);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : '认证失败。');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <div className={styles.logo}>G</div>
          <div>
            <h1>GitTodo</h1>
            <p>登录后管理你的私人任务工作区。</p>
          </div>
        </div>

        <div className={styles.modeSwitch} role="tablist" aria-label="认证模式">
          <button
            type="button"
            className={`${styles.modeButton} ${mode === 'login' ? styles.modeActive : ''}`}
            onClick={() => setMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === 'register' ? styles.modeActive : ''}`}
            onClick={() => setMode('register')}
          >
            注册
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>用户名</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="请输入用户名"
              minLength={3}
              maxLength={32}
              required
            />
          </label>

          <label className={styles.field}>
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder="至少 8 个字符"
              minLength={8}
              required
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitButton} disabled={pending}>
            {pending ? '请稍候...' : isRegister ? '创建账号' : '登录'}
          </button>
        </form>

        <p className={styles.note}>
          {isRegister
            ? '新账号会从空的私人工作区开始。'
            : '使用已注册账号继续。'}
        </p>
      </section>
    </main>
  );
}
