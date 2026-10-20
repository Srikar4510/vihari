import { jsPDF } from 'jspdf';
import { imageUrl } from './imageUrl';
import { API_URL } from '../config';

const TEAL = [31, 181, 196];
const DARK = [31, 45, 54];
const GREY = [110, 125, 135];
const LIGHT = [234, 251, 251];

const titleCase = (s = '') => s.replace(/\b\w/g, (c) => c.toUpperCase());
// The built-in PDF fonts have no rupee glyph, so amounts are written as "Rs.".
const money = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// Builds an A4 e-ticket for a bus booking and downloads it.
// ticket: { _id, date, amount, createdAt, tickets: [{ seat, name, age, gender }] }, bus: the booked bus.
export const downloadTicketPdf = (ticket, bus) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const bookingId = ticket._id.slice(-8).toUpperCase();
  const from = titleCase(bus?.srcname);
  const to = titleCase(bus?.destname);

  // Header band
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 110, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('Vihari', M, 58);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...TEAL);
  doc.text('Bus e-ticket', M, 80);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('Booking ID', W - M, 50, { align: 'right' });
  doc.setFont('courier', 'bold');
  doc.setFontSize(18);
  doc.text(bookingId, W - M, 72, { align: 'right' });

  // Route
  let y = 160;
  doc.setTextColor(...GREY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('FROM', M, y);
  doc.text('TO', W - M, y, { align: 'right' });
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(from, M, y + 28);
  doc.text(to, W - M, y + 28, { align: 'right' });
  doc.setFontSize(14);
  doc.setTextColor(...TEAL);
  doc.text(bus?.deptime || '', M, y + 50);
  doc.text(bus?.arrtime || '', W - M, y + 50, { align: 'right' });
  doc.setDrawColor(...TEAL);
  doc.setLineDashPattern([4, 4], 0);
  doc.line(M + 150, y + 20, W - M - 150, y + 20);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GREY);
  doc.text(bus?.durtime || '', W / 2, y + 12, { align: 'center' });

  // Trip details grid
  y += 90;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, W - 2 * M, 76, 8, 8, 'F');
  const cols = [
    ['Travel date', longDate(ticket.date)],
    ['Operator', bus?.trname || '-'],
    ['Bus type', bus?.btype || '-'],
    ['Seats', ticket.tickets.map((t) => t.seat).join(', ')],
  ];
  const colW = (W - 2 * M) / cols.length;
  cols.forEach(([label, value], i) => {
    const x = M + 16 + i * colW;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text(doc.splitTextToSize(value, colW - 24), x, y + 46);
  });

  // Passengers table
  y += 116;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text('Passengers', M, y);
  y += 16;
  const headers = ['Seat', 'Name', 'Age', 'Gender'];
  const xs = [M + 12, M + 90, W - M - 160, W - M - 80];
  doc.setFillColor(...DARK);
  doc.rect(M, y, W - 2 * M, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  headers.forEach((h, i) => doc.text(h, xs[i], y + 17));
  y += 26;
  doc.setFont('helvetica', 'normal');
  ticket.tickets.forEach((p, i) => {
    if (i % 2) {
      doc.setFillColor(247, 249, 250);
      doc.rect(M, y, W - 2 * M, 26, 'F');
    }
    doc.setTextColor(...DARK);
    [p.seat, p.name, String(p.age), p.gender].forEach((v, j) => doc.text(v, xs[j], y + 17));
    y += 26;
  });

  // Amount
  y += 24;
  doc.setDrawColor(220, 228, 232);
  doc.line(M, y, W - M, y);
  y += 30;
  doc.setFontSize(12);
  doc.setTextColor(...GREY);
  doc.text('Total paid', M, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.text(money(ticket.amount), W - M, y, { align: 'right' });

  // Notes
  y += 50;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  const notes = [
    'Please reach the boarding point at least 15 minutes before departure.',
    'Carry a valid photo ID for every passenger. Show this e-ticket on your phone or as a printout.',
    ticket.createdAt ? `Booked on ${new Date(ticket.createdAt).toLocaleString('en-IN')}.` : '',
  ].filter(Boolean);
  notes.forEach((n) => { doc.text(`- ${n}`, M, y); y += 14; });

  // Footer
  const H = doc.internal.pageSize.getHeight();
  doc.setFillColor(...TEAL);
  doc.rect(0, H - 6, W, 6, 'F');
  doc.setFontSize(9);
  doc.text('Vihari: buses and curated tours across India', W / 2, H - 20, { align: 'center' });

  doc.save(`vihari-ticket-${bookingId}.pdf`);
};

const API = API_URL;

// Loads an image and crops it to the given aspect ratio as a JPEG data URL.
// Resolves null when the image can't be loaded (offline, blocked, no CORS) so the PDF still builds.
const loadImage = (src, aspect, maxW = 900, timeoutMs = 5000) => new Promise((resolve) => {
  if (!src) return resolve(null);
  const img = new Image();
  const timer = setTimeout(() => resolve(null), timeoutMs);
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    clearTimeout(timer);
    try {
      let sw = img.naturalWidth;
      let sh = sw / aspect;
      if (sh > img.naturalHeight) { sh = img.naturalHeight; sw = sh * aspect; }
      const w = Math.min(maxW, sw);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = w / aspect;
      canvas.getContext('2d').drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    } catch {
      resolve(null);
    }
  };
  img.onerror = () => { clearTimeout(timer); resolve(null); };
  img.src = src;
});

