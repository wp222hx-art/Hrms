import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  FaUserShield, FaUserTie, FaUserCog, FaUser, FaArrowRight, FaGlobe,
} from 'react-icons/fa';
import { userApi } from '../../mock/api';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import './Login.css';

const ROLE_ICON = {
  super_admin: FaUserShield,
  hr_admin: FaUserTie,
  manager: FaUserCog,
  employee: FaUser,
};

const ROLE_ACCENT = {
  super_admin: '#7c3aed',
  hr_admin: '#3b63ec',
  manager: '#10b981',
  employee: '#f59e0b',
};

export default function Login() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login, logout, session } = useApp();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);

  // Always load the user list when visiting /login (do NOT auto-redirect away
  // even if a session exists — the user came here on purpose to switch role).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await userApi.list();
      if (!cancelled) {
        setUsers(list);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePick = async (user) => {
    setSubmitting(user.id);
    // If there's an existing session for a different user, clear it first so
    // the new role takes effect cleanly.
    if (session && session.userId !== user.id) {
      logout();
    }
    const s = await login({ user, tenantId: user.tenantId });
    toast.success(`${t('auth.loggedInAs')} ${user.name}`);
    // Use the returned session (already up to date) so we don't depend on
    // React's async state update.
    navigate(s.role === 'super_admin' ? '/admin' : '/dashboard', { replace: true });
  };

  const switchLang = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(next);
    try { localStorage.setItem('i18nextLng', next); } catch {}
  };

  return (
    <div className="login">
      <button className="login__lang" onClick={switchLang}>
        <FaGlobe />
        <span>{i18n.language === 'zh' ? 'English' : '中文'}</span>
      </button>

      <div className="login__panel">
        <div className="login__brand">
          <div className="login__logo">H</div>
          <div>
            <h1 className="login__title">{t('common.appName')}</h1>
            <p className="login__sub">{t('auth.loginSubtitle')}</p>
          </div>
        </div>

        <div className="login__note">
          {t('auth.demoNote')}
        </div>

        {session && (
          <div className="login__current">
            <span>{t('auth.loggedInAs')}: <strong>{session.name}</strong> ({t(`roles.${session.role}`)})</span>
            <button
              type="button"
              className="login__current-logout"
              onClick={() => logout()}
            >
              {t('common.logout')}
            </button>
          </div>
        )}

        {loading ? (
          <div className="login__loading">{t('common.loading')}</div>
        ) : (
          <div className="login__roles">
            {users.map((u) => {
              const Icon = ROLE_ICON[u.role] || FaUser;
              const accent = ROLE_ACCENT[u.role];
              const isCurrent = session?.userId === u.id;
              return (
                <button
                  key={u.id}
                  className={`login__role-card ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => handlePick(u)}
                  disabled={!!submitting}
                  style={{ '--role-accent': accent }}
                >
                  <span className="login__role-icon"><Icon /></span>
                  <span className="login__role-text">
                    <span className="login__role-name">{u.name}</span>
                    <span className="login__role-meta">
                      {t(`roles.${u.role}`)} · {u.email}
                    </span>
                  </span>
                  <span className="login__role-arrow">
                    {submitting === u.id ? '…' : <FaArrowRight />}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="login__footer">
          <small>© 2026 HRMS Cloud · PDPA / GDPR / 个人信息保护法 compliant</small>
        </div>
      </div>

      <div className="login__hero">
        <div className="login__hero-inner">
          <h2>SaaS HRMS</h2>
          <p>多租户 · 多区域 · 完整人力资源生命周期管理</p>
          <ul className="login__features">
            <li>✓ 员工档案 / 考勤打卡 / 请假申请</li>
            <li>✓ 报销审批 / 薪资计算 / 个税核算</li>
            <li>✓ 五险一金 / CPF / EPF 三地合规</li>
            <li>✓ 双语界面 (中文 / English)</li>
            <li>✓ 移动端适配 · 桌面端响应式</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
