import React, { useState, useMemo, useRef, useEffect } from "react";
import Navbar from "../components/UI/Navbar";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Footer from "../components/UI/Footer";
import { useGetAllToursQuery } from '../Slices/agentApiSlice';
import "../components/CSS/TourComponent.css";
import "../components/CSS/ToursPage.css";
import Loader from '../components/Loader/Loader';
import Reveal from "../components/UI/Reveal";
import useRazorpay from "react-razorpay";
import { createOrder, collectPayment, bookTour } from "../utils/payments";
import { getProfile } from "../utils/account";
import { downloadTourPdf } from "../utils/ticketPdf";
import { imageUrl } from "../utils/imageUrl";
import tourPhotos from "../constants/tourPhotos.json";

const DEFAULT_FEATURES = ['Hotel stay', 'Transportation', 'Food facilities'];

const SORTS = {
  recommended: { label: 'Top rated', icon: 'fa fa-star', fn: (a, b) => (b.rating || 0) - (a.rating || 0) },
  priceLow: { label: 'Lowest price', icon: 'fa fa-arrow-down', fn: (a, b) => a.tprice - b.tprice },
  priceHigh: { label: 'Highest price', icon: 'fa fa-arrow-up', fn: (a, b) => b.tprice - a.tprice },
};
const SORT_KEYS = Object.keys(SORTS);

