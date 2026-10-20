// Backend address. Set REACT_APP_API_URL in frontend/.env (local) or in the hosting dashboard
// (e.g. https://vihari-api.onrender.com). Trailing slashes are removed.
export const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
