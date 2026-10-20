import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "../components/UI/Navbar";
import Footer from "../components/UI/Footer";
import Reveal from "../components/UI/Reveal";
import CountUp from "../components/UI/CountUp";
import "../components/CSS/About.css";
import tourPhotos from "../constants/tourPhotos.json";
import { CONTACT } from "../constants/contact";
import { useSiteStats } from "../utils/siteStats";

// Live counts from the API.
const statItems = (s) => [
  { value: s.buses, label: 'Daily buses' },
  { value: s.routes, label: 'Routes' },
  { value: s.cities, label: 'Cities' },
  { value: s.tours, label: 'Curated tours' },
];

const STEPS = [
  { icon: 'fa fa-search-location', title: 'Search', text: 'Pick where you are starting, where you are going and when. Popular cities show up as you type.' },
  { icon: 'fa fa-chair', title: 'Choose', text: 'Compare operators, bus types, timings and fares, or browse tours with every stop laid out.' },
  { icon: 'fa fa-shield-alt', title: 'Pay and go', text: 'Pay securely with UPI, cards or net banking. Your booking is confirmed instantly.' },
];

const VALUES = [
  { icon: 'fa fa-bolt', title: 'Fast booking', text: 'From search to confirmed seat in under a minute, on any device.' },
  { icon: 'fa fa-tags', title: 'Honest prices', text: 'The fare you see is the fare you pay. No hidden convenience fees.' },
  { icon: 'fa fa-user-check', title: 'Verified partners', text: 'Every bus operator and travel agent is reviewed before going live.' },
  { icon: 'fa fa-map-marked-alt', title: 'Curated trips', text: 'Tours planned stop by stop, with stays, transport and sightseeing.' },
];

const STACK = ['React', 'Redux Toolkit', 'Node.js', 'Express', 'MongoDB', 'Redis', 'Razorpay', 'OpenStreetMap'];

