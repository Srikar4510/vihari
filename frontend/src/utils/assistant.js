import { API_URL } from '../config';
const API = API_URL;

// Sends one message to the rule-based assistant. The token is optional: with it the
// assistant can answer about the user's own trips and tour bookings.
// Returns { messages, context }.
export const askAssistant = async (message, context) => {
  const res = await fetch(`${API}/api/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('token') ? { 'auth-token': localStorage.getItem('token') } : {}),
    },
    body: JSON.stringify({ message, context }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'The assistant is unavailable right now.');
  return json;
};
