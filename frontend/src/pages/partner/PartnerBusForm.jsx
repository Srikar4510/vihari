import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { partnerApi } from '../../utils/partnerApi';
import { imageUrl } from '../../utils/imageUrl';
import CityAutocomplete from '../../components/UI/CityAutocomplete';
import { TimePicker, DurationPicker, durationLabel } from '../../components/Partner/Pickers';
import { durationToMinutes } from '../../utils/time';
import {
  PartnerLayout, PhotoPicker, Field, LoadingBlock, ErrorBlock, usePartnerUI, rupees, titleCase, usePortal,
} from '../../components/Partner/PartnerUI';

const LAYOUTS = {
  seater: { icon: 'fa fa-chair', text: '40 seats in a 2+2 layout' },
  sleeper: { icon: 'fa fa-bed', text: '36 berths, lower and upper deck (2+1)' },
  mixed: { icon: 'fa fa-layer-group', text: '32 seats below, 18 berths above' },
};
const layoutOf = (btype = '') => {
  const sleeper = /sleeper/i.test(btype);
  if (sleeper && /seater/i.test(btype)) return 'mixed';
  return sleeper ? 'sleeper' : 'seater';
};

// "21:30" <-> "9:30 PM"
const to24 = (t = '') => {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return '';
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};
const to12 = (mins) => {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const EMPTY = { srcname: '', destname: '', trname: '', btype: '', deptime: '', durationMinutes: 0, tktprice: '' };

const PartnerBusForm = () => {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { toast } = usePartnerUI();
  const { paths, isAdmin } = usePortal();
  const [form, setForm] = useState(EMPTY);
  const [types, setTypes] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [current, setCurrent] = useState(null);
  const [upcoming, setUpcoming] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => photoUrl && URL.revokeObjectURL(photoUrl), [photoUrl]);

  useEffect(() => {
    const load = editing
      ? Promise.all([partnerApi.bus(id), partnerApi.buses()]).then(([r, all]) => {
        const b = r.bus;
        setTypes(r.busTypes);
        setCurrent(b.Imageurl);
        setUpcoming(all.buses.find((x) => x._id === id)?.upcoming || 0);
        setForm({
          srcname: titleCase(b.srcname),
          destname: titleCase(b.destname),
          trname: b.trname,
          btype: b.btype,
          deptime: to24(b.deptime),
          durationMinutes: durationToMinutes(b.durtime),
          tktprice: String(b.tktprice),
        });
      })
      : partnerApi.busTypes().then((r) => setTypes(r.busTypes));
    load.catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  }, [id, editing]);

  const set = (e) => { setForm((f) => ({ ...f, [e.target.name]: e.target.value })); setError(''); };

  const arrival = useMemo(() => {
    const [h, m] = form.deptime.split(':').map(Number);
    const minutes = Number(form.durationMinutes);
    if (Number.isNaN(h) || !form.deptime || !minutes) return null;
    const dep = h * 60 + m;
    const arr = dep + minutes;
    const days = Math.floor(arr / 1440);
    return { dep: to12(dep), arr: to12(arr), days };
  }, [form.deptime, form.durationMinutes]);

  const swap = () => setForm((f) => ({ ...f, srcname: f.destname, destname: f.srcname }));

  const submit = async (e) => {
    e.preventDefault();
    if (!editing && !photo) { setError('Please add a photo of the bus'); return; }
    if (!form.deptime) { setError('Choose a departure time'); return; }
    if (!(form.durationMinutes >= 15)) { setError('Choose a journey duration of at least 15 minutes'); return; }
    if (!form.btype) { setError('Choose a bus type'); return; }
    setSaving(true);
    setError('');
    const data = new FormData();
    data.append('srcname', form.srcname);
    data.append('destname', form.destname);
    data.append('trname', form.trname);
    data.append('btype', form.btype);
    data.append('deptime', form.deptime);
    data.append('durationMinutes', String(form.durationMinutes));
    data.append('tktprice', form.tktprice);
    if (photo) data.append('image', photo);
    try {
      if (editing) await partnerApi.editBus(id, data);
      else await partnerApi.addBus(data);
      toast(editing ? 'Bus updated' : 'Bus added. It is now live for travellers.');
      navigate(paths.buses);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const layout = form.btype ? LAYOUTS[layoutOf(form.btype)] : null;
  const previewSrc = photoUrl || (current ? imageUrl(current) : null);

  return (
    <PartnerLayout
      title={editing ? 'Edit bus' : 'Add a bus'}
      subtitle={editing ? 'Changes show up for travellers immediately.' : 'Fill in the route, timings and fare. You can edit it any time.'}
      back={{ to: paths.buses, label: isAdmin ? 'All buses' : 'Your buses' }}
    >
      {loading && <LoadingBlock rows={3} />}
      {loadError && <ErrorBlock message={loadError} />}
      {!loading && !loadError && (
        <form className="pt-form-grid" onSubmit={submit} noValidate={false}>
          <div className="pt-form-main">
            <section className="pt-card pt-form-section">
              <h2><span>1</span> Route</h2>
              <div className="pt-route-fields">
                <Field label="From" required>
                  <CityAutocomplete name="srcname" value={form.srcname} placeholder="e.g. Hyderabad" onChange={set} />
                </Field>
                <button type="button" className="pt-swap" onClick={swap} aria-label="Swap cities"><i className="fa fa-exchange-alt" /></button>
                <Field label="To" required>
                  <CityAutocomplete name="destname" value={form.destname} placeholder="e.g. Bangalore" onChange={set} />
                </Field>
              </div>
              <Field label="Operator / travels name" required>
                <input name="trname" value={form.trname} onChange={set} required minLength={2} maxLength={60} placeholder="e.g. SkyLine Travels" />
              </Field>
            </section>

            <section className="pt-card pt-form-section">
              <h2><span>2</span> Schedule</h2>
              <div className="pt-row-2">
                <Field label="Departure time" required group>
                  <TimePicker value={form.deptime} onChange={(v) => { setForm((f) => ({ ...f, deptime: v })); setError(''); }} ariaLabel="Departure time" />
                </Field>
                <Field label="Journey duration" required group>
                  <DurationPicker value={form.durationMinutes} onChange={(v) => { setForm((f) => ({ ...f, durationMinutes: v })); setError(''); }} ariaLabel="Journey duration" />
                </Field>
              </div>
              <div className={`pt-arrival${arrival ? ' show' : ''}`}>
                <i className="far fa-clock" />
                {arrival
                  ? <>Departs <b>{arrival.dep}</b>, arrives <b>{arrival.arr}</b>{arrival.days > 0 && <em> +{arrival.days} day{arrival.days > 1 ? 's' : ''}</em>}</>
                  : 'Pick a departure time and duration to see the arrival time.'}
              </div>
            </section>

            <section className="pt-card pt-form-section">
              <h2><span>3</span> Bus type and fare</h2>
              {editing && upcoming > 0 && (
                <p className="pt-note"><i className="fa fa-lock" /> This bus has {upcoming} upcoming booking{upcoming > 1 ? 's' : ''}, so its type (seat layout) can't be changed.</p>
              )}
              <div className="pt-type-grid" role="radiogroup" aria-label="Bus type">
                {types.map((t) => {
                  const l = LAYOUTS[layoutOf(t)];
                  const locked = editing && upcoming > 0 && t !== form.btype;
                  return (
                    <button
                      type="button"
                      key={t}
                      role="radio"
                      aria-checked={form.btype === t}
                      disabled={locked}
                      className={`pt-type${form.btype === t ? ' active' : ''}`}
                      onClick={() => { setForm((f) => ({ ...f, btype: t })); setError(''); }}
                    >
                      <i className={l.icon} />
                      <b>{t}</b>
                    </button>
                  );
                })}
              </div>
              {layout && <p className="pt-field-hint"><i className={layout.icon} /> Seat map: {layout.text}</p>}
              <div className="pt-row-2">
                <Field label="Fare per seat (₹)" required hint="Whole rupees, ₹50 to ₹20,000">
                  <input type="number" name="tktprice" value={form.tktprice} onChange={set} required min={50} max={20000} step={1} placeholder="e.g. 1150" />
                </Field>
              </div>
            </section>

            <section className="pt-card pt-form-section">
              <h2><span>4</span> Photo</h2>
              <PhotoPicker file={photo} current={current} onChange={setPhoto} label="Bus photo" required={!editing} />
            </section>

            {error && <div className="pt-form-error" role="alert"><i className="fa fa-exclamation-circle" /> {error}</div>}
            <div className="pt-form-actions">
              <Link to={paths.buses} className="pt-btn pt-btn--ghost">Cancel</Link>
              <button type="submit" className="pt-btn pt-btn--primary" disabled={saving}>
                {saving ? <><span className="pt-spinner" /> Saving…</> : <><i className="fa fa-check" /> {editing ? 'Save changes' : 'Add bus'}</>}
              </button>
            </div>
          </div>

          <aside className="pt-preview">
            <span className="pt-preview-label"><i className="fa fa-eye" /> Traveller preview</span>
            <div className="pt-preview-card">
              <div className="pt-preview-img">
                {previewSrc
                  ? <img src={previewSrc} alt="" />
                  : <div className="pt-preview-placeholder"><i className="fa fa-bus" /></div>}
                {form.btype && <span className="pt-chip pt-chip--dark">{form.btype}</span>}
              </div>
              <div className="pt-preview-body">
                <b className="pt-preview-op">{form.trname || 'Operator name'}</b>
                <div className="pt-bus-route">
                  <div><b>{form.srcname || 'From'}</b><small>{arrival?.dep || '--:--'}</small></div>
                  <div className="pt-bus-line"><i className="fa fa-bus" /><small>{form.durationMinutes ? durationLabel(form.durationMinutes) : ''}</small></div>
                  <div className="text-end"><b>{form.destname || 'To'}</b><small>{arrival?.arr || '--:--'}</small></div>
                </div>
                <div className="pt-preview-foot">
                  <span>{layout ? layout.text : 'Choose a bus type'}</span>
                  <strong>{form.tktprice ? rupees(form.tktprice) : '₹—'}</strong>
                </div>
              </div>
            </div>
            <ul className="pt-tips">
              <li><i className="fa fa-check" /> Use the city names travellers search for (e.g. Bangalore, not BLR).</li>
              <li><i className="fa fa-check" /> A clear daytime photo of the bus gets more bookings.</li>
              <li><i className="fa fa-check" /> Neighbouring-seat gender rules are applied automatically.</li>
            </ul>
          </aside>
        </form>
      )}
    </PartnerLayout>
  );
};

export default PartnerBusForm;