const Tours = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [Razorpay] = useRazorpay();
  const { data: tourData, isLoading } = useGetAllToursQuery();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recommended');
  const [selectedTour, setSelectedTour] = useState(null);
  const [booking, setBooking] = useState({ email: '', mobile: '', seats: 1 });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [booked, setBooked] = useState(null);
  const [downloading, setDownloading] = useState(false);
  // Profile of the logged-in user, used to prefill contact details like the bus checkout does.
  const profile = useRef(null);

  const tours = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tourData?.tours || [])
      .filter((t) => !q || `${t.tname} ${t.highlight || ''}`.toLowerCase().includes(q))
      .sort(SORTS[sort].fn);
  }, [tourData, query, sort]);

  const openBooking = (tour) => {
    if (!localStorage.getItem('token')) {
      alert('Please log in to book a tour.');
      navigate('/login');
      return;
    }
    const known = profile.current;
    setBooking({ email: known?.email || '', mobile: known?.mobile || '', seats: 1 });
    setPayError('');
    setSelectedTour(tour);
    if (!known) {
      getProfile()
        .then(({ user }) => {
          profile.current = user;
          // Only fill fields the user hasn't started typing in.
          setBooking((b) => ({ ...b, email: b.email || user.email || '', mobile: b.mobile || user.mobile || '' }));
        })
        .catch(() => {});
    }
  };

  // /tours?book=<id> (from the assistant) opens that tour's booking form directly.
  const bookId = params.get('book');
  useEffect(() => {
    if (!bookId || !tourData?.tours) return;
    const tour = tourData.tours.find((t) => t._id === bookId);
    setParams({}, { replace: true });
    if (tour) openBooking(tour);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, tourData]);

  const onBookingChange = (e) => setBooking({ ...booking, [e.target.name]: e.target.value });
  const changeSeats = (delta) => setBooking({ ...booking, seats: Math.max(1, Math.min(20, Number(booking.seats) + delta)) });

  const HandlePayment = async (e) => {
    e.preventDefault();
    const tour = selectedTour;
    setPaying(true);
    setPayError('');
    try {
      const order = await createOrder({ type: 'tour', tourId: tour._id, travellers: booking.seats });
      const payment = await collectPayment(order, Razorpay, {
        description: tour.tname,
        prefill: { email: booking.email, contact: booking.mobile },
      });
      const result = await bookTour({ tourId: tour._id, travellers: booking.seats, payment });
      setSelectedTour(null);
      setBooked({ tour, travellers: booking.seats, amount: order.amount, demo: result.demo, emailQueued: result.emailQueued, ticket: result.ticket, contact: { ...booking } });
    } catch (err) {
      setPayError(err.message);
    } finally {
      setPaying(false);
    }
  };

  const downloadVoucher = async () => {
    const { tour, ticket, travellers, amount, contact } = booked;
    setDownloading(true);
    try {
      const name = [profile.current?.firstName, profile.current?.lastName].filter(Boolean).join(' ');
      await downloadTourPdf(
        { ...ticket, travellers, price: ticket.price || amount },
        tour,
        { name, email: contact.email, mobile: contact.mobile },
      );
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <Loader />;

  const heroPhoto = tourPhotos.munnar?.src;

  return (
    <>
      <Navbar />
      <div className="tours-page">
        <section className="tours-hero" style={{ backgroundImage: `url('${heroPhoto}')` }}>
          <div className="tours-hero-overlay" />
          <div className="tours-hero-content">
            <span className="tours-hero-eyebrow hero-step"><i className="fa fa-compass" /> {tourData?.tours?.length || 0} curated packages</span>
            <h1 className="hero-step" style={{ animationDelay: '0.15s' }}>Explore Tours</h1>
            <p className="hero-step" style={{ animationDelay: '0.3s' }}>Hand-planned trips with stays, transport and sightseeing included.</p>
          </div>
        </section>

        <div className="container">
          <div className="tours-toolbar">
            <div className="tours-search">
              <i className="fa fa-search" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by city or place, e.g. Jaipur"
              />
              {query && (
                <button type="button" className="tours-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                  <i className="fa fa-times" />
                </button>
              )}
            </div>
            <div className="tours-sort" role="radiogroup" aria-label="Sort tours">
              <span
                className="tours-sort-indicator"
                style={{ transform: `translateX(${SORT_KEYS.indexOf(sort) * 100}%)` }}
              />
              {SORT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={sort === key}
                  className={sort === key ? 'active' : ''}
                  onClick={() => setSort(key)}
                >
                  <i className={SORTS[key].icon} /> {SORTS[key].label}
                </button>
              ))}
            </div>
          </div>

          {tours.length === 0 ? (
            <div className="tours-empty">
              <i className="fa fa-map-signs" />
              <p>No tours match "{query}". Try another city.</p>
            </div>
          ) : (
            <div className="row g-4 tours-grid">
              {tours.map((tour, i) => (
                <Reveal key={tour._id} className="col-lg-4 col-md-6" delay={(i % 3) * 120}>
                  <div className="pkg-card">
                    <Link to={`/tourplaces/${tour._id}`} className="pkg-media">
                      <img src={imageUrl(tour.DispImageurl)} alt={tour.tname} loading="lazy" />
                      {tour.rating && (
                        <span className="pkg-rating"><i className="fa fa-star" /> {tour.rating} <small>({tour.reviews})</small></span>
                      )}
                      <div className="pkg-media-text">
                        <h3>{tour.tname}</h3>
                        {tour.highlight && <p>{tour.highlight}</p>}
                      </div>
                    </Link>
                    <div className="pkg-body">
                      <p className="pkg-duration">
                        <i className="far fa-clock" /> {tour.duration || 'Flexible dates'}
                        <span className="pkg-places"><i className="fa fa-map-marker-alt" /> {tour.places?.length || 0} places</span>
                      </p>
                      <ul className="pkg-features">
                        {(tour.features?.length ? tour.features : DEFAULT_FEATURES).map((f) => <li key={f}>{f}</li>)}
                      </ul>
                      <div className="pkg-footer">
                        <div className="pkg-price">
                          <span>Starting from</span>
                          <strong>₹{tour.tprice.toLocaleString('en-IN')}</strong>
                          <small>per person</small>
                        </div>
                        <div className="tour-actions">
                          <Link to={`/tourplaces/${tour._id}`} className="tour-details-link">Details</Link>
                          <button type="button" className="pkg-btn" onClick={() => openBooking(tour)}>
                            Book now <i className="fa fa-arrow-right" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTour && (
        <div className="booking-backdrop" onClick={() => setSelectedTour(null)}>
          <form className="booking-modal" onClick={(e) => e.stopPropagation()} onSubmit={HandlePayment}>
            <button type="button" className="booking-close" onClick={() => setSelectedTour(null)} aria-label="Close">
              <i className="fa fa-times" />
            </button>
            <div className="booking-head">
              <img src={imageUrl(selectedTour.DispImageurl)} alt="" />
              <div>
                <span>Booking</span>
                <h3>{selectedTour.tname}</h3>
                <p><i className="far fa-clock" /> {selectedTour.duration || 'Flexible dates'}</p>
              </div>
            </div>
            <label>Email
              <input type="email" name="email" required value={booking.email} onChange={onBookingChange} placeholder="you@example.com" />
            </label>
            <label>Phone
              <input type="tel" name="mobile" required pattern="[0-9]{10}" value={booking.mobile} onChange={onBookingChange} placeholder="10-digit mobile number" />
            </label>
            <div className="booking-seats">
              <span>Travellers</span>
              <div className="seat-stepper">
                <button type="button" onClick={() => changeSeats(-1)} aria-label="Fewer travellers">−</button>
                <strong>{booking.seats}</strong>
                <button type="button" onClick={() => changeSeats(1)} aria-label="More travellers">+</button>
              </div>
            </div>
            <div className="booking-total">
              <span>₹{selectedTour.tprice.toLocaleString('en-IN')} × {booking.seats}</span>
              <strong>₹{(selectedTour.tprice * booking.seats).toLocaleString('en-IN')}</strong>
            </div>
            {payError && <div className="booking-error" role="alert"><i className="fa fa-exclamation-circle" /> {payError}</div>}
            <button type="submit" className="pkg-btn booking-pay" disabled={paying}>
              {paying ? 'Processing…' : <>Pay ₹{(selectedTour.tprice * booking.seats).toLocaleString('en-IN')} <i className="fa fa-lock" /></>}
            </button>
          </form>
        </div>
      )}
      {booked && (
        <div className="booking-backdrop" onClick={() => setBooked(null)}>
          <div className="booking-modal booking-done" onClick={(e) => e.stopPropagation()}>
            <div className="booking-done-icon"><i className="fa fa-check" /></div>
            <h3>Tour booked!</h3>
            <p>{booked.tour.tname} for {booked.travellers} traveller{booked.travellers > 1 ? 's' : ''} · ₹{booked.amount.toLocaleString('en-IN')}</p>
            {booked.demo && <p className="booking-demo-note">Demo mode: no payment was taken.</p>}
            {booked.emailQueued && <p className="booking-demo-note"><i className="fa fa-envelope" /> Your voucher PDF is on its way to your account email.</p>}
            {booked.ticket && (
              <button type="button" className="pkg-btn booking-download" onClick={downloadVoucher} disabled={downloading}>
                <i className="fa fa-file-download" /> {downloading ? 'Preparing PDF…' : 'Download tour voucher (PDF)'}
              </button>
            )}
            <div className="booking-done-actions">
              <Link to="/profile?tab=tours" className="tour-details-link">View my bookings</Link>
              <button type="button" className="pkg-btn" onClick={() => setBooked(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
};

export default Tours;
