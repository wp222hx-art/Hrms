import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { employeeApi } from '../../mock/api';
import { useToast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import DataTable from '../../components/ui/Table';
import { Input, Select } from '../../components/ui/Input';
import EmployeeForm from './EmployeeForm';

const STATUS_TONE = { Active: 'success', 'On Leave': 'warning', Resigned: 'neutral' };

export default function EmployeeList() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { tenant, role } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [showForm, setShowForm] = useState(false);

  const canEdit = role === 'hr_admin' || role === 'super_admin';

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const list = await employeeApi.list(tenant.id, { search, department: dept });
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenant?.id, search, dept]);

  const departments = useMemo(() => {
    const set = new Set(rows.map((r) => r.department));
    return Array.from(set).sort();
  }, [rows]);

  const columns = [
    {
      key: 'employee',
      header: t('employees.headers.name'),
      mobileLabel: t('employees.headers.name'),
      render: (r) => (
        <div className="emp-cell">
          <Avatar name={r.fullName} size={32} />
          <div className="emp-cell__text">
            <div className="emp-cell__name">{r.fullName}</div>
            <div className="emp-cell__id">{r.employeeId}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: t('employees.headers.department'),
      mobileLabel: t('employees.headers.department'),
      render: (r) => t(`departments.${r.department}`, r.department),
    },
    {
      key: 'position',
      header: t('employees.headers.position'),
      mobileLabel: t('employees.headers.position'),
      hideOnMobile: true,
      render: (r) => r.position,
    },
    {
      key: 'email',
      header: t('employees.headers.email'),
      mobileLabel: t('employees.headers.email'),
      hideOnMobile: true,
      render: (r) => <span className="emp-cell__email">{r.email}</span>,
    },
    {
      key: 'hireDate',
      header: t('employees.headers.hireDate'),
      mobileLabel: t('employees.headers.hireDate'),
      hideOnMobile: true,
      render: (r) => r.hireDate,
    },
    {
      key: 'status',
      header: t('employees.headers.status'),
      mobileLabel: t('employees.headers.status'),
      render: (r) => (
        <Badge tone={STATUS_TONE[r.status] || 'neutral'}>
          {t(`employees.status.${r.status}`, r.status)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      mobileLabel: '',
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/employees/${r.id}`); }}>
          {t('common.view')}
        </Button>
      ),
    },
  ];

  const handleCreated = (emp) => {
    toast.success(t('common.create') + ': ' + emp.fullName);
    setShowForm(false);
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('employees.title')}</h1>
          <p className="page-subtitle">{t('employees.subtitle')}</p>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={() => setShowForm(true)}>
            <FaPlus /> <span style={{ marginLeft: 6 }}>{t('employees.add')}</span>
          </Button>
        )}
      </div>

      <Card padded={false}>
        <div className="emp-toolbar">
          <div className="emp-toolbar__search">
            <FaSearch className="emp-toolbar__search-icon" />
            <Input
              placeholder={t('employees.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">{t('employees.filterDept')}</option>
            {departments.map((d) => (
              <option key={d} value={d}>{t(`departments.${d}`, d)}</option>
            ))}
          </Select>
        </div>

        <div className="emp-table-wrap">
          {loading ? (
            <div className="dash__placeholder">{t('common.loading')}</div>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey="id"
              empty={t('common.noData', 'No data')}
            />
          )}
        </div>
      </Card>

      {showForm && (
        <EmployeeForm
          tenantId={tenant.id}
          onClose={() => setShowForm(false)}
          onCreated={handleCreated}
        />
      )}

      <style>{`
        .emp-toolbar {
          display: flex; gap: var(--sp-3);
          padding: var(--sp-4);
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
        }
        .emp-toolbar__search {
          position: relative; flex: 1; min-width: 200px;
        }
        .emp-toolbar__search-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          color: var(--text-3); pointer-events: none;
        }
        .emp-toolbar__search .input { padding-left: 36px; }
        .emp-table-wrap {
          padding: 0;
        }
        .emp-cell { display: flex; align-items: center; gap: var(--sp-2); }
        .emp-cell__text { display: flex; flex-direction: column; min-width: 0; }
        .emp-cell__name { font-weight: 600; color: var(--text-1); }
        .emp-cell__id { font-size: var(--fs-12); color: var(--text-3); }
        .emp-cell__email { color: var(--text-2); font-size: var(--fs-13); }
      `}</style>
    </div>
  );
}
