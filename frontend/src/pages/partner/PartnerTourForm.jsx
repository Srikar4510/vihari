import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { partnerApi } from '../../utils/partnerApi';
import { imageUrl } from '../../utils/imageUrl';
import {
  PartnerLayout, PhotoPicker, Field, LoadingBlock, ErrorBlock, usePartnerUI, rupees, usePortal,
} from '../../components/Partner/PartnerUI';

const DURATION_PRESETS = ['1 Day', '2 Days 1 Night', '3 Days 2 Nights', '4 Days 3 Nights', '5 Days 4 Nights'];
const FEATURE_IDEAS = ['Hotel stay', 'AC transport', 'Breakfast included', 'Local guide', 'Entry tickets', 'Airport pickup'];
const MAX_FEATURES = 8;

const EMPTY = { tname: '', tprice: '', duration: '', highlight: '', features: [] };

const PartnerTourForm = () => {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { toast } = usePartnerUI();
  const { paths, isAdmin } = usePortal();
  const [form, setForm] = useState(EMPTY);
  const [feature, setFeature] = useState('');
  const [photo, setPhoto] = useState(null);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => photoUrl && URL.revokeObjectURL(photoUrl), [photoUrl]);

  useEffect(() => {
    if (!editing) return;
    partnerApi.tour(id)
      .then(({ tour }) => {
        setCurrent(tour.DispImageurl);
        setForm({
          tname: tour.tname,
          tprice: String(tour.tprice),
          duration: tour.duration || '',
          highlight: tour.highlight || '',
          features: tour.features || [],
        });
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id, editing]);

  const set = (e) => { setForm((f) => ({ ...f, [e.target.name]: e.target.value })); setError(''); };

  const addFeature = (value) => {
    const v = value.trim().replace(/\s+/g, ' ');
    if (!v) return;
    setForm((f) => (f.features.some((x) => x.toLowerCase() === v.toLowerCase()) || f.features.length >= MAX_FEATURES
      ? f
      : { ...f, features: [...f.features, v.slice(0, 40)] }));
    setFeature('');
  };
  const removeFeature = (v) => setForm((f) => ({ ...f, features: f.features.filter((x) => x !== v) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!editing && !photo) { setError('Please add a cover photo'); return; }
    setSaving(true);
    setError('');
    const data = new FormData();
    data.append('tname', form.tname);
    data.append('tprice', form.tprice);
    data.append('duration', form.duration);
    data.append('highlight', form.highlight);
    data.append('features', JSON.stringify(feature.trim() ? [...form.features, feature.trim()] : form.features));
    if (photo) data.append('tourImage', photo);
    try {
      const res = editing ? await partnerApi.editTour(id, data) : await partnerApi.addTour(data);
      toast(editing ? 'Tour updated' : 'Tour created. Now add the places it covers.');
      navigate(editing ? paths.tours : paths.tourPlaces(res.tour._id));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const preview = photoUrl || (current ? imageUrl(current) : null);

  return (
    <PartnerLayout
      title={editing ? 'Edit tour' : 'Create a tour'}
      subtitle={editing ? 'Update the details travellers see on the Tours page.' : 'Step 1 of 2: tour details. Next you will add the places it covers.'}
      back={{ to: paths.tours, label: isAdmin ? 'All tours' : 'Your tours' }}
    >
      {loading && <LoadingBlock rows={3} />}
      {loadError && <ErrorBlock message={loadError} />}
      {!loading && !loadError && (
        <form className="pt-form-grid" onSubmit={submit}>
          <div className="pt-form-main">
            <section className="pt-card pt-form-section">
              <h2><span>1</span> Basics</h2>
              <Field label="Tour name" required hint="e.g. Jaipur Pink City Royal Tour">
                <input name="tname" value={form.tname} onChange={set} required minLength={3} maxLength={80} placeholder="Name travellers will see" />
              </Field>
              <Field label="Highlight" hint={`${form.highlight.length}/140 · one line that sells the tour`}>
                <input name="highlight" value={form.highlight} onChange={set} maxLength={140} placeholder="e.g. Royal forts, palaces and the Palace of Winds" />
              </Field>
              <div className="pt-row-2">
                <Field label="Price per person (₹)" required hint="Whole rupees, ₹100 to ₹2,00,000">
                  <input type="number" name="tprice" value={form.tprice} onChange={set} required min={100} max={200000} step={1} placeholder="e.g. 1699" />
                </Field>
                <Field label="Duration">
                  <input name="duration" value={form.duration} onChange={set} maxLength={40} placeholder="e.g. 3 Days 2 Nights" list="pt-durations" />
                  <datalist id="pt-durations">{DURATION_PRESETS.map((d) => <option key={d} value={d} />)}</datalist>
                </Field>
              </div>
            </section>

            <section className="pt-card pt-form-section">
              <h2><span>2</span> What's included</h2>
              <div className="pt-tags">
                {form.features.map((f) => (
                  <span key={f} className="pt-tag">{f}<button type="button" onClick={() => removeFeature(f)} aria-label={`Remove ${f}`}><i className="fa fa-times" /></button></span>
                ))}
                {form.features.length < MAX_FEATURES && (
                  <input
                    value={feature}
                    onChange={(e) => setFeature(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addFeature(feature); }
                      if (e.key === 'Backspace' && !feature && form.features.length) removeFeature(form.features[form.features.length - 1]);
                    }}
                    onBlur={() => addFeature(feature)}
                    placeholder={form.features.length ? 'Add another…' : 'Type an inclusion and press Enter'}
                    maxLength={40}
                    aria-label="Add inclusion"
                  />
                )}
              </div>
              <div className="pt-suggest">
                {FEATURE_IDEAS.filter((f) => !form.features.includes(f)).map((f) => (
                  <button type="button" key={f} onClick={() => addFeature(f)} disabled={form.features.length >= MAX_FEATURES}><i className="fa fa-plus" /> {f}</button>
                ))}
              </div>
              <span className="pt-field-hint">Up to {MAX_FEATURES}. Shown on the tour card and the PDF voucher.</span>
            </section>

            <section className="pt-card pt-form-section">
              <h2><span>3</span> Cover photo</h2>
              <PhotoPicker file={photo} current={current} onChange={setPhoto} label="Cover photo" aspect="16 / 9" required={!editing} />
            </section>

            {error && <div className="pt-form-error" role="alert"><i className="fa fa-exclamation-circle" /> {error}</div>}
            <div className="pt-form-actions">
              <Link to={paths.tours} className="pt-btn pt-btn--ghost">Cancel</Link>
              <button type="submit" className="pt-btn pt-btn--primary" disabled={saving}>
                {saving ? <><span className="pt-spinner" /> Saving…</> : <><i className="fa fa-check" /> {editing ? 'Save changes' : 'Create tour & add places'}</>}
              </button>
            </div>
          </div>

          <aside className="pt-preview">
            <span className="pt-preview-label"><i className="fa fa-eye" /> Traveller preview</span>
            <div className="pt-preview-card pt-preview-card--tour">
              <div className="pt-preview-img pt-preview-img--tall">
                {preview ? <img src={preview} alt="" /> : <div className="pt-preview-placeholder"><i className="fa fa-mountain" /></div>}
                {form.duration && <span className="pt-chip pt-chip--dark"><i className="far fa-clock" /> {form.duration}</span>}
              </div>
              <div className="pt-preview-body">
                <b className="pt-preview-title">{form.tname || 'Your tour name'}</b>
                <p className="pt-preview-text">{form.highlight || 'A short highlight appears here.'}</p>
                <ul className="pt-preview-features">
                  {(form.features.length ? form.features : ['Hotel stay', 'Transportation', 'Food facilities']).slice(0, 4).map((f) => (
                    <li key={f}><i className="fa fa-check" /> {f}</li>
                  ))}
                </ul>
                <div className="pt-preview-foot">
                  <span>per person</span>
                  <strong>{form.tprice ? rupees(form.tprice) : '₹—'}</strong>
                </div>
              </div>
            </div>
          </aside>
        </form>
      )}
    </PartnerLayout>
  );
};

export default PartnerTourForm;
