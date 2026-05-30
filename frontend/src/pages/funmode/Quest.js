import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { employeeApi, attendanceApi } from '../../mock/api';
import { comboOf, comboMultiplier, classOf } from './engine';

export default function Quest() {
  const { session, tenant } = useApp();
  const [me, setMe] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenant) return;
      const emps = await employeeApi.list(tenant.id);
      const found =
        emps.find((e) => e.email && e.email.toLowerCase() === (session?.email || '').toLowerCase()) ||
        emps.find((e) => e.fullName === session?.name) ||
        emps[0];
      const att = await attendanceApi.list(tenant.id);
      if (!cancelled) {
        setMe(found);
        setAttendance(att);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant, session]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const today = now.toISOString().slice(0, 10);
  const todayAtt = me ? attendance.find((a) => a.employeeId === me.id && a.date === today) : null;
  const combo = me ? comboOf(me, attendance) : 0;
  const mul = comboMultiplier(combo);
  const cls = me ? classOf(me.department) : null;

  const handleClockIn = async () => {
    if (!me || busy) return;
    setBusy(true);
    await attendanceApi.clockIn(tenant.id, me.id);
    const fresh = await attendanceApi.list(tenant.id);
    setAttendance(fresh);
    setBusy(false);
    const newCombo = comboOf(me, fresh);
    const newMul = comboMultiplier(newCombo);
    showToast(`⚡ 上班副本 +${Math.round(50 * newMul.mult)} EXP · ${newMul.label}`);
  };
  const handleClockOut = async () => {
    if (!me || busy) return;
    setBusy(true);
    await attendanceApi.clockOut(tenant.id, me.id);
    const fresh = await attendanceApi.list(tenant.id);
    setAttendance(fresh);
    setBusy(false);
    showToast(`🌙 下班通关 +${Math.round(50 * mul.mult)} EXP · 战斗结算`);
  };

  if (!me) {
    return (
      <div className="fm-loading">
        ◢ LOADING DUNGEON ◣
        <div className="fm-loading__bar"><div /></div>
      </div>
    );
  }

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const weekDay = ['SUN','MON','TUE','WED','THU','FRI','SAT'][now.getDay()];

  const canClockIn = !todayAtt;
  const canClockOut = todayAtt && !todayAtt.checkOut;
  const done = todayAtt && todayAtt.checkOut;

  // Last 14 days streak heatmap
  const heat = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const att = attendance.find((a) => a.employeeId === me.id && a.date === ds);
    heat.push({ date: ds, status: att?.status || (i === 0 ? null : 'absent') });
  }

  return (
    <>
      {toast && <div className="fm-toast">{toast}</div>}

      {/* Clock + Combo */}
      <div className="fm-clock">
        <div className="fm-clock__time">{hh}:{mm}<span style={{fontSize: '24px', opacity: 0.5}}>:{ss}</span></div>
        <div className="fm-clock__date">{today.replace(/-/g, ' · ')} · {weekDay}</div>

        <div className="fm-combo">
          <div className="fm-combo__num">{combo}</div>
          <div className="fm-combo__lbl">
            <div className="fm-combo__lbl-x">COMBO × {mul.mult}</div>
            <div className="fm-combo__lbl-tag" style={{ background: mul.color, color: '#000' }}>{mul.label}</div>
            <div className="fm-combo__lbl-tip">连续打卡天数</div>
          </div>
        </div>

        {canClockIn && (
          <button className="fm-punch" onClick={handleClockIn} disabled={busy}>
            {busy ? '…' : '⚔️ 进入副本 · 上班打卡'}
          </button>
        )}
        {canClockOut && (
          <button className="fm-punch fm-punch--out" onClick={handleClockOut} disabled={busy}>
            {busy ? '…' : '🌙 通关结算 · 下班打卡'}
          </button>
        )}
        {done && (
          <button className="fm-punch" disabled>✅ 今日已通关</button>
        )}
      </div>

      {/* Today's status */}
      {todayAtt && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">📊 今日战报</div>
          </div>
          <div className="fm-radar-wrap" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-2)' }}>入场时间</span>
              <strong>{todayAtt.checkIn || '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
              <span style={{ color: 'var(--text-2)' }}>退场时间</span>
              <strong>{todayAtt.checkOut || '战斗中…'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
              <span style={{ color: 'var(--text-2)' }}>战斗状态</span>
              <strong style={{ color: todayAtt.status === 'LATE' ? 'var(--neon-orange)' : 'var(--neon-green)' }}>
                {todayAtt.status === 'LATE' ? '⚠️ 迟到惩罚' : '✓ 满分通关'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">🔥 连击轨迹（14 日）</div>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)',
          gap: '4px', padding: '12px', background: 'rgba(19,24,48,0.6)',
          borderRadius: '14px', border: '1px solid var(--line)',
        }}>
          {heat.map((h, i) => {
            const colors = {
              PRESENT: 'linear-gradient(135deg, #39ff14, #00b34a)',
              LATE:    'linear-gradient(135deg, #ff8a00, #ff5722)',
              absent:  'rgba(255,255,255,0.05)',
            };
            return (
              <div
                key={i}
                title={`${h.date} · ${h.status || '未来'}`}
                style={{
                  aspectRatio: '1',
                  borderRadius: '6px',
                  background: colors[h.status] || 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  boxShadow: h.status === 'PRESENT' ? '0 0 8px rgba(57,255,20,0.4)' : 'none',
                }}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: 'var(--text-3)' }}>
          <span>🟢 满分通关</span>
          <span>🟠 迟到惩罚</span>
          <span>⬛ 未参战</span>
        </div>
      </div>

      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">⚔ 副本规则</div>
        </div>
        <div className="fm-radar-wrap" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)' }}>
            • 9:05 前打卡 = <strong style={{color: 'var(--neon-green)'}}>满分通关</strong> +50 EXP<br />
            • 9:05 后打卡 = <strong style={{color: 'var(--neon-orange)'}}>迟到惩罚</strong> +20 EXP，连击中断<br />
            • 连续打卡触发 <strong style={{color: 'var(--neon-pink)'}}>Combo 倍率</strong>，最高 ×5<br />
            • Combo ≥ 30 解锁 <strong style={{color: 'var(--neon-red)'}}>"月之守护者"</strong> 神话勋章
          </div>
        </div>
      </div>
    </>
  );
}
