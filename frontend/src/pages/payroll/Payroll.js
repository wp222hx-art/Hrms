import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlay, FaFileCsv, FaPrint } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { payrollApi } from '../../mock/api';
import { useToast } from '../../components/ui/Toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import DataTable from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import Payslip from './Payslip';

function thisMonthLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Payroll() {
  const { t } = useTranslation();
  const toast = useToast();
  const { tenant, role } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [month, setMonth] = useState(thisMonthLabel());
  const [payslip, setPayslip] = useState(null);

  const canRun = role === 'hr_admin' || role === 'super_admin';

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const d = await payrollApi.get(tenant.id);
    setData(d);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenant?.id]);

  const handleRun = async () => {
    setRunning(true);
    try {
      await payrollApi.run(tenant.id, month);
      toast.success(t('payroll.run') + ' ✓');
      load();
    } finally {
      setRunning(false);
    }
  };

  const exportCsv = () => {
    if (!data?.lines?.length) return;
    const headers = ['Employee ID','Name','Department','Gross','Statutory','Tax','Net'];
    const rows = data.lines.map((l) => {
      const stat = (l.employeeStatutory || []).reduce((s, x) => s + x.amount, 0);
      return [l.employeeId, l.employeeName, l.department, l.gross, stat, l.tax, l.net].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payroll-${tenant.id}-${data.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sumStat = (line) => (line.employeeStatutory || []).reduce((s, x) => s + x.amount, 0);
  const totals = data?.lines?.reduce(
    (acc, l) => ({
      gross: acc.gross + (l.gross || 0),
      stat:  acc.stat  + sumStat(l),
      tax:   acc.tax   + (l.tax || 0),
      net:   acc.net   + (l.net || 0),
    }),
    { gross: 0, stat: 0, tax: 0, net: 0 },
  );

  if (!tenant) return <EmptyState title="No tenant" />;

  const fmt = (n) => `${tenant.currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const columns = [
    { key: 'eid', header: 'ID', mobileLabel: 'ID', hideOnMobile: true, render: (r) => r.employeeId },
    {
      key: 'name', header: t('payroll.headers.employee'),
      mobileLabel: t('payroll.headers.employee'),
      render: (r) => <strong>{r.employeeName}</strong>,
    },
    {
      key: 'dept', header: t('payroll.headers.department'),
      mobileLabel: t('payroll.headers.department'),
      hideOnMobile: true,
      render: (r) => t(`departments.${r.department}`, r.department),
    },
    {
      key: 'gross', header: t('payroll.headers.gross'),
      mobileLabel: t('payroll.headers.gross'),
      render: (r) => fmt(r.gross),
    },
    {
      key: 'stat', header: t('payroll.headers.statutory'),
      mobileLabel: t('payroll.headers.statutory'),
      render: (r) => fmt(sumStat(r)),
    },
    {
      key: 'tax', header: t('payroll.headers.tax'),
      mobileLabel: t('payroll.headers.tax'),
      hideOnMobile: true,
      render: (r) => fmt(r.tax),
    },
    {
      key: 'net', header: t('payroll.headers.net'),
      mobileLabel: t('payroll.headers.net'),
      render: (r) => <strong style={{ color: 'var(--success-700)' }}>{fmt(r.net)}</strong>,
    },
    {
      key: 'actions', header: t('common.actions'), mobileLabel: '',
      render: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setPayslip(r)}>
          <FaPrint /> <span style={{ marginLeft: 4 }}>{t('payroll.payslip.title')}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('payroll.title')}</h1>
          <p className="page-subtitle">{t('payroll.subtitle')}</p>
          <Badge tone="info" className="payroll__region-note">
            {t(`payroll.regionNote.${tenant.region}`, tenant.region)}
          </Badge>
        </div>
      </div>

      <Card>
        <div className="payroll__bar">
          <div className="payroll__bar-left">
            <label className="payroll__month">
              <span>{t('payroll.month')}</span>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
            {data?.month && (
              <Badge tone="brand">{t('payroll.current')}: {data.month}</Badge>
            )}
          </div>
          <div className="payroll__bar-right">
            {canRun && (
              <Button variant="primary" onClick={handleRun} loading={running}>
                <FaPlay /> <span style={{ marginLeft: 6 }}>{running ? t('payroll.running') : t('payroll.run')}</span>
              </Button>
            )}
            <Button variant="secondary" onClick={exportCsv} disabled={!data?.lines?.length}>
              <FaFileCsv /> <span style={{ marginLeft: 6 }}>{t('payroll.exportCsv')}</span>
            </Button>
          </div>
        </div>
      </Card>

      {totals && (
        <div className="payroll__totals">
          <StatCard label={t('payroll.totalGross')} value={fmt(totals.gross)} tone="brand" />
          <StatCard label={t('payroll.totalStatutory')} value={fmt(totals.stat)} tone="warning" />
          <StatCard label={t('payroll.totalTax')} value={fmt(totals.tax)} tone="danger" />
          <StatCard label={t('payroll.totalNet')} value={fmt(totals.net)} tone="success" />
        </div>
      )}

      <Card padded={false}>
        {loading ? (
          <div className="dash__placeholder">{t('common.loading')}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.lines || []}
            rowKey={(r) => r.id || (r.employeeId + '-' + (data?.month || ''))}
            empty={t('common.noData', 'No data — click "Run Payroll" to generate.')}
          />
        )}
      </Card>

      {payslip && (
        <Payslip line={payslip} tenant={tenant} month={data?.month || month} onClose={() => setPayslip(null)} />
      )}

      <style>{`
        .payroll__bar {
          display: flex; justify-content: space-between; align-items: center;
          gap: var(--sp-3); flex-wrap: wrap;
        }
        .payroll__bar-left { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
        .payroll__bar-right { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
        .payroll__month {
          display: flex; flex-direction: column; gap: 4px;
          font-size: var(--fs-12); color: var(--text-3);
        }
        .payroll__totals {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: var(--sp-3); margin: var(--sp-4) 0;
        }
        .payroll__region-note { margin-top: var(--sp-2); }
      `}</style>
    </div>
  );
}
