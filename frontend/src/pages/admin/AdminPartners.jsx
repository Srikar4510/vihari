import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../utils/partnerApi';
import {
  PartnerLayout, LoadingBlock, ErrorBlock, EmptyState, usePartnerUI, initials, timeAgo,
} from '../../components/Partner/PartnerUI';

const TABS = [
  { key: 'pending', label: 'Pending', icon: 'fa fa-hourglass-half' },
  { key: 'approved', label: 'Approved', icon: 'fa fa-check-circle' },
  { key: 'blocked', label: 'Blocked', icon: 'fa fa-ban' },
  { key: 'all', label: 'All', icon: 'fa fa-list' },
];
const STATUS = {
  pending: { label: 'Pending review', cls: 'pt-chip--warn' },
  approved: { label: 'Approved', cls: 'pt-chip--live' },
  blocked: { label: 'Blocked', cls: 'pt-chip--danger' },
};

const AdminPartners = () => {
  const { toast, confirm } = usePartnerUI();
  const [agents, setAgents] = useState(null);
  const [mailConfigured, setMailConfigured] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);

  const load = () => {
    setError('');
    adminApi.agents()
      .then((r) => {
        setAgents(r.agents);
        setMailConfigured(r.mailConfigured);
        // Open on pending applications when there are any.
        setTab((t) => t || (r.agents.some((a) => a.status === 'pending') ? 'pending' : 'approved'));
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const counts = useMemo(() => {
    const c = { all: agents?.length || 0, pending: 0, approved: 0, blocked: 0 };
    (agents || []).forEach((a) => { c[a.status] += 1; });
    return c;
  }, [agents]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (agents || [])
      .filter((a) => tab === 'all' || a.status === tab)
      .filter((a) => !q || `${a.agentName} ${a.email}`.toLowerCase().includes(q));
  }, [agents, tab, query]);

  const run = async (agent, action) => {
    const config = {
      approve: { call: adminApi.approveAgent, done: 'approved' },
      reject: {
        call: adminApi.rejectAgent, done: 'rejected',
        ask: { danger: true, title: `Reject ${agent.agentName}?`, text: 'The application and its document will be removed. They can apply again later.', confirmLabel: 'Reject application' },
      },
      block: {
        call: adminApi.blockAgent, done: 'blocked',
        ask: { danger: true, title: `Block ${agent.agentName}?`, text: `They will be signed out of the partner portal right away. Their ${agent.buses} bus${agent.buses === 1 ? '' : 'es'} and ${agent.tours} tour${agent.tours === 1 ? '' : 's'} stay listed and existing bookings are kept.`, confirmLabel: 'Block partner', icon: 'fa fa-ban' },
      },
      unblock: { call: adminApi.unblockAgent, done: 'unblocked' },
    }[action];
    if (config.ask && !(await confirm(config.ask))) return;
    setBusy(agent._id);
    try {
      const r = await config.call(agent._id);
      setAgents((list) => (action === 'reject' ? list.filter((a) => a._id !== agent._id) : list.map((a) => (a._id === agent._id ? { ...a, ...r.agent } : a))));
      toast(`${agent.agentName} ${config.done}${r.emailSent ? ' · email sent' : ''}`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const openDoc = (agent) => adminApi.openDocument(agent._id).catch((e) => toast(e.message, 'error'));

  return (
    <PartnerLayout title="Partners" subtitle="Bus operators and tour agencies on Vihari.">
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!agents && !error && <LoadingBlock rows={3} />}
      {agents && (
        <>
          {!mailConfigured && (
            <div className="pt-alert">
              <i className="fa fa-envelope" />
              <div>Email is not set up, so partners won't be notified of approvals or blocks. Let them know another way for now.</div>
            </div>
          )}
          <div className="pt-toolbar">
            <div className="pt-tabs" role="tablist">
              {TABS.map((t) => (
                <button type="button" role="tab" aria-selected={tab === t.key} key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
                  <i className={t.icon} /> {t.label} <span>{counts[t.key]}</span>
                </button>
              ))}
            </div>
            <div className="pt-search">
              <i className="fa fa-search" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agency or email" aria-label="Search partners" />
            </div>
          </div>

          {list.length === 0 ? (
            <EmptyState
              icon={tab === 'pending' ? 'fa fa-inbox' : 'fa fa-handshake'}
              title={query ? 'No partners match' : tab === 'pending' ? 'No applications waiting' : `No ${tab === 'all' ? '' : tab} partners`}
              text={tab === 'pending' && !query ? 'New partner sign-ups will appear here for review.' : 'Try another tab or search.'}
            />
          ) : (
            <div className="pt-partner-grid" key={tab}>
              {list.map((a, i) => (
                <article className={`pt-partner pt-partner--${a.status}`} key={a._id} style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="pt-partner-head">
                    <span className={`pt-avatar ${a.status === 'pending' ? 'pt-avatar--tour' : ''}`}>{initials(a.agentName)}</span>
                    <div>
                      <b>{a.agentName}</b>
                      <a href={`mailto:${a.email}`}>{a.email}</a>
                    </div>
                    <span className={`pt-chip ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span>
                  </div>
                  <div className="pt-partner-meta">
                    <span><i className="far fa-calendar" /> {a.status === 'pending' ? 'Applied' : 'Joined'} {timeAgo(a.createdAt)}</span>
                    <span><i className="fa fa-bus" /> {a.buses} bus{a.buses === 1 ? '' : 'es'}</span>
                    <span><i className="fa fa-map-marked-alt" /> {a.tours} tour{a.tours === 1 ? '' : 's'}</span>
                  </div>
                  <div className="pt-actions">
                    {a.hasDocument
                      ? <button type="button" className="pt-btn pt-btn--ghost pt-btn--small" onClick={() => openDoc(a)}><i className="fa fa-file-alt" /> Document</button>
                      : <span className="pt-muted-note"><i className="fa fa-file-excel" /> No document</span>}
                    <span className="pt-actions-spacer" />
                    {a.status === 'pending' && (
                      <>
                        <button type="button" className="pt-btn pt-btn--danger-soft pt-btn--small" disabled={busy === a._id} onClick={() => run(a, 'reject')}><i className="fa fa-times" /> Reject</button>
                        <button type="button" className="pt-btn pt-btn--primary pt-btn--small" disabled={busy === a._id} onClick={() => run(a, 'approve')}><i className="fa fa-check" /> Approve</button>
                      </>
                    )}
                    {a.status === 'approved' && (
                      <button type="button" className="pt-btn pt-btn--danger-soft pt-btn--small" disabled={busy === a._id} onClick={() => run(a, 'block')}><i className="fa fa-ban" /> Block</button>
                    )}
                    {a.status === 'blocked' && (
                      <button type="button" className="pt-btn pt-btn--soft pt-btn--small" disabled={busy === a._id} onClick={() => run(a, 'unblock')}><i className="fa fa-unlock" /> Unblock</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </PartnerLayout>
  );
};

export default AdminPartners;
