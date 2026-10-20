import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { partnerApi } from '../../utils/partnerApi';
import { imageUrl } from '../../utils/imageUrl';
import {
  PartnerLayout, Modal, PhotoPicker, Field, LoadingBlock, ErrorBlock, EmptyState, usePartnerUI, rupees, usePortal,
} from '../../components/Partner/PartnerUI';

// Add or edit one place in a modal.
const PlaceForm = ({ tourId, place, onSaved, onClose }) => {
  const [form, setForm] = useState({ name: place?.name || '', description: place?.description || '' });
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!place && !photo) { setError('Please add a photo of the place'); return; }
    setSaving(true);
    setError('');
    const data = new FormData();
    data.append('name', form.name);
    data.append('description', form.description);
    if (photo) data.append('placeImage', photo);
    try {
      const res = place ? await partnerApi.editPlace(place._id, data) : await partnerApi.addPlace(tourId, data);
      onSaved(res.place);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={place ? 'Edit place' : 'Add a place'} onClose={onClose}>
      <form className="pt-modal-form" onSubmit={submit}>
        <Field label="Place name" required>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={80} placeholder="e.g. Hawa Mahal" autoFocus />
        </Field>
        <Field label="Description" required hint={`${form.description.length}/600 · what travellers will see or do here`}>
          <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required minLength={10} maxLength={600} placeholder="A short, vivid description" />
        </Field>
        <PhotoPicker file={photo} current={place?.Imageurl} onChange={setPhoto} label="Photo" aspect="4 / 3" required={!place} />
        {error && <div className="pt-form-error" role="alert"><i className="fa fa-exclamation-circle" /> {error}</div>}
        <div className="pt-form-actions">
          <button type="button" className="pt-btn pt-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="pt-btn pt-btn--primary" disabled={saving}>
            {saving ? <><span className="pt-spinner" /> Saving…</> : <><i className="fa fa-check" /> {place ? 'Save place' : 'Add place'}</>}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const PartnerTourPlaces = () => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { toast, confirm } = usePartnerUI();
  const { paths, isAdmin } = usePortal();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(params.get('add') ? 'new' : null);

  const load = () => {
    setError('');
    partnerApi.tour(id).then(setData).catch((e) => setError(e.message));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [id]);

  const close = () => {
    setEditing(null);
    if (params.get('add')) setParams({}, { replace: true });
  };

  const saved = (place) => {
    setData((d) => {
      const exists = d.places.some((p) => p._id === place._id);
      return { ...d, places: exists ? d.places.map((p) => (p._id === place._id ? place : p)) : [...d.places, place] };
    });
    toast(editing === 'new' ? 'Place added' : 'Place updated');
    close();
  };

  const remove = async (place) => {
    const ok = await confirm({ danger: true, title: `Delete ${place.name}?`, text: 'It will be removed from the itinerary travellers see.', confirmLabel: 'Delete place' });
    if (!ok) return;
    try {
      await partnerApi.deletePlace(place._id);
      setData((d) => ({ ...d, places: d.places.filter((p) => p._id !== place._id) }));
      toast('Place deleted');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const tour = data?.tour;

  return (
    <PartnerLayout
      title={tour ? tour.tname : 'Tour places'}
      subtitle="The itinerary travellers see, in order."
      back={{ to: paths.tours, label: isAdmin ? 'All tours' : 'Your tours' }}
      actions={tour && (
        <>
          <Link to={`/tourplaces/${id}`} className="pt-btn pt-btn--ghost" target="_blank" rel="noreferrer"><i className="fa fa-external-link-alt" /> View on site</Link>
          <button type="button" className="pt-btn pt-btn--primary" onClick={() => setEditing('new')}><i className="fa fa-plus" /> Add place</button>
        </>
      )}
    >
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!data && !error && <LoadingBlock rows={3} />}
      {data && (
        <>
          <section className="pt-tour-banner" style={{ backgroundImage: `url(${imageUrl(tour.DispImageurl)})` }}>
            <div>
              <span className="pt-pill">{tour.duration || 'Tour'}</span>
              <h2>{tour.tname}</h2>
              {tour.highlight && <p>{tour.highlight}</p>}
              <div className="pt-tour-banner-meta">
                <span><i className="fa fa-tag" /> {rupees(tour.tprice)} per person</span>
                <span><i className="fa fa-map-pin" /> {data.places.length} place{data.places.length === 1 ? '' : 's'}</span>
                <Link to={paths.editTour(id)}><i className="fa fa-pen" /> Edit details</Link>
              </div>
            </div>
          </section>

          {data.places.length === 0 ? (
            <EmptyState
              icon="fa fa-map-pin"
              title="No places yet"
              text="Add the sights this tour covers. Travellers see them as the itinerary and in their PDF voucher."
              action={<button type="button" className="pt-btn pt-btn--primary" onClick={() => setEditing('new')}><i className="fa fa-plus" /> Add the first place</button>}
            />
          ) : (
            <ol className="pt-timeline">
              {data.places.map((p, i) => (
                <li key={p._id} style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="pt-timeline-dot">{i + 1}</span>
                  <article className="pt-place">
                    <img src={imageUrl(p.Imageurl)} alt="" loading="lazy" />
                    <div>
                      <h3>{p.name}</h3>
                      <p>{p.description}</p>
                    </div>
                    <div className="pt-place-actions">
                      <button type="button" className="pt-icon-btn" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><i className="fa fa-pen" /></button>
                      <button type="button" className="pt-icon-btn pt-icon-btn--danger" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}><i className="fa fa-trash-alt" /></button>
                    </div>
                  </article>
                </li>
              ))}
              <li className="pt-timeline-add">
                <span className="pt-timeline-dot"><i className="fa fa-plus" /></span>
                <button type="button" onClick={() => setEditing('new')}>Add another place</button>
              </li>
            </ol>
          )}
        </>
      )}
      {editing && data && (
        <PlaceForm tourId={id} place={editing === 'new' ? null : editing} onSaved={saved} onClose={close} />
      )}
    </PartnerLayout>
  );
};

export default PartnerTourPlaces;
