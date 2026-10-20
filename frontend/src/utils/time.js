import { useEffect, useState } from 'react';

// Local Date for a trip date ("2026-10-24") and a bus time ("10:45 PM").
export const tripDateTime = (dateISO, time = '') => {
  const [y, m, d] = (dateISO || '').split('-').map(Number);
  const t = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!y || !t) return null;
  const hours = (Number(t[1]) % 12) + (t[3].toUpperCase() === 'PM' ? 12 : 0);
  return new Date(y, m - 1, d, hours, Number(t[2]));
};

// Minutes in a bus duration: "10 hrs", "10.5 hrs", "3h 45m" or "45m".
export const durationToMinutes = (durtime = '') => {
  const s = String(durtime).toLowerCase();
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = s.match(/(\d+)\s*m(?!o)/);
  if (!h && !m) return (parseFloat(s) || 0) * 60;
  return Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
};

// Arrival is departure + duration.
export const tripArrival = (departure, durtime = '') => {
  if (!departure) return null;
  return new Date(departure.getTime() + durationToMinutes(durtime) * 60 * 1000);
};

// { days, hours, minutes, seconds } until `target`, or null once it has passed.
export const timeLeft = (target, now = new Date()) => {
  if (!target) return null;
  let s = Math.floor((target - now) / 1000);
  if (s <= 0) return null;
  const days = Math.floor(s / 86400); s -= days * 86400;
  const hours = Math.floor(s / 3600); s -= hours * 3600;
  const minutes = Math.floor(s / 60);
  return { days, hours, minutes, seconds: s - minutes * 60 };
};

// "2d 4h", "3h 12m" or "18m" for compact labels.
export const shortCountdown = (left) => {
  if (!left) return '';
  if (left.days) return `${left.days}d ${left.hours}h`;
  if (left.hours) return `${left.hours}h ${left.minutes}m`;
  return `${Math.max(left.minutes, 1)}m`;
};

// Re-renders every `intervalMs` with the current time.
export const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
};
