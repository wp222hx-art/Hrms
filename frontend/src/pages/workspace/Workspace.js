import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FaCalendarAlt, FaReceipt, FaMoneyBillWave, FaCommentDots,
  FaBullhorn, FaBuilding, FaProjectDiagram, FaUserCircle, FaClock,
  FaBook, FaStar, FaThumbtack, FaChevronRight, FaGift, FaUserCheck,
  FaGraduationCap,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import {
  workspaceApi, annApi, notifyApi, workflowApi, holidayApi, regionMeta,
} from '../../mock/enterpriseApi';
import { useCurrentEmployee } from '../../utils/format';
import { relativeTime } from '../../utils/format';
import EmptyState from '../../components/ui/EmptyState';
import './Workspace.css';

const APP_CATALOG = [
  { key: 'workflow',   icon: FaProjectDiagram,  label: '流程中心',    color: '#3b63ec', to: '/workflow' },
  { key: 'im',         icon: FaCommentDots,     label: '即时消息',    color: '#10b981', to: '/im' },
  { key: 'announce',   icon: FaBullhorn,        label: '公告',        color: '#f59e0b', to: '/announcements' },
  { key: 'attendance', icon: FaClock,           label: '考勤打卡',    color: '#06b6d4', to: '/attendance' },
  { key: 'leave',      icon: FaCalendarAlt,     label: '请假',        color: '#8b5cf6', to: '/leave' },
  { key: 'expense',    icon: FaReceipt,         label: '报销',        color: '#ec4899', to: '/expense' },
  { key: 'payslip',    icon: FaMoneyBillWave,   label: '工资条',      color: '#84cc16', to: '/self-service' },
  { key: 'directory',  icon: FaUserCircle,      label: '通讯录',      color: '#0ea5e9', to: '/employees' },
  { key: 'departments',icon: FaBuilding,        label: '组织架构',    color: '#7c4dff', to: '/departments' },
  { key: 'handbook',   icon: FaBook,            label: '员工手册',    color: '#64748b', to: '/handbook' },
  { key: 'training',   icon: FaGraduationCap,   label: '培训中心',    color: '#a855f7', to: '/training' },
];

