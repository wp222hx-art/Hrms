import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaShieldAlt, FaCheckCircle } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { employeeApi, payrollApi } from '../../mock/api';
import { useToast } from '../../components/ui/Toast';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Input';
import DataTable from '../../components/ui/Table';

export default function SelfService() {
  const { t } = useTranslation();
  const toast = useToast();
  const { tenant, session } = useApp();
  const [me, setMe] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [dsarType, setDsarType] = useState('access');
  const [consent, setConsent] = useState({ marketing: false, analytics: true, payroll: true });

  useEffect(() => {
    if (!tenant || !session) return;
    (async () => {
      const list = await employeeApi.list(tenant.id);
      const myEmp = list.find((e) => e.email?.toLowerCase() === session.email?.toLowerCase()) || list[0];
      setMe(myEmp);
      const pr = await payrollApi.get(tenant.id);
      setPayslips((pr?.lines || []).filter((l) => l.employeeId === myEmp.employeeId));
    })();
  }, [tenant, session]);

  const submitDsar = () => {
    const ref = 'DSAR-' + Math.floor(100000 + Math.random() * 900000);
    toast.success(t('self.dsarSubmitted', { ref }));
  };

  const fmt = (n) => `${tenant?.currency || ''} ${Number(n || 0).toLocaleString()}`;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('self.title')}</h1>
          <p className="page-subtitle">{t('self.myProfile')}</p>
        </div>
      </div>

      {me && (
        <Card>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar name={me.fullName} size={64} />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0 }}>{me.fullName}</h3>
              <div style={{ color: 'var(--text-3)', fontSize: 'var(--fs-13)' }}>
                {t(`departments.${me.department}`, me.department)} · {me.position} · {me.employeeId}
              </div>
            </div>
            <Badge tone="success">{t('common.status')}: {t(`employees.status.${me.status}`, me.status)}</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
            <Field label={t('common.email')}><Input value={me.email} readOnly /></Field>
            <Field label={t('common.phone')}><Input value={me.phone || ''} readOnly /></Field>
            <Field label={t('employees.form.hireDate')}><Input value={me.hireDate} readOnly /></Field>
            <Field label={t('employees.headers.salary')}><Input value={fmt(me.baseSalary)} readOnly /></Field>
          </div>
        </Card>
      )}

      {/* PDPA / privacy */}
      <Card title={<><FaShieldAlt /> <span style={{ marginLeft: 8 }}>{t('self.privacy')}</span></>} className="self-priv">
        <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-13)' }}>{t('self.consentNote')}</p>

        <h4 style={{ margin: '16px 0 8px', fontSize: 'var(--fs-13)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {t('self.consent')}
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {Object.entries(consent).map(([key, val]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--fs-13)' }}>
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => setConsent({ ...consent, [key]: e.target.checked })}
              />
              <span style={{ textTransform: 'capitalize' }}>{key}</span>
              {val && <FaCheckCircle style={{ color: 'var(--success-500)' }} />}
            </label>
          ))}
        </div>

        <h4 style={{ margin: '16px 0 8px', fontSize: 'var(--fs-13)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {t('self.dsar')}
        </h4>
        <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-12)', margin: '0 0 8px' }}>{t('self.dsarHint')}</p>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <Select value={dsarType} onChange={(e) => setDsarType(e.target.value)}>
            <option value="access">{t('self.dsarTypes.access')}</option>
            <option value="correct">{t('self.dsarTypes.correct')}</option>
            <option value="delete">{t('self.dsarTypes.delete')}</option>
            <option value="export">{t('self.dsarTypes.export')}</option>
          </Select>
          <Button variant="primary" onClick={submitDsar}>{t('common.submit')}</Button>
        </div>
      </Card>

      <Card title={t('nav.myPayslips')} padded={false}>
        <DataTable
          columns={[
            { key: 'm', header: t('payroll.month'), mobileLabel: t('payroll.month'), render: (r) => r.month },
            { key: 'g', header: t('payroll.headers.gross'), mobileLabel: t('payroll.headers.gross'), render: (r) => fmt(r.gross) },
            { key: 't', header: t('payroll.headers.tax'), mobileLabel: t('payroll.headers.tax'), render: (r) => fmt(r.tax) },
            { key: 'n', header: t('payroll.headers.net'), mobileLabel: t('payroll.headers.net'),
              render: (r) => <strong style={{ color: 'var(--success-700)' }}>{fmt(r.net)}</strong> },
          ]}
          rows={payslips}
          rowKey={(r) => r.employeeId + r.month}
          empty={t('common.noData', 'No payslips yet')}
        />
      </Card>
    </div>
  );
}