const About = () => {
  const siteStats = useSiteStats();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  // Support links like /about#contact, including from the old /contact page.
  useEffect(() => {
    if (location.hash) {
      // scrollIntoView does not scroll here because the global CSS makes <html> the scroll container.
      const el = document.querySelector(location.hash);
      if (el) {
        // Jump instantly once the page has laid out; a smooth scroll this early gets cancelled.
        setTimeout(() => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 20, behavior: 'instant' }), 300);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // There is no mail backend, so the message opens in the visitor's email app, addressed to the owner.
  const onSubmit = (e) => {
    e.preventDefault();
    const subject = form.subject || `Message from ${form.name}`;
    const body = `${form.message}\n\n${form.name}\n${form.email}`;
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  return (
    <div className="App">
      <Navbar />
      <div className="about-page">
        <section className="about-hero" style={{ backgroundImage: `url('${tourPhotos.valleyofflowers.src}')` }}>
          <div className="about-hero-overlay" />
          <div className="about-hero-content">
            <span className="about-eyebrow hero-step"><i className="fa fa-heart" /> Made for Indian travellers</span>
            <h1 className="hero-step" style={{ animationDelay: '0.15s' }}>About Vihari</h1>
            <p className="hero-step" style={{ animationDelay: '0.3s' }}>
              One place to book buses and curated tours across India, simple enough for anyone to use.
            </p>
          </div>
        </section>

        <section className="container about-story">
          <Reveal effect="left" className="about-story-text">
            <span className="about-kicker">Our story</span>
            <h2>Travel planning, without the tabs and phone calls</h2>
            <p>
              Planning a trip in India usually means juggling operator websites, agent phone numbers and
              screenshots of seat maps. Vihari brings it together: search a route, compare buses, see every
              stop on a tour, and pay in one flow.
            </p>
            <p>
              Vihari (విహారి) means "traveller" in Telugu. The platform connects travellers with bus
              operators and travel agents, who list their own buses and tour packages and manage bookings
              from their dashboards.
            </p>
            <Link to="/tours" className="about-btn">Explore tours <i className="fa fa-arrow-right" /></Link>
          </Reveal>
          <Reveal effect="right" delay={150} className="about-collage">
            <img className="collage-main" src={tourPhotos.hawamahal.src} alt="Hawa Mahal, Jaipur" loading="lazy" />
            <img className="collage-top" src={tourPhotos.palolem.src} alt="Palolem Beach, Goa" loading="lazy" />
            <img className="collage-bottom" src={tourPhotos.munnar.src} alt="Tea plantations, Munnar" loading="lazy" />
            <div className="collage-badge"><i className="fa fa-star" /> 4.8 traveller rating</div>
          </Reveal>
        </section>

        {siteStats?.buses > 0 && (
        <section className="about-stats">
          <div className="container about-stats-grid">
            {statItems(siteStats).map((s, i) => (
              <Reveal key={s.label} delay={i * 100} className="about-stat">
                <strong><CountUp value={s.value} suffix={s.suffix || ''} /></strong>
                <span>{s.label}</span>
              </Reveal>
            ))}
          </div>
        </section>
        )}

        <section className="container about-section">
          <Reveal className="about-heading">
            <span className="about-kicker">How it works</span>
            <h2>Three steps to your next trip</h2>
          </Reveal>
          <div className="about-steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 180} className="about-step">
                <div className="about-step-icon"><i className={s.icon} /><span>{i + 1}</span></div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="about-values-wrap">
          <div className="container about-section">
            <Reveal className="about-heading">
              <span className="about-kicker">What we care about</span>
              <h2>Built around the traveller</h2>
            </Reveal>
            <div className="about-values">
              {VALUES.map((v, i) => (
                <Reveal key={v.title} effect="zoom" delay={i * 120} className="about-value">
                  <i className={v.icon} />
                  <h3>{v.title}</h3>
                  <p>{v.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="container about-section">
          <Reveal className="about-heading">
            <span className="about-kicker">Under the hood</span>
            <h2>Tech behind Vihari</h2>
          </Reveal>
          <Reveal className="about-stack">
            {STACK.map((t) => <span key={t}>{t}</span>)}
          </Reveal>
        </section>

        <section id="contact" className="about-contact-wrap">
          <div className="container about-contact">
            <Reveal effect="left" className="about-contact-info">
              <span className="about-kicker">Get in touch</span>
              <h2>Questions, feedback or partnership ideas?</h2>
              <p>Send a message and I will get back to you, usually within a day.</p>
              <ul>
                <li><i className="fa fa-envelope" /> <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
                <li><i className="fa fa-map-marker-alt" /> {CONTACT.location}</li>
              </ul>
              <div className="about-contact-links">
                {CONTACT.links.map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"><i className={l.icon} /> {l.label}</a>
                ))}
              </div>
            </Reveal>
            <Reveal effect="right" delay={150} className="about-contact-card">
              {sent ? (
                <div className="about-sent">
                  <i className="fa fa-paper-plane" />
                  <h3>Almost there</h3>
                  <p>Your email app should have opened with the message ready. Hit send there to reach me.</p>
                  <button type="button" onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }}>
                    Write another message
                  </button>
                </div>
              ) : (
                <form onSubmit={onSubmit}>
                  <div className="about-form-row">
                    <label>Name<input name="name" required value={form.name} onChange={onChange} placeholder="Your name" /></label>
                    <label>Email<input name="email" type="email" required value={form.email} onChange={onChange} placeholder="you@example.com" /></label>
                  </div>
                  <label>Subject<input name="subject" value={form.subject} onChange={onChange} placeholder="What is it about?" /></label>
                  <label>Message<textarea name="message" required rows={5} value={form.message} onChange={onChange} placeholder="Write your message" /></label>
                  <button type="submit" className="about-btn">Send message <i className="fa fa-paper-plane" /></button>
                </form>
              )}
            </Reveal>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default About;
