import React, { useEffect, useRef, useState } from 'react';

// Counts from 0 to `value` with an ease-out curve the first time it scrolls into view.
const CountUp = ({ value, decimals = 0, duration = 1600, suffix = '' }) => {
  const ref = useRef(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let frame;
    const run = () => {
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min((t - t0) / duration, 1);
        setN(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        run();
        observer.disconnect();
      }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return <span ref={ref}>{n.toFixed(decimals)}{suffix}</span>;
};

export default CountUp;
