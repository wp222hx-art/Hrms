import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaUser, FaEnvelope, FaIdBadge, FaBuilding } from 'react-icons/fa';
import '../styles/EmployeeForm.css';

const DEPARTMENT_KEYS = [
  'Engineering',
  'Marketing',
  'Sales',
  'Human Resources',
  'Finance',
  'Operations',
  'IT Support',
  'Research & Development',
  'Customer Support',
  'Product Management',
];

function EmployeeForm({ onSubmit, initialData }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(
    initialData || {
      employee_id: '',
      full_name: '',
      email: '',
      department: '',
    }
  );

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.employee_id.trim()) {
      newErrors.employee_id = t('employees.form.errors.employeeIdRequired');
    } else if (!/^[A-Za-z0-9_-]+$/.test(formData.employee_id)) {
      newErrors.employee_id = t('employees.form.errors.employeeIdInvalid');
    }

    if (!formData.full_name.trim()) {
      newErrors.full_name = t('employees.form.errors.fullNameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('employees.form.errors.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('employees.form.errors.emailInvalid');
    }

    if (!formData.department.trim()) {
      newErrors.department = t('employees.form.errors.departmentRequired');
    }

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      if (!initialData) {
        setFormData({ employee_id: '', full_name: '', email: '', department: '' });
      }
      setErrors({});
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="employee-form-container">
      <div className="form-header">
        <h3>{t('employees.form.title')}</h3>
        <p>{t('employees.form.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="employee-form">
        <div className="form-group">
          <label htmlFor="employee_id" className="form-label">
            <FaIdBadge className="input-icon" />
            {t('employees.form.employeeId')} *
          </label>
          <input
            type="text"
            id="employee_id"
            name="employee_id"
            value={formData.employee_id}
            onChange={handleChange}
            className={`form-input ${errors.employee_id ? 'input-error' : ''}`}
            placeholder={t('employees.form.employeeIdPlaceholder')}
            disabled={isSubmitting}
          />
          {errors.employee_id && <span className="form-error">{errors.employee_id}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="full_name" className="form-label">
            <FaUser className="input-icon" />
            {t('employees.form.fullName')} *
          </label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            className={`form-input ${errors.full_name ? 'input-error' : ''}`}
            placeholder={t('employees.form.fullNamePlaceholder')}
            disabled={isSubmitting}
          />
          {errors.full_name && <span className="form-error">{errors.full_name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">
            <FaEnvelope className="input-icon" />
            {t('employees.form.email')} *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`form-input ${errors.email ? 'input-error' : ''}`}
            placeholder={t('employees.form.emailPlaceholder')}
            disabled={isSubmitting}
          />
          {errors.email && <span className="form-error">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="department" className="form-label">
            <FaBuilding className="input-icon" />
            {t('employees.form.department')} *
          </label>
          <select
            id="department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            className={`select-input ${errors.department ? 'input-error' : ''}`}
            disabled={isSubmitting}
          >
            <option value="">{t('employees.form.departmentPlaceholder')}</option>
            {DEPARTMENT_KEYS.map((dept) => (
              <option key={dept} value={dept}>
                {t(`employees.departments.${dept}`, dept)}
              </option>
            ))}
          </select>
          {errors.department && <span className="form-error">{errors.department}</span>}
        </div>

        <div className="form-actions">
          {initialData ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.history.back()}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? t('employees.form.updating') : t('employees.form.update')}
              </button>
            </>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner-small"></span>
                  {t('employees.form.submitting')}
                </>
              ) : (
                t('employees.form.submit')
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default EmployeeForm;
