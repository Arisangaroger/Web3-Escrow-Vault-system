import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for cookie-based auth
  headers: {
    'Content-Type': 'application/json',
  },
});

// Admin Authentication
export const login = async (email, password) => {
  const response = await client.post('/admin/login', { email, password });
  return response.data;
};

export const logout = async () => {
  const response = await client.post('/admin/logout');
  return response.data;
};

export const getMe = async () => {
  const response = await client.get('/admin/me');
  return response.data;
};

// Disputes
export const getDisputes = async () => {
  const response = await client.get('/admin/disputes');
  return response.data;
};

export const getDisputeDetail = async (dealId) => {
  const response = await client.get(`/admin/disputes/${dealId}`);
  return response.data;
};

export const resolveDispute = async (dealId, outcome) => {
  const response = await client.post(`/admin/disputes/${dealId}/resolve`, {
    outcome,
  });
  return response.data;
};

// History
export const getHistory = async () => {
  const response = await client.get('/admin/disputes/history');
  return response.data;
};

export default client;
