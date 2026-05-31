import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaInbox, FaListUl, FaHourglassHalf, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { workflowApi } from '../../mock/enterpriseApi';
import { useCurrentEmployee, relativeTime } from '../../utils/format';
import EmptyState from '../../components/ui/EmptyState';
import './Workflow.css';

export default function WorkflowCenter() {
  const { i18n } = useTranslation();
  const { tenant } = useApp();
  const { me } = useCurrentEmployee();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') || 'apps';

  const [templates, setTemplates] = useState([]);
  const [myList, setMyList] = useState([]);
  const [inboxList, setInboxList] = useState([]);

  useEffect(() => {
    if (!tenant || !me) return;
    let live = true;
    (async () => {
      const [tpls, mine, all] = await Promise.all([
        workflowApi.templates(tenant.id),
        workflowApi.list(tenant.id, { applicantId: me.id }),
        workflowApi.list(tenant.id),
      ]);
      if (!live) return;
      setTemplates(tpls);
      setMyList(mine);
      setInboxList(all.filter((x) => x.applicantId !== me.id && x.status === 'pending'));
    })();
    return () => { live = false; };
  }, [tenant, me]);

  const categorized = useMemo(() => {
    const map = {};
    templates.forEach((t) => {
      const k = t.category || 'Other';
      if (!map[k]) map[k] = [];
      map[k].push(t);
    });
    return map;
  }, [templates]);

  const tabs = [
    { key: 'apps',  label: '流程应用',  icon: FaListUl,        count: templates.length },
    { key: 'mine',  label: '我发起的',  icon: FaHourglassHalf, count: myList.filter((x) => x.status === 'pending').length },
    { key: 'inbox', label: '待我审批',  icon: FaInbox,         count: inboxList.length },
    { key: 'all',   label: '全部记录',  icon: FaCheckCircle,   count: myList.length },
  ];

  if (!tenant) return <EmptyState title="No tenant selected" />;

  return (
    <div className="page wf-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">流程中心</h1>
          <p className="page-subtitle">所有审批流程 · 一站发起 · 一目了然</p>
        </div>
      </div>

      <div className="wf-tabs">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              className={`wf-tab ${tabParam === t.key ? 'is-on' : ''}`}
              onClick={() => setParams({ tab: t.key })}
            >
              <Icon /> <span>{t.label}</span>
              {t.count > 0 && <span className="wf-tab__count">{t.count}</span>}
            </button>
          );
        })}
      </div>

      {tabParam === 'apps' && (
        <div className="wf-apps">
          {Object.entries(categorized).map(([cat, tpls]) => (
            <section key={cat} className="wf-apps__cat">
              <h3>{cat}</h3>
              <div className="wf-apps__grid">
                {tpls.map((t) => (
                  <button key={t.id} className="wf-app-card" onClick={() => navigate(`/workflow/new/${t.id}`)}>
                    <span className="wf-app-card__icon">{t.icon}</span>
                    <span className="wf-app-card__name">{t.name}</span>
                    <span className="wf-app-card__hint">{t.nameEn}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tabParam === 'mine' && (
        <InstanceList list={myList} lang={i18n.language} onClick={(id) => navigate(`/workflow/${id}`)} emptyText="还没有发起过流程，点击「流程应用」开始" />
      )}
      {tabParam === 'inbox' && (
        <InstanceList list={inboxList} lang={i18n.language} onClick={(id) => navigate(`/workflow/${id}`)} emptyText="审批待办为空 ✨" showApplicant />
      )}
      {tabParam === 'all' && (
        <InstanceList list={myList} lang={i18n.language} onClick={(id) => navigate(`/workflow/${id}`)} emptyText="暂无记录" />
      )}
    </div>
  );
}

function InstanceList({ list, lang, onClick, emptyText, showApplicant }) {
  if (list.length === 0) return <EmptyState title={emptyText} />;
  return (
    <div className="wf-table">
      <div className="wf-table__head">
        <span>类型</span>
        {showApplicant && <span>申请人</span>}
        <span>当前节点</span>
        <span>状态</span>
        <span>提交时间</span>
      </div>
      {list.map((w) => (
        <div key={w.id} className="wf-table__row" onClick={() => onClick(w.id)}>
          <span>
            <span style={{ marginRight: 6 }}>{w.icon}</span>{w.templateName}
          </span>
          {showApplicant && <span>{w.applicantName}</span>}
          <span>{w.steps?.find((s) => s.status === 'pending')?.label || '—'}</span>
          <span><StatusPill status={w.status} /></span>
          <span className="wf-time">{relativeTime(w.submittedAt, lang)}</span>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    pending:   { cls: 'pending',  txt: '待审批' },
    approved:  { cls: 'approved', txt: '已通过' },
    rejected:  { cls: 'rejected', txt: '已驳回' },
    withdrawn: { cls: 'with',     txt: '已撤回' },
  };
  const m = map[status] || { cls: 'pending', txt: status };
  return <span className={`wf-pill wf-pill--${m.cls}`}>{m.txt}</span>;
}

export { StatusPill };
