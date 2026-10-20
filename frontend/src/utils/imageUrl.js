import { API_URL } from '../config';
const API_BASE = API_URL;

// Images are either full URLs (sample data) or paths of files uploaded to the backend.
export const imageUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}/${path.replace(/\\/g, '/').replace(/^.*?backend\//, '')}`;
};
