import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { expenseApi } from '../../mock/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Field, Input, TextArea, Select } from '../../components/ui/Input';

const CATEGORIES = ['Travel','Meal','Office Supplies','Training','Software','Client Entertainment'];

export default function ExpenseForm({ tenantId, employee, currency = 'SGD', onClose, onCreated }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    category: 'Travel',
    amount: '',
    currency,
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const submit = async (e) => {
    e?.preventDefault();
    const er = {};
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) er.amount = 'Required';
    if (!form.description) er.description = 'Required';
    setErrors(er);
    if (Object.keys(er).length) return;
    setSubmitting(true);
    try {
      await expenseApi.create(tenantId, {
        ...form,
        amount: Number(form.amount),
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
      title={t('expense.form.title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={submitting} onClick={submit}>{t('expense.form.submit')}</Button>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <Field label={t('expense.form.category')}>
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`expense.categories.${c}`, c)}</option>
            ))}
          </Select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 'var(--sp-3)' }}>
          <Field label={t('expense.form.amount')} required error={errors.amount}>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label={t('expense.form.currency')}>
            <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </Field>
        </div>
        <Field label={t('expense.form.description')} required error={errors.description}>
          <TextArea
            rows={3}
            placeholder={t('expense.form.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label={t('expense.form.receipt')}>
          <Input type="file" disabled />
        </Field>
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}
