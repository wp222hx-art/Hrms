import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FaTachometerAlt, FaUsers, FaClock, FaCalendarAlt, FaReceipt,
  FaMoneyBillWave, FaUserCircle, FaCogs, FaShieldAlt, FaBuilding,
} from 'react-icons/fa';
import { useApp } from '../context/AppContext';
import './Sidebar.css';

const NAV_BY_ROLE = {
  super_admin: [
    { to: '/admin',           key: 'nav.adminConsole', icon: FaShieldAlt },
    { to: '/admin/tenants',   key: 'nav.tenants',      icon: FaBuilding },
  ],
  hr_admin: [
    { to: '/dashboard',       key: 'nav.dashboard',    icon: FaTachometerAlt },
    { to: '/employees',       key: 'nav.employees',    icon: FaUsers },
    { to: '/attendance',      key: 'nav.attendance',   icon: FaClock },
    { to: '/leave',           key: 'nav.leave',        icon: FaCalendarAlt },
    { to: '/expense',         key: 'nav.expense',      icon: FaReceipt },
    { to: '/payroll',         key: 'nav.payroll',      icon: FaMoneyBillWave },
    { to: '/self-service',    key: 'nav.selfService',  icon: FaUserCircle },
  ],
  manager: [
    { to: '/dashboard',       key: 'nav.dashboard',    icon: FaTachometerAlt },
    { to: '/employees',       key: 'nav.employees',    icon: FaUsers },
    { to: '/leave',           key: 'nav.leave',        icon: FaCalendarAlt },
    { to: '/expense',         key: 'nav.expense',      icon: FaReceipt },
    { to: '/self-service',    key: 'nav.selfService',  icon: FaUserCircle },
  ],
  employee: [
    { to: '/dashboard',       key: 'nav.dashboard',    icon: FaTachometerAlt },
    { to: '/attendance',      key: 'nav.myAttendance', icon: FaClock },
    { to: '/leave',           key: 'nav.myLeave',      icon: FaCalendarAlt },
    { to: '/expense',         key: 'nav.myExpense',    icon: FaReceipt },
    { to: '/self-service',    key: 'nav.selfService',  icon: FaUserCircle },
  ],
};

export default function Sidebar({ onNavigate }) {
  const { t } = useTranslation();
  const { role } = useApp();
  const items = NAV_BY_ROLE[role] || NAV_BY_ROLE.employee;

  return (
    <nav className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">H</div>
        <div className="sidebar__brand-text">
          <div className="sidebar__brand-name">{t('common.appName')}</div>
          <div className="sidebar__brand-sub">{t(`roles.${role || 'employee'}`)}</div>
        </div>
      </div>

      <ul className="sidebar__nav">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <NavLink
                to={it.to}
                end={it.to === '/admin'}
                className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
                onClick={onNavigate}
              >
                <Icon className="sidebar__link-icon" />
                <span>{t(it.key)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>

      <div className="sidebar__footer">
        <div className="sidebar__footer-item">
          <FaCogs />
          <span>v0.9 demo</span>
        </div>
      </div>
    </nav>
  );
}
