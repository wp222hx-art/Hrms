import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { employeeApi, payrollApi } from '../../mock/api';
import { lootRarity, RARITIES, classOf } from './engine';

export default function Loot() {
  const { tenant } = useApp();
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [opening, setOpening] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenant) return;
      const emps = await employeeApi.list(tenant.id);
      const pr = await payrollApi.get(tenant.id);
      if (!cancelled) {
        setEmployees(emps);
        setPayroll(pr);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const handleRun = async () => {
    setRunning(true);
    const month = new Date().toISOString().slice(0, 7);
    const pr = await payrollApi.run(tenant.id, month);
    setPayroll(pr);
    setRunning(false);
    showToast(`💎 ${pr.lines.length} 个宝箱已生成！`);
  };

  const lines = useMemo(() => {
    if (!payroll) return [];
    const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));
    return payroll.lines.map((l) => {
      const emp = empMap[l.employeeId];
      const baseSalary = emp?.monthlyBase || l.gross || 1;
      const rarity = lootRarity(l.netPay, baseSalary);
      return { ...l, emp, rarity, cls: emp ? classOf(emp.department) : null };
    });
  }, [payroll, employees]);

  const rarityCounts = useMemo(() => {
    const c = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
    lines.forEach((l) => c[l.rarity]++);
    return c;
  }, [lines]);

  if (loading) {
    return (
      <div className="fm-loading">
        ◢ SCANNING VAULT ◣
        <div className="fm-loading__bar"><div /></div>
      </div>
    );
  }

  return (
    <>
      {toast && <div className="fm-toast">{toast}</div>}

      <div className="fm-hero" style={{ padding: '18px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-2)', letterSpacing: 3, textTransform: 'uppercase' }}>
          💰 月度战利品仓库
        </div>
        <div style={{
          fontSize: 36, fontWeight: 900, marginTop: 6,
          background: 'linear-gradient(90deg, var(--neon-yellow), var(--neon-orange), var(--neon-red))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 12px rgba(255,138,0,0.5))',
        }}>
          {payroll?.month || '尚未开启'}
        </div>

        {payroll && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginTop: 14,
          }}>
            {Object.entries(rarityCounts).map(([rarity, count]) => {
              const r = RARITIES[rarity];
              return (
                <div key={rarity} style={{
                  padding: 8, borderRadius: 10,
                  background: `${r.color}22`,
                  border: `1px solid ${r.color}66`,
                }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: r.color }}>{count}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: 0.5 }}>{r.name}</div>
                </div>
              );
            })}
          </div>
        )}

        <button
          className="fm-punch"
          onClick={handleRun}
          disabled={running}
          style={{ marginTop: 14 }}
        >
          {running ? '⏳ 开启中…' : (payroll ? '🎲 重新开启全部宝箱' : '⚡ 一键开宝箱（运行薪资）')}
        </button>
      </div>

      {lines.length === 0 ? (
        <div className="fm-empty">
          <div className="fm-empty__icon">📦</div>
          <div>仓库还是空的，点击上面按钮开启本月宝箱</div>
        </div>
      ) : (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">📦 宝箱列表（按稀有度）</div>
          </div>
          <div className="fm-loot">
            {[...lines]
              .sort((a, b) => {
                const order = ['mythic','legendary','epic','rare','uncommon','common'];
                return order.indexOf(a.rarity) - order.indexOf(b.rarity);
              })
              .map((l) => {
                const r = RARITIES[l.rarity];
                const isOpen = opening === l.employeeId;
                return (
                  <div
                    key={l.employeeId}
                    className="fm-chest"
                    style={{ '--l-color': r.color, '--l-glow': r.glow }}
                    onClick={() => {
                      setOpening(l.employeeId);
                      setTimeout(() => setOpening(null), 1500);
                      showToast(`🎁 ${r.name}宝箱 · ${l.emp?.fullName}`);
                    }}
                  >
                    <div className="fm-chest__top">
                      <div className="fm-chest__icon" style={{
                        animation: isOpen ? 'comboBounce 0.5s ease-in-out 3' : 'none',
                      }}>
                        {l.cls?.emoji || '📦'}
                      </div>
                      <div className="fm-chest__rarity">{r.name}</div>
                    </div>
                    <div className="fm-chest__stars">{'★'.repeat(r.stars)}{'☆'.repeat(6 - r.stars)}</div>
                    <div className="fm-chest__title">{l.emp?.fullName || l.employeeId}</div>
                    <div className="fm-chest__amount">
                      {tenant?.currency || ''} {Math.round(l.netPay).toLocaleString()}
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 10, color: 'var(--text-3)', marginTop: 8,
                      paddingTop: 8, borderTop: '1px dashed rgba(255,255,255,0.08)',
                    }}>
                      <span>Gross {Math.round(l.gross).toLocaleString()}</span>
                      <span>−Tax {Math.round(l.tax || 0).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Legend */}
          <div className="fm-section">
            <div className="fm-section__head">
              <div className="fm-section__title">💡 稀有度规则</div>
            </div>
            <div className="fm-radar-wrap" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 2 }}>
                <RarityRow r="mythic">实发 ≥ 基本工资 × 1.5（年终大爆发！）</RarityRow>
                <RarityRow r="legendary">实发 ≥ 基本工资 × 1.25（年中奖金）</RarityRow>
                <RarityRow r="epic">实发 ≥ 基本工资 × 1.10（项目奖励）</RarityRow>
                <RarityRow r="rare">实发 ≥ 基本工资 × 0.95（标准月份）</RarityRow>
                <RarityRow r="uncommon">实发 ≥ 基本工资 × 0.80（含请假扣款）</RarityRow>
                <RarityRow r="common">实发 &lt; 基本工资 × 0.80</RarityRow>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RarityRow({ r, children }) {
  const rar = RARITIES[r];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 800,
        background: `${rar.color}22`, color: rar.color, border: `1px solid ${rar.color}66`,
        letterSpacing: 1, minWidth: 48, textAlign: 'center',
      }}>{rar.name}</span>
      <span>{children}</span>
    </div>
  );
}
