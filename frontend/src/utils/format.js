/**
 * Shared formatting + lookup utilities for the enterprise modules.
 */
import { useEffect, useState } from 'react';
import { employeeApi } from '../mock/api';
import { useApp } from '../context/AppContext';

/** Format currency with SEA-aware locale + integer for big-number currencies */
export function formatCurrency(amount, currency = 'SGD') {
  if (amount === null || amount === undefined || amount === '') return '—';
  const num = Number(amount);
  if (Number.isNaN(num)) return String(amount);
  const localeMap = {
    SGD: 'en-SG', MYR: 'ms-MY', IDR: 'id-ID', VND: 'vi-VN',
    THB: 'th-TH', PHP: 'en-PH', CNY: 'zh-CN', USD: 'en-US',
  };
  const noDecimal = currency === 'IDR' || currency === 'VND';
  try {
    return new Intl.NumberFormat(localeMap[currency] || 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: noDecimal ? 0 : 2,
      minimumFractionDigits: noDecimal ? 0 : 0,
    }).format(num);
  } catch {
    return `${currency} ${num.toLocaleString()}`;
  }
}

/** Relative time: "刚刚 / 3 分钟前 / 2 小时前 / 昨天 / 3 天前 / yyyy-mm-dd" */
export function relativeTime(iso, lang = 'zh') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  const isZh = lang === 'zh';
  if (diff < 60)     return isZh ? '刚刚' : 'just now';
  if (diff < 3600)   return isZh ? `${Math.floor(diff / 60)} 分钟前` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return isZh ? `${Math.floor(diff / 3600)} 小时前` : `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return isZh ? '昨天' : 'yesterday';
  if (diff < 604800) return isZh ? `${Math.floor(diff / 86400)} 天前` : `${Math.floor(diff / 86400)}d ago`;
  return d.toISOString().slice(0, 10);
}

/** Time-of-day for chat bubbles (HH:MM) */
export function timeHM(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Hook: load current employee record matched by session.email + employee list */
export function useCurrentEmployee() {
  const { session, tenant } = useApp();
  const [me, setMe] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant || !session) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    employeeApi.list(tenant.id).then((list) => {
      if (!live) return;
      const m = list.find((e) => e.email?.toLowerCase() === session.email?.toLowerCase()) || list[0] || null;
      setEmployees(list);
      setMe(m);
      setLoading(false);
    });
    return () => { live = false; };
  }, [tenant, session]);

  return { me, employees, loading };
}

/** Quick lookup helper */
export function findEmployee(employees, id) {
  return employees.find((e) => e.id === id) || null;
}
