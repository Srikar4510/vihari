import { API_URL } from '../config';
const SERVER = API_URL;
const API = `${SERVER}/api/agent`;

// Login page for whichever console the user is in (shared screens run in both).
const loginPage = () => (window.location.pathname.startsWith('/admindb') ? '/admin/login' : '/agentLogin');

// Calls the partner API with the partner (or admin) token. `body` may be a plain object (sent as JSON)
// or FormData (for photo uploads). Throws an Error with the server's message on failure;
// an expired or invalid session sends the partner back to the login page.
export const request = async (method, path, body, base = API) => {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'auth-token': localStorage.getItem('token') || '',
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('agentId');
    window.location.assign(loginPage());
  }
  if (!res.ok) {
    const error = new Error(json.error || json.message || 'Something went wrong. Please try again.');
    error.status = res.status;
    throw error;
  }
  return json;
};

export const partnerApi = {
  me: () => request('GET', '/me'),
  updateMe: (data) => request('PUT', '/me', data),
  dashboard: () => request('GET', '/dashboard'),

  busTypes: () => request('GET', '/bustypes'),
  buses: () => request('GET', '/buses'),
  bus: (id) => request('GET', `/buses/${id}`),
  addBus: (form) => request('POST', '/buses', form),
  editBus: (id, form) => request('PUT', `/buses/${id}`, form),
  deleteBus: (id) => request('DELETE', `/buses/${id}`),
  busBookings: (id) => request('GET', `/buses/${id}/bookings`),

  tours: () => request('GET', '/tours'),
  tour: (id) => request('GET', `/tours/${id}`),
  addTour: (form) => request('POST', '/tours', form),
  editTour: (id, form) => request('PUT', `/tours/${id}`, form),
  deleteTour: (id) => request('DELETE', `/tours/${id}`),
  tourBookings: (id) => request('GET', `/tours/${id}/bookings`),

  addPlace: (tourId, form) => request('POST', `/tours/${tourId}/places`, form),
  editPlace: (id, form) => request('PUT', `/places/${id}`, form),
  deletePlace: (id) => request('DELETE', `/places/${id}`),
};

export const signOutPartner = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('agentId');
};

const ADMIN_API = `${SERVER}/api/admin`;
const admin = (method, path, body) => request(method, path, body, ADMIN_API);

export const adminApi = {
  login: async (email, password) => {
    const res = await fetch(`${SERVER}/adminLogin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json().catch(() => ({ success: false, error: 'Could not reach the server' }));
  },
  me: () => admin('GET', '/me'),
  dashboard: () => admin('GET', '/dashboard'),
  users: () => admin('GET', '/users'),
  addUser: (data) => admin('POST', '/users', data),
  editUser: (id, data) => admin('PUT', `/users/${id}`, data),
  deleteUser: (id) => admin('DELETE', `/users/${id}`),
  agents: () => admin('GET', '/agents'),
  approveAgent: (id) => admin('PUT', `/agents/${id}/approve`),
  rejectAgent: (id) => admin('DELETE', `/agents/${id}`),
  blockAgent: (id) => admin('PUT', `/agents/${id}/block`),
  unblockAgent: (id) => admin('PUT', `/agents/${id}/unblock`),
  // Opens a partner's document in a new tab (the file needs the admin token, so fetch it first).
  // The tab is opened straight away (inside the click) so pop-up blockers allow it.
  openDocument: async (id) => {
    const tab = window.open('', '_blank');
    try {
      const res = await fetch(`${ADMIN_API}/agents/${id}/document`, { headers: { 'auth-token': localStorage.getItem('token') || '' } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not open the document');
      const url = URL.createObjectURL(await res.blob());
      if (tab) tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      if (tab) tab.close();
      throw error;
    }
  },
  recipients: () => admin('GET', '/announcements'),
  announce: (data) => admin('POST', '/announcements', data),
};
