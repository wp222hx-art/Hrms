import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSignInAlt, FaSignOutAlt, FaClock } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { attendanceApi, employeeApi } from '../../mock/api';
import { useToast } from '../../components/ui/Toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import DataTable from '../../components/ui/Table';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';

function findMyEmployee(employees, session) {
  // Map demo personas to a real employee row by matching email name
  // Fallback: take first employee for the tenant
  if (!session) return null;
  const m = employees.find((e) => e.email?.toLowerCase() === session.email?.toLowerCase());
  return m || employees[0] || null;
}

const STATUS_TONE = { PRESENT: 'success', LATE: 'warning', ABSENT: 'danger', LEAVE: 'info', OT: 'info' };

export default function Attendance() {
  const { t } = useTranslation();
  const toast = useToast();
  const { tenant, role, session } = useApp();
  const [me, setMe] = useState(null);
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [allHistory, setAllHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const isHr = role === 'hr_admin' || role === 'manager';

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const employees = await employeeApi.list(tenant.id);
    const myEmp = findMyEmployee(employees, session);
    setMe(myEmp);
    if (myEmp) {
      const list = await attendanceApi.list(tenant.id, { employeeId: myEmp.id });
      const todayStr = new Date().toISOString().slice(0, 10);
      setToday(list.find((a) => a.date === todayStr) || null);
      setHistory(list.slice(0, 30));
    }
    if (isHr) {
      const all = await attendanceApi.list(tenant.id);
      // attach employee names
      const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));
      setAllHistory(all.slice(0, 60).map((a) => ({ ...a, employee: empMap[a.employeeId] })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenant?.id]);

  const todaySummary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const list = allHistory.filter((a) => a.date === todayStr);
    return {
      present: list.filter((a) => a.status === 'PRESENT').length,
      late: list.filter((a) => a.status === 'LATE').length,
      absent: list.filter((a) => a.status === 'ABSENT').length,
      leave: list.filter((a) => a.status === 'LEAVE').length,
    };
  }, [allHistory]);

  const handleClockIn = async () => {
    if (!me) return;
    const r = await attendanceApi.clockIn(tenant.id, me.id);
    setToday(r);
    toast.success(t('attendance.clockedIn', { time: r.checkIn }));
    load();
  };

  const handleClockOut = async () => {
    if (!me) return;
    const r = await attendanceApi.clockOut(tenant.id, me.id);
    setToday(r);
    toast.success(t('attendance.clockedOut', { time: r.checkOut }));
    load();
  };

  const fmtTime = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  const fmtDate = (d) => d.toLocaleDateString();

  if (!tenant) return <EmptyState title="No tenant" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isHr ? t('attendance.title') : t('attendance.myTitle')}</h1>
          <p className="page-subtitle">{t('attendance.subtitle')}</p>
        </div>
      </div>

      {/* Clock-in card */}
      <Card className="att-clock">
        <div className="att-clock__head">
          <div>
            <div className="att-clock__date">{fmtDate(now)}</div>
            <div className="att-clock__time">{fmtTime(now)}</div>
            <div className="att-clock__shift">{t('attendance.shift')}</div>
          </div>
          {me && (
            <div className="att-clock__me">
              <Avatar name={me.fullName} size={48} />
              <div>
                <div className="att-clock__me-name">{me.fullName}</div>
                <div className="att-clock__me-dept">{t(`departments.${me.department}`, me.department)} · {me.position}</div>
              </div>
            </div>
          )}
        </div>
        <div className="att-clock__body">
          {today?.checkIn ? (
            <div className="att-clock__status">
              <Badge tone="success" dot>{t('attendance.clockedIn', { time: today.checkIn })}</Badge>
              {today.checkOut && (
                <Badge tone="info" dot>{t('attendance.clockedOut', { time: today.checkOut })}</Badge>
              )}
            </div>
          ) : (
            <div className="att-clock__status">
              <Badge tone="warning">{t('attendance.notClockedIn')}</Badge>
            </div>
          )}
          <div className="att-clock__actions">
            {!today?.checkIn ? (
              <Button variant="primary" size="lg" onClick={handleClockIn} disabled={!me}>
                <FaSignInAlt /> <span style={{ marginLeft: 8 }}>{t('attendance.clockIn')}</span>
              </Button>
            ) : !today.checkOut ? (
              <Button variant="primary" size="lg" onClick={handleClockOut}>
                <FaSignOutAlt /> <span style={{ marginLeft: 8 }}>{t('attendance.clockOut')}</span>
              </Button>
            ) : (
              <Button variant="secondary" size="lg" disabled>
                <FaClock /> <span style={{ marginLeft: 8 }}>{t('common.completed', 'Done')}</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* HR/Manager: today summary */}
      {isHr && (
        <div className="att-summary-grid">
          <StatCard label={t('attendance.summary.present')} value={todaySummary.present} tone="success" />
          <StatCard label={t('attendance.summary.late')} value={todaySummary.late} tone="warning" />
          <StatCard label={t('attendance.summary.absent')} value={todaySummary.absent} tone="danger" />
          <StatCard label={t('attendance.summary.leave')} value={todaySummary.leave} tone="info" />
        </div>
      )}

      {/* List */}
      <Card title={isHr ? t('attendance.title') : t('attendance.myTitle')} padded={false}>
        {loading ? (
          <div className="dash__placeholder">{t('common.loading')}</div>
        ) : (
          <DataTable
            columns={[
              ...(isHr ? [{
                key: 'employee',
                header: t('attendance.list.headers.employee'),
                mobileLabel: t('attendance.list.headers.employee'),
                render: (r) => r.employee ? (
                  <div className="emp-cell">
                    <Avatar name={r.employee.fullName} size={28} />
                    <span>{r.employee.fullName}</span>
                  </div>
                ) : '—',
              }] : []),
              { key: 'date', header: t('attendance.list.headers.date'), mobileLabel: t('attendance.list.headers.date'), render: (r) => r.date },
              { key: 'in', header: t('attendance.list.headers.checkIn'), mobileLabel: t('attendance.list.headers.checkIn'), render: (r) => r.checkIn || '—' },
              { key: 'out', header: t('attendance.list.headers.checkOut'), mobileLabel: t('attendance.list.headers.checkOut'), render: (r) => r.checkOut || '—' },
              {
                key: 'st', header: t('attendance.list.headers.status'),
                mobileLabel: t('attendance.list.headers.status'),
                render: (r) => <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{t(`attendance.status.${r.status}`, r.status)}</Badge>,
              },
            ]}
            rows={isHr ? allHistory : history}
            rowKey="id"
            empty={t('common.noData', 'No data')}
          />
        )}
      </Card>

      <style>{`
        .att-clock__head {
          display: flex; justify-content: space-between; align-items: center;
          gap: var(--sp-4); flex-wrap: wrap;
          padding-bottom: var(--sp-4);
          border-bottom: 1px dashed var(--border);
          margin-bottom: var(--sp-4);
        }
        .att-clock__date { color: var(--text-3); font-size: var(--fs-13); }
        .att-clock__time {
          font-size: 36px; font-weight: 700; color: var(--text-1); letter-spacing: 0.02em;
          font-feature-settings: "tnum"; line-height: 1;
        }
        .att-clock__shift { color: var(--text-3); font-size: var(--fs-12); margin-top: 4px; }
        .att-clock__me { display: flex; gap: var(--sp-3); align-items: center; }
        .att-clock__me-name { font-weight: 600; }
        .att-clock__me-dept { color: var(--text-3); font-size: var(--fs-12); }
        .att-clock__body {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--sp-4); flex-wrap: wrap;
        }
        .att-clock__status { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
        .att-clock__actions .btn { min-width: 160px; }
        .att-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: var(--sp-3);
          margin: var(--sp-4) 0;
        }
        @media (max-width: 480px) {
          .att-clock__time { font-size: 28px; }
          .att-clock__actions .btn { min-width: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
