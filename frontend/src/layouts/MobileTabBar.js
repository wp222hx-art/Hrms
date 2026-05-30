import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FaTachometerAlt, FaUsers, FaClock, FaCalendarAlt,
  FaReceipt, FaMoneyBillWave, FaUserCircle, FaShieldAlt, FaBuilding,
} from 'react-icons/fa';
import { useApp } from '../context/AppContext';
import './MobileTabBar.css';

const TABS_BY_ROLE = {
  super_admin: [
    { to: '/admin',         key: 'nav.adminConsole', icon: FaShieldAlt },
    { to: '/admin/tenants', key: 'nav.tenants',      icon: FaBuilding },
  ],
  hr_admin: [
    { to: '/dashboard',    key: 'nav.dashboard',   icon: FaTachometerAlt },
    { to: '/employees',    key: 'nav.employees',   icon: FaUsers },
    { to: '/leave',        key: 'nav.leave',       icon: FaCalendarAlt },
    { to: '/payroll',      key: 'nav.payroll',     icon: FaMoneyBillWave },
    { to: '/self-service', key: 'nav.selfService', icon: FaUserCircle },
  ],
  manager: [
    { to: '/dashboard',    key: 'nav.dashboard',   icon: FaTachometerAlt },
    { to: '/employees',    key: 'nav.employees',   icon: FaUsers },
    { to: '/leave',        key: 'nav.leave',       icon: FaCalendarAlt },
    { to: '/expense',      key: 'nav.expense',     icon: FaReceipt },
    { to: '/self-service', key: 'nav.selfService', icon: FaUserCircle },
  ],
  employee: [
    { to: '/dashboard',    key: 'nav.dashboard',     icon: FaTachometerAlt },
    { to: '/attendance',   key: 'nav.myAttendance',  icon: FaClock },
    { to: '/leave',        key: 'nav.myLeave',       icon: FaCalendarAlt },
    { to: '/expense',      key: 'nav.myExpense',     icon: FaReceipt },
    { to: '/self-service', key: 'nav.selfService',   icon: FaUserCircle },
  ],
};

export default function MobileTabBar() {
  const { t } = useTranslation();
  const { role } = useApp();
  const tabs = TABS_BY_ROLE[role] || TABS_BY_ROLE.employee;

  return (
    <nav className="tabbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/admin'}
            className={({ isActive }) => `tabbar__item ${isActive ? 'is-active' : ''}`}
          >
            <Icon className="tabbar__icon" />
            <span className="tabbar__label">{t(tab.key)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
