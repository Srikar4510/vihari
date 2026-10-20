import React, { useState, useEffect } from "react";
import '../CSS/TravelPage.css';
import '../CSS/Animations.css';
import SearchForm from "./SearchForm";

const STATS = [
  { value: 184, suffix: '+', label: 'Daily buses' },
  { value: 46, suffix: '', label: 'Routes' },
  { value: 16, suffix: '', label: 'Cities' },
  { value: 4.8, suffix: '★', label: 'Traveller rating', decimals: 1 },
];

// Counts from 0 up to `value` once, with an ease-out curve.
const CountUp = ({ value, decimals = 0, duration = 1600, start }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return undefined;
    let frame;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / duration, 1);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, start]);
  return n.toFixed(decimals);
};

const TravelPage = () => {
  const [statsStarted, setStatsStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStatsStarted(true), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="travel-page">
      {/* Background layers are clipped separately so the search dropdowns can overflow the hero. */}
      <div className="travel-clip">
        <div className="travel-bg" style={{ backgroundImage: "url('../b2.jpg')" }} />
        <div className="travel-overlay" />
        <div className="travel-cloud travel-cloud--1" />
        <div className="travel-cloud travel-cloud--2" />
        <div className="travel-cloud travel-cloud--3" />
      </div>

      <div className="travel-content">
        <span className="travel-eyebrow hero-step" style={{ animationDelay: '0.1s' }}>
          <i className="fa fa-location-arrow" /> Explore India your way
        </span>
        <h1 id="animation-title" className="travel hero-step" style={{ animationDelay: '0.25s' }}>Travel Tour</h1>
        <p className="travel-subtitle hero-step" style={{ animationDelay: '0.4s' }}>
          Book buses and curated tours across India in a few clicks.
        </p>

        <div className="hero-step hero-search" style={{ animationDelay: '0.55s' }}>
          <SearchForm variant="hero" />
        </div>

        <div className="hero-stats hero-step" style={{ animationDelay: '0.75s' }}>
          {STATS.map((s) => (
            <div className="hero-stat" key={s.label}>
              <strong><CountUp value={s.value} decimals={s.decimals} start={statsStarted} />{s.suffix}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <a href="#gallery" className="scroll-hint" aria-label="Scroll to destinations">
        <span />
      </a>
    </section>
  );
};

export default TravelPage;
