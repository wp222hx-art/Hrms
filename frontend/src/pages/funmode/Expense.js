import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { employeeApi } from '../../mock/api';
import { UI_ICONS } from './assets';
import { listReceipts, addReceipt, fakeQrParse } from './hubStore';

/**
 * Expense submission page — mobile-first.
 * Three input modes:
 *   1) Camera / photo upload (file input with capture="environment")
 *   2) QR scan (simulated)
 *   3) Manual form
 */
export default function Expense() {
  const { session, tenant } = useApp();
  const [me, setMe] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [mode, setMode] = useState('home'); // home | qr | form | scanning
  const [form, setForm] = useState({
    merchant: '', category: '餐饮', amount: '', date: new Date().toISOString().slice(0, 10),
    note: '', photoData: '', source: 'manual', receiptNo: '',
  });
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenant) return;
      const emps = await employeeApi.list(tenant.id);
      const found =
        emps.find((e) => e.email && e.email.toLowerCase() === (session?.email || '').toLowerCase()) ||
        emps.find((e) => e.fullName === session?.name) ||
        emps[0];
      if (!cancelled && found) {
        setMe(found);
        setReceipts(listReceipts(tenant.id, found.id));
      }
    })();
    return () => { cancelled = true; };
  }, [tenant, session]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const openCamera = () => {
    setMode('form');
    setTimeout(() => fileRef.current?.click(), 100);
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((p) => ({ ...p, photoData: reader.result, source: 'photo', receiptNo: `PHOTO-${Date.now().toString().slice(-7)}` }));
    };
    reader.readAsDataURL(f);
  };

  const startQrScan = () => {
    setMode('scanning');
    // Fake QR parsing with animation duration
    setTimeout(() => {
      const parsed = fakeQrParse();
      setForm({
        merchant: parsed.merchant,
        category: parsed.category,
        amount: String(parsed.amount),
        date: parsed.date,
        note: `二维码识别 · ${parsed.taxRate} 税率`,
        photoData: '',
        source: 'qr_scan',
        receiptNo: parsed.receiptNo,
      });
      setMode('form');
    }, 2400);
  };

  const submit = () => {
    if (!me || !form.merchant || !form.amount) {
      showToast('⚠️ 请填写商家与金额');
      return;
    }
    const r = addReceipt(tenant.id, {
      employeeId: me.id,
      employeeName: me.fullName,
      merchant: form.merchant,
      category: form.category,
      amount: parseFloat(form.amount) || 0,
      currency: 'CNY',
      date: form.date,
      note: form.note,
      photoData: form.photoData,
      receiptNo: form.receiptNo,
      source: form.source,
    });
    setReceipts(listReceipts(tenant.id, me.id));
    setMode('home');
    setForm({
      merchant: '', category: '餐饮', amount: '', date: new Date().toISOString().slice(0, 10),
      note: '', photoData: '', source: 'manual', receiptNo: '',
    });
    showToast(`✅ 报销已提交 · ${r.id.slice(-6).toUpperCase()}`);
  };

  if (!me) {
    return (
      <div className="fm-loading">
        ◢ LOADING WALLET ◣
        <div className="fm-loading__bar"><div /></div>
      </div>
    );
  }

  const total = receipts.reduce((s, r) => s + (r.amount || 0), 0);
  const pending = receipts.filter((r) => r.status === 'pending').length;
  const approved = receipts.filter((r) => r.status === 'approved' || r.status === 'paid').length;

  return (
    <>
      {toast && <div className="fm-toast">{toast}</div>}

      {/* Header card */}
      <div className="fm-section fm-expense-hero">
        <div className="fm-expense-hero__top">
          <img src={UI_ICONS.ic_expense} alt="" className="fm-expense-hero__icon" />
          <div>
            <div className="fm-expense-hero__title">报销中心 · Expense Vault</div>
            <div className="fm-expense-hero__sub">手机拍照 · 二维码扫描 · 一键提交</div>
          </div>
        </div>
        <div className="fm-expense-hero__stats">
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">¥{total.toFixed(0)}</div>
            <div className="fm-expense-hero__stat-lbl">累计报销</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{pending}</div>
            <div className="fm-expense-hero__stat-lbl">审批中</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{approved}</div>
            <div className="fm-expense-hero__stat-lbl">已通过</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      {mode === 'home' && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">⚡ 快速提交</div>
          </div>
          <div className="fm-quickactions">
            <button className="fm-bigbtn fm-bigbtn--photo" onClick={openCamera}>
              <img src={UI_ICONS.ic_expense} alt="" />
              <div>
                <div className="fm-bigbtn__title">📸 拍照上传</div>
                <div className="fm-bigbtn__sub">手机相机直接拍发票</div>
              </div>
            </button>
            <button className="fm-bigbtn fm-bigbtn--qr" onClick={startQrScan}>
              <img src={UI_ICONS.ic_qr} alt="" />
              <div>
                <div className="fm-bigbtn__title">📱 扫码识别</div>
                <div className="fm-bigbtn__sub">扫电子发票二维码</div>
              </div>
            </button>
            <button className="fm-bigbtn fm-bigbtn--manual" onClick={() => setMode('form')}>
              <div style={{ fontSize: 28 }}>✍️</div>
              <div>
                <div className="fm-bigbtn__title">手工录入</div>
                <div className="fm-bigbtn__sub">无凭证补录</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* QR scanning animation */}
      {mode === 'scanning' && (
        <div className="fm-section">
          <div className="fm-qrscan">
            <div className="fm-qrscan__frame">
              <div className="fm-qrscan__corner fm-qrscan__corner--tl" />
              <div className="fm-qrscan__corner fm-qrscan__corner--tr" />
              <div className="fm-qrscan__corner fm-qrscan__corner--bl" />
              <div className="fm-qrscan__corner fm-qrscan__corner--br" />
              <div className="fm-qrscan__line" />
              <img src={UI_ICONS.ic_qr} alt="" className="fm-qrscan__qr" />
            </div>
            <div className="fm-qrscan__text">⚡ 识别中… 正在调用区块链上的发票验真</div>
            <button className="fm-qrscan__cancel" onClick={() => setMode('home')}>取消</button>
          </div>
        </div>
      )}

      {/* Form */}
      {mode === 'form' && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">
              {form.source === 'qr_scan' ? '🔗 链上识别结果' : form.source === 'photo' ? '📸 照片识别' : '✍️ 手工填写'}
            </div>
            <button className="fm-link" onClick={() => setMode('home')}>取消</button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            style={{ display: 'none' }}
          />

          {form.photoData && (
            <div className="fm-receipt-preview">
              <img src={form.photoData} alt="receipt" />
              <button className="fm-link" onClick={() => setForm((p) => ({ ...p, photoData: '' }))}>移除</button>
            </div>
          )}

          <div className="fm-formgrid">
            <label className="fm-field">
              <span>商家</span>
              <input value={form.merchant} onChange={(e) => setForm((p) => ({ ...p, merchant: e.target.value }))} placeholder="例：星巴克咖啡" />
            </label>
            <label className="fm-field">
              <span>类型</span>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                <option>餐饮</option>
                <option>交通</option>
                <option>差旅</option>
                <option>办公用品</option>
                <option>培训</option>
                <option>其他</option>
              </select>
            </label>
            <label className="fm-field">
              <span>金额 (CNY)</span>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
            </label>
            <label className="fm-field">
              <span>日期</span>
              <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            </label>
            <label className="fm-field fm-field--full">
              <span>备注</span>
              <input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="可选" />
            </label>
            {form.receiptNo && (
              <label className="fm-field fm-field--full">
                <span>凭证号</span>
                <code style={{ fontSize: 11 }}>{form.receiptNo}</code>
              </label>
            )}
          </div>

          <button className="fm-punch" onClick={submit}>
            ⛓️ 提交 · 链上存证
          </button>
        </div>
      )}

      {/* List */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">🧾 我的报销</div>
          <div className="fm-section__more">{receipts.length} 笔</div>
        </div>
        {receipts.length === 0 && <div className="fm-empty">还没有报销 · 点击上方按钮提交</div>}
        <div className="fm-receipt-list">
          {receipts.map((r) => (
            <div key={r.id} className={`fm-receipt fm-receipt--${r.status}`}>
              <div className="fm-receipt__icon">
                {r.source === 'qr_scan' ? '📱' : r.source === 'photo' ? '📸' : '✍️'}
              </div>
              <div className="fm-receipt__body">
                <div className="fm-receipt__top">
                  <strong>{r.merchant}</strong>
                  <span className="fm-receipt__amount">¥{(r.amount || 0).toFixed(2)}</span>
                </div>
                <div className="fm-receipt__meta">
                  <span>{r.category}</span>
                  <span>·</span>
                  <span>{r.date}</span>
                  {r.receiptNo && <><span>·</span><code>{r.receiptNo}</code></>}
                </div>
              </div>
              <span className={`fm-receipt__status fm-receipt__status--${r.status}`}>
                {{
                  pending:  '审批中',
                  approved: '已通过',
                  rejected: '已拒绝',
                  paid:     '已结算',
                }[r.status] || r.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
