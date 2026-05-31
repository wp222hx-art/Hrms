import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { attendanceAPI, employeeAPI } from '../services/api';
import AttendanceForm from '../components/AttendanceForm';
import AttendanceList from '../components/AttendanceList';
import '../styles/AttendanceManagement.css';

function AttendanceManagement() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      setEmployees(response.data);
    } catch (err) {
      toast.error(t('attendance.fetchFailedEmployees'));
    }
  };

  const fetchAttendance = async (employeeId) => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const response = await attendanceAPI.getByEmployee(employeeId);
      setAttendance(response.data);
    } catch (err) {
      toast.error(t('attendance.fetchFailedRecords'));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (attendanceData) => {
    try {
      await attendanceAPI.mark(attendanceData);
      toast.success(t('attendance.markSuccess'));
      if (attendanceData.employee_id === selectedEmployee) {
        fetchAttendance(selectedEmployee);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || t('attendance.markFailed'));
    }
  };

  const handleEmployeeSelect = (employeeId) => {
    setSelectedEmployee(employeeId);
    fetchAttendance(employeeId);
  };

  return (
    <div className="attendance-management">
      <div className="page-header">
        <h2>{t('attendance.pageTitle')}</h2>
        <p>{t('attendance.pageSubtitle')}</p>
      </div>

      <div className="content-grid">
        <div className="form-section">
          <AttendanceForm employees={employees} onSuccess={handleMarkAttendance} />
        </div>

        <div className="records-section">
          <div className="employee-selector">
            <label htmlFor="employee-select">{t('attendance.selectEmployee')}</label>
            <select
              id="employee-select"
              value={selectedEmployee}
              onChange={(e) => handleEmployeeSelect(e.target.value)}
              className="select-input"
            >
              <option value="">{t('attendance.selectEmployeePrompt')}</option>
              {employees.map((emp) => (
                <option key={emp.employee_id} value={emp.employee_id}>
                  {emp.full_name} ({emp.employee_id})
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>{t('attendance.loading')}</p>
            </div>
          ) : selectedEmployee && attendance.length === 0 ? (
            <div className="empty-state">
              <p>{t('attendance.emptyForEmployee')}</p>
            </div>
          ) : selectedEmployee ? (
            <AttendanceList
              attendance={attendance}
              employee={employees.find((e) => e.employee_id === selectedEmployee)}
            />
          ) : (
            <div className="select-prompt">
              <p>{t('attendance.selectEmployeeToView')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttendanceManagement;
