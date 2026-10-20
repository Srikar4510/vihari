import React from 'react';
import '../CSS/Services.css';
import Reveal from './Reveal';

const services = [
  {
    icon: 'fa fa-bus',
    title: 'Wide Bus Network',
    description: '180+ daily buses on 46 routes across South, West and North India, from budget seaters to AC sleepers.',
  },
  {
    icon: 'fa fa-map-marked-alt',
    title: 'Curated Tours',
    description: 'Hand-planned city packages with hotels, transport and sightseeing included, so you just show up.',
  },
  {
    icon: 'fa fa-shield-alt',
    title: 'Secure Payments',
    description: 'Pay safely with UPI, cards or net banking through Razorpay. Your ticket is confirmed instantly.',
  },
  {
    icon: 'fa fa-headset',
    title: '24x7 Support',
    description: 'Verified operators, live booking updates and a support team that is available round the clock.',
  },
];

const Services = () => {
  return (
    <section id="services" className="services-section">
      <div className="container">
        <Reveal className="gallary-header text-center">
          <h2>Why Travel With Us</h2>
          <p>Everything you need for a stress-free journey, in one place.</p>
        </Reveal>
        <div className="row g-4 services-row">
          {services.map((s, i) => (
            <Reveal className="col-lg-3 col-md-6" key={s.title} delay={i * 120}>
              <div className="service-card">
                <div className="service-icon"><i className={s.icon} /></div>
                <h4>{s.title}</h4>
                <p>{s.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