const fetchPlaces = async (tourId) => {
  try {
    const res = await fetch(`${API}/api/agent/tourplaces/${tourId}`);
    if (!res.ok) return [];
    return (await res.json()).places || [];
  } catch {
    return [];
  }
};

// Builds a detailed A4 voucher for a tour booking (cover photo, highlights, inclusions,
// day-by-day places with photos, travellers and payment) and downloads it.
// booking: { _id, travellers, price, bookedAt }, tour: the booked tour,
// contact (optional): { name, email, mobile } of the person who booked.
export const downloadTourPdf = async (booking, tour, contact = {}) => {
  const places = await fetchPlaces(tour._id);
  const [cover, ...thumbs] = await Promise.all([
    loadImage(imageUrl(tour.DispImageurl), 2.6),
    ...places.map((p) => loadImage(imageUrl(p.Imageurl), 4 / 3, 320)),
  ]);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const bookingId = booking._id.slice(-8).toUpperCase();
  const travellers = Number(booking.travellers) || 1;
  const features = tour.features?.length ? tour.features : ['Hotel stay', 'Transportation', 'Food facilities'];

  const footer = () => {
    doc.setFillColor(...TEAL);
    doc.rect(0, H - 6, W, 6, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text('Vihari: buses and curated tours across India', W / 2, H - 20, { align: 'center' });
    doc.text(`Booking ${bookingId}  ·  Page ${doc.getNumberOfPages()}`, W - M, H - 20, { align: 'right' });
  };
  let y;
  // Starts a new page when the next block would run into the footer.
  const ensure = (needed) => {
    if (y + needed <= H - 50) return;
    footer();
    doc.addPage();
    y = 56;
  };
  const sectionTitle = (title) => {
    ensure(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...DARK);
    doc.text(title, M, y);
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(2);
    doc.line(M, y + 6, M + 28, y + 6);
    doc.setLineWidth(1);
    y += 24;
  };

  // Header band
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 110, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('Vihari', M, 58);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...TEAL);
  doc.text('Tour booking voucher', M, 80);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('Booking ID', W - M, 50, { align: 'right' });
  doc.setFont('courier', 'bold');
  doc.setFontSize(18);
  doc.text(bookingId, W - M, 72, { align: 'right' });

  // Cover photo
  y = 130;
  const coverH = (W - 2 * M) / 2.6;
  if (cover) {
    doc.addImage(cover, 'JPEG', M, y, W - 2 * M, coverH);
    y += coverH + 28;
  } else {
    y += 10;
  }

  // Title, highlight and quick facts
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...DARK);
  const title = doc.splitTextToSize(tour.tname || 'Tour', W - 2 * M);
  doc.text(title, M, y);
  y += title.length * 26;
  if (tour.highlight) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...GREY);
    const hl = doc.splitTextToSize(tour.highlight, W - 2 * M);
    doc.text(hl, M, y);
    y += hl.length * 15;
  }
  const facts = [
    tour.duration,
    tour.rating ? `Rated ${tour.rating}/5${tour.reviews ? ` (${tour.reviews.toLocaleString('en-IN')} reviews)` : ''}` : null,
    places.length ? `${places.length} places` : null,
  ].filter(Boolean);
  if (facts.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...TEAL);
    doc.text(facts.join('   •   '), M, y + 4);
    y += 18;
  }

  // Booking details grid
  y += 12;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, W - 2 * M, 72, 8, 8, 'F');
  const cols = [
    ['Travellers', `${travellers} ${travellers > 1 ? 'people' : 'person'}`],
    ['Booked on', booking.bookedAt ? new Date(booking.bookedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'],
    ['Booked by', contact.name || contact.email || '-'],
    ['Phone', contact.mobile || '-'],
  ];
  const colW = (W - 2 * M) / cols.length;
  cols.forEach(([label, value], i) => {
    const x = M + 16 + i * colW;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text(doc.splitTextToSize(String(value), colW - 24).slice(0, 2), x, y + 46);
  });
  y += 104;

  // Inclusions as pills
  sectionTitle("What's included");
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  let x = M;
  features.forEach((f) => {
    const w = doc.getTextWidth(f) + 34;
    if (x + w > W - M) { x = M; y += 30; }
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y - 14, w, 22, 11, 11, 'F');
    doc.setFillColor(...TEAL);
    doc.circle(x + 12, y - 3, 3, 'F');
    doc.setTextColor(...DARK);
    doc.text(f, x + 22, y + 1);
    x += w + 8;
  });
  y += 36;

  // Itinerary: one card per place with a thumbnail and the full description
  sectionTitle('Itinerary');
  if (!places.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...GREY);
    doc.text('The detailed itinerary will be shared by the tour partner before the trip.', M, y);
    y += 24;
  }
  const thumbW = 96;
  const thumbH = 72;
  places.forEach((p, i) => {
    const textX = M + thumbW + 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const desc = doc.splitTextToSize(p.description || '', W - M - textX);
    const blockH = Math.max(thumbH, 22 + desc.length * 12.5) + 18;
    ensure(blockH);
    if (thumbs[i]) {
      doc.addImage(thumbs[i], 'JPEG', M, y, thumbW, thumbH);
    } else {
      doc.setFillColor(...LIGHT);
      doc.rect(M, y, thumbW, thumbH, 'F');
    }
    doc.setFillColor(...TEAL);
    doc.circle(M + 12, y + 12, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), M + 12, y + 15.5, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text(p.name || `Stop ${i + 1}`, textX, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...GREY);
    doc.text(desc, textX, y + 30);
    y += blockH;
    if (i < places.length - 1) {
      doc.setDrawColor(230, 236, 239);
      doc.line(textX, y - 9, W - M, y - 9);
    }
  });

  // Payment summary
  ensure(110);
  y += 8;
  sectionTitle('Payment');
  const perPerson = Math.round((booking.price || 0) / travellers);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...GREY);
  doc.text(`${money(perPerson)} x ${travellers} traveller${travellers > 1 ? 's' : ''}`, M, y);
  doc.text(money(booking.price), W - M, y, { align: 'right' });
  y += 14;
  doc.setDrawColor(220, 228, 232);
  doc.line(M, y, W - M, y);
  y += 26;
  doc.setFontSize(12);
  doc.text('Total paid', M, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.text(money(booking.price), W - M, y, { align: 'right' });
  y += 36;

  // Notes
  const notes = [
    'The tour partner will contact you on the booking phone number with pickup time and hotel details.',
    'Carry a valid photo ID for every traveller. Show this voucher on your phone or as a printout.',
    'Entry tickets for monuments and personal expenses are not included unless listed above.',
  ];
  ensure(notes.length * 14 + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  notes.forEach((n) => { doc.text(`- ${n}`, M, y); y += 14; });

  footer();
  const slug = (tour.tname || 'tour').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`vihari-tour-${slug}-${bookingId}.pdf`);
};
