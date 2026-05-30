import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { employeeAPI } from '../services/api';
import EmployeeForm from '../components/EmployeeForm';
import EmployeeList from '../components/EmployeeList';
import '../styles/EmployeeManagement.css';

function EmployeeManagement() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeAPI.getAll();
      setEmployees(response.data);
      setError(null);
    } catch (err) {
      setError(t('employees.fetchFailed'));
      toast.error(t('employees.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleAddEmployee = async (employeeData) => {
    try {
      await employeeAPI.create(employeeData);
      toast.success(t('employees.addSuccess'));
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('employees.addFailed'));
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (window.confirm(t('employees.deleteConfirm'))) {
      try {
        await employeeAPI.delete(employeeId);
        toast.success(t('employees.deleteSuccess'));
        fetchEmployees();
      } catch (err) {
        toast.error(err.response?.data?.detail || t('employees.deleteFailed'));
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>{t('employees.loading')}</p>
      </div>
    );
  }

  return (
    <div className="employee-management">
      <div className="page-header">
        <h2>{t('employees.pageTitle')}</h2>
        <p>{t('employees.pageSubtitle')}</p>
      </div>

      <div className="content-grid">
        <div className="form-section">
          <EmployeeForm onSubmit={handleAddEmployee} />
        </div>

        <div className="list-section">
          {error ? (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={fetchEmployees} className="btn-retry">
                {t('common.retry')}
              </button>
            </div>
          ) : employees.length === 0 ? (
            <div className="empty-state">
              <p>{t('employees.emptyState')}</p>
            </div>
          ) : (
            <EmployeeList
              employees={employees}
              onDelete={handleDeleteEmployee}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default EmployeeManagement;
