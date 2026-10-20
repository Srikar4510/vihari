import React, { useEffect, useState } from 'react';
import '../CSS/BackToTop.css';

// Round button in the bottom-right corner that appears after scrolling down.
const BackToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      className={`back-to-top${visible ? ' visible' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
    >
      <i className="fa fa-arrow-up" />
    </button>
  );
};

export default BackToTop;
