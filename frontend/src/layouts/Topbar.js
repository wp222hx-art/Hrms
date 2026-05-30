import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FaBars, FaCaretDown, FaSignOutAlt, FaSyncAlt, FaGlobe } from 'react-icons/fa';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import { useApp } from '../context/AppContext';
import './Topbar.css';

export default function Topbar({ onMenu }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { session, tenant, tenants, role, switchTenant, logout } = useApp();
  const [tenantOpen, setTenantOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const tenantRef = useRef(null);
  const userRef = useRef(null);
  const langRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (tenantRef.current && !tenantRef.current.contains(e.target)) setTenantOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSwitchLang = (lng) => {
    i18n.changeLanguage(lng);
    try { localStorage.setItem('i18nextLng', lng); } catch {}
    setLangOpen(false);
  };

  const isSuper = role === 'super_admin';
  const tenantLabel = tenant
    ? (i18n.language === 'zh' ? (tenant.nameZh || tenant.name) : tenant.name)
    : (isSuper ? t('common.appName') : '—');

  return (
    <header className="topbar">
      <button
        className="topbar__menu-btn"
        onClick={onMenu}
        aria-label="menu"
      >
        <FaBars />
      </button>

      {/* Tenant switcher (HR/manager/employee) */}
      {!isSuper && tenants.length > 0 && (
        <div className="topbar__tenant" ref={tenantRef}>
          <button className="topbar__tenant-btn" onClick={() => setTenantOpen((v) => !v)}>
            <span
              className="topbar__tenant-dot"
              style={{ background: tenant?.accentColor || 'var(--brand-500)' }}
            />
            <span className="topbar__tenant-name">{tenantLabel}</span>
            {tenant && <Badge tone="neutral" className="topbar__tenant-region">{tenant.region}</Badge>}
            <FaCaretDown className="topbar__caret" />
          </button>
          {tenantOpen && (
            <div className="topbar__dropdown">
              <div className="topbar__dropdown-title">{t('auth.switchTenant')}</div>
              {tenants.map((tn) => (
                <button
                  key={tn.id}
                  className={`topbar__dropdown-item ${tn.id === session?.tenantId ? 'is-active' : ''}`}
                  onClick={() => { switchTenant(tn.id); setTenantOpen(false); }}
                >
                  <span className="topbar__tenant-dot" style={{ background: tn.accentColor }} />
                  <span className="topbar__dropdown-text">
                    <span>{i18n.language === 'zh' ? (tn.nameZh || tn.name) : tn.name}</span>
                    <small>{tn.region} · {tn.plan}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isSuper && (
        <div className="topbar__brand-only">
          <FaShieldIcon /> <span>{t('admin.title')}</span>
        </div>
      )}

      <div className="topbar__spacer" />

      {/* Language */}
      <div className="topbar__lang" ref={langRef}>
        <button className="topbar__icon-btn" onClick={() => setLangOpen((v) => !v)} aria-label="language">
          <FaGlobe />
          <span className="topbar__lang-code">{i18n.language === 'zh' ? '中' : 'EN'}</span>
        </button>
        {langOpen && (
          <div className="topbar__dropdown topbar__dropdown--right">
            <button
              className={`topbar__dropdown-item ${i18n.language === 'en' ? 'is-active' : ''}`}
              onClick={() => handleSwitchLang('en')}
            >English</button>
            <button
              className={`topbar__dropdown-item ${i18n.language === 'zh' ? 'is-active' : ''}`}
              onClick={() => handleSwitchLang('zh')}
            >中文</button>
          </div>
        )}
      </div>

      {/* User */}
      <div className="topbar__user" ref={userRef}>
        <button className="topbar__user-btn" onClick={() => setUserOpen((v) => !v)}>
          <Avatar name={session?.name || '?'} size={32} />
          <span className="topbar__user-meta hide-mobile">
            <span className="topbar__user-name">{session?.name}</span>
            <small>{t(`roles.${role}`)}</small>
          </span>
          <FaCaretDown className="topbar__caret hide-mobile" />
        </button>
        {userOpen && (
          <div className="topbar__dropdown topbar__dropdown--right">
            <div className="topbar__dropdown-title">
              <div style={{ fontWeight: 600 }}>{session?.name}</div>
              <small style={{ color: 'var(--text-3)' }}>{session?.email}</small>
            </div>
            <button
              className="topbar__dropdown-item"
              onClick={() => {
                setUserOpen(false);
                navigate('/fun');
              }}
              style={{
                background: 'linear-gradient(90deg, rgba(255,46,200,0.12), rgba(124,77,255,0.12))',
                fontWeight: 700,
              }}
            >
              <span style={{ fontSize: 16 }}>⚡</span>
              <span>炫酷模式 · Arena</span>
            </button>
            <button
              className="topbar__dropdown-item"
              onClick={() => {
                setUserOpen(false);
                logout();
                navigate('/login', { replace: true });
              }}
            >
              <FaSyncAlt /> <span>{t('auth.switchRole')}</span>
            </button>
            <button className="topbar__dropdown-item topbar__dropdown-item--danger" onClick={handleLogout}>
              <FaSignOutAlt /> <span>{t('common.logout')}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// tiny inline icon to avoid adding another import for shield
function FaShieldIcon() {
  return <span style={{ fontSize: 16 }}>🛡</span>;
}
