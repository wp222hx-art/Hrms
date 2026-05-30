import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaThumbtack, FaPlus, FaBullhorn, FaExclamationTriangle, FaCheckCircle, FaInfoCircle } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { annApi } from '../../mock/enterpriseApi';
import { useCurrentEmployee, relativeTime } from '../../utils/format';
import EmptyState from '../../components/ui/EmptyState';
import './Announcements.css';

const LEVELS = {
  info:    { icon: FaInfoCircle,         label: '通知', color: '#3b63ec' },
  success: { icon: FaCheckCircle,        label: '喜讯', color: '#10b981' },
  warning: { icon: FaExclamationTriangle,label: '提醒', color: '#f59e0b' },
  danger:  { icon: FaExclamationTriangle,label: '紧急', color: '#ef4444' },
};

export default function Announcements() {
  const { i18n } = useTranslation();
  const { tenant, role } = useApp();
  const { me } = useCurrentEmployee();
  const [list, setList] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', level: 'info', pinned: false });

  const canPublish = role === 'hr_admin' || role === 'super_admin';

  useEffect(() => {
    if (!tenant) return;
    let live = true;
    annApi.list(tenant.id).then((l) => { if (live) setList(l); });
    return () => { live = false; };
  }, [tenant]);

  const refresh = async () => setList(await annApi.list(tenant.id));

  const publish = async () => {
    if (!draft.title.trim()) return;
    await annApi.publish(tenant.id, {
      ...draft,
      authorName: me?.fullName || 'HR',
    });
    setDraft({ title: '', body: '', level: 'info', pinned: false });
    setShowNew(false);
    await refresh();
  };

  const markRead = async (id) => {
    if (!me) return;
    await annApi.read(tenant.id, id, me.id);
    await refresh();
  };

  if (!tenant) return <EmptyState title="No tenant selected" />;

  return (
    <div className="page ann-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">公司公告</h1>
          <p className="page-subtitle">企业动态 · 政策更新 · 福利通知</p>
        </div>
        {canPublish && (
          <button className="dept-btn dept-btn--primary" onClick={() => setShowNew(true)}>
            <FaPlus /> 发布公告
          </button>
        )}
      </div>

      <div className="ann-list">
        {list.length === 0 ? (
          <EmptyState title="暂无公告" />
        ) : list.map((a) => {
          const lvl = LEVELS[a.level] || LEVELS.info;
          const Icon = lvl.icon;
          const isRead = me && a.readers.includes(me.id);
          return (
            <div
              key={a.id}
              className={`ann-card ann-card--${a.level} ${isRead ? 'is-read' : ''}`}
              onClick={() => !isRead && markRead(a.id)}
            >
              <div className="ann-card__icon" style={{ background: lvl.color }}>
                <Icon />
              </div>
              <div className="ann-card__body">
                <div className="ann-card__head">
                  <h3>
                    {a.pinned && <FaThumbtack className="ann-card__pin" />}
                    {a.title}
                  </h3>
                  <span className={`ann-card__tag ann-card__tag--${a.level}`}>{lvl.label}</span>
                </div>
                <p className="ann-card__body-text">{a.body}</p>
                <div className="ann-card__foot">
                  <span>{a.authorName} · {relativeTime(a.publishedAt, i18n.language)}</span>
                  {!isRead && <span className="ann-card__unread">未读</span>}
                  {isRead && <span className="ann-card__read">已读</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showNew && canPublish && (
        <div className="dept-modal-overlay" onClick={() => setShowNew(false)}>
          <div className="dept-modal" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
            <div className="dept-modal__head"><h3><FaBullhorn /> 发布公告</h3></div>
            <div className="dept-modal__body">
              <label>标题 *
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="例如：年终奖发放通知"
                />
              </label>
              <label>正文
                <textarea
                  rows={4}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  placeholder="公告正文内容..."
                  style={{ width: '100%', border: '1px solid var(--border-1)', borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-app)', color: 'var(--text-1)' }}
                />
              </label>
              <label>级别
                <select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })}>
                  <option value="info">通知 · Info</option>
                  <option value="success">喜讯 · Success</option>
                  <option value="warning">提醒 · Warning</option>
                  <option value="danger">紧急 · Critical</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={draft.pinned}
                  onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
                  style={{ width: 'auto', marginTop: 0 }}
                />
                置顶此公告
              </label>
            </div>
            <div className="dept-modal__foot">
              <button className="dept-btn" onClick={() => setShowNew(false)}>取消</button>
              <button className="dept-btn dept-btn--primary" onClick={publish}>发布</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
