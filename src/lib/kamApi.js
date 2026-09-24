const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || 'Request failed');
  }

  if (response.status === 204) return null;
  return response.json();
}

export const kamApi = {
  getDashboard: () => request('/dashboard'),
  getAccounts: () => request('/accounts'),
  createAccount: (payload) => request('/accounts', { method: 'POST', body: JSON.stringify(payload) }),
  getSuppliers: () => request('/suppliers'),
  createSupplier: (payload) => request('/suppliers', { method: 'POST', body: JSON.stringify(payload) }),
  getCampaigns: () => request('/campaigns'),
  createCampaign: (payload) => request('/campaigns', { method: 'POST', body: JSON.stringify(payload) }),
  updateCampaign: (payload) => request('/campaigns', { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCampaign: (id) => request('/campaigns', { method: 'DELETE', body: JSON.stringify({ id }) }),
  getQuickTasks: () => request('/quick-tasks'),
  createQuickTask: (payload) => request('/quick-tasks', { method: 'POST', body: JSON.stringify(payload) }),
};
