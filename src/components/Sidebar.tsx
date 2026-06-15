'use client';

import type { AppTab, User } from '@/types';

import styles from './Sidebar.module.css';

interface NavItem {
  tab: AppTab;
  label: string;
  icon: 'tasks' | 'ideas' | 'notes' | 'branches' | 'terminal';
}

interface SidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  user: User;
  stats: {
    totalTasks: number;
    completedTasks: number;
    openIdeas: number;
    totalNotes: number;
    pinnedNotes: number;
    activeBranches: number;
    deployedPro: number;
  };
  onChangePassword: () => void;
  onLogout: () => void;
}

const navItems: NavItem[] = [
  { tab: 'tasks', label: '任务看板', icon: 'tasks' },
  { tab: 'ideas', label: '想法清单', icon: 'ideas' },
  { tab: 'notes', label: '记事板', icon: 'notes' },
  { tab: 'branches', label: '分支矩阵', icon: 'branches' },
  { tab: 'terminal', label: '开发控制台', icon: 'terminal' },
];

const joinClassNames = (...classes: Array<string | false | undefined>): string =>
  classes.filter(Boolean).join(' ');

function NavIcon({ icon }: { icon: NavItem['icon'] }) {
  if (icon === 'tasks') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    );
  }

  if (icon === 'ideas') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M2 10a8 8 0 1 1 16 0c0 2.6-1.2 4.1-2.4 5.4-.8.8-1.6 1.7-1.6 2.6h-4c0-.9-.8-1.8-1.6-2.6C3.2 14.1 2 12.6 2 10Z" />
      </svg>
    );
  }

  if (icon === 'notes') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4z" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </svg>
    );
  }

  if (icon === 'branches') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  user,
  stats,
  onChangePassword,
  onLogout,
}: SidebarProps) {
  const initials = user.username.slice(0, 3).toUpperCase();

  return (
    <div className={styles.sidebar}>
      <div className={styles.topSection}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>G</div>
          <span>GIT_TODO.sh</span>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <button
              key={item.tab}
              type="button"
              className={joinClassNames(styles.navButton, activeTab === item.tab && styles.activeNav)}
              onClick={() => setActiveTab(item.tab)}
            >
              <span className={styles.navIcon}>
                <NavIcon icon={item.icon} />
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.statsSection}>
          <h3 className={styles.statsTitle}>统计</h3>

          <div className={styles.statRow}>
            <span>待处理任务</span>
            <span className={styles.statValue}>{stats.totalTasks - stats.completedTasks}</span>
          </div>

          <div className={styles.statRow}>
            <span>待整理想法</span>
            <span className={styles.statValue}>{stats.openIdeas}</span>
          </div>

          <div className={styles.statRow}>
            <span>记事总数</span>
            <span className={styles.statValue}>{stats.totalNotes}</span>
          </div>

          <div className={styles.statRow}>
            <span>置顶记事</span>
            <span className={styles.statValue}>{stats.pinnedNotes}</span>
          </div>

          <div className={styles.statRow}>
            <span>分支总数</span>
            <span className={styles.statValue}>{stats.activeBranches}</span>
          </div>

          <div className={styles.statRow}>
            <span>生产发布</span>
            <span className={joinClassNames(styles.statValue, styles.proStatValue)}>
              {stats.deployedPro}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.bottomSection}>
        <div className={styles.userCard}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.username}</span>
            <span className={styles.userRole}>已登录</span>
          </div>
        </div>
        <div className={styles.accountActions}>
          <button type="button" className={styles.accountButton} onClick={onChangePassword}>
            修改密码
          </button>
          <button type="button" className={styles.accountButton} onClick={onLogout}>
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
