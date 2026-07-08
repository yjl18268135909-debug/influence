import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const AUTH_STORAGE_KEY = 'shopfluence_current_user';

const roleCodeByName: Record<string, string> = {
  老板: 'owner',
  财务: 'finance',
  运营: 'operator',
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// 请求拦截器 - 把当前登录角色传给后端做权限判断
api.interceptors.request.use((config) => {
  try {
    const rawUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (rawUser) {
      const user = JSON.parse(rawUser);
      const roleCode = roleCodeByName[user.role] || 'operator';
      config.headers = config.headers || {};
      (config.headers as any)['X-Shopfluence-Role'] = roleCode;
      (config.headers as any)['X-Shopfluence-User'] = encodeURIComponent(user.username || user.name || '');
    }
  } catch (error) {
    console.warn('读取当前用户权限失败:', error);
  }
  return config;
});

// 响应拦截器 - 返回完整响应对象
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// 达人相关API
export const accountApi = {
  login: (data: { username: string; password: string }) => api.post('/auth/login', data),
  getAll: () => api.get('/accounts'),
  create: (data: any) => api.post('/accounts', data),
  update: (id: number | string, data: any) => api.put(`/accounts/${id}`, data),
  delete: (id: number | string) => api.delete(`/accounts/${id}`),
};

export const backupApi = {
  exportAll: () => api.get('/export/all', { responseType: 'blob' }),
};

// 达人相关API
export const influencerApi = {
  getAll: (params?: any) => api.get('/influencers', { params }),
  create: (data: any) => api.post('/influencers', data),
  update: (id: number | string, data: any) => api.put(`/influencers/${id}`, data),
  delete: (id: number | string) => api.delete(`/influencers/${id}`),
};

// 商家相关API
export const merchantApi = {
  getAll: (params?: any) => api.get('/merchants', { params }),
  create: (data: any) => api.post('/merchants', data),
  update: (id: number, data: any) => api.put(`/merchants/${id}`, data),
  delete: (id: number) => api.delete(`/merchants/${id}`),
};

// 直播场次相关API
export const liveSessionApi = {
  getAll: (params?: any) => api.get('/live-sessions', { params }),
  create: (data: any) => api.post('/live-sessions', data),
  update: (id: number | string, data: any) => api.put(`/live-sessions/${id}`, data),
  delete: (id: number | string) => api.delete(`/live-sessions/${id}`),
};

// 订单相关API
export const orderApi = {
  getAll: (params?: any) => api.get('/orders', { params }),
  create: (data: any) => api.post('/orders', data),
};

// 支出相关API
export const expenseApi = {
  getAll: (params?: any) => api.get('/expenses', { params }),
  create: (data: any) => api.post('/expenses', data),
};

// 成本相关API
export const costApi = {
  getAll: (params?: any) => api.get('/costs', { params }),
  create: (data: any) => api.post('/costs', data),
};

// 收入相关API
export const incomeApi = {
  getAll: (params?: any) => api.get('/income', { params }),
  create: (data: any) => api.post('/income', data),
};

// 应收款项相关API
export const travelReceivableApi = {
  getAll: () => api.get('/travel-receivables'),
  create: (data: any) => api.post('/travel-receivables', data),
  update: (id: number | string, data: any) => api.put(`/travel-receivables/${id}`, data),
  delete: (id: number | string) => api.delete(`/travel-receivables/${id}`),
};

// 工作推进相关API
export const workProgressApi = {
  getAll: (params?: any) => api.get('/work-progress', { params }),
  create: (data: any) => api.post('/work-progress', data),
  update: (id: number | string, data: any) => api.put(`/work-progress/${id}`, data),
  delete: (id: number | string) => api.delete(`/work-progress/${id}`),
};

// 汇率相关API
export const exchangeRateApi = {
  getSgdToCny: () => api.get('/exchange-rate', { params: { from: 'SGD', to: 'CNY' } }),
};

// 报表相关API
export const reportApi = {
  getSummary: (params?: any) => api.get('/reports/summary', { params }),
  getInfluencerRanking: (params?: any) => api.get('/reports/influencer-ranking', { params }),
  getPlatformComparison: (params?: any) => api.get('/reports/platform-comparison', { params }),
  getMonthlyTrend: (params?: any) => api.get('/reports/monthly-trend', { params }),
};

export default api;
