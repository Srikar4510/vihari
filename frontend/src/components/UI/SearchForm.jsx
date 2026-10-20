import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CityAutocomplete from './CityAutocomplete';
import DatePicker from './DatePicker';

// Builds the results URL; the search lives in the URL so results survive a refresh.
export const busSearchUrl = ({ from, to, date }) =>
  `/buses?${new URLSearchParams({ from: from.trim(), to: to.trim(), date })}`;

// From / To / Date search used in the home page hero and on the bus results page.
const SearchForm = ({ initial = {}, variant = 'hero', className = '' }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ from: initial.from || '', to: initial.to || '', date: initial.date || '' });
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    setForm({ from: initial.from || '', to: initial.to || '', date: initial.date || '' });
  }, [initial.from, initial.to, initial.date]);

  const onChange = (e) => {
    const key = { srcname: 'from', destname: 'to' }[e.target.name] || e.target.name;
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setError('');
  };

  const swap = () => setForm((f) => ({ ...f, from: f.to, to: f.from }));

  const submit = (e) => {
    e.preventDefault();
    let message = '';
    if (!form.from.trim() || !form.to.trim()) message = 'Enter where you are leaving from and going to';
    else if (form.from.trim().toLowerCase() === form.to.trim().toLowerCase()) message = 'Source and destination cannot be the same';
    else if (!form.date) message = 'Pick a travel date';
    if (message) {
      setError(message);
      setShakeKey((k) => k + 1);
      return;
    }
    navigate(busSearchUrl(form));
  };

  return (
    <form className={`search-form search-form--${variant} ${className}`} onSubmit={submit} noValidate>
      <div className="search-field">
        <label>From</label>
        <CityAutocomplete name="srcname" value={form.from} placeholder="Source city" onChange={onChange} />
      </div>
      <button type="button" className="swap-btn" onClick={swap} aria-label="Swap source and destination">
        <i className="fa fa-exchange-alt" />
      </button>
      <div className="search-field">
        <label>To</label>
        <CityAutocomplete name="destname" value={form.to} placeholder="Destination city" onChange={onChange} />
      </div>
      <div className="search-field search-field--date">
        <label>Date</label>
        <DatePicker name="date" value={form.date} onChange={onChange} />
      </div>
      <button className="btn-travel" type="submit">
        <i className="fa fa-search" /> {variant === 'compact' ? 'Search' : 'Search'}
      </button>
      {error && <p className="search-error" key={shakeKey} role="alert"><i className="fa fa-exclamation-circle" /> {error}</p>}
    </form>
  );
};

export default SearchForm;
