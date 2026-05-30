import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { FaSignOutAlt } from 'react-icons/fa';
import './funmode.css';

const TABS = [
  { path: '/fun',        icon: '🏠', label: 'LOBBY' },
  { path: '/fun/quest',  icon: '⚔️', label: 'QUEST' },
  { path: '/fun/squad',  icon: '👥', label: 'SQUAD' },
  { path: '/fun/loot',   icon: '💰', label: 'LOOT' },
  { path: '/fun/rank',   icon: '🏆', label: 'RANK' },
];

export default function FunShell() {
  const navigate = useNavigate();
  const loc = useLocation();

  return (
    <div className="funmode">
      <div className="fm-shell">
        <div className="fm-topbar">
          <div className="fm-topbar__title">⚡ HRMS · ARENA</div>
          <button className="fm-topbar__exit" onClick={() => navigate('/dashboard')}>
            <FaSignOutAlt size={11} />
            <span>退出酷炫</span>
          </button>
        </div>

        <Outlet />
      </div>

      <nav className="fm-tabbar">
        <div className="fm-tabbar__inner">
          {TABS.map((t) => {
            const active = loc.pathname === t.path;
            return (
              <button
                key={t.path}
                className={`fm-tab ${active ? 'is-active' : ''}`}
                onClick={() => navigate(t.path)}
              >
                <span className="fm-tab__icon">{t.icon}</span>
                <span className="fm-tab__lbl">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
