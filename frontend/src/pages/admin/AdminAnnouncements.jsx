import { useEffect, useState } from 'react';
import { adminApi } from '../../utils/partnerApi';
import { PartnerLayout, Field, LoadingBlock, ErrorBlock, usePartnerUI } from '../../components/Partner/PartnerUI';

const TEMPLATES = [
  { label: 'Festive offer', subject: 'Festive season trips are open on Vihari', message: 'Hi there,\n\nFestive season is here! Book your bus tickets and curated tours early to get the best seats.\n\nHappy travels,\nTeam Vihari' },
  { label: 'New routes', subject: 'New bus routes on Vihari', message: 'Hi there,\n\nWe have added new bus routes and operators. Search your next trip on Vihari and pick your seat in seconds.\n\nTeam Vihari' },
  { label: 'Maintenance', subject: 'Scheduled maintenance', message: 'Hi there,\n\nVihari will be briefly unavailable for scheduled maintenance. Existing bookings and tickets are not affected.\n\nThank you for your patience,\nTeam Vihari' },
];

const AdminAnnouncements = () => {
  const { toast, confirm } = usePartnerUI();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ audience: 'users', subject: '', message: '' });
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    setError('');
    adminApi.recipients().then(setInfo).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const audiences = info ? [
    { key: 'users', label: 'Travellers', icon: 'fa fa-users', count: info.users },
    { key: 'partners', label: 'Partners', icon: 'fa fa-handshake', count: info.partners },
    { key: 'all', label: 'Everyone', icon: 'fa fa-globe-asia', count: info.users + info.partners },
  ] : [];
  const chosen = audiences.find((a) => a.key === form.audience);

  const send = async (e) => {
    e.preventDefault();
    setFormError('');
    const ok = await confirm({
      title: `Send to ${chosen.count} ${chosen.key === 'partners' ? 'partner' : 'recipient'}${chosen.count === 1 ? '' : 's'}?`,
      text: `"${form.subject}" will be emailed now. This can't be undone.`,
      confirmLabel: 'Send now',
      icon: 'fa fa-paper-plane',
    });
    if (!ok) return;
    setSending(true);
    try {
      const r = await adminApi.announce(form);
      toast(`Announcement sent to ${r.sent} ${r.sent === 1 ? 'person' : 'people'}`);
      setForm((f) => ({ ...f, subject: '', message: '' }));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <PartnerLayout title="Announcements" subtitle="Email travellers, partners or everyone at once.">
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!info && !error && <LoadingBlock rows={2} />}
      {info && (
        <form className="pt-form-grid" onSubmit={send}>
          <div className="pt-form-main">
            {!info.mailConfigured && (
              <div className="pt-alert">
                <i className="fa fa-envelope" />
                <div><b>Email is not set up yet.</b> Add <code>BREVO_API_KEY</code> and <code>MAIL_FROM</code> to the backend settings (or <code>MAIL_USER</code>/<code>MAIL_PASS</code> locally) and restart the server to send announcements.</div>
              </div>
            )}
            <section className="pt-card pt-form-section">
              <h2><span>1</span> Audience</h2>
              <div className="pt-audience" role="radiogroup" aria-label="Audience">
                {audiences.map((a) => (
                  <button type="button" role="radio" aria-checked={form.audience === a.key} key={a.key} className={form.audience === a.key ? 'active' : ''} onClick={() => setForm({ ...form, audience: a.key })}>
                    <i className={a.icon} />
                    <b>{a.label}</b>
                    <small>{a.count} recipient{a.count === 1 ? '' : 's'}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="pt-card pt-form-section">
              <h2><span>2</span> Message</h2>
              <div className="pt-suggest">
                <small className="pt-field-hint">Start from a template:</small>
                {TEMPLATES.map((t) => (
                  <button type="button" key={t.label} onClick={() => setForm({ ...form, subject: t.subject, message: t.message })}><i className="fa fa-magic" /> {t.label}</button>
                ))}
              </div>
              <Field label="Subject" required hint={`${form.subject.length}/120`}>
                <input value={form.subject} onChange={(e) => { setForm({ ...form, subject: e.target.value }); setFormError(''); }} required minLength={3} maxLength={120} placeholder="What is this about?" />
              </Field>
              <Field label="Message" required hint={`${form.message.length}/5000 · plain text, line breaks are kept`}>
                <textarea rows={9} value={form.message} onChange={(e) => { setForm({ ...form, message: e.target.value }); setFormError(''); }} required minLength={10} maxLength={5000} placeholder="Write your announcement…" />
              </Field>
            </section>

            {formError && <div className="pt-form-error" role="alert"><i className="fa fa-exclamation-circle" /> {formError}</div>}
            <div className="pt-form-actions">
              <button type="button" className="pt-btn pt-btn--ghost" onClick={() => setForm({ ...form, subject: '', message: '' })} disabled={!form.subject && !form.message}>Clear</button>
              <button type="submit" className="pt-btn pt-btn--primary" disabled={sending || !info.mailConfigured || !chosen?.count} title={!info.mailConfigured ? 'Email is not set up yet' : undefined}>
                {sending ? <><span className="pt-spinner" /> Sending…</> : <><i className="fa fa-paper-plane" /> Send to {chosen?.count}</>}
              </button>
            </div>
          </div>

          <aside className="pt-preview">
            <span className="pt-preview-label"><i className="fa fa-eye" /> Email preview</span>
            <div className="pt-mail">
              <div className="pt-mail-head">
                <span className="pt-avatar"><i className="fa fa-bus" /></span>
                <div><b>Vihari</b><small>to {chosen?.label.toLowerCase()} (BCC)</small></div>
              </div>
              <h3>{form.subject || 'Your subject line'}</h3>
              <p>{form.message || 'Your message will appear here exactly as recipients will read it.'}</p>
            </div>
            <ul className="pt-tips">
              <li><i className="fa fa-check" /> Recipients are added as BCC, so nobody sees other addresses.</li>
              <li><i className="fa fa-check" /> Blocked and pending partners are not included.</li>
            </ul>
          </aside>
        </form>
      )}
    </PartnerLayout>
  );
};

export default AdminAnnouncements;
