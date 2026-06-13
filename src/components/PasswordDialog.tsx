'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

import styles from './PasswordDialog.module.css';

interface PasswordDialogProps {
  onClose: () => void;
}

interface PasswordResponse {
  error?: string;
}

export default function PasswordDialog({ onClose }: PasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json()) as PasswordResponse;

      if (!response.ok) {
        throw new Error(data.error ?? '修改密码失败。');
      }

      setCurrentPassword('');
      setNewPassword('');
      setSuccess(true);
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : '修改密码失败。');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <section className={styles.dialog} aria-modal="true" role="dialog" aria-labelledby="password-title">
        <div className={styles.header}>
          <div>
            <h2 id="password-title">修改密码</h2>
            <p>更新当前账号的登录密码。</p>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="关闭">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>当前密码</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <label className={styles.field}>
            <span>新密码</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>密码已更新。</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              取消
            </button>
            <button type="submit" className={styles.primaryButton} disabled={pending}>
              {pending ? '保存中...' : '保存密码'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
