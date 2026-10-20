import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../utils/partnerApi';
import { Dropdown } from '../../components/Partner/Pickers';
import {
  PartnerLayout, Modal, Field, LoadingBlock, ErrorBlock, EmptyState, AnimatedNumber, usePartnerUI, downloadCsv, rupees, initials, timeAgo,
} from '../../components/Partner/PartnerUI';

const SORTS = [
  { value: 'newest', label: 'Newest first', icon: 'fa fa-clock', fn: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  { value: 'name', label: 'Name (A–Z)', icon: 'fa fa-sort-alpha-down', fn: (a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`) },
  { value: 'spent', label: 'Top spenders', icon: 'fa fa-wallet', fn: (a, b) => b.spent - a.spent },
  { value: 'trips', label: 'Most trips', icon: 'fa fa-bus', fn: (a, b) => (b.trips + b.tours) - (a.trips + a.tours) },
];
const EMPTY = { firstName: '', lastName: '', email: '', mobile: '', password: '' };

const UserForm = ({ user, onSaved, onClose }) => {
  const [form, setForm] = useState(user ? { ...EMPTY, ...user, password: '' } : EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { firstName, lastName, email, mobile, password } = form;
      const res = user
        ? await adminApi.editUser(user._id, { firstName, lastName, email, mobile })
        : await adminApi.addUser({ firstName, lastName, email, mobile, password });
      onSaved(res.user);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={user ? 'Edit traveller' : 'Add a traveller'} onClose={onClose}>
      <form className="pt-modal-form" onSubmit={submit}>
        <div className="pt-row-2">
          <Field label="First name" required><input name="firstName" value={form.firstName} onChange={set} required maxLength={40} autoFocus /></Field>
          <Field label="Last name" required><input name="lastName" value={form.lastName} onChange={set} required maxLength={40} /></Field>
        </div>
        <Field label="Email" required><input type="email" name="email" value={form.email} onChange={set} required /></Field>
        <Field label="Mobile" required hint="10-digit Indian mobile number">
          <input type="tel" name="mobile" value={form.mobile} onChange={set} required pattern="[6-9][0-9]{9}" maxLength={10} />
        </Field>
        {!user && (
          <Field label="Temporary password" required hint="At least 8 characters. Share it with the traveller so they can log in.">
            <input type="text" name="password" value={form.password} onChange={set} required minLength={8} autoComplete="new-password" />
          </Field>
        )}
        {error && <div className="pt-form-error" role="alert"><i className="fa fa-exclamation-circle" /> {error}</div>}
        <div className="pt-form-actions">
          <button type="button" className="pt-btn pt-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="pt-btn pt-btn--primary" disabled={saving}>
            {saving ? <><span className="pt-spinner" /> Saving…</> : <><i className="fa fa-check" /> {user ? 'Save changes' : 'Add traveller'}</>}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const AdminUsers = () => {
  const { toast, confirm } = usePartnerUI();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [editing, setEditing] = useState(null);

  const load = () => {
    setError('');
    adminApi.users().then((r) => setUsers(r.users)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users || [])
      .filter((u) => !q || `${u.firstName} ${u.lastName} ${u.email} ${u.mobile}`.toLowerCase().includes(q))
      .sort(SORTS.find((s) => s.value === sort).fn);
  }, [users, query, sort]);

  const saved = (user) => {
    setUsers((list) => (list.some((u) => u._id === user._id)
      ? list.map((u) => (u._id === user._id ? { ...u, ...user } : u))
      : [user, ...list]));
    toast(editing === 'new' ? 'Traveller added' : 'Traveller updated');
    setEditing(null);
  };

  const remove = async (u) => {
    if (u.upcoming) { toast(`${u.firstName} has ${u.upcoming} upcoming trip${u.upcoming > 1 ? 's' : ''} and can't be deleted yet`, 'error'); return; }
    const ok = await confirm({ danger: true, title: `Delete ${u.firstName} ${u.lastName}?`, text: 'They will no longer be able to log in. Past bookings stay in the partners\' records.', confirmLabel: 'Delete traveller' });
    if (!ok) return;
    try {
      await adminApi.deleteUser(u._id);
      setUsers((list) => list.filter((x) => x._id !== u._id));
      toast('Traveller deleted');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const exportCsv = () => downloadCsv('vihari-travellers.csv', [
    ['First name', 'Last name', 'Email', 'Mobile', 'Joined', 'Bus trips', 'Tours', 'Spent'],
    ...list.map((u) => [u.firstName, u.lastName, u.email, u.mobile, String(u.createdAt).slice(0, 10), u.trips, u.tours, u.spent]),
  ]);

  const totals = useMemo(() => users && {
    count: users.length,
    active: users.filter((u) => u.trips + u.tours > 0).length,
    spent: users.reduce((s, u) => s + u.spent, 0),
  }, [users]);

  return (
    <PartnerLayout
      title="Travellers"
      subtitle="Everyone who has a traveller account."
      actions={(
        <>
          {users?.length > 0 && <button type="button" className="pt-btn pt-btn--ghost" onClick={exportCsv}><i className="fa fa-file-csv" /> Export CSV</button>}
          <button type="button" className="pt-btn pt-btn--primary" onClick={() => setEditing('new')}><i className="fa fa-user-plus" /> Add traveller</button>
        </>
      )}
    >
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!users && !error && <LoadingBlock rows={3} />}
      {users && (
        <>
          <div className="pt-summary pt-summary--plain">
            <div><small>Travellers</small><b><AnimatedNumber value={totals.count} /></b></div>
            <div><small>Have booked</small><b><AnimatedNumber value={totals.active} /></b></div>
            <div><small>Total spent</small><b><AnimatedNumber value={totals.spent} format={rupees} /></b></div>
          </div>
          <div className="pt-toolbar">
            <div className="pt-search">
              <i className="fa fa-search" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or mobile" aria-label="Search travellers" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><i className="fa fa-times" /></button>}
            </div>
            <div className="pt-filter"><Dropdown value={sort} onChange={setSort} options={SORTS} ariaLabel="Sort travellers" icon="fa fa-sort-amount-down" /></div>
          </div>

          {list.length === 0 ? (
            <EmptyState icon="fa fa-users" title={users.length ? 'No travellers match' : 'No travellers yet'} text={users.length ? 'Try a different search.' : 'Travellers appear here when they sign up.'} />
          ) : (
            <div className="pt-table-card pt-card">
              <table className="pt-table">
                <thead>
                  <tr><th>Traveller</th><th>Mobile</th><th>Joined</th><th>Bookings</th><th>Spent</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {list.map((u, i) => (
                    <tr key={u._id} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                      <td>
                        <div className="pt-person">
                          <span className="pt-avatar">{initials(`${u.firstName} ${u.lastName}`)}</span>
                          <div><b>{u.firstName} {u.lastName}</b><a href={`mailto:${u.email}`}>{u.email}</a></div>
                        </div>
                      </td>
                      <td data-label="Mobile"><a href={`tel:${u.mobile}`}>{u.mobile || '—'}</a></td>
                      <td data-label="Joined">{timeAgo(u.createdAt)}</td>
                      <td data-label="Bookings">
                        <span className="pt-mini-stats">
                          <span title="Bus trips"><i className="fa fa-bus" /> {u.trips}</span>
                          <span title="Tours"><i className="fa fa-map-marked-alt" /> {u.tours}</span>
                          {u.upcoming > 0 && <span className="pt-chip pt-chip--live">{u.upcoming} upcoming</span>}
                        </span>
                      </td>
                      <td data-label="Spent"><b>{rupees(u.spent)}</b></td>
                      <td className="pt-row-actions">
                        <button type="button" className="pt-icon-btn" onClick={() => setEditing(u)} aria-label={`Edit ${u.firstName}`}><i className="fa fa-pen" /></button>
                        <button type="button" className="pt-icon-btn pt-icon-btn--danger" onClick={() => remove(u)} aria-label={`Delete ${u.firstName}`}><i className="fa fa-trash-alt" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {editing && <UserForm user={editing === 'new' ? null : editing} onSaved={saved} onClose={() => setEditing(null)} />}
    </PartnerLayout>
  );
};

export default AdminUsers;
