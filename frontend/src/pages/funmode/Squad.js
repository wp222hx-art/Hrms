import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { employeeApi, attendanceApi, leaveApi } from '../../mock/api';
import { classOf, levelStats, powerOf, CLASSES, RARITIES } from './engine';

export default function Squad() {
  const { tenant } = useApp();
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenant) return;
      const [emps, att, lv] = await Promise.all([
        employeeApi.list(tenant.id),
        attendanceApi.list(tenant.id),
        leaveApi.list(tenant.id),
      ]);
      if (!cancelled) {
        setEmployees(emps);
        setAttendance(att);
        setLeaves(lv);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant]);

  const enriched = useMemo(() => {
    return employees.map((e) => {
      const cls = classOf(e.department);
      const lvl = levelStats(e, { attendance, leaves });
      const power = powerOf(e, lvl.level);
      return { ...e, cls, lvl: lvl.level, expPercent: lvl.expPercent, power };
    }).sort((a, b) => b.power - a.power);
  }, [employees, attendance, leaves]);

  const classKeys = useMemo(() => {
    const set = new Set();
    enriched.forEach((e) => set.add(e.cls.key));
    return Array.from(set);
  }, [enriched]);

  const filtered = filter === 'all' ? enriched : enriched.filter((e) => e.cls.key === filter);

  // Class stats
  const classStats = useMemo(() => {
    const counts = {};
    enriched.forEach((e) => {
      counts[e.cls.key] = counts[e.cls.key] || { ...e.cls, count: 0, totalPower: 0 };
      counts[e.cls.key].count++;
      counts[e.cls.key].totalPower += e.power;
    });
    return Object.values(counts).sort((a, b) => b.totalPower - a.totalPower);
  }, [enriched]);

  const totalPower = enriched.reduce((s, e) => s + e.power, 0);

  if (loading) {
    return (
      <div className="fm-loading">
        ◢ ASSEMBLING SQUAD ◣
        <div className="fm-loading__bar"><div /></div>
      </div>
    );
  }

  return (
    <>
      {/* Guild stats */}
      <div className="fm-hero" style={{ padding: '18px 16px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-2)', letterSpacing: 3, textTransform: 'uppercase' }}>
            ⚜ {tenant?.nameCn || tenant?.name || '工会'} ⚜
          </div>
          <div style={{
            fontSize: 36, fontWeight: 900, marginTop: 6,
            background: 'linear-gradient(90deg, var(--neon-yellow), var(--neon-orange))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(255,138,0,0.5))',
          }}>
            {totalPower.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: 2 }}>
            公会总战力 · {enriched.length} 名成员
          </div>
        </div>

        <div className="fm-quickstats" style={{ marginTop: 18, gridTemplateColumns: `repeat(${Math.min(4, classStats.length)}, 1fr)` }}>
          {classStats.slice(0, 4).map((c) => (
            <div key={c.key} className="fm-quickstat">
              <div className="fm-quickstat__icon">{c.emoji}</div>
              <div className="fm-quickstat__val" style={{
                background: `linear-gradient(90deg, ${c.color}, #fff)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>{c.count}</div>
              <div className="fm-quickstat__lbl">{c.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter chips */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">🛡 公会成员</div>
          <div className="fm-section__more">{filtered.length}</div>
        </div>
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6,
          marginBottom: 10, scrollbarWidth: 'none',
        }}>
          <Chip active={filter === 'all'} onClick={() => setFilter('all')} color="#fff">
            全部
          </Chip>
          {classKeys.map((k) => {
            const c = Object.values(CLASSES).find((cl) => cl.key === k);
            if (!c) return null;
            return (
              <Chip
                key={k}
                active={filter === k}
                onClick={() => setFilter(k)}
                color={c.color}
              >
                {c.emoji} {c.name}
              </Chip>
            );
          })}
        </div>

        <div className="fm-members">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="fm-member"
              style={{ '--member-color': e.cls.color, '--member-glow': `${e.cls.color}55` }}
            >
              <div className="fm-member__avatar">
                {e.cls.emoji}
                <div className="fm-member__lvl">{e.lvl}</div>
              </div>
              <div className="fm-member__body">
                <div className="fm-member__name">{e.fullName}</div>
                <div className="fm-member__class">{e.cls.name} · {e.position || e.jobTitle || '—'}</div>
                <div className="fm-member__bar">
                  <div style={{ width: `${e.expPercent}%` }} />
                </div>
                <div className="fm-member__power">
                  ⚔ 战力 <strong>{e.power.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Chip({ active, onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        whiteSpace: 'nowrap',
        padding: '6px 14px',
        borderRadius: 100,
        fontSize: 12,
        fontWeight: 700,
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
        background: active ? `${color}22` : 'rgba(19,24,48,0.6)',
        color: active ? color : 'var(--text-2)',
        cursor: 'pointer',
        boxShadow: active ? `0 0 12px ${color}66` : 'none',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}
