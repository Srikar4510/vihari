import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../utils/partnerApi';
import '../../components/CSS/Partner.css';

// Separate sign-in for the admin console. Admin accounts live in their own collection,
// so a traveller or partner login can never open the console.
const AdminLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Admin sign in · Vihari';
    return () => { document.title = 'Vihari'; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.login(form.email.trim(), form.password);
      if (!res.success) throw new Error(res.error || 'Invalid email or password');
      localStorage.setItem('token', res.authToken);
      localStorage.removeItem('agentId');
      navigate('/admindb/adminhome');
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Could not reach the server. Please try again.' : err.message);
      setLoading(false);
    }
  };

  return (
    <div className="adm-login">
      <div className="adm-login-bg" aria-hidden="true"><span /><span /><span /></div>
      <form className="adm-login-card" onSubmit={submit}>
        <div className="adm-login-mark"><i className="fa fa-user-shield" /></div>
        <h1>Admin console</h1>
        <p>Sign in to manage travellers, partners, buses and tours.</p>

        <label className="pt-field">
          <span className="pt-label">Email</span>
          <input type="email" autoComplete="username" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setError(''); }} required autoFocus placeholder="admin@example.com" />
        </label>
        <label className="pt-field">
          <span className="pt-label">Password</span>
          <span className="adm-pass">
            <input type={show ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setError(''); }} required />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              <i className={show ? 'fa fa-eye-slash' : 'fa fa-eye'} />
            </button>
          </span>
        </label>

        {error && <div className="pt-form-error" role="alert"><i className="fa fa-exclamation-circle" /> {error}</div>}
        <button type="submit" className="pt-btn pt-btn--primary adm-login-btn" disabled={loading}>
          {loading ? <><span className="pt-spinner" /> Signing in…</> : <>Sign in <i className="fa fa-arrow-right" /></>}
        </button>
        <div className="adm-login-links">
          <Link to="/"><i className="fa fa-arrow-left" /> Back to website</Link>
          <Link to="/agentLogin">Partner login</Link>
        </div>
      </form>
    </div>
  );
};

export default AdminLogin;
