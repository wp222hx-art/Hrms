import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaPrint } from 'react-icons/fa';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

export default function Payslip({ line, tenant, month, onClose }) {
  const { t } = useTranslation();
  const fmt = (n) => `${tenant.currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const empStat = line.employeeStatutory || [];
  const erStat = line.employerStatutory || [];
  const empTotal = empStat.reduce((s, x) => s + x.amount, 0);

  const handlePrint = () => window.print();

  return (
    <Modal
      open
      title={t('payroll.payslip.title')}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
          <Button variant="primary" onClick={handlePrint}>
            <FaPrint /> <span style={{ marginLeft: 6 }}>{t('payroll.payslip.downloadPdf')}</span>
          </Button>
        </>
      }
    >
      <div className="payslip" id="payslip-print">
        <div className="payslip__head">
          <div>
            <h3 style={{ margin: 0 }}>{tenant.name}</h3>
            <small>{t('payroll.payslip.subtitle', { schema: tenant.statutorySchema?.toUpperCase() })}</small>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600 }}>{t('payroll.payslip.for')}: {month}</div>
            <small style={{ color: 'var(--text-3)' }}>{line.employeeId}</small>
          </div>
        </div>

        <div className="payslip__name">
          <strong>{line.employeeName}</strong>
          <span>{t(`departments.${line.department}`, line.department)}</span>
        </div>

        <table className="payslip__table">
          <thead><tr><th colSpan={2}>{t('payroll.payslip.earnings')}</th></tr></thead>
          <tbody>
            <tr><td>{t('payroll.payslip.baseSalary')}</td><td>{fmt(line.gross)}</td></tr>
            <tr className="payslip__sub"><td>{t('payroll.headers.gross')}</td><td>{fmt(line.gross)}</td></tr>
          </tbody>
        </table>

        <table className="payslip__table">
          <thead><tr><th colSpan={2}>{t('payroll.payslip.deductions')}</th></tr></thead>
          <tbody>
            {empStat.map((s) => (
              <tr key={s.code}><td>{s.label} ({s.rate})</td><td>− {fmt(s.amount)}</td></tr>
            ))}
            <tr><td>{t('payroll.payslip.tax')}</td><td>− {fmt(line.tax)}</td></tr>
            <tr className="payslip__sub"><td>Total Deductions</td><td>− {fmt(empTotal + line.tax)}</td></tr>
          </tbody>
        </table>

        <table className="payslip__table">
          <thead><tr><th colSpan={2}>{t('payroll.payslip.employer')}</th></tr></thead>
          <tbody>
            {erStat.length === 0 ? (
              <tr><td colSpan={2} style={{ color: 'var(--text-3)' }}>—</td></tr>
            ) : erStat.map((s) => (
              <tr key={s.code}><td>{s.label} ({s.rate})</td><td>{fmt(s.amount)}</td></tr>
            ))}
          </tbody>
        </table>

        <div className="payslip__net">
          <span>{t('payroll.payslip.netPay')}</span>
          <strong>{fmt(line.net)}</strong>
        </div>
      </div>

      <style>{`
        .payslip { font-size: var(--fs-13); }
        .payslip__head {
          display: flex; justify-content: space-between; gap: var(--sp-3);
          padding-bottom: var(--sp-3); border-bottom: 2px solid var(--text-1);
          margin-bottom: var(--sp-3); flex-wrap: wrap;
        }
        .payslip__name {
          display: flex; gap: var(--sp-3); align-items: baseline;
          padding: var(--sp-2) 0; flex-wrap: wrap;
        }
        .payslip__name span { color: var(--text-3); font-size: var(--fs-12); }
        .payslip__table {
          width: 100%; margin-bottom: var(--sp-3);
          border-collapse: collapse;
        }
        .payslip__table th {
          text-align: left;
          font-size: var(--fs-12); color: var(--text-3);
          text-transform: uppercase; letter-spacing: 0.04em;
          padding: var(--sp-2) 0; border-bottom: 1px solid var(--border);
        }
        .payslip__table td { padding: 6px 0; border-bottom: 1px dashed var(--border); }
        .payslip__table td:last-child { text-align: right; font-feature-settings: "tnum"; }
        .payslip__sub td { font-weight: 700; border-bottom: 0; }
        .payslip__net {
          display: flex; justify-content: space-between; align-items: baseline;
          padding: var(--sp-3); margin-top: var(--sp-3);
          background: var(--brand-50); color: var(--brand-700);
          border-radius: var(--r-2); border: 1px solid var(--brand-200);
        }
        .payslip__net strong { font-size: var(--fs-22); }
        @media print {
          body * { visibility: hidden; }
          #payslip-print, #payslip-print * { visibility: visible; }
          #payslip-print { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
        }
      `}</style>
    </Modal>
  );
}
