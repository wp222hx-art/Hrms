import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCheck, FaTimes, FaUndoAlt } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { workflowApi } from '../../mock/enterpriseApi';
import { useCurrentEmployee, relativeTime, formatCurrency } from '../../utils/format';
import { StatusPill } from './WorkflowCenter';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import './Workflow.css';

export default function WorkflowDetail() {
  const { id } = useParams();
  const { tenant, session } = useApp();
  const { me } = useCurrentEmployee();
  const navigate = useNavigate();
  const [inst, setInst] = useState(null);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!tenant || !id) return;
    let live = true;
    workflowApi.list(tenant.id).then((all) => {
      if (!live) return;
      setInst(all.find((x) => x.id === id) || null);
    });
    return () => { live = false; };
  }, [tenant, id]);

  if (!tenant) return <EmptyState title="No tenant selected" />;
  if (!inst) return <div className="wf-form-loading">加载中…</div>;

  const isApplicant = inst.applicantId === me?.id;
  const isPending = inst.status === 'pending';
  // mock authorization: any non-applicant can act if pending (real app would check role/manager)
  const canAct = isPending && !isApplicant;

  const refresh = async () => {
    const all = await workflowApi.list(tenant.id);
    setInst(all.find((x) => x.id === id));
  };

  const decide = async (decision) => {
    setActing(true);
    await workflowApi.decide(tenant.id, inst.id, decision, {
      actor: session?.name,
      comment: comment.trim(),
    });
    setComment('');
    await refresh();
    setActing(false);
  };
  const withdraw = async () => {
    if (!window.confirm('确认撤回此申请？')) return;
    setActing(true);
    await workflowApi.withdraw(tenant.id, inst.id);
    await refresh();
    setActing(false);
  };

  return (
    <div className="page wf-page">
      <div className="page-header">
        <button className="wf-back" onClick={() => navigate('/workflow')}>
          <FaArrowLeft /> 返回流程中心
        </button>
      </div>

      <div className="wf-detail">
        <header className="wf-detail__head">
          <div className="wf-detail__title">
            <span className="wf-detail__icon">{inst.icon}</span>
            <div>
              <h2>{inst.templateName}</h2>
              <p>{inst.applicantName} · {inst.department} · 提交于 {relativeTime(inst.submittedAt)}</p>
            </div>
          </div>
          <StatusPill status={inst.status} />
        </header>

        <section className="wf-detail__body">
          <h4>申请内容</h4>
          <div className="wf-detail__fields">
            {Object.entries(inst.payload || {}).map(([k, v]) => (
              <div key={k} className="wf-detail__field">
                <span className="wf-detail__k">{k}</span>
                <span className="wf-detail__v">{renderValue(k, v, inst.payload)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="wf-detail__body">
          <h4>审批进度</h4>
          <ul className="wf-timeline">
            <li className="wf-timeline__item is-done">
              <span className="wf-timeline__dot">●</span>
              <div className="wf-timeline__col">
                <div className="wf-timeline__top">
                  <Avatar name={inst.applicantName} size={28} />
                  <b>{inst.applicantName}</b>
                  <span className="wf-tl-action">发起申请</span>
                </div>
                <small>{new Date(inst.submittedAt).toLocaleString()}</small>
              </div>
            </li>
            {inst.steps.map((s, idx) => (
              <li key={idx} className={`wf-timeline__item is-${s.status}`}>
                <span className="wf-timeline__dot">{
                  s.status === 'approved' ? '✓' :
                  s.status === 'rejected' ? '×' :
                  s.status === 'pending' ? '…' :
                  s.status === 'skipped' ? '−' : '○'
                }</span>
                <div className="wf-timeline__col">
                  <div className="wf-timeline__top">
                    <b>{s.label}</b>
                    <span className="wf-tl-action">
                      {s.status === 'approved' && '已通过'}
                      {s.status === 'rejected' && '已驳回'}
                      {s.status === 'pending' && '待处理'}
                      {s.status === 'waiting' && '等待中'}
                      {s.status === 'skipped' && '已跳过'}
                    </span>
                  </div>
                  {s.actorName && <small>{s.actorName} · {s.decidedAt ? new Date(s.decidedAt).toLocaleString() : ''}</small>}
                  {s.comment && <div className="wf-tl-comment">"{s.comment}"</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {canAct && (
          <section className="wf-detail__act">
            <h4>审批操作</h4>
            <textarea
              rows={2}
              placeholder="审批意见（可选）"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="wf-detail__act-btns">
              <button className="dept-btn dept-btn--danger" disabled={acting} onClick={() => decide('rejected')}>
                <FaTimes /> 驳回
              </button>
              <button className="dept-btn dept-btn--primary" disabled={acting} onClick={() => decide('approved')}>
                <FaCheck /> 通过
              </button>
            </div>
          </section>
        )}

        {isApplicant && isPending && (
          <section className="wf-detail__act">
            <div className="wf-detail__act-btns">
              <button className="dept-btn" disabled={acting} onClick={withdraw}>
                <FaUndoAlt /> 撤回申请
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function renderValue(key, v, payload) {
  if (v === '' || v === null || v === undefined) return '—';
  if (typeof v === 'number' && key === 'amount') {
    return formatCurrency(v, payload.currency || 'SGD');
  }
  if (typeof v === 'number' && key === 'budget') {
    return formatCurrency(v, payload.currency || 'SGD');
  }
  return String(v);
}
