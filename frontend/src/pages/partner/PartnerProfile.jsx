import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { partnerApi } from '../../utils/partnerApi';
import {
  PartnerLayout, Field, LoadingBlock, ErrorBlock, AnimatedNumber, usePartnerUI, initials,
} from '../../components/Partner/PartnerUI';

const PartnerProfile = () => {
  const { toast } = usePartnerUI();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setError('');
    partnerApi.me()
      .then((r) => { setData(r); setForm({ agentName: r.agent.agentName, email: r.agent.email }); })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const dirty = data && form && (form.agentName !== data.agent.agentName || form.email !== data.agent.email);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const r = await partnerApi.updateMe(form);
      setData((d) => ({ ...d, agent: { ...d.agent, ...r.agent } }));
      setForm({ agentName: r.agent.agentName, email: r.agent.email });
      toast('Profile saved');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const agent = data?.agent;
  const since = agent && new Date(agent.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <PartnerLayout title="Profile" subtitle="Your agency details as travellers and the Vihari team see them.">
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!data && !error && <LoadingBlock rows={2} />}
      {data && (
        <div className="pt-profile">
          <section className="pt-card pt-profile-card">
            <div className="pt-profile-cover" />
            <div className="pt-profile-avatar">{initials(agent.agentName)}</div>
            <h2>{agent.agentName}</h2>
            <p>{agent.email}</p>
            <span className="pt-pill pt-pill--ok"><i className="fa fa-check-circle" /> Approved partner</span>
            <div className="pt-profile-stats">
              <Link to="/agent/allbuses"><b><AnimatedNumber value={data.stats.buses} /></b><small>Buses</small></Link>
              <Link to="/agent/alltours"><b><AnimatedNumber value={data.stats.tours} /></b><small>Tours</small></Link>
            </div>
            <ul className="pt-profile-facts">
              <li><i className="far fa-calendar" /> Partner since {since}</li>
              <li><i className="fa fa-file-alt" /> Registration document {agent.hasDocument ? 'on file' : 'missing'}</li>
            </ul>
          </section>

          <div className="pt-profile-side">
            <form className="pt-card pt-form-section" onSubmit={save}>
              <h2><i className="fa fa-building" /> Agency details</h2>
              <Field label="Agency name" required>
                <input value={form.agentName} onChange={(e) => { setForm({ ...form, agentName: e.target.value }); setFormError(''); }} required minLength={2} maxLength={60} />
              </Field>
              <Field label="Login email" required hint="You use this to log in to the partner portal.">
                <input type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFormError(''); }} required />
              </Field>
              {formError && <div className="pt-form-error" role="alert"><i className="fa fa-exclamation-circle" /> {formError}</div>}
              <div className="pt-form-actions">
                <button type="button" className="pt-btn pt-btn--ghost" disabled={!dirty || saving} onClick={() => setForm({ agentName: agent.agentName, email: agent.email })}>Reset</button>
                <button type="submit" className="pt-btn pt-btn--primary" disabled={!dirty || saving}>
                  {saving ? <><span className="pt-spinner" /> Saving…</> : <><i className="fa fa-check" /> Save changes</>}
                </button>
              </div>
            </form>

            <section className="pt-card pt-form-section pt-help">
              <h2><i className="fa fa-life-ring" /> Need help?</h2>
              <p>To change your password or registration document, contact the Vihari team with your agency name and login email.</p>
              <Link to="/about#contact" className="pt-btn pt-btn--soft"><i className="fa fa-envelope" /> Contact support</Link>
            </section>
          </div>
        </div>
      )}
    </PartnerLayout>
  );
};

export default PartnerProfile;
