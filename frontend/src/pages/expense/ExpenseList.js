import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { expenseApi, employeeApi } from '../../mock/api';
import { useToast } from '../../components/ui/Toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import DataTable from '../../components/ui/Table';
import { Select } from '../../components/ui/Input';
import ExpenseForm from './ExpenseForm';

function findMyEmployee(employees, session) {
  if (!session) return null;
  const m = employees.find((e) => e.email?.toLowerCase() === session.email?.toLowerCase());
  return m || employees[0] || null;
}

const STATUS_TONE = {
  submitted: 'info',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  paid: 'brand',
};

export default function ExpenseList() {
  const { t } = useTranslation();
  const toast = useToast();
  const { tenant, role, session } = useApp();
  const [rows, setRows] = useState([]);
  const [me, setMe] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const isApprover = role === 'hr_admin' || role === 'manager';

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const emps = await employeeApi.list(tenant.id);
    const myEmp = findMyEmployee(emps, session);
    setMe(myEmp);
    const filter = isApprover ? {} : { employeeId: myEmp?.id };
    if (statusFilter) filter.status = statusFilter;
    const list = await expenseApi.list(tenant.id, filter);
    const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));
    setRows(list.map((x) => ({ ...x, employee: empMap[x.employeeId] })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenant?.id, statusFilter, role]);

  const decide = async (id, decision) => {
    await expenseApi.decide(id, decision);
    toast.success(t(`expense.${decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'paid'}`, decision));
    load();
  };

  const columns = [
    {
      key: 'employee',
      header: t('expense.list.headers.employee'),
      mobileLabel: t('expense.list.headers.employee'),
      render: (r) => r.employee ? (
        <div className="emp-cell">
          <Avatar name={r.employee.fullName} size={28} />
          <span>{r.employee.fullName}</span>
        </div>
      ) : (r.employeeName || '—'),
    },
    {
      key: 'cat',
      header: t('expense.list.headers.category'),
      mobileLabel: t('expense.list.headers.category'),
      render: (r) => t(`expense.categories.${r.category}`, r.category),
    },
    {
      key: 'amt',
      header: t('expense.list.headers.amount'),
      mobileLabel: t('expense.list.headers.amount'),
      render: (r) => `${r.currency || tenant?.currency} ${Number(r.amount).toLocaleString()}`,
    },
    {
      key: 'submitted',
      header: t('expense.list.headers.submitted'),
      mobileLabel: t('expense.list.headers.submitted'),
      hideOnMobile: true,
      render: (r) => (r.submittedAt || '').slice(0, 10),
    },
    {
      key: 'st',
      header: t('expense.list.headers.status'),
      mobileLabel: t('expense.list.headers.status'),
      render: (r) => <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{t(`expense.status.${r.status}`, r.status)}</Badge>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      mobileLabel: '',
      render: (r) => (isApprover) ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(r.status === 'submitted' || r.status === 'pending') && (
            <>
              <Button size="sm" variant="primary" onClick={() => decide(r.id, 'approved')}>{t('common.approve')}</Button>
              <Button size="sm" variant="danger" onClick={() => decide(r.id, 'rejected')}>{t('common.reject')}</Button>
            </>
          )}
          {r.status === 'approved' && (
            <Button size="sm" variant="secondary" onClick={() => decide(r.id, 'paid')}>{t('expense.markPaid')}</Button>
          )}
        </div>
      ) : null,
    },
  ];

  const handleCreated = () => {
    toast.success(t('expense.submittedMsg'));
    setShowForm(false);
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isApprover ? t('expense.title') : t('expense.myTitle')}</h1>
          <p className="page-subtitle">{t('expense.subtitle')}</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <FaPlus /> <span style={{ marginLeft: 6 }}>{t('expense.new')}</span>
        </Button>
      </div>

      <Card padded={false}>
        <div className="leave-toolbar">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t('common.all')}</option>
            <option value="submitted">{t('expense.status.submitted')}</option>
            <option value="approved">{t('expense.status.approved')}</option>
            <option value="rejected">{t('expense.status.rejected')}</option>
            <option value="paid">{t('expense.status.paid')}</option>
          </Select>
        </div>
        {loading ? (
          <div className="dash__placeholder">{t('common.loading')}</div>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey="id" empty={t('common.noData', 'No data')} />
        )}
      </Card>

      {showForm && (
        <ExpenseForm
          tenantId={tenant.id}
          employee={me}
          currency={tenant?.currency}
          onClose={() => setShowForm(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
