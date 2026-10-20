import { useEffect, useState } from 'react';
import { API_URL } from '../config';

// Live counts for the home and About pages, worked out from the public route list and tours.
// Fetched once per page load and shared between components.
let pending = null;

const load = () => {
  if (!pending) {
    pending = Promise.all([
      fetch(`${API_URL}/routes`).then((r) => r.json()),
      fetch(`${API_URL}/api/agent/alltours`).then((r) => r.json()),
    ])
      .then(([routes, tours]) => {
        const list = Array.isArray(routes) ? routes : [];
        return {
          buses: list.reduce((sum, r) => sum + (r.buses || 0), 0),
          routes: list.length,
          cities: new Set(list.flatMap((r) => [r.from, r.to])).size,
          tours: Array.isArray(tours?.tours) ? tours.tours.length : 0,
        };
      })
      .catch(() => {
        pending = null; // allow a retry on the next page that asks
        return null;
      });
  }
  return pending;
};

// Returns { buses, routes, cities, tours }, or null while loading or if the API is unreachable.
export const useSiteStats = () => {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let alive = true;
    load().then((s) => alive && setStats(s));
    return () => { alive = false; };
  }, []);
  return stats;
};
