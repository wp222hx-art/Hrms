import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import { employeeApi, attendanceApi, leaveApi, payrollApi } from '../../mock/api';
import { useApp } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';

const TABS = ['overview', 'attendance', 'leave', 'payslips'];
const STATUS_TONE = { Active: 'success', 'On Leave': 'warning', Resigned: 'neutral' };

export default function EmployeeDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant } = useApp();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payslips, setPayslips] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const e = await employeeApi.get(id);
      if (cancelled) return;
      setEmp(e);
      setLoading(false);
      if (e && tenant) {
        const [att, lvs, pr] = await Promise.all([
          attendanceApi.list(tenant.id, { employeeId: e.id }),
          leaveApi.list(tenant.id, { employeeId: e.id }),
          payrollApi.get(tenant.id),
        ]);
        if (cancelled) return;
        setAttendance(att.slice(0, 30));
        setLeaves(lvs);
        setPayslips((pr?.lines || []).filter((l) => l.employeeId === e.id));
      }
    })();
    return () => { cancelled = true; };
  }, [id, tenant]);

  if (loading) return <div className="page"><div className="dash__placeholder">{t('common.loading')}</div></div>;
  if (!emp) return <EmptyState title="Not found" action={<Button onClick={() => navigate('/employees')}>{t('common.back')}</Button>} />;

  return (
    <div className="page">
      <Button variant="ghost" onClick={() => navigate('/employees')} className="back-btn">
        <FaArrowLeft /> <span style={{ marginLeft: 6 }}>{t('employees.detail.back')}</span>
      </Button>

      <Card className="emp-detail__head">
        <div className="emp-detail__head-row">
          <Avatar name={emp.fullName} size={64} />
          <div className="emp-detail__head-text">
            <h2 className="emp-detail__name">{emp.fullName}</h2>
            <div className="emp-detail__meta">
              <span>{t(`departments.${emp.department}`, emp.department)}</span>
              <span>·</span>
              <span>{emp.position}</span>
              <span>·</span>
              <span>{emp.employeeId}</span>
              <Badge tone={STATUS_TONE[emp.status]}>{t(`employees.status.${emp.status}`, emp.status)}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <div className="emp-detail__tabs">
        {TABS.map((tk) => (
          <button
            key={tk}
            className={`emp-detail__tab ${tab === tk ? 'is-active' : ''}`}
            onClick={() => setTab(tk)}
          >
            {t(`employees.detail.tabs.${tk}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="emp-detail__grid">
          <Card title={t('employees.detail.personalInfo')}>
            <dl className="kv">
              <dt>{t('common.email')}</dt><dd>{emp.email}</dd>
              <dt>{t('common.phone')}</dt><dd>{emp.phone || '—'}</dd>
              <dt>{t('employees.form.birthDate')}</dt><dd>{emp.birthDate || '—'}</dd>
              <dt>{t('employees.form.address')}</dt><dd>{emp.address || '—'}</dd>
            </dl>
          </Card>
          <Card title={t('employees.detail.employmentInfo')}>
            <dl className="kv">
              <dt>{t('employees.form.hireDate')}</dt><dd>{emp.hireDate}</dd>
              <dt>{t('employees.form.employmentType')}</dt><dd>{emp.employmentType}</dd>
              <dt>{t('employees.headers.salary')}</dt>
              <dd>{tenant?.currency} {Number(emp.baseSalary).toLocaleString()}</dd>
              <dt>{t('common.status')}</dt>
              <dd><Badge tone={STATUS_TONE[emp.status]}>{t(`employees.status.${emp.status}`, emp.status)}</Badge></dd>
            </dl>
          </Card>
          <Card title={t('employees.detail.leaveBalance')} className="emp-detail__leave-card">
            <div className="emp-detail__leave-grid">
              {['annual','sick','personal'].map((k) => (
                <div key={k} className="emp-detail__leave-tile">
                  <div className="emp-detail__leave-num">{emp.leaveBalance?.[k] ?? '—'}</div>
                  <div className="emp-detail__leave-label">{t(`employees.detail.${k}`)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'attendance' && (
        <Card padded={false}>
          <DataTable
            columns={[
              { key: 'date', header: t('attendance.list.headers.date'), mobileLabel: t('attendance.list.headers.date'), render: (r) => r.date },
              { key: 'in', header: t('attendance.list.headers.checkIn'), mobileLabel: t('attendance.list.headers.checkIn'), render: (r) => r.checkIn || '—' },
              { key: 'out', header: t('attendance.list.headers.checkOut'), mobileLabel: t('attendance.list.headers.checkOut'), render: (r) => r.checkOut || '—' },
              { key: 'st', header: t('attendance.list.headers.status'), mobileLabel: t('attendance.list.headers.status'),
                render: (r) => <Badge tone={r.status === 'PRESENT' ? 'success' : r.status === 'LATE' ? 'warning' : 'danger'}>{t(`attendance.status.${r.status}`, r.status)}</Badge> },
            ]}
            rows={attendance}
            rowKey="id"
            empty={t('common.noData', 'No data')}
          />
        </Card>
      )}

      {tab === 'leave' && (
        <Card padded={false}>
          <DataTable
            columns={[
              { key: 'type', header: t('leave.form.type'), mobileLabel: t('leave.form.type'), render: (r) => t(`leave.types.${r.type}`, r.type) },
              { key: 'from', header: t('leave.list.headers.from'), mobileLabel: t('leave.list.headers.from'), render: (r) => r.startDate },
              { key: 'to', header: t('leave.list.headers.to'), mobileLabel: t('leave.list.headers.to'), render: (r) => r.endDate },
              { key: 'days', header: t('leave.list.headers.days'), mobileLabel: t('leave.list.headers.days'), render: (r) => r.days },
              { key: 'st', header: t('leave.list.headers.status'), mobileLabel: t('leave.list.headers.status'),
                render: (r) => <Badge tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}>{t(`common.${r.status}`, r.status)}</Badge> },
            ]}
            rows={leaves}
            rowKey="id"
            empty={t('common.noData', 'No data')}
          />
        </Card>
      )}

      {tab === 'payslips' && (
        <Card padded={false}>
          <DataTable
            columns={[
              { key: 'm', header: t('payroll.month'), mobileLabel: t('payroll.month'), render: (r) => r.month },
              { key: 'g', header: t('payroll.headers.gross'), mobileLabel: t('payroll.headers.gross'), render: (r) => `${tenant?.currency} ${Number(r.gross).toLocaleString()}` },
              { key: 'n', header: t('payroll.headers.net'), mobileLabel: t('payroll.headers.net'), render: (r) => `${tenant?.currency} ${Number(r.net).toLocaleString()}` },
            ]}
            rows={payslips}
            rowKey={(r) => r.id || (r.employeeId + r.month)}
            empty={t('common.noData', 'No data')}
          />
        </Card>
      )}

      <style>{`
        .back-btn { margin-bottom: var(--sp-3); }
        .emp-detail__head-row { display: flex; align-items: center; gap: var(--sp-4); flex-wrap: wrap; }
        .emp-detail__name { margin: 0; font-size: var(--fs-22); }
        .emp-detail__meta { display: flex; gap: var(--sp-2); align-items: center; flex-wrap: wrap; color: var(--text-3); font-size: var(--fs-13); margin-top: 4px; }
        .emp-detail__tabs {
          display: flex; gap: var(--sp-2);
          border-bottom: 1px solid var(--border);
          margin: var(--sp-4) 0;
          overflow-x: auto;
        }
        .emp-detail__tab {
          padding: var(--sp-3) var(--sp-4);
          background: transparent;
          border: 0;
          border-bottom: 2px solid transparent;
          color: var(--text-2);
          font-weight: 500;
          font-size: var(--fs-14);
          white-space: nowrap;
          cursor: pointer;
        }
        .emp-detail__tab:hover { color: var(--text-1); }
        .emp-detail__tab.is-active {
          color: var(--brand-700);
          border-bottom-color: var(--brand-500);
        }
        .emp-detail__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--sp-4);
        }
        .kv { display: grid; grid-template-columns: 120px 1fr; gap: var(--sp-2) var(--sp-3); margin: 0; font-size: var(--fs-13); }
        .kv dt { color: var(--text-3); }
        .kv dd { margin: 0; color: var(--text-1); }
        .emp-detail__leave-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--sp-3);
        }
        .emp-detail__leave-tile {
          background: var(--gray-50);
          border-radius: var(--r-2);
          padding: var(--sp-3);
          text-align: center;
        }
        .emp-detail__leave-num {
          font-size: var(--fs-24);
          font-weight: 700;
          color: var(--brand-600);
        }
        .emp-detail__leave-label {
          font-size: var(--fs-12);
          color: var(--text-3);
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
