import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { employeeApi } from '../../mock/api';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Input';

const DEPARTMENTS = ['Engineering','Product','Sales','Finance','Human Resources','Marketing','Operations','Customer Support'];
const TYPES = ['Full-time','Part-time','Contract','Intern'];

export default function EmployeeForm({ tenantId, onClose, onCreated }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    fullName: '',
    employeeId: 'EMP-' + Math.floor(1000 + Math.random() * 9000),
    email: '',
    phone: '',
    department: 'Engineering',
    position: '',
    employmentType: 'Full-time',
    hireDate: new Date().toISOString().slice(0, 10),
    baseSalary: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.fullName) e.fullName = 'Required';
    if (!form.email) e.email = 'Required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.position) e.position = 'Required';
    if (!form.baseSalary || isNaN(form.baseSalary)) e.baseSalary = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const emp = await employeeApi.create(tenantId, {
        ...form,
        baseSalary: Number(form.baseSalary),
      });
      onCreated?.(emp);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={t('employees.form.title')}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={submitting} onClick={submit}>
            {submitting ? t('employees.form.submitting') : t('employees.form.submit')}
          </Button>
        </>
      }
    >
      <form className="emp-form" onSubmit={submit}>
        <h4>{t('employees.form.personal')}</h4>
        <div className="emp-form__grid">
          <Field label={t('employees.form.fullName')} required error={errors.fullName}>
            <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </Field>
          <Field label={t('employees.form.email')} required error={errors.email}>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label={t('employees.form.phone')}>
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Employee ID">
            <Input value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)} />
          </Field>
        </div>

        <h4>{t('employees.form.employment')}</h4>
        <div className="emp-form__grid">
          <Field label={t('employees.form.department')}>
            <Select value={form.department} onChange={(e) => set('department', e.target.value)}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{t(`departments.${d}`, d)}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('employees.form.position')} required error={errors.position}>
            <Input value={form.position} onChange={(e) => set('position', e.target.value)} />
          </Field>
          <Field label={t('employees.form.employmentType')}>
            <Select value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label={t('employees.form.hireDate')}>
            <Input type="date" value={form.hireDate} onChange={(e) => set('hireDate', e.target.value)} />
          </Field>
        </div>

        <h4>{t('employees.form.compensation')}</h4>
        <div className="emp-form__grid">
          <Field label={t('employees.form.baseSalary')} required error={errors.baseSalary}>
            <Input type="number" value={form.baseSalary} onChange={(e) => set('baseSalary', e.target.value)} />
          </Field>
        </div>

        <button type="submit" style={{ display: 'none' }} />
      </form>

      <style>{`
        .emp-form h4 {
          margin: 0 0 var(--sp-3);
          font-size: var(--fs-13);
          color: var(--text-3);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .emp-form h4 + .emp-form__grid { margin-bottom: var(--sp-5); }
        .emp-form__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: var(--sp-3);
        }
      `}</style>
    </Modal>
  );
}