export default function Workspace() {
  const { i18n } = useTranslation();
  const { tenant, session, role } = useApp();
  const { me } = useCurrentEmployee();
  const navigate = useNavigate();

  const [layout, setLayout] = useState({ pinned: [] });
  const [pendingMine, setPendingMine] = useState([]);
  const [approvalInbox, setApprovalInbox] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    if (!tenant || !me) return;
    let live = true;
    (async () => {
      const [lay, anns, holi, mine, all, notes] = await Promise.all([
        workspaceApi.layout(tenant.id, me.id),
        annApi.list(tenant.id),
        holidayApi.list(tenant.id),
        workflowApi.list(tenant.id, { applicantId: me.id }),
        workflowApi.list(tenant.id, { status: 'pending' }),
        notifyApi.list(tenant.id, me.id),
      ]);
      if (!live) return;
      setLayout(lay);
      setAnnouncements(anns.slice(0, 5));
      setHolidays(holi);
      setPendingMine(mine.filter((x) => x.status === 'pending').slice(0, 4));
      // approval inbox = where I'm a possible decider (role-based + manager) – mock: all pending where I'm not applicant
      const inbox = all.filter((x) => x.applicantId !== me.id);
      setApprovalInbox(inbox.slice(0, 4));
      setNotifications(notes.slice(0, 5));
    })();
    return () => { live = false; };
  }, [tenant, me]);

  const meta = tenant ? regionMeta[tenant.region] : null;
  const tenantName = tenant ? (i18n.language === 'zh' ? (tenant.nameZh || tenant.name) : tenant.name) : '';
  const greeting = (() => {
    const h = new Date().getHours();
    if (i18n.language === 'zh') {
      if (h < 6) return '夜深了';
      if (h < 12) return '早上好';
      if (h < 18) return '下午好';
      return '晚上好';
    }
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const todayHoliday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return holidays.find((h) => h.date === today);
  }, [holidays]);
  const upcomingHoliday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return holidays.find((h) => h.date > today);
  }, [holidays]);

  const pinned = APP_CATALOG.filter((a) => layout.pinned?.includes(a.key));
  const others = APP_CATALOG.filter((a) => !layout.pinned?.includes(a.key));

  if (!tenant) {
    return <EmptyState title="No tenant selected" hint="Please pick a tenant from the topbar." />;
  }

  return (
    <div className="page workspace">
      {/* Hero banner */}
      <div className="ws-hero">
        <div className="ws-hero__bg" />
        <div className="ws-hero__inner">
          <div>
            <h1 className="ws-hero__title">
              {greeting}, {session?.name?.split(' ')[0] || ''} <span className="ws-hero__wave">👋</span>
            </h1>
            <p className="ws-hero__subtitle">
              {meta?.flag} {tenantName} · {meta?.nameZh || meta?.name} · {meta?.currency}
              {me?.department && <> · {me.department}</>}
            </p>
          </div>
          <div className="ws-hero__date">
            <div className="ws-hero__date-num">{new Date().getDate()}</div>
            <div className="ws-hero__date-text">
              {new Date().toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
                month: 'short', year: 'numeric', weekday: 'long',
              })}
            </div>
          </div>
        </div>

        {(todayHoliday || upcomingHoliday) && (
          <div className="ws-hero__holiday">
            <FaGift />
            {todayHoliday ? (
              <span><b>{i18n.language === 'zh' ? todayHoliday.nameZh : todayHoliday.name}</b> · 今日法定节假日 🎉</span>
            ) : (
              <span>
                下一个假期：<b>{i18n.language === 'zh' ? upcomingHoliday.nameZh : upcomingHoliday.name}</b>
                <span style={{ opacity: .7, marginLeft: 8 }}>{upcomingHoliday.date}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Pinned apps grid */}
      <section className="ws-section">
        <div className="ws-section__head">
          <h2><FaThumbtack /> 常用应用</h2>
          <span className="ws-section__hint">点击进入</span>
        </div>
        <div className="ws-app-grid">
          {pinned.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.key} className="ws-app" onClick={() => navigate(a.to)}>
                <span className="ws-app__icon" style={{ background: a.color }}><Icon /></span>
                <span className="ws-app__label">{a.label}</span>
              </button>
            );
          })}
          <button
            className="ws-app ws-app--add"
            onClick={async () => {
              const next = others[0];
              if (!next) return;
              const l = await workspaceApi.togglePin(tenant.id, me.id, next.key);
              setLayout(l);
            }}
          >
            <span className="ws-app__icon ws-app__icon--add">+</span>
            <span className="ws-app__label">更多</span>
          </button>
        </div>
      </section>

      {/* Two-column dashboard */}
      <div className="ws-grid-2">
        {/* My pending */}
        <section className="ws-card">
          <div className="ws-card__head">
            <h3><FaProjectDiagram /> 我发起的</h3>
            <button className="ws-link" onClick={() => navigate('/workflow')}>全部 <FaChevronRight /></button>
          </div>
          {pendingMine.length === 0 ? (
            <div className="ws-empty">暂无待办流程 🎉</div>
          ) : pendingMine.map((w) => (
            <div key={w.id} className="ws-row" onClick={() => navigate(`/workflow/${w.id}`)}>
              <div className="ws-row__icon">{w.icon}</div>
              <div className="ws-row__body">
                <div className="ws-row__title">{w.templateName}</div>
                <div className="ws-row__sub">
                  待 {w.steps?.find((s) => s.status === 'pending')?.label || '审批'} · {relativeTime(w.submittedAt, i18n.language)}
                </div>
              </div>
              <span className="ws-pill ws-pill--pending">待审批</span>
            </div>
          ))}
        </section>

        {/* Approval inbox */}
        <section className="ws-card">
          <div className="ws-card__head">
            <h3><FaUserCheck /> 待我审批</h3>
            <button className="ws-link" onClick={() => navigate('/workflow?tab=inbox')}>全部 <FaChevronRight /></button>
          </div>
          {approvalInbox.length === 0 ? (
            <div className="ws-empty">没有待审批事项 ✨</div>
          ) : approvalInbox.map((w) => (
            <div key={w.id} className="ws-row" onClick={() => navigate(`/workflow/${w.id}`)}>
              <div className="ws-row__icon">{w.icon}</div>
              <div className="ws-row__body">
                <div className="ws-row__title">{w.applicantName} · {w.templateName}</div>
                <div className="ws-row__sub">{relativeTime(w.submittedAt, i18n.language)}</div>
              </div>
              <span className="ws-pill ws-pill--alert">需处理</span>
            </div>
          ))}
        </section>

        {/* Announcements */}
        <section className="ws-card">
          <div className="ws-card__head">
            <h3><FaBullhorn /> 公司公告</h3>
            <button className="ws-link" onClick={() => navigate('/announcements')}>全部 <FaChevronRight /></button>
          </div>
          {announcements.length === 0 ? (
            <div className="ws-empty">暂无公告</div>
          ) : announcements.map((a) => (
            <div key={a.id} className="ws-row" onClick={() => navigate('/announcements')}>
              <div className={`ws-row__icon ws-row__icon--${a.level}`}>
                {a.pinned ? <FaStar /> : <FaBullhorn />}
              </div>
              <div className="ws-row__body">
                <div className="ws-row__title">{a.title}</div>
                <div className="ws-row__sub">{a.authorName} · {relativeTime(a.publishedAt, i18n.language)}</div>
              </div>
              {a.pinned && <span className="ws-pill ws-pill--pin">置顶</span>}
            </div>
          ))}
        </section>

        {/* Notifications */}
        <section className="ws-card">
          <div className="ws-card__head">
            <h3><FaCommentDots /> 最新通知</h3>
            <button className="ws-link" onClick={() => navigate('/notifications')}>全部 <FaChevronRight /></button>
          </div>
          {notifications.length === 0 ? (
            <div className="ws-empty">暂无新通知</div>
          ) : notifications.map((n) => (
            <div key={n.id} className="ws-row" onClick={() => n.link && navigate(n.link)}>
              <div className={`ws-row__icon ws-row__icon--${n.kind}`}>•</div>
              <div className="ws-row__body">
                <div className="ws-row__title">{n.title}</div>
                <div className="ws-row__sub">{n.body || ''} · {relativeTime(n.at, i18n.language)}</div>
              </div>
              {!n.read && <span className="ws-pill ws-pill--alert">未读</span>}
            </div>
          ))}
        </section>
      </div>

      {/* All apps (others) */}
      {others.length > 0 && (
        <section className="ws-section">
          <div className="ws-section__head"><h2>全部应用</h2></div>
          <div className="ws-app-grid">
            {others.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  className="ws-app ws-app--ghost"
                  onClick={() => navigate(a.to)}
                  onContextMenu={async (e) => {
                    e.preventDefault();
                    const l = await workspaceApi.togglePin(tenant.id, me.id, a.key);
                    setLayout(l);
                  }}
                  title="右键固定到常用"
                >
                  <span className="ws-app__icon" style={{ background: a.color, opacity: .82 }}><Icon /></span>
                  <span className="ws-app__label">{a.label}</span>
                </button>
              );
            })}
          </div>
          <div className="ws-tip">提示：长按 / 右键 应用可固定到「常用应用」</div>
        </section>
      )}
    </div>
  );
}
