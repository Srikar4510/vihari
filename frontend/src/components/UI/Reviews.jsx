import React from 'react';
import ReviewCard from './ReviewCard';
import Reveal from './Reveal';
import '../CSS/Reviews.css';

const reviewsData = [
  {
    name: 'Anil Kumar',
    city: 'Hyderabad',
    trip: 'Hyderabad → Bangalore, AC Sleeper',
    rating: 5,
    matter: 'Booked an overnight sleeper in under two minutes. The bus left on time, was clean, and the seat map matched exactly what I picked.',
  },
  {
    name: 'Yaswanth Reddy',
    city: 'Vijayawada',
    trip: 'Bangalore Garden City tour',
    rating: 5,
    matter: 'The Bangalore package covered the palace, Lalbagh and ISKCON without any rushing. Good hotel and a very friendly guide.',
  },
  {
    name: 'Harihar Rao',
    city: 'Visakhapatnam',
    trip: 'Vijayawada → Visakhapatnam, Seater',
    rating: 4,
    matter: 'Paid with UPI and got the ticket instantly. Prices were lower than the counter. Would love more evening departures.',
  },
  {
    name: 'Stephen Joseph',
    city: 'Chennai',
    trip: 'Goa Beach Holiday',
    rating: 5,
    matter: 'Our family trip to Goa was planned end to end. The Mandovi cruise was the highlight. Support answered my call at midnight.',
  },
];

const Reviews = () => {
  return (
    <section id="reviews" className="reviews-section">
      <div className="container">
        <Reveal className="gallary-header text-center">
          <h2>What Travellers Say</h2>
          <p>Rated 4.8/5 by travellers across India.</p>
        </Reveal>
        <div className="row g-4 reviews-row">
          {reviewsData.map((review, i) => (
            <Reveal className="col-lg-3 col-md-6" key={review.name} effect={i % 2 ? 'right' : 'left'} delay={i * 120}>
              <ReviewCard {...review} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Reviews;
