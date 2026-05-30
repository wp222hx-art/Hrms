import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaTrash,
  FaEye,
  FaEnvelope,
  FaBuilding,
  FaUserTie,
  FaSearch,
  FaFilter,
} from 'react-icons/fa';
import '../styles/EmployeeList.css';

function EmployeeList({ employees, onDelete, onView }) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [sortField, setSortField] = useState('employee_id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Extract unique departments (raw English keys) for filter
  const departments = [...new Set(employees.map((emp) => emp.department))].sort();

  const filteredEmployees = employees
    .filter((employee) => {
      const matchesSearch =
        employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDepartment =
        !filterDepartment || employee.department === filterDepartment;

      return matchesSearch && matchesDepartment;
    })
    .sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      return sortDirection === 'asc'
        ? aValue > bValue ? 1 : -1
        : aValue < bValue ? 1 : -1;
    });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (employees.length === 0) {
    return (
      <div className="employee-list-empty">
        <div className="empty-icon">
          <FaUserTie />
        </div>
        <h3>{t('employees.list.emptyTitle')}</h3>
        <p>{t('employees.list.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="employee-list">
      <div className="list-controls">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder={t('employees.list.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              className="clear-search"
              onClick={() => setSearchTerm('')}
              aria-label={t('employees.list.clearSearch')}
            >
              ×
            </button>
          )}
        </div>

        <div className="filter-box">
          <FaFilter className="filter-icon" />
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="filter-select"
          >
            <option value="">{t('employees.list.allDepartments')}</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {t(`employees.departments.${dept}`, dept)}
              </option>
            ))}
          </select>
          {filterDepartment && (
            <button
              className="clear-filter"
              onClick={() => setFilterDepartment('')}
              aria-label={t('employees.list.clearFilter')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="employee-count">
        {t('employees.list.showing', {
          count: filteredEmployees.length,
          total: employees.length,
        })}
      </div>

      <div className="employee-table-container">
        <table className="employee-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('employee_id')}>
                {t('employees.list.headers.employeeId')} {getSortIcon('employee_id')}
              </th>
              <th className="sortable" onClick={() => handleSort('full_name')}>
                {t('employees.list.headers.name')} {getSortIcon('full_name')}
              </th>
              <th className="sortable" onClick={() => handleSort('email')}>
                {t('employees.list.headers.email')} {getSortIcon('email')}
              </th>
              <th className="sortable" onClick={() => handleSort('department')}>
                {t('employees.list.headers.department')} {getSortIcon('department')}
              </th>
              <th>{t('employees.list.headers.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee) => (
              <tr key={employee.employee_id}>
                <td>
                  <div className="employee-id-cell">
                    <span className="id-badge">{employee.employee_id}</span>
                  </div>
                </td>
                <td>
                  <div className="employee-name-cell">
                    <div className="avatar-placeholder">
                      {employee.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="name-info">
                      <span className="full-name">{employee.full_name}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="email-cell">
                    <FaEnvelope className="email-icon" />
                    <a href={`mailto:${employee.email}`} className="email-link">
                      {employee.email}
                    </a>
                  </div>
                </td>
                <td>
                  <div className="department-cell">
                    <FaBuilding className="department-icon" />
                    <span className="department-name">
                      {t(`employees.departments.${employee.department}`, employee.department)}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    {onView && (
                      <button
                        className="btn-action btn-view"
                        onClick={() => onView(employee.employee_id)}
                        title={t('employees.list.viewTitle')}
                      >
                        <FaEye />
                      </button>
                    )}
                    <button
                      className="btn-action btn-delete"
                      onClick={() => onDelete(employee.employee_id)}
                      title={t('employees.list.deleteTitle')}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredEmployees.length === 0 && (
        <div className="no-results">
          <p>{t('employees.list.noResults')}</p>
          <button
            className="btn-clear-filters"
            onClick={() => {
              setSearchTerm('');
              setFilterDepartment('');
            }}
          >
            {t('employees.list.clearFilters')}
          </button>
        </div>
      )}
    </div>
  );
}

export default EmployeeList;
