import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { employeeApi, attendanceApi, leaveApi } from '../../mock/api';
import { classOf, levelStats, powerOf, comboOf } from './engine';

const TABS = [
  { key: 'power',  label: '战力榜',   icon: '⚔️', metric: (e) => e.power },
  { key: 'level',  label: '等级榜',   icon: '⭐', metric: (e) => e.lvl },
  { key: 'combo',  label: '连击榜',   icon: '🔥', metric: (e) => e.combo },
  { key: 'attend', label: '出勤榜',   icon: '⏰', metric: (e) => e.attCount },
];

export default function Rank() {
  const { session, tenant } = useApp();
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [tab, setTab] = useState('power');
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

  const myId = useMemo(() => {
    if (!session || !employees.length) return null;
    const me =
      employees.find((e) => e.email && e.email.toLowerCase() === (session.email || '').toLowerCase()) ||
      employees.find((e) => e.fullName === session.name);
    return me?.id;
  }, [employees, session]);

  const enriched = useMemo(() => {
    return employees.map((e) => {
      const cls = classOf(e.department);
      const lvl = levelStats(e, { attendance, leaves });
      const power = powerOf(e, lvl.level);
      const combo = comboOf(e, attendance);
      const attCount = attendance.filter((a) => a.employeeId === e.id && a.status === 'PRESENT').length;
      return { ...e, cls, lvl: lvl.level, power, combo, attCount };
    });
  }, [employees, attendance, leaves]);

  const currentTab = TABS.find((t) => t.key === tab);
  const ranked = useMemo(() => {
    return [...enriched].sort((a, b) => currentTab.metric(b) - currentTab.metric(a));
  }, [enriched, currentTab]);

  if (loading) {
    return (
      <div className="fm-loading">
        ◢ COMPUTING LEADERBOARD ◣
        <div className="fm-loading__bar"><div /></div>
      </div>
    );
  }

  const myRank = ranked.findIndex((e) => e.id === myId) + 1;

  return (
    <>
      <div className="fm-hero" style={{ padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-2)', letterSpacing: 3, textTransform: 'uppercase' }}>
          🏆 名人堂 · HALL OF FAME
        </div>
        <div style={{
          fontSize: 32, fontWeight: 900, marginTop: 8,
          background: 'linear-gradient(90deg, #ffd700, #ff8a00, #ff1744)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 16px rgba(255,215,0,0.5))',
        }}>
          赛季排行榜
        </div>
        {myId && myRank > 0 && (
          <div style={{
            marginTop: 12, fontSize: 13, color: 'var(--text-2)',
          }}>
            你的排名：<strong style={{
              fontSize: 18, color: myRank <= 3 ? '#ffd700' : 'var(--neon-cyan)',
            }}>#{myRank}</strong> / {ranked.length}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 0',
        scrollbarWidth: 'none',
      }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              whiteSpace: 'nowrap',
              padding: '8px 16px',
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1,
              border: tab === t.key
                ? '1px solid var(--neon-cyan)'
                : '1px solid rgba(255,255,255,0.1)',
              background: tab === t.key
                ? 'linear-gradient(135deg, rgba(0,246,255,0.2), rgba(255,43,214,0.2))'
                : 'rgba(19,24,48,0.6)',
              color: tab === t.key ? 'var(--text-0)' : 'var(--text-2)',
              cursor: 'pointer',
              boxShadow: tab === t.key ? '0 0 16px rgba(0,246,255,0.4)' : 'none',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      <div className="fm-section" style={{ marginTop: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 8, alignItems: 'end' }}>
          {[ranked[1], ranked[0], ranked[2]].filter(Boolean).map((e, i) => {
            const pos = [2, 1, 3][i];
            const color = pos === 1 ? '#ffd700' : pos === 2 ? '#c0c0c0' : '#cd7f32';
            const height = pos === 1 ? 180 : pos === 2 ? 150 : 140;
            return (
              <div key={e.id} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, margin: '0 auto 8px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${color}, ${e.cls.color})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32,
                  boxShadow: `0 0 24px ${color}88`,
                  border: `2px solid ${color}`,
                }}>{e.cls.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{e.fullName}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Lv.{e.lvl} · {e.cls.name}</div>
                <div style={{
                  height,
                  marginTop: 8,
                  borderRadius: '12px 12px 0 0',
                  background: `linear-gradient(180deg, ${color}, ${color}33)`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  paddingTop: 12,
                  border: `1px solid ${color}66`,
                  boxShadow: `0 -4px 24px ${color}55`,
                  position: 'relative',
                }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#000', textShadow: '0 1px 2px rgba(255,255,255,0.3)' }}>
                    #{pos}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, marginTop: 8, color: '#000' }}>
                    {currentTab.metric(e).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.7)', letterSpacing: 1, fontWeight: 700 }}>
                    {currentTab.label.replace('榜','')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full rank list */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">📜 完整排名</div>
        </div>
        {ranked.map((e, i) => {
          const pos = i + 1;
          const isMe = e.id === myId;
          const topClass = pos === 1 ? 'is-top-1' : pos === 2 ? 'is-top-2' : pos === 3 ? 'is-top-3' : '';
          return (
            <div key={e.id} className={`fm-rank-item ${topClass} ${isMe ? 'is-me' : ''}`}>
              <div className="fm-rank__pos">
                {pos <= 3 ? ['🥇','🥈','🥉'][pos - 1] : `#${pos}`}
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${e.cls.color}, rgba(0,0,0,0.4))`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>{e.cls.emoji}</div>
              <div className="fm-rank__body">
                <div className="fm-rank__name">
                  {e.fullName} {isMe && <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 4,
                    background: 'var(--neon-cyan)', color: '#000', marginLeft: 4, fontWeight: 900,
                  }}>YOU</span>}
                </div>
                <div className="fm-rank__meta">Lv.{e.lvl} · {e.cls.name} · {e.department}</div>
              </div>
              <div className="fm-rank__power">{currentTab.metric(e).toLocaleString()}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
