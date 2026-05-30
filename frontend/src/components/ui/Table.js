import React from 'react';
import './Table.css';

/**
 * <DataTable
 *    columns={[{key, header, render?, width?, mobileLabel?, hideOnMobile?}]}
 *    rows={[]}
 *    rowKey="id"
 *    empty="No data"
 * />
 *
 * On mobile (<=640px) renders cards instead of table rows.
 */
export default function DataTable({ columns, rows, rowKey = 'id', empty = 'No data' }) {
  if (!rows || rows.length === 0) {
    return <div className="table-empty">{empty}</div>;
  }
  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={c.hideOnMobile ? 'th--hide-mobile' : ''}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[rowKey]}>
                {columns.map((c) => (
                  <td key={c.key} className={c.hideOnMobile ? 'td--hide-mobile' : ''}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <div className="table-cards">
        {rows.map((row) => (
          <div key={row[rowKey]} className="table-card">
            {columns.map((c) => (
              <div key={c.key} className="table-card__row">
                <span className="table-card__label">{c.mobileLabel || c.header}</span>
                <span className="table-card__value">
                  {c.render ? c.render(row) : row[c.key]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
