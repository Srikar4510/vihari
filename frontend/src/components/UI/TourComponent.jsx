import React from 'react';
import '../CSS/TourComponent.css';
import { Link } from 'react-router-dom';

const TourComponent = ({ image, name, highlight, price, duration, features, rating, reviews, tag }) => {
  return (
    <div className="pkg-card">
      <div className="pkg-media">
        <img src={image} alt={name} loading="lazy" />
        {tag && <span className="pkg-tag"><i className="fa fa-fire" /> {tag}</span>}
        <span className="pkg-rating"><i className="fa fa-star" /> {rating} <small>({reviews})</small></span>
        <div className="pkg-media-text">
          <h3>{name}</h3>
          <p>{highlight}</p>
        </div>
      </div>
      <div className="pkg-body">
        <p className="pkg-duration"><i className="far fa-clock" /> {duration}</p>
        <ul className="pkg-features">
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="pkg-footer">
          <div className="pkg-price">
            <span>Starting from</span>
            <strong>₹{price.toLocaleString('en-IN')}</strong>
            <small>per person</small>
          </div>
          <Link to="/tours" className="pkg-btn">
            Book now <i className="fa fa-arrow-right" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TourComponent;
