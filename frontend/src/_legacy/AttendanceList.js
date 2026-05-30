import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  format,
  parseISO,
  isToday,
  isYesterday,
  isThisWeek,
  isSameMonth,
} from 'date-fns';
import {
  FaCalendar,
  FaCalendarCheck,
  FaCalendarTimes,
  FaFilter,
  FaSort,
  FaDownload,
  FaPrint,
  FaSearch,
} from 'react-icons/fa';
import '../styles/AttendanceList.css';

function AttendanceList({ attendance, employee, showEmployeeColumn = true }) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  if (!attendance || attendance.length === 0) {
    return (
      <div className="attendance-empty">
        <div className="empty-icon">
          <FaCalendar />
        </div>
        <h3>{t('attendance.list.emptyTitle')}</h3>
        <p>{t('attendance.list.emptyHint')}</p>
      </div>
    );
  }

  const totalDays = attendance.length;
  const presentDays = attendance.filter((a) => a.status === 'Present').length;
  const absentDays = attendance.filter((a) => a.status === 'Absent').length;
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const filteredAttendance = attendance.filter((record) => {
    if (
      searchTerm &&
      !record.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    if (filterStatus && record.status !== filterStatus) return false;

    const recordDate = parseISO(record.date);
    switch (filterDateRange) {
      case 'today':
        return isToday(recordDate);
      case 'yesterday':
        return isYesterday(recordDate);
      case 'thisWeek':
        return isThisWeek(recordDate);
      case 'thisMonth':
        return isSameMonth(recordDate, new Date());
      case 'lastMonth': {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return isSameMonth(recordDate, lastMonth);
      }
      default:
        return true;
    }
  });

  const sortedAttendance = [...filteredAttendance].sort((a, b) => {
    if (sortConfig.key === 'date') {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    } else if (sortConfig.key === 'status') {
      const sA = a.status;
      const sB = b.status;
      if (sA === sB) return 0;
      return sortConfig.direction === 'asc'
        ? sA < sB ? -1 : 1
        : sA > sB ? -1 : 1;
    }
    return 0;
  });

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleExport = () => {
    // CSV header is in current language; status is translated for human readability,
    // employee_id / date stay raw for downstream processing.
    const csvHeader = [
      t('attendance.list.headers.date'),
      t('dashboard.table.employeeId'),
      t('dashboard.table.name'),
      t('attendance.list.headers.status'),
      t('attendance.list.headers.day'),
    ];
    const csvContent = [
      csvHeader,
      ...attendance.map((record) => [
        record.date,
        record.employee_id,
        employee?.full_name || '',
        t(`attendance.status.${record.status}`, record.status),
        format(parseISO(record.date), 'EEEE'),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    // Add UTF-8 BOM so Excel opens Chinese correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${employee?.employee_id || 'all'}_${format(
      new Date(),
      'yyyy-MM-dd'
    )}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort />;
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="attendance-list-container">
      {employee && (
        <div className="attendance-header">
          <div className="employee-profile">
            <div className="profile-avatar">
              {employee.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="profile-info">
              <h3>{employee.full_name}</h3>
              <p className="employee-meta">
                <span className="employee-id">
                  {t('dashboard.table.employeeId')}: {employee.employee_id}
                </span>
                <span className="separator">•</span>
                <span className="employee-dept">
                  {t(`employees.departments.${employee.department}`, employee.department)}
                </span>
              </p>
            </div>
          </div>

          <div className="attendance-stats">
            <div className="stat-card">
              <div className="stat-icon total">
                <FaCalendar />
              </div>
              <div className="stat-details">
                <div className="stat-value">{totalDays}</div>
                <div className="stat-label">{t('attendance.list.stats.totalDays')}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon present">
                <FaCalendarCheck />
              </div>
              <div className="stat-details">
                <div className="stat-value">{presentDays}</div>
                <div className="stat-label">{t('attendance.list.stats.present')}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon absent">
                <FaCalendarTimes />
              </div>
              <div className="stat-details">
                <div className="stat-value">{absentDays}</div>
                <div className="stat-label">{t('attendance.list.stats.absent')}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon rate">
                <div className="rate-circle">{attendanceRate}%</div>
              </div>
              <div className="stat-details">
                <div className="stat-value">{attendanceRate}%</div>
                <div className="stat-label">{t('attendance.list.stats.rate')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="list-controls">
        <div className="search-control">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder={t('attendance.list.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <FaFilter className="filter-icon" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="">{t('attendance.list.allStatus')}</option>
              <option value="Present">{t('attendance.status.Present')}</option>
              <option value="Absent">{t('attendance.status.Absent')}</option>
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              className="filter-select"
            >
              <option value="all">{t('attendance.list.dateRange.all')}</option>
              <option value="today">{t('attendance.list.dateRange.today')}</option>
              <option value="yesterday">{t('attendance.list.dateRange.yesterday')}</option>
              <option value="thisWeek">{t('attendance.list.dateRange.thisWeek')}</option>
              <option value="thisMonth">{t('attendance.list.dateRange.thisMonth')}</option>
              <option value="lastMonth">{t('attendance.list.dateRange.lastMonth')}</option>
            </select>
          </div>

          <div className="action-buttons">
            <button className="btn-action btn-export" onClick={handleExport}>
              <FaDownload />
              {t('attendance.list.export')}
            </button>
            <button className="btn-action btn-print" onClick={handlePrint}>
              <FaPrint />
              {t('attendance.list.print')}
            </button>
          </div>
        </div>
      </div>

      <div className="attendance-summary-bar">
        <div className="summary-info">
          {t('attendance.list.showing', {
            count: sortedAttendance.length,
            total: attendance.length,
          })}
          {searchTerm && t('attendance.list.matching', { term: searchTerm })}
        </div>
        {sortedAttendance.length === 0 && (
          <button
            className="btn-clear-filters"
            onClick={() => {
              setSearchTerm('');
              setFilterStatus('');
              setFilterDateRange('all');
            }}
          >
            {t('attendance.list.clearFilters')}
          </button>
        )}
      </div>

      <div className="attendance-table-container">
        <table className="attendance-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('date')}>
                <div className="sort-header">
                  {t('attendance.list.headers.date')}
                  <span className="sort-icon">{getSortIcon('date')}</span>
                </div>
              </th>
              <th>{t('attendance.list.headers.day')}</th>
              {showEmployeeColumn && <th>{t('attendance.list.headers.employee')}</th>}
              <th className="sortable" onClick={() => handleSort('status')}>
                <div className="sort-header">
                  {t('attendance.list.headers.status')}
                  <span className="sort-icon">{getSortIcon('status')}</span>
                </div>
              </th>
              <th>{t('attendance.list.headers.remarks')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedAttendance.map((record) => {
              const recordDate = parseISO(record.date);
              const isTodayDate = isToday(recordDate);
              return (
                <tr
                  key={`${record.employee_id}-${record.date}`}
                  className={isTodayDate ? 'today-row' : ''}
                >
                  <td>
                    <div className="date-cell">
                      <div className="date-wrapper">
                        <div className="date-day">{format(recordDate, 'dd')}</div>
                        <div className="date-month-year">
                          <div className="date-month">{format(recordDate, 'MMM')}</div>
                          <div className="date-year">{format(recordDate, 'yyyy')}</div>
                        </div>
                      </div>
                      {isTodayDate && (
                        <span className="today-badge">{t('attendance.list.todayBadge')}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="day-cell">
                      <span className="day-name">{format(recordDate, 'EEEE')}</span>
                      <span className="day-short">{format(recordDate, 'EEE')}</span>
                    </div>
                  </td>
                  {showEmployeeColumn && (
                    <td>
                      <div className="employee-cell">
                        <div className="employee-avatar">{record.employee_id.charAt(0)}</div>
                        <div className="employee-info">
                          <div className="employee-id">{record.employee_id}</div>
                          {employee && (
                            <div className="employee-name">{employee.full_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                  )}
                  <td>
                    <span className={`status-badge status-${record.status.toLowerCase()}`}>
                      {record.status === 'Present' ? (
                        <>
                          <FaCalendarCheck className="status-icon" />
                          {t('attendance.status.Present')}
                        </>
                      ) : (
                        <>
                          <FaCalendarTimes className="status-icon" />
                          {t('attendance.status.Absent')}
                        </>
                      )}
                    </span>
                  </td>
                  <td>
                    <div className="remarks-cell">
                      {record.status === 'Present' ? (
                        <span className="remark-present">
                          {t('attendance.list.remarkPresent')}
                        </span>
                      ) : (
                        <span className="remark-absent">
                          {t('attendance.list.remarkAbsent')}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedAttendance.length === 0 && filteredAttendance.length === 0 && (
        <div className="no-results">
          <p>{t('attendance.list.noResults')}</p>
          <button
            className="btn-clear-all"
            onClick={() => {
              setSearchTerm('');
              setFilterStatus('');
              setFilterDateRange('all');
            }}
          >
            {t('attendance.list.clearAll')}
          </button>
        </div>
      )}

      <div className="attendance-footer">
        <div className="footer-summary">
          <div className="summary-item">
            <div className="summary-dot present"></div>
            <span>
              {t('attendance.list.stats.present')}: {presentDays}
            </span>
          </div>
          <div className="summary-item">
            <div className="summary-dot absent"></div>
            <span>
              {t('attendance.list.stats.absent')}: {absentDays}
            </span>
          </div>
          <div className="summary-item">
            <div className="summary-dot total"></div>
            <span>
              {t('attendance.list.stats.totalDays')}: {totalDays}
            </span>
          </div>
        </div>
        <div className="footer-actions">
          <span className="last-updated">
            {t('attendance.list.footer.lastUpdated', {
              datetime: format(new Date(), 'MMM dd, yyyy HH:mm'),
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AttendanceList;
