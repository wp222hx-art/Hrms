import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { leaveApi } from '../../mock/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Field, Input, TextArea, Select } from '../../components/ui/Input';

function diffDays(a, b) {
  const d1 = new Date(a), d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return 0;
  const ms = d2 - d1;
  return Math.floor(ms / 86400000) + 1;
}

export default function LeaveForm({ tenantId, employee, onClose, onCreated }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    type: 'annual',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const days = useMemo(() => Math.max(0, diffDays(form.startDate, form.endDate)), [form.startDate, form.endDate]);

  const submit = async (e) => {
    e?.preventDefault();
    if (days < 1) { setError(t('leave.endBeforeStart')); return; }
    setError('');
    setSubmitting(true);
    try {
      await leaveApi.create(tenantId, {
        ...form,
        days,
        employeeId: employee?.id,
        employeeName: employee?.fullName,
      });
      onCreated?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={t('leave.form.title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={submitting} onClick={submit}>
            {t('leave.form.submit')}
          </Button>
        </>
      }
    >
      <form className="leave-form" onSubmit={submit}>
        <Field label={t('leave.form.type')}>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="annual">{t('leave.types.annual')}</option>
            <option value="sick">{t('leave.types.sick')}</option>
            <option value="personal">{t('leave.types.personal')}</option>
          </Select>
        </Field>
        <div className="leave-form__row">
          <Field label={t('leave.form.startDate')}>
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label={t('leave.form.endDate')} error={error}>
            <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </Field>
        </div>
        <div className="leave-form__days">
          <span>{t('leave.form.days')}:</span>
          <strong>{days}</strong>
        </div>
        <Field label={t('leave.form.reason')}>
          <TextArea
            rows={3}
            placeholder={t('leave.form.reasonPlaceholder')}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </Field>
        <button type="submit" style={{ display: 'none' }} />
      </form>

      <style>{`
        .leave-form { display: flex; flex-direction: column; gap: var(--sp-3); }
        .leave-form__row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
        .leave-form__days {
          display: flex; gap: var(--sp-2); align-items: center;
          background: var(--info-50); color: var(--info-700);
          padding: var(--sp-2) var(--sp-3); border-radius: var(--r-2);
          font-size: var(--fs-13);
        }
        .leave-form__days strong { font-size: var(--fs-16); }
        @media (max-width: 480px) {
          .leave-form__row { grid-template-columns: 1fr; }
        }
      `}</style>
    </Modal>
  );
}
