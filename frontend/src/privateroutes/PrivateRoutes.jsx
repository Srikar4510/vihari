import React from 'react';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

// Login page for each kind of account.
const LOGIN = { user: '/login', agent: '/agentLogin', admin: '/admin/login' };

// Renders the page only for the right kind of account (traveller, partner or admin).
// The server checks the token again on every request; this just routes people correctly.
const PrivateRoute = ({ children, role }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to={LOGIN[role]} replace />;
  let payload;
  try {
    payload = jwtDecode(token);
  } catch {
    return <Navigate to={LOGIN[role]} replace />;
  }
  return payload[role] ? children : <Navigate to={LOGIN[role]} replace />;
};

export default PrivateRoute;
