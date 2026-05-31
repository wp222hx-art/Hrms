import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Employee APIs
export const employeeAPI = {
  getAll: () => api.get('/employees/'),
  getById: (employeeId) => api.get(`/employees/${employeeId}`),
  create: (employeeData) => api.post('/employees/', employeeData),
  delete: (employeeId) => api.delete(`/employees/${employeeId}`),
};

// Attendance APIs
export const attendanceAPI = {
  mark: (attendanceData) => api.post('/attendance/', attendanceData),
  getByEmployee: (employeeId) => api.get(`/attendance/employee/${employeeId}`),
  getByDate: (date) => api.get(`/attendance/date/${date}`),
};

export default api;