import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { partnerApi } from '../../utils/partnerApi';
import { imageUrl } from '../../utils/imageUrl';
import {
  PartnerLayout, LoadingBlock, ErrorBlock, EmptyState, usePartnerUI, rupees, usePortal,
} from '../../components/Partner/PartnerUI';

const PartnerTours = () => {
  const { toast, confirm } = usePartnerUI();
  const { paths, isAdmin } = usePortal();
  const [tours, setTours] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = () => {
    setError('');
    partnerApi.tours().then((r) => setTours(r.tours)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tours || []).filter((t) => !q || `${t.tname} ${t.highlight || ''}`.toLowerCase().includes(q));
  }, [tours, query]);

  const remove = async (tour) => {
    if (tour.bookings > 0) {
      toast(`${tour.tname} has ${tour.bookings} booking${tour.bookings > 1 ? 's' : ''} and can't be deleted`, 'error');
      return;
    }
    const ok = await confirm({
      danger: true,
      title: 'Delete this tour?',
      text: `${tour.tname} and its ${tour.places} place${tour.places === 1 ? '' : 's'} will be removed from the website.`,
      confirmLabel: 'Delete tour',
    });
    if (!ok) return;
    try {
      await partnerApi.deleteTour(tour._id);
      setTours((t) => t.filter((x) => x._id !== tour._id));
      toast('Tour deleted');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <PartnerLayout
      title={isAdmin ? 'All tours' : 'Your tours'}
      subtitle={tours ? `${tours.length} tour${tours.length === 1 ? '' : 's'} · ${tours.reduce((s, t) => s + t.bookings, 0)} bookings` : 'Loading…'}
      actions={paths.addTour && <Link to={paths.addTour} className="pt-btn pt-btn--primary"><i className="fa fa-plus" /> Add tour</Link>}
    >
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!tours && !error && <LoadingBlock rows={3} />}
      {tours && tours.length === 0 && (
        <EmptyState
          icon="fa fa-map-marked-alt"
          title="No tours yet"
          text="Create a curated tour with a cover photo, price and inclusions, then add the places it covers."
          action={paths.addTour && <Link to={paths.addTour} className="pt-btn pt-btn--primary"><i className="fa fa-plus" /> Create your first tour</Link>}
        />
      )}
      {tours && tours.length > 0 && (
        <>
          <div className="pt-toolbar">
            <div className="pt-search">
              <i className="fa fa-search" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tours" aria-label="Search tours" />
            </div>
          </div>
          {list.length === 0 && <EmptyState icon="fa fa-search" title="No tours match" text="Try a different name." />}
          <div className="pt-tour-grid">
            {list.map((t, i) => (
              <article className="pt-tour" key={t._id} style={{ animationDelay: `${i * 60}ms` }}>
                <div className="pt-tour-media">
                  <img src={imageUrl(t.DispImageurl)} alt="" loading="lazy" />
                  <div className="pt-tour-overlay">
                    {t.rating ? <span className="pt-chip"><i className="fa fa-star" /> {t.rating}</span> : null}
                    {t.places === 0 && <span className="pt-chip pt-chip--warn"><i className="fa fa-exclamation-triangle" /> No places yet</span>}
                  </div>
                  <span className="pt-tour-price">{rupees(t.tprice)}<small>/person</small></span>
                </div>
                <div className="pt-tour-body">
                  <h3>{t.tname}</h3>
                  {isAdmin && t.agentId?.agentName && <span className="pt-owner-tag"><i className="fa fa-handshake" /> {t.agentId.agentName}</span>}
                  {t.highlight && <p>{t.highlight}</p>}
                  <div className="pt-tour-meta">
                    {t.duration && <span><i className="far fa-clock" /> {t.duration}</span>}
                    <span><i className="fa fa-map-pin" /> {t.places} place{t.places === 1 ? '' : 's'}</span>
                  </div>
                  <div className="pt-bus-stats">
                    <span><b>{t.bookings}</b> bookings</span>
                    <span><b>{t.travellers}</b> travellers</span>
                    <span><b>{rupees(t.revenue)}</b> earned</span>
                  </div>
                  <div className="pt-actions">
                    <Link to={paths.tourPlaces(t._id)} className="pt-btn pt-btn--soft pt-btn--small"><i className="fa fa-map-pin" /> Places</Link>
                    <Link to={paths.tourBookings(t._id)} className="pt-btn pt-btn--ghost pt-btn--small"><i className="fa fa-users" /> Bookings</Link>
                    <Link to={paths.editTour(t._id)} className="pt-icon-btn" aria-label="Edit tour" title="Edit tour"><i className="fa fa-pen" /></Link>
                    <button type="button" className="pt-icon-btn pt-icon-btn--danger" onClick={() => remove(t)} aria-label="Delete tour" title={t.bookings ? 'Tours with bookings cannot be deleted' : 'Delete tour'}>
                      <i className="fa fa-trash-alt" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </PartnerLayout>
  );
};

export default PartnerTours;
