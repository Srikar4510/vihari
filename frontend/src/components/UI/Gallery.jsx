import React from 'react';
import '../CSS/Gallery.css';
import { Link } from 'react-router-dom';
import Reveal from './Reveal';
import { PHOTOS } from '../../constants/photos';

const destinations = [
    { name: 'Mumbai', tagline: 'City of Dreams', image: PHOTOS.mumbai.src, area: 'mumbai' },
    { name: 'Chennai', tagline: 'Gateway to the South', image: PHOTOS.chennai.src, area: 'chennai' },
    { name: 'Delhi', tagline: 'Heart of India', image: PHOTOS.delhiPortrait.src, area: 'delhi' },
    { name: 'Hyderabad', tagline: 'City of Pearls', image: PHOTOS.hyderabad.src, area: 'hyderabad' },
    { name: 'Goa', tagline: 'Sun, Sand and Sea', image: PHOTOS.goa.src, area: 'goa' },
    { name: 'Bangalore', tagline: 'Garden City', image: PHOTOS.bangalore.src, area: 'bangalore' },
];

const Gallery = () => {
    return (
        <section id="gallery" className="gallery">
            <div className="container">
                <Reveal className="gallary-header text-center">
                    <h2>Top Destination Places in India</h2>
                    <p>Handpicked cities our travellers love the most.</p>
                </Reveal>
                <div className="destination-grid">
                    {destinations.map((d, i) => (
                        <Reveal key={d.name} effect="zoom" delay={i * 110} className={`destination-cell destination-card--${d.area}`}>
                        <Link to="/tours" className="destination-card">
                            <img src={d.image} alt={d.name} loading="lazy" />
                            <div className="destination-caption">
                                <h3>{d.name}</h3>
                                <span>{d.tagline}</span>
                            </div>
                        </Link>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Gallery;
