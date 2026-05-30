import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaInfoCircle, FaProjectDiagram, FaCommentDots, FaCheckDouble, FaBell } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { notifyApi } from '../../mock/enterpriseApi';
import { useCurrentEmployee, relativeTime } from '../../utils/format';
import EmptyState from '../../components/ui/EmptyState';
import './NotificationCenter.css';

const KIND_ICON = {
  success:  { icon: FaCheckCircle,         color: '#10b981' },
  error:    { icon: FaTimesCircle,         color: '#ef4444' },
  warning:  { icon: FaExclamationTriangle, color: '#f59e0b' },
  approval: { icon: FaProjectDiagram,      color: '#7c4dff' },
  message:  { icon: FaCommentDots,         color: '#06b6d4' },
  info:     { icon: FaInfoCircle,          color: '#3b63ec' },
  system:   { icon: FaBell,                color: '#64748b' },
};

export default function NotificationCenter() {
  const { i18n } = useTranslation();
  const { tenant } = useApp();
  const { me } = useCurrentEmployee();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('all'); // all | unread

  useEffect(() => {
    if (!tenant || !me) return;
    let live = true;
    notifyApi.list(tenant.id, me.id).then((l) => { if (live) setList(l); });
    return () => { live = false; };
  }, [tenant, me]);

  const refresh = async () => setList(await notifyApi.list(tenant.id, me.id));

  const filtered = filter === 'unread' ? list.filter((n) => !n.read) : list;

  const open = async (n) => {
    if (!n.read) {
      await notifyApi.read(tenant.id, n.id);
      await refresh();
    }
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    await notifyApi.readAll(tenant.id, me.id);
    await refresh();
  };

  if (!tenant) return <EmptyState title="No tenant selected" />;

  const unreadCount = list.filter((n) => !n.read).length;

  return (
    <div className="page nt-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">通知中心</h1>
          <p className="page-subtitle">{list.length} 条通知 · {unreadCount} 条未读</p>
        </div>
        {unreadCount > 0 && (
          <button className="dept-btn" onClick={readAll}>
            <FaCheckDouble /> 全部标为已读
          </button>
        )}
      </div>

      <div className="nt-filter">
        <button className={filter === 'all' ? 'is-on' : ''} onClick={() => setFilter('all')}>全部 ({list.length})</button>
        <button className={filter === 'unread' ? 'is-on' : ''} onClick={() => setFilter('unread')}>未读 ({unreadCount})</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={filter === 'unread' ? '没有未读通知 ✨' : '暂无通知'} />
      ) : (
        <div className="nt-list">
          {filtered.map((n) => {
            const meta = KIND_ICON[n.kind] || KIND_ICON.info;
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className={`nt-card ${n.read ? 'is-read' : ''}`}
                onClick={() => open(n)}
              >
                <span className="nt-card__icon" style={{ background: meta.color }}>
                  <Icon />
                </span>
                <div className="nt-card__body">
                  <div className="nt-card__title">{n.title}</div>
                  {n.body && <div className="nt-card__sub">{n.body}</div>}
                  <div className="nt-card__time">{relativeTime(n.at, i18n.language)}</div>
                </div>
                {!n.read && <span className="nt-dot" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
