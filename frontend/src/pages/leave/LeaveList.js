import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { leaveApi, employeeApi } from '../../mock/api';
import { useToast } from '../../components/ui/Toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import DataTable from '../../components/ui/Table';
import { Select } from '../../components/ui/Input';
import LeaveForm from './LeaveForm';

function findMyEmployee(employees, session) {
  if (!session) return null;
  const m = employees.find((e) => e.email?.toLowerCase() === session.email?.toLowerCase());
  return m || employees[0] || null;
}

const STATUS_TONE = { pending: 'warning', approved: 'success', rejected: 'danger' };

export default function LeaveList() {
  const { t } = useTranslation();
  const toast = useToast();
  const { tenant, role, session } = useApp();
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [me, setMe] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const isApprover = role === 'hr_admin' || role === 'manager';

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const emps = await employeeApi.list(tenant.id);
    setEmployees(emps);
    const myEmp = findMyEmployee(emps, session);
    setMe(myEmp);
    const filter = isApprover ? {} : { employeeId: myEmp?.id };
    if (statusFilter) filter.status = statusFilter;
    const list = await leaveApi.list(tenant.id, filter);
    const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));
    setRows(list.map((l) => ({ ...l, employee: empMap[l.employeeId] })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenant?.id, statusFilter, role]);

  const decide = async (id, decision) => {
    if (!window.confirm(t(`leave.${decision === 'approved' ? 'approveConfirm' : 'rejectConfirm'}`))) return;
    await leaveApi.decide(id, decision, session?.name);
    toast.success(t(`leave.${decision}`));
    load();
  };

  const handleCreated = () => {
    toast.success(t('leave.submitted'));
    setShowForm(false);
    load();
  };

  const balance = me?.leaveBalance || { annual: 0, sick: 0, personal: 0 };

  const columns = [
    {
      key: 'employee',
      header: t('leave.list.headers.employee'),
      mobileLabel: t('leave.list.headers.employee'),
      render: (r) => r.employee ? (
        <div className="emp-cell">
          <Avatar name={r.employee.fullName} size={28} />
          <span>{r.employee.fullName}</span>
        </div>
      ) : (r.employeeName || '—'),
    },
    {
      key: 'type',
      header: t('leave.list.headers.type'),
      mobileLabel: t('leave.list.headers.type'),
      render: (r) => t(`leave.types.${r.type}`, r.type),
    },
    { key: 'from', header: t('leave.list.headers.from'), mobileLabel: t('leave.list.headers.from'), render: (r) => r.startDate },
    { key: 'to',   header: t('leave.list.headers.to'),   mobileLabel: t('leave.list.headers.to'),   render: (r) => r.endDate },
    { key: 'days', header: t('leave.list.headers.days'), mobileLabel: t('leave.list.headers.days'), render: (r) => r.days },
    {
      key: 'st',
      header: t('leave.list.headers.status'),
      mobileLabel: t('leave.list.headers.status'),
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(`common.${r.status}`, r.status)}</Badge>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      mobileLabel: '',
      render: (r) => (isApprover && r.status === 'pending') ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="sm" variant="primary" onClick={() => decide(r.id, 'approved')}>{t('common.approve')}</Button>
          <Button size="sm" variant="danger" onClick={() => decide(r.id, 'rejected')}>{t('common.reject')}</Button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isApprover ? t('leave.title') : t('leave.myTitle')}</h1>
          <p className="page-subtitle">{t('leave.subtitle')}</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <FaPlus /> <span style={{ marginLeft: 6 }}>{t('leave.apply')}</span>
        </Button>
      </div>

      {/* Leave balance card (employee/manager) */}
      {me && (
        <Card title={t('leave.balance')} className="leave-balance">
          <div className="leave-balance__grid">
            {['annual','sick','personal'].map((k) => (
              <div key={k} className="leave-balance__tile">
                <div className="leave-balance__num">{balance[k]}</div>
                <div className="leave-balance__label">{t(`leave.types.${k}`)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padded={false}>
        <div className="leave-toolbar">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t('leave.filter.all')}</option>
            <option value="pending">{t('leave.filter.pending')}</option>
            <option value="approved">{t('leave.filter.approved')}</option>
            <option value="rejected">{t('leave.filter.rejected')}</option>
          </Select>
        </div>
        {loading ? (
          <div className="dash__placeholder">{t('common.loading')}</div>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey="id" empty={t('common.noData', 'No data')} />
        )}
      </Card>

      {showForm && (
        <LeaveForm
          tenantId={tenant.id}
          employee={me}
          onClose={() => setShowForm(false)}
          onCreated={handleCreated}
        />
      )}

      <style>{`
        .leave-balance__grid {
          display: grid; gap: var(--sp-3);
          grid-template-columns: repeat(3, 1fr);
        }
        .leave-balance__tile {
          background: var(--gray-50);
          border-radius: var(--r-2);
          padding: var(--sp-4);
          text-align: center;
        }
        .leave-balance__num {
          font-size: var(--fs-30);
          font-weight: 700;
          color: var(--brand-600);
          line-height: 1;
        }
        .leave-balance__label { color: var(--text-3); font-size: var(--fs-12); margin-top: 4px; }
        .leave-toolbar { padding: var(--sp-3); border-bottom: 1px solid var(--border); }
      `}</style>
    </div>
  );
}
