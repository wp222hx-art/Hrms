import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileTabBar from './MobileTabBar';
import './AppShell.css';

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Close drawer on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setDrawerOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="shell">
      {/* Desktop sidebar */}
      <aside className="shell__sidebar">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div className="shell__drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <aside className="shell__drawer">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </>
      )}

      <div className="shell__main">
        <Topbar onMenu={() => setDrawerOpen(true)} />
        <main className="shell__content">
          <Outlet />
        </main>
        <MobileTabBar />
      </div>
    </div>
  );
}
