import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPaperPlane } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { workflowApi } from '../../mock/enterpriseApi';
import { useCurrentEmployee } from '../../utils/format';
import EmptyState from '../../components/ui/EmptyState';
import './Workflow.css';

export default function WorkflowForm() {
  const { templateId } = useParams();
  const { tenant } = useApp();
  const { me } = useCurrentEmployee();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState(null);
  const [payload, setPayload] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenant || !templateId) return;
    workflowApi.template(tenant.id, templateId).then(setTpl);
  }, [tenant, templateId]);

  const resolvedSteps = useMemo(() => {
    if (!tpl) return [];
    return workflowApi.resolveSteps(tpl, payload);
  }, [tpl, payload]);

  if (!tenant) return <EmptyState title="No tenant selected" />;
  if (!tpl) return <div className="wf-form-loading">加载流程模板…</div>;

  const setField = (k, v) => setPayload((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!me) return;
    setSubmitting(true);
    const inst = await workflowApi.submit(tenant.id, {
      templateId: tpl.id,
      applicant: { id: me.id, fullName: me.fullName, department: me.department },
      payload,
    });
    setSubmitting(false);
    if (inst) navigate(`/workflow/${inst.id}`);
  };

  // simple required validation
  const requiredOk = tpl.fields.every((f) => {
    if (f.kind === 'file') return true; // optional in mock
    const v = payload[f.key];
    return v !== undefined && v !== '' && v !== null;
  });

  return (
    <div className="page wf-page">
      <div className="page-header">
        <button className="wf-back" onClick={() => navigate('/workflow')}>
          <FaArrowLeft /> 返回流程中心
        </button>
      </div>

      <div className="wf-form-shell">
        <header className="wf-form-head">
          <span className="wf-form-head__icon">{tpl.icon}</span>
          <div>
            <h2>{tpl.name}</h2>
            <p>{tpl.nameEn} · {tpl.category}</p>
          </div>
        </header>

        <div className="wf-form-body">
          {tpl.fields.map((f) => (
            <Field key={f.key} field={f} value={payload[f.key]} onChange={(v) => setField(f.key, v)} />
          ))}
        </div>

        <div className="wf-form-flow">
          <h4>审批路径预览</h4>
          {resolvedSteps.length === 0 ? (
            <div className="wf-empty">请填写关键字段以查看审批路径</div>
          ) : (
            <div className="wf-form-flow__steps">
              <div className="wf-flow-step wf-flow-step--start">
                <span className="wf-flow-step__bullet">●</span>
                <span>{me?.fullName} (申请人)</span>
              </div>
              {resolvedSteps.map((s, i) => (
                <React.Fragment key={i}>
                  <span className="wf-flow-arrow">→</span>
                  <div className="wf-flow-step">
                    <span className="wf-flow-step__bullet">{i + 1}</span>
                    <span>{s.label}</span>
                  </div>
                </React.Fragment>
              ))}
              <span className="wf-flow-arrow">→</span>
              <div className="wf-flow-step wf-flow-step--end">
                <span className="wf-flow-step__bullet">✓</span>
                <span>完成</span>
              </div>
            </div>
          )}
        </div>

        <div className="wf-form-foot">
          <button className="dept-btn" onClick={() => navigate('/workflow')}>取消</button>
          <button
            className="dept-btn dept-btn--primary"
            disabled={!requiredOk || submitting}
            onClick={submit}
          >
            <FaPaperPlane /> {submitting ? '提交中…' : '提交申请'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ field, value, onChange }) {
  const v = value === undefined ? '' : value;
  if (field.kind === 'textarea') {
    return (
      <label className="wf-field">
        <span className="wf-field__label">{field.label}</span>
        <textarea
          rows={3}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`请输入${field.label}…`}
        />
      </label>
    );
  }
  if (field.kind === 'select') {
    return (
      <label className="wf-field">
        <span className="wf-field__label">{field.label}</span>
        <select value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">请选择…</option>
          {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </label>
    );
  }
  if (field.kind === 'file') {
    return (
      <label className="wf-field">
        <span className="wf-field__label">{field.label} <small>(演示版禁用上传)</small></span>
        <input type="text" value={v} placeholder="示例：receipt-001.pdf" onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  return (
    <label className="wf-field">
      <span className="wf-field__label">{field.label}</span>
      <input
        type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
        value={v}
        onChange={(e) => onChange(field.kind === 'number' ? Number(e.target.value || 0) : e.target.value)}
      />
    </label>
  );
}
