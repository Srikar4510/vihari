import React, { useState } from 'react';
import '../CSS/Footer.css';
import { Link } from 'react-router-dom';
import { CONTACT } from '../../constants/contact';

const EXPLORE = [
    { to: '/', label: 'Home' },
    { to: '/tours', label: 'Tours' },
    { to: '/about', label: 'About us' },
    { to: '/about#contact', label: 'Contact us' },
    { to: '/agentSignUp', label: 'Partner with us' },
];

const ROUTES = ['Hyderabad → Bangalore', 'Bangalore → Chennai', 'Mumbai → Goa', 'Delhi → Jaipur', 'Vijayawada → Vizag'];

const Footer = () => {
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);

    const subscribe = (e) => {
        e.preventDefault();
        if (email.trim()) {
            setSubscribed(true);
            setEmail('');
        }
    };

    return (
        <footer className="site-footer">
            <div className="footer-glow" />
            <div className="container">
                <div className="footer-newsletter">
                    <div>
                        <h3>Get travel deals in your inbox</h3>
                        <p>New routes, seasonal offers and tour picks. No spam, unsubscribe any time.</p>
                    </div>
                    {subscribed ? (
                        <p className="footer-subscribed"><i className="fa fa-check-circle" /> You're subscribed. Happy travels!</p>
                    ) : (
                        <form className="footer-form" onSubmit={subscribe}>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                aria-label="Email address"
                            />
                            <button type="submit">Subscribe <i className="fa fa-paper-plane" /></button>
                        </form>
                    )}
                </div>

                <div className="footer-grid">
                    <div className="footer-brand">
                        <Link to="/" className="footer-logo"><i className="fa fa-bus-alt" /> Vihari</Link>
                        <p>Buses and curated tours across India, booked in a few clicks with secure payments and 24x7 support.</p>
                        <div className="footer-socials">
                            {CONTACT.links.map((s) => (
                                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                                    <i className={s.icon} />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4>Explore</h4>
                        <ul className="footer-links">
                            {EXPLORE.map((l) => (
                                <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4>Popular routes</h4>
                        <ul className="footer-links">
                            {ROUTES.map((r) => (
                                <li key={r}><Link to="/">{r}</Link></li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4>Contact</h4>
                        <ul className="footer-contact">
                            <li><i className="fa fa-map-marker-alt" /> {CONTACT.location}</li>
                            <li><i className="fa fa-envelope" /> <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
                            {CONTACT.links.map((l) => (
                                <li key={l.label}><i className={l.icon} /> <a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <span>© {new Date().getFullYear()} <strong>Vihari</strong>. Designed and built by{' '}
                        <a href={CONTACT.links[2].href} target="_blank" rel="noopener noreferrer">{CONTACT.owner}</a>.</span>
                    <Link to="/credits">Photo credits</Link>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
