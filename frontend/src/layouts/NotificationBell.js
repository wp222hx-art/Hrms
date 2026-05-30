import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaBell, FaCheckDouble } from 'react-icons/fa';
import { useApp } from '../context/AppContext';
import { notifyApi } from '../mock/enterpriseApi';
import { useCurrentEmployee, relativeTime } from '../utils/format';
import './NotificationBell.css';

export default function NotificationBell() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { tenant } = useApp();
  const { me } = useCurrentEmployee();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const ref = useRef(null);

  // Load & poll every 8s for new notifications
  useEffect(() => {
    if (!tenant || !me) return;
    let live = true;
    const load = async () => {
      const l = await notifyApi.list(tenant.id, me.id);
      if (live) setList(l);
    };
    load();
    const t = setInterval(load, 8000);
    return () => { live = false; clearInterval(t); };
  }, [tenant, me]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const unread = list.filter((n) => !n.read);
  const recent = list.slice(0, 8);

  const handleOpen = async (n) => {
    setOpen(false);
    if (!n.read) {
      await notifyApi.read(tenant.id, n.id);
      const l = await notifyApi.list(tenant.id, me.id);
      setList(l);
    }
    if (n.link) navigate(n.link);
    else navigate('/notifications');
  };

  const readAll = async (e) => {
    e.stopPropagation();
    await notifyApi.readAll(tenant.id, me.id);
    const l = await notifyApi.list(tenant.id, me.id);
    setList(l);
  };

  if (!tenant) return null;

  return (
    <div className="nbell" ref={ref}>
      <button className="topbar__icon-btn nbell__btn" onClick={() => setOpen((v) => !v)} aria-label="notifications">
        <FaBell />
        {unread.length > 0 && (
          <span className="nbell__badge">{unread.length > 99 ? '99+' : unread.length}</span>
        )}
      </button>
      {open && (
        <div className="nbell__panel">
          <div className="nbell__head">
            <span>通知 ({unread.length} 未读)</span>
            {unread.length > 0 && (
              <button onClick={readAll} title="全部已读"><FaCheckDouble /></button>
            )}
          </div>
          <div className="nbell__list">
            {recent.length === 0 ? (
              <div className="nbell__empty">暂无通知 ✨</div>
            ) : recent.map((n) => (
              <button key={n.id} className={`nbell__item ${n.read ? 'is-read' : ''}`} onClick={() => handleOpen(n)}>
                <div className={`nbell__kind nbell__kind--${n.kind || 'info'}`}>•</div>
                <div className="nbell__col">
                  <div className="nbell__title">{n.title}</div>
                  {n.body && <div className="nbell__body">{n.body}</div>}
                  <div className="nbell__time">{relativeTime(n.at, i18n.language)}</div>
                </div>
                {!n.read && <span className="nbell__dot" />}
              </button>
            ))}
          </div>
          <div className="nbell__foot">
            <button onClick={() => { setOpen(false); navigate('/notifications'); }}>查看全部</button>
          </div>
        </div>
      )}
    </div>
  );
}
