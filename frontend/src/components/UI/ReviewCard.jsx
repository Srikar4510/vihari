import React from 'react';
import '../CSS/Reviews.css';

const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

const ReviewCard = ({ name, city, trip, rating, matter }) => {
  return (
    <div className="review-card">
        <i className="fa fa-quote-left review-quote" aria-hidden="true" />
        <div className="review-stars" aria-label={`${rating} out of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} className={n <= rating ? 'fa fa-star' : 'far fa-star'} />
          ))}
        </div>
        <p className="review-text">{matter}</p>
        <span className="review-trip">{trip}</span>
        <div className="review-author">
          <div className="review-avatar">{initials(name)}</div>
          <div>
            <h4>{name}</h4>
            <span>{city}</span>
          </div>
        </div>
    </div>
  );
};

export default ReviewCard;
