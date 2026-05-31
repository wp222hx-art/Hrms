import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { FaSignOutAlt } from 'react-icons/fa';
import './funmode.css';
import { UI_ICONS } from './assets';

const TABS = [
  { path: '/fun',          icon: UI_ICONS.tab_lobby,    label: 'LOBBY' },
  { path: '/fun/quest',    icon: UI_ICONS.tab_quest,    label: 'QUEST' },
  { path: '/fun/academy',  icon: UI_ICONS.ic_training,  label: 'STUDY' },
  { path: '/fun/expense',  icon: UI_ICONS.ic_expense,   label: 'BILL'  },
  { path: '/fun/welfare',  icon: UI_ICONS.ic_welfare,   label: 'PERK'  },
  { path: '/fun/wall',     icon: UI_ICONS.ic_wall,      label: 'WALL'  },
  { path: '/fun/mentor',   icon: UI_ICONS.ic_pair,      label: 'PAIR'  },
  { path: '/fun/ops',      icon: UI_ICONS.ic_ops,       label: 'OPS'   },
  { path: '/fun/cards',    icon: UI_ICONS.tab_cards,    label: 'CARDS' },
  { path: '/fun/squad',    icon: UI_ICONS.tab_squad,    label: 'SQUAD' },
  { path: '/fun/loot',     icon: UI_ICONS.tab_loot,     label: 'LOOT'  },
  { path: '/fun/rank',     icon: UI_ICONS.tab_rank,     label: 'RANK'  },
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

      <nav className="fm-tabbar fm-tabbar--scroll">
        <div className="fm-tabbar__inner fm-tabbar__inner--scroll">
          {TABS.map((t) => {
            const active = loc.pathname === t.path;
            return (
              <button
                key={t.path}
                className={`fm-tab ${active ? 'is-active' : ''}`}
                onClick={() => navigate(t.path)}
              >
                <img className="fm-tab__icon-img" src={t.icon} alt="" />
                <span className="fm-tab__lbl">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
