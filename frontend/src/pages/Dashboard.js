import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  FaUsers, FaUserCheck, FaUserTimes, FaCalendarAlt,
  FaReceipt, FaPlus, FaPlay, FaUserPlus,
} from 'react-icons/fa';
import { useApp } from '../context/AppContext';
import { dashboardApi } from '../mock/api';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { LineChart, Donut } from '../components/ui/MiniChart';
import EmptyState from '../components/ui/EmptyState';
import './Dashboard.css';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { tenant, role, session } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    dashboardApi.summary(tenant.id).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [tenant]);

  if (!tenant) {
    return <EmptyState title="No tenant selected" hint="Please select a tenant from the topbar." />;
  }

  const tenantName = i18n.language === 'zh' ? (tenant.nameZh || tenant.name) : tenant.name;
  const greeting = (() => {
    const h = new Date().getHours();
    if (i18n.language === 'zh') {
      if (h < 6) return '夜深了';
      if (h < 12) return '早上好';
      if (h < 18) return '下午好';
      return '晚上好';
    }
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const lineData = (data?.trend || []).map((d) => ({
    label: d.date.slice(5),
    value: d.present + d.late,
  }));

  const palette = ['#3b63ec', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
  const deptData = (data?.deptBreakdown || []).map((d, i) => ({
    label: t(`departments.${d.dept}`, d.dept),
    value: d.count,
    color: palette[i % palette.length],
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting}, {session?.name?.split(' ')[0] || ''} 👋
          </h1>
          <p className="page-subtitle">{t('dashboard.subtitle', { tenant: tenantName })}</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="dash__kpi-grid">
        <StatCard
          icon={<FaUsers />}
          label={t('dashboard.kpi.employees')}
          value={loading ? '—' : data.employeeCount}
          hint={`${data?.activeCount || 0} ${t('dashboard.kpi.activeEmployees').toLowerCase()}`}
          tone="brand"
        />
        <StatCard
          icon={<FaUserCheck />}
          label={t('dashboard.kpi.presentToday')}
          value={loading ? '—' : data.todayPresent}
          tone="success"
        />
        <StatCard
          icon={<FaUserTimes />}
          label={t('dashboard.kpi.absentToday')}
          value={loading ? '—' : data.todayAbsent}
          tone="warning"
        />
        <StatCard
          icon={<FaCalendarAlt />}
          label={t('dashboard.kpi.pendingLeaves')}
          value={loading ? '—' : data.pendingLeaves}
          tone="info"
        />
        <StatCard
          icon={<FaReceipt />}
          label={t('dashboard.kpi.pendingExpenses')}
          value={loading ? '—' : data.pendingExpenses}
          tone="danger"
        />
      </div>

      <div className="dash__grid">
        <Card title={t('dashboard.trendTitle')} className="dash__chart-card">
          {loading ? (
            <div className="dash__placeholder">{t('common.loading')}</div>
          ) : lineData.length === 0 ? (
            <EmptyState title="No data" />
          ) : (
            <LineChart data={lineData} height={200} />
          )}
        </Card>

        <Card title={t('dashboard.departmentTitle')} className="dash__donut-card">
          {loading ? (
            <div className="dash__placeholder">{t('common.loading')}</div>
          ) : (
            <div className="dash__donut">
              <Donut
                segments={deptData}
                size={150}
                thickness={20}
                centerLabel={data?.employeeCount}
              />
              <ul className="dash__legend">
                {deptData.map((d) => (
                  <li key={d.label}>
                    <span className="dash__dot" style={{ background: d.color }} />
                    <span className="dash__legend-label">{d.label}</span>
                    <span className="dash__legend-value">{d.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="dash__grid">
        <Card title={t('dashboard.todoTitle')} className="dash__todo-card">
          {loading ? (
            <div className="dash__placeholder">{t('common.loading')}</div>
          ) : data.pendingLeaves === 0 && data.pendingExpenses === 0 ? (
            <EmptyState title={t('dashboard.noPending')} />
          ) : (
            <ul className="dash__todo-list">
              {data.pendingLeavesList?.map((l) => (
                <li key={l.id} onClick={() => navigate('/leave')} className="dash__todo-item">
                  <Badge tone="info">{t('nav.leave')}</Badge>
                  <span className="dash__todo-text">
                    {t('dashboard.leaveItem', {
                      name: l.employeeName,
                      days: l.days,
                      type: t(`leave.types.${l.type}`, l.type),
                    })}
                  </span>
                </li>
              ))}
              {data.pendingExpensesList?.map((e) => (
                <li key={e.id} onClick={() => navigate('/expense')} className="dash__todo-item">
                  <Badge tone="warning">{t('nav.expense')}</Badge>
                  <span className="dash__todo-text">
                    {t('dashboard.expenseItem', {
                      name: e.employeeName,
                      amount: `${tenant.currency} ${e.amount}`,
                      category: t(`expense.categories.${e.category}`, e.category),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('dashboard.quickActions')} className="dash__quick-card">
          <div className="dash__actions">
            {(role === 'hr_admin' || role === 'manager') && (
              <Button variant="secondary" onClick={() => navigate('/employees')}>
                <FaUserPlus /> <span>{t('dashboard.actions.addEmployee')}</span>
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/leave')}>
              <FaPlus /> <span>{t('dashboard.actions.applyLeave')}</span>
            </Button>
            <Button variant="secondary" onClick={() => navigate('/expense')}>
              <FaPlus /> <span>{t('dashboard.actions.submitExpense')}</span>
            </Button>
            {role === 'hr_admin' && (
              <Button variant="primary" onClick={() => navigate('/payroll')}>
                <FaPlay /> <span>{t('dashboard.actions.runPayroll')}</span>
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
