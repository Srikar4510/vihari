import React from 'react';
import '../CSS/JourneyStrip.css';
import '../CSS/Animations.css';

const STOPS = ['Hyderabad', 'Vijayawada', 'Chennai', 'Bangalore', 'Goa', 'Mumbai'];

// Decorative strip: a bus drives along a road past city pins.
const JourneyStrip = () => {
  return (
    <div className="journey-strip" aria-hidden="true">
      <div className="journey-road">
        {STOPS.map((city, i) => (
          <div
            key={city}
            className="journey-stop"
            style={{ left: `${8 + i * 16.8}%`, animationDelay: `${i * 0.35}s` }}
          >
            <i className="fa fa-map-marker-alt" />
            <span>{city}</span>
          </div>
        ))}
        <div className="journey-bus">
          <i className="fa fa-bus-alt" />
          <span className="journey-bus-glow" />
        </div>
      </div>
    </div>
  );
};

export default JourneyStrip;
