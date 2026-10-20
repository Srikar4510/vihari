import { API_URL } from '../config';
// Calls for the logged-in traveller's profile, trips and saved co-travellers.
const API = API_URL;

const request = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'auth-token': localStorage.getItem('token') || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
  return json;
};

export const getProfile = () => request('GET', '/profile');
export const updateProfile = (data) => request('PUT', '/profile', data);
export const getTrips = () => request('GET', '/mytrips');
export const getTours = () => request('GET', '/mytours');
export const getTravellers = () => request('GET', '/travellers');
export const addTraveller = (t) => request('POST', '/travellers', t);
export const updateTraveller = (id, t) => request('PUT', `/travellers/${id}`, t);
export const deleteTraveller = (id) => request('DELETE', `/travellers/${id}`);
