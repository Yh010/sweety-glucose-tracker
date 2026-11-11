import { useState, type ReactNode } from 'react';
import { BarChart3, BookOpen, LogOut, ShieldCheck } from 'lucide-react';
import type { User } from '../lib/types';
import { initials } from '../lib/dates';
import { Brand } from './Brand';
export type View = 'daily' | 'reports';
export function AppShell({
  user,
  view,
  onView,
  onLogout,
  loggingOut,
  children,
}: {
  user: User;
  view: View;
  onView: (view: View) => void;
  onLogout: () => void;
  loggingOut: boolean;
  children: ReactNode;
}) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Main navigation">
          <button
            className={`nav-item ${view === 'daily' ? 'active' : ''}`}
            aria-current={view === 'daily' ? 'page' : undefined}
            onClick={() => onView('daily')}
          >
            <BookOpen size={19} strokeWidth={1.7} aria-hidden="true" />
            Daily log
          </button>
          <button
            className={`nav-item ${view === 'reports' ? 'active' : ''}`}
            aria-current={view === 'reports' ? 'page' : undefined}
            onClick={() => onView('reports')}
          >
            <BarChart3 size={19} strokeWidth={1.7} aria-hidden="true" />
            Reports
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="private-label">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>Your private journal</span>
          </div>
          <div className="account">
            <span className="avatar">{initials(user.name)}</span>
            <div className="account-text">
              <strong title={user.name}>{user.name}</strong>
              <span>Personal account</span>
            </div>
            <button
              className="icon-button"
              aria-label="Log out"
              disabled={loggingOut}
              onClick={() => setConfirmLogout(!confirmLogout)}
              aria-expanded={confirmLogout}
            >
              <LogOut size={17} />
            </button>
          </div>
          {confirmLogout && (
            <div className="logout-confirm">
              <p>Log out of your journal?</p>
              <button className="text-button" onClick={onLogout} disabled={loggingOut}>
                {loggingOut ? 'Logging out…' : 'Log out'}
              </button>
              <button className="text-button" onClick={() => setConfirmLogout(false)}>
                Stay
              </button>
            </div>
          )}
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <span>Your glucose journal</span>
          <span className="topbar-private">
            <span className="status-dot" />
            Personal & private
          </span>
        </div>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span>
            Sweety<span className="brand-dot">.</span>
          </span>
          <span>A little more clarity, every day.</span>
        </footer>
      </div>
    </div>
  );
}
