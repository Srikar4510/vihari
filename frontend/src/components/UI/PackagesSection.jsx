import React from 'react';
import TourComponent from './TourComponent';
import Reveal from './Reveal';
import { PHOTOS } from '../../constants/photos';
import '../CSS/PackagesSection.css';

const tours = [
  {
    name: 'Agra',
    highlight: 'Taj Mahal and Agra Fort',
    image: PHOTOS.agra.src,
    price: 499,
    duration: '1 Day',
    features: ['AC transport', 'Entry tickets', 'Sunrise at the Taj'],
    rating: 4.6,
    reviews: 254,
  },
  {
    name: 'Hyderabad',
    highlight: 'Charminar, Golconda and biryani trail',
    image: PHOTOS.hyderabad.src,
    price: 1499,
    duration: '3 Days 2 Nights',
    features: ['5★ stay', 'AC transport', 'All meals'],
    rating: 4.8,
    reviews: 344,
    tag: 'Best seller',
  },
  {
    name: 'Delhi',
    highlight: 'Red Fort, India Gate and Qutub Minar',
    image: PHOTOS.delhi.src,
    price: 1199,
    duration: '3 Days 2 Nights',
    features: ['5★ stay', 'AC transport', 'Food included'],
    rating: 4.7,
    reviews: 544,
  },
];

const PackagesSection = () => {
  return (
    <section id="pack" className="packages">
      <div className="container">
        <Reveal className="gallary-header text-center">
          <h2>Special Tours</h2>
          <p>Explore incredible India with our specialised packages.</p>
        </Reveal>
        <div className="row g-4 pkg-row">
          {tours.map((tour, i) => (
            <Reveal key={tour.name} className="col-lg-4 col-md-6" delay={i * 150}>
              <TourComponent {...tour} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PackagesSection;
