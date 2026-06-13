'use client';

import { useEffect, useState } from 'react';

import AuthPanel from '@/components/AuthPanel';
import BranchSection from '@/components/BranchSection';
import Console from '@/components/Console';
import { IdeaSection } from '@/components/IdeaSection';
import PasswordDialog from '@/components/PasswordDialog';
import Sidebar from '@/components/Sidebar';
import TodoSection from '@/components/TodoSection';
import { useGitTodoState } from '@/hooks/useGitTodoState';
import type { AppTab, User } from '@/types';

interface CurrentUserResponse {
  user: User | null;
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<AppTab>('tasks');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  
  const {
    todos,
    branches,
    ideas,
    logs,
    loading,
    error,
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
  } = useGitTodoState(Boolean(user));

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const response = await fetch('/api/auth/me');
        const data = (await response.json()) as CurrentUserResponse;
        setUser(data.user);
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    }

    void loadCurrentUser();
  }, []);

  const handleAuthenticated = (nextUser: User) => {
    setUser(nextUser);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setActiveTab('tasks');
  };

  // Calculations for sidebar stats
  const totalTasks = todos.length;
  const completedTasks = todos.filter((t) => t.status === 'done').length;
  const activeBranches = branches.length;
  const deployedPro = branches.filter((b) => b.pro).length;
  const openIdeas = ideas.filter((idea) => idea.status === 'open').length;

  if (authLoading || (user && loading)) {
    return (
      <div className="loading-screen" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: '#0d0e15',
        color: '#a5b4fc',
        fontFamily: 'Outfit, Inter, system-ui, sans-serif'
      }}>
        <div className="spinner" style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(165, 180, 252, 0.2)',
          borderTop: '3px solid #6366f1',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1.5rem'
        }} />
        <p style={{ fontSize: '1.1rem', fontWeight: 500, letterSpacing: '0.05em' }}>正在加载工作区...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <AuthPanel onAuthenticated={handleAuthenticated} />;
  }

  if (error) {
    return (
      <div className="error-screen" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: '#0d0e15',
        color: '#f87171',
        fontFamily: 'Outfit, Inter, system-ui, sans-serif',
        padding: '2rem'
      }}>
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(248, 113, 113, 0.2)',
          borderRadius: '16px',
          padding: '2.5rem',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: '#ffffff', marginBottom: '1rem', fontSize: '1.5rem' }}>连接失败</h2>
          <p style={{ color: '#cbd5e1', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.6' }}>
            {error}
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '0.75rem 2rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            重试连接
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="dashboard-container">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          onChangePassword={() => setIsPasswordDialogOpen(true)}
          onLogout={handleLogout}
          stats={{
            totalTasks,
            completedTasks,
            openIdeas,
            activeBranches,
            deployedPro,
          }}
        />
        
        <main className="main-content">
          {activeTab === 'tasks' && (
            <TodoSection
              todos={todos}
              branches={branches}
              onAddTodo={handleAddTodo}
              onUpdateTodo={handleUpdateTodo}
              onUpdateTodoStatus={handleUpdateTodoStatus}
              onUpdateTodoDueDate={handleUpdateTodoDueDate}
              onDeleteTodo={handleDeleteTodo}
            />
          )}

          {activeTab === 'ideas' && (
            <IdeaSection
              ideas={ideas}
              onAddIdea={handleAddIdea}
              onUpdateIdea={handleUpdateIdea}
              onDeleteIdea={handleDeleteIdea}
            />
          )}
          
          {activeTab === 'branches' && (
            <BranchSection
              branches={branches}
              onAddBranch={handleAddBranch}
              onImportBranches={handleImportBranches}
              onUpdateBranchEnv={handleUpdateBranchEnv}
              onUpdateBranchStatus={handleUpdateBranchStatus}
              onUpdateBranch={handleUpdateBranch}
              onDeleteBranch={handleDeleteBranch}
              onLogBranchEdit={handleLogBranchEdit}
            />
          )}
          
          {activeTab === 'terminal' && (
            <Console
              logs={logs}
              onClearLogs={handleClearLogs}
            />
          )}
        </main>
        {isPasswordDialogOpen && (
          <PasswordDialog onClose={() => setIsPasswordDialogOpen(false)} />
        )}
      </div>
    </div>
  );
}
