import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  FaCalendarAlt,
  FaUser,
  FaCheckCircle,
  FaTimesCircle,
  FaSave,
} from 'react-icons/fa';
import { attendanceAPI } from '../services/api';
import '../styles/AttendanceForm.css';

function AttendanceForm({ employees, onSuccess }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    employee_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'Present',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState([]);

  useEffect(() => {
    const fetchTodayAttendance = async () => {
      if (formData.date) {
        try {
          const response = await attendanceAPI.getByDate(formData.date);
          setTodayAttendance(response.data);
        } catch (error) {
          console.error("Failed to fetch today's attendance:", error);
        }
      }
    };
    fetchTodayAttendance();
  }, [formData.date]);

  const getAvailableEmployees = () => {
    const markedEmployeeIds = todayAttendance.map((r) => r.employee_id);
    return employees.filter((e) => !markedEmployeeIds.includes(e.employee_id));
  };

  const availableEmployees = getAvailableEmployees();

  const validateForm = () => {
    const newErrors = {};
    if (!formData.employee_id) newErrors.employee_id = t('attendance.form.errors.employeeRequired');
    if (!formData.date) newErrors.date = t('attendance.form.errors.dateRequired');
    if (!formData.status) newErrors.status = t('attendance.form.errors.statusRequired');
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const alreadyMarked = todayAttendance.find(
      (r) => r.employee_id === formData.employee_id
    );
    if (alreadyMarked) {
      toast.error(t('attendance.alreadyMarked'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSuccess(formData);
      setFormData({
        employee_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'Present',
      });
      setErrors({});
      toast.success(t('attendance.markSuccess'));
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error(error.response?.data?.detail || t('attendance.markFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickMark = (status) => {
    if (!formData.employee_id) {
      toast.error(t('attendance.selectFirst'));
      return;
    }
    const quickFormData = { ...formData, status };
    handleSubmit({ preventDefault: () => {} }, quickFormData);
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees.find((e) => e.employee_id === employeeId);
    return employee ? `${employee.full_name} (${employee.employee_id})` : '';
  };

  return (
    <div className="attendance-form-container">
      <div className="form-header">
        <h3>
          <FaCalendarAlt className="header-icon" />
          {t('attendance.form.title')}
        </h3>
        <p>{t('attendance.form.subtitle')}</p>
      </div>

      <div className="attendance-stats">
        <div className="stat-item">
          <span className="stat-label">{t('attendance.form.totalEmployees')}</span>
          <span className="stat-value">{employees.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">{t('attendance.form.markedToday')}</span>
          <span className="stat-value">{todayAttendance.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">{t('attendance.form.remaining')}</span>
          <span className="stat-value">{availableEmployees.length}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="attendance-form">
        <div className="form-group">
          <label htmlFor="employee_id" className="form-label">
            <FaUser className="input-icon" />
            {t('attendance.form.selectEmployee')} *
          </label>
          <select
            id="employee_id"
            name="employee_id"
            value={formData.employee_id}
            onChange={handleChange}
            className={`select-input ${errors.employee_id ? 'input-error' : ''}`}
            disabled={isSubmitting || availableEmployees.length === 0}
          >
            <option value="">{t('attendance.selectEmployeePrompt')}</option>
            {availableEmployees.map((employee) => (
              <option key={employee.employee_id} value={employee.employee_id}>
                {employee.full_name} ({employee.employee_id}) -{' '}
                {t(`employees.departments.${employee.department}`, employee.department)}
              </option>
            ))}
          </select>
          {errors.employee_id && <span className="form-error">{errors.employee_id}</span>}
          {availableEmployees.length === 0 && (
            <div className="form-warning">{t('attendance.form.allMarked')}</div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="date" className="form-label">
              <FaCalendarAlt className="input-icon" />
              {t('attendance.form.date')} *
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={`form-input ${errors.date ? 'input-error' : ''}`}
              disabled={isSubmitting}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
            {errors.date && <span className="form-error">{errors.date}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="status" className="form-label">
              {t('attendance.form.status')} *
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className={`select-input ${errors.status ? 'input-error' : ''}`}
              disabled={isSubmitting}
            >
              <option value="Present">{t('attendance.status.Present')}</option>
              <option value="Absent">{t('attendance.status.Absent')}</option>
            </select>
            {errors.status && <span className="form-error">{errors.status}</span>}
          </div>
        </div>

        {formData.employee_id && (
          <div className="selected-employee-info">
            <div className="info-header">
              <FaUser className="info-icon" />
              <span>{t('attendance.form.selectedEmployee')}</span>
            </div>
            <div className="employee-details">
              <p className="employee-name">{getEmployeeName(formData.employee_id)}</p>
              <div className="quick-actions">
                <button
                  type="button"
                  className="btn-quick-present"
                  onClick={() => handleQuickMark('Present')}
                  disabled={isSubmitting}
                >
                  <FaCheckCircle />
                  {t('attendance.form.markPresent')}
                </button>
                <button
                  type="button"
                  className="btn-quick-absent"
                  onClick={() => handleQuickMark('Absent')}
                  disabled={isSubmitting}
                >
                  <FaTimesCircle />
                  {t('attendance.form.markAbsent')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting || availableEmployees.length === 0}
          >
            {isSubmitting ? (
              <>
                <div className="spinner-small"></div>
                {t('attendance.form.submitting')}
              </>
            ) : (
              <>
                <FaSave />
                {t('attendance.form.submit')}
              </>
            )}
          </button>
        </div>
      </form>

      {todayAttendance.length > 0 && (
        <div className="today-attendance-preview">
          <h4>
            {t('attendance.form.todayPreview', {
              date: format(new Date(formData.date), 'MMM dd, yyyy'),
            })}
          </h4>
          <div className="attendance-summary">
            <div className="summary-item present">
              <span className="summary-count">
                {todayAttendance.filter((a) => a.status === 'Present').length}
              </span>
              <span className="summary-label">{t('attendance.status.Present')}</span>
            </div>
            <div className="summary-item absent">
              <span className="summary-count">
                {todayAttendance.filter((a) => a.status === 'Absent').length}
              </span>
              <span className="summary-label">{t('attendance.status.Absent')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AttendanceForm;
