import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaSyncAlt, FaTrash, FaBuilding, FaUsers, FaCheckCircle, FaClock } from 'react-icons/fa';
import { tenantApi, employeeApi } from '../../mock/api';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import DataTable from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import { Field, Input, Select } from '../../components/ui/Input';

const STATUS_TONE = { active: 'success', trial: 'info', suspended: 'warning', expired: 'danger' };

export default function AdminConsole() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { refreshTenants } = useApp();
  const [tenants, setTenants] = useState([]);
  const [empCounts, setEmpCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    const list = await tenantApi.list();
    setTenants(list);
    const counts = {};
    for (const tn of list) {
      const emps = await employeeApi.list(tn.id);
      counts[tn.id] = emps.length;
    }
    setEmpCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleReset = async () => {
    if (!window.confirm(t('admin.resetConfirm'))) return;
    await tenantApi.reset();
    toast.success(t('admin.resetDone'));
    refreshTenants();
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('admin.deleteTenant'))) return;
    await tenantApi.remove(id);
    refreshTenants();
    load();
  };

  const handleSave = async (patch) => {
    if (editing.isNew) {
      await tenantApi.create(patch);
    } else {
      await tenantApi.update(editing.id, patch);
    }
    refreshTenants();
    setEditing(null);
    load();
  };

  const totalEmps = Object.values(empCounts).reduce((s, n) => s + n, 0);
  const activeCount = tenants.filter((t) => t.status === 'active').length;
  const trialCount = tenants.filter((t) => t.status === 'trial').length;

  const columns = [
    {
      key: 'name', header: t('admin.tenantName'), mobileLabel: t('admin.tenantName'),
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.accentColor }} />
          <strong>{i18n.language === 'zh' ? (r.nameZh || r.name) : r.name}</strong>
        </div>
      ),
    },
    { key: 'region', header: t('admin.region'), mobileLabel: t('admin.region'),
      render: (r) => <Badge tone="neutral">{r.region}</Badge> },
    { key: 'plan', header: t('admin.plan'), mobileLabel: t('admin.plan'), render: (r) => r.plan },
    {
      key: 'seats', header: t('admin.seats'), mobileLabel: t('admin.seats'),
      hideOnMobile: true,
      render: (r) => `${empCounts[r.id] ?? 0} / ${r.seats}`,
    },
    {
      key: 'status', header: t('admin.status'), mobileLabel: t('admin.status'),
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(`admin.tenantStatus.${r.status}`, r.status)}</Badge>,
    },
    { key: 'createdAt', header: t('admin.createdAt'), mobileLabel: t('admin.createdAt'),
      hideOnMobile: true, render: (r) => r.createdAt },
    {
      key: 'actions', header: t('common.actions'), mobileLabel: '',
      render: (r) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>{t('common.edit')}</Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} className="btn-danger-text">
            <FaTrash />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin.title')}</h1>
          <p className="page-subtitle">{t('admin.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={handleReset}>
            <FaSyncAlt /> <span style={{ marginLeft: 6 }}>{t('admin.resetData')}</span>
          </Button>
          <Button variant="primary" onClick={() => setEditing({ isNew: true, name: '', region: 'SG', plan: 'Starter', status: 'trial', seats: 25, accentColor: '#3b63ec' })}>
            <FaPlus /> <span style={{ marginLeft: 6 }}>{t('admin.newTenant')}</span>
          </Button>
        </div>
      </div>

      {/* Platform stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
        <StatCard icon={<FaBuilding />} label={t('admin.totalTenants')} value={tenants.length} tone="brand" />
        <StatCard icon={<FaUsers />} label={t('admin.totalUsers')} value={totalEmps} tone="info" />
        <StatCard icon={<FaCheckCircle />} label={t('admin.activeTenants')} value={activeCount} tone="success" />
        <StatCard icon={<FaClock />} label={t('admin.trialTenants')} value={trialCount} tone="warning" />
      </div>

      <Card padded={false}>
        {loading ? (
          <div className="dash__placeholder">{t('common.loading')}</div>
        ) : (
          <DataTable columns={columns} rows={tenants} rowKey="id" empty={t('common.noData', 'No tenants')} />
        )}
      </Card>

      {editing && (
        <TenantEditor tenant={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      )}
    </div>
  );
}

function TenantEditor({ tenant, onClose, onSave }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: tenant.name || '',
    nameZh: tenant.nameZh || '',
    region: tenant.region || 'SG',
    currency: tenant.currency || 'SGD',
    plan: tenant.plan || 'Starter',
    seats: tenant.seats || 25,
    status: tenant.status || 'trial',
    accentColor: tenant.accentColor || '#3b63ec',
    statutorySchema: tenant.statutorySchema || (tenant.region || 'sg').toLowerCase(),
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Modal
      open
      title={tenant.isNew ? t('admin.newTenant') : t('common.edit') + ': ' + tenant.name}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={save} loading={saving}>{t('common.save')}</Button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sp-3)' }}>
        <Field label={t('admin.tenantName')} required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="中文名称">
          <Input value={form.nameZh} onChange={(e) => set('nameZh', e.target.value)} />
        </Field>
        <Field label={t('admin.region')}>
          <Select value={form.region} onChange={(e) => {
            const r = e.target.value;
            set('region', r);
            set('currency', r === 'SG' ? 'SGD' : r === 'CN' ? 'CNY' : 'MYR');
            set('statutorySchema', r.toLowerCase());
          }}>
            <option value="SG">{t('regions.SG', 'Singapore')}</option>
            <option value="CN">{t('regions.CN', 'China')}</option>
            <option value="MY">{t('regions.MY', 'Malaysia')}</option>
          </Select>
        </Field>
        <Field label={t('admin.plan')}>
          <Select value={form.plan} onChange={(e) => set('plan', e.target.value)}>
            <option>Starter</option>
            <option>Professional</option>
            <option>Enterprise</option>
          </Select>
        </Field>
        <Field label={t('admin.seats')}>
          <Input type="number" value={form.seats} onChange={(e) => set('seats', Number(e.target.value))} />
        </Field>
        <Field label={t('admin.status')}>
          <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="active">{t('admin.tenantStatus.active', 'Active')}</option>
            <option value="trial">{t('admin.tenantStatus.trial', 'Trial')}</option>
            <option value="suspended">{t('admin.tenantStatus.suspended', 'Suspended')}</option>
            <option value="expired">{t('admin.tenantStatus.expired', 'Expired')}</option>
          </Select>
        </Field>
        <Field label="Currency">
          <Input value={form.currency} onChange={(e) => set('currency', e.target.value)} />
        </Field>
        <Field label="Accent Color">
          <Input type="color" value={form.accentColor} onChange={(e) => set('accentColor', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
