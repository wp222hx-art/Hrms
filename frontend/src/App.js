import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import AppShell from './layouts/AppShell';

import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import EmployeeList from './pages/employees/EmployeeList';
import EmployeeDetail from './pages/employees/EmployeeDetail';
import Attendance from './pages/attendance/Attendance';
import LeaveList from './pages/leave/LeaveList';
import ExpenseList from './pages/expense/ExpenseList';
import Payroll from './pages/payroll/Payroll';
import SelfService from './pages/self/SelfService';
import AdminConsole from './pages/admin/AdminConsole';

// Funmode (game-style UI)
import FunShell from './pages/funmode/FunShell';
import Lobby from './pages/funmode/Lobby';
import Quest from './pages/funmode/Quest';
import Squad from './pages/funmode/Squad';
import Loot from './pages/funmode/Loot';
import Rank from './pages/funmode/Rank';

import './styles/tokens.css';
import './styles/global.css';

function Protected({ children, allow }) {
  const { session, bootLoading } = useApp();
  if (bootLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>;
  }
  if (!session) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(session.role)) {
    return <Navigate to={session.role === 'super_admin' ? '/admin' : '/dashboard'} replace />;
  }
  return children;
}

function RootRedirect() {
  const { session, bootLoading } = useApp();
  if (bootLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={session.role === 'super_admin' ? '/admin' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RootRedirect />} />

        <Route element={<Protected><AppShell /></Protected>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/employees" element={
            <Protected allow={['hr_admin', 'manager']}><EmployeeList /></Protected>
          } />
          <Route path="/employees/:id" element={
            <Protected allow={['hr_admin', 'manager']}><EmployeeDetail /></Protected>
          } />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/leave" element={<LeaveList />} />
          <Route path="/expense" element={<ExpenseList />} />
          <Route path="/payroll" element={
            <Protected allow={['hr_admin']}><Payroll /></Protected>
          } />
          <Route path="/self-service" element={<SelfService />} />
          <Route path="/admin" element={
            <Protected allow={['super_admin']}><AdminConsole /></Protected>
          } />
          <Route path="/admin/tenants" element={
            <Protected allow={['super_admin']}><AdminConsole /></Protected>
          } />
        </Route>

        {/* Funmode — game-style UI (mobile-optimized cyberpunk) */}
        <Route element={<Protected><FunShell /></Protected>}>
          <Route path="/fun"        element={<Lobby />} />
          <Route path="/fun/quest"  element={<Quest />} />
          <Route path="/fun/squad"  element={<Squad />} />
          <Route path="/fun/loot"   element={<Loot />} />
          <Route path="/fun/rank"   element={<Rank />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
