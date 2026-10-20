import React from 'react';
import Navbar from '../components/UI/Navbar';
import Footer from '../components/UI/Footer';
import { PHOTOS } from '../constants/photos';
import TOUR_PHOTOS from '../constants/tourPhotos.json';

// Attribution for the Wikimedia Commons photos, as their CC BY / CC BY-SA / FAL licenses require.
const Credits = () => (
  <>
    <Navbar />
    <main className="container" style={{ fontSize: 16, padding: '60px 15px', minHeight: '60vh', textAlign: 'left' }}>
      <h2 style={{ fontSize: 30, fontWeight: 600, marginBottom: 8 }}>Photo credits</h2>
      <p style={{ color: '#6b7b84', marginBottom: 28 }}>Destination photos are from Wikimedia Commons.</p>
      <ul style={{ lineHeight: 2, paddingLeft: 20 }}>
        {[...Object.values(PHOTOS), ...Object.values(TOUR_PHOTOS)]
          .filter((p, i, all) => all.findIndex((q) => q.page === p.page) === i)
          .map((p) => (
          <li key={p.page}>
            <a href={p.page} target="_blank" rel="noopener noreferrer">{p.title || decodeURIComponent(p.page.split('File:')[1]).replace(/_/g, ' ')}</a> by {p.author}, {p.license}
          </li>
        ))}
      </ul>
    </main>
    <Footer />
  </>
);

export default Credits;
