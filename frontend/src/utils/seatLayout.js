// Seat layouts by bus type. Keep in sync with backend/utils/seatLayout.js.
//   seater:  one deck, 10 rows of 2+2 seats         -> 1A..10D
//   sleeper: two decks, 6 rows of 2+1 berths each    -> L1A..L6C (lower), U1A..U6C (upper)
//   mixed:   seats downstairs (8 rows of 2+2), berths upstairs (6 rows of 2+1)
// In each row the letters in one group sit next to each other (A-B and C-D, or A-B with C alone).

const DECKS = {
  seats10: { name: 'Seats', prefix: '', rows: 10, groups: [['A', 'B'], ['C', 'D']], kind: 'seat', driver: true },
  seats8: { name: 'Lower deck · Seats', prefix: '', rows: 8, groups: [['A', 'B'], ['C', 'D']], kind: 'seat', driver: true },
  lowerBerths: { name: 'Lower deck', prefix: 'L', rows: 6, groups: [['A', 'B'], ['C']], kind: 'berth', driver: true },
  upperBerths: { name: 'Upper deck', prefix: 'U', rows: 6, groups: [['A', 'B'], ['C']], kind: 'berth', driver: false },
};

export const layoutType = (btype = '') => {
  const sleeper = /sleeper/i.test(btype);
  const seater = /seater/i.test(btype);
  if (sleeper && seater) return 'mixed';
  if (sleeper) return 'sleeper';
  return 'seater';
};

export const decksFor = (btype) => ({
  seater: [DECKS.seats10],
  sleeper: [DECKS.lowerBerths, DECKS.upperBerths],
  mixed: [DECKS.seats8, DECKS.upperBerths],
}[layoutType(btype)]);

export const seatId = (deck, row, letter) => `${deck.prefix}${row}${letter}`;

export const totalSeats = (btype) => decksFor(btype).reduce((n, d) => n + d.rows * d.groups.flat().length, 0);

export const neighbours = (btype, seat) => {
  for (const deck of decksFor(btype)) {
    const m = seat.match(new RegExp(`^${deck.prefix}(\\d+)([A-D])$`));
    if (!m || Number(m[1]) > deck.rows) continue;
    const group = deck.groups.find((g) => g.includes(m[2]));
    if (!group) continue;
    return group.filter((c) => c !== m[2]).map((c) => `${deck.prefix}${m[1]}${c}`);
  }
  return [];
};

// 'Female' / 'Male' if this seat sits next to a seat already booked by that gender, else null.
// booked: [{ seat, gender }]
export const genderRule = (btype, seat, booked) => {
  const next = neighbours(btype, seat).map((n) => booked.find((b) => b.seat === n)).find(Boolean);
  return next && ['Male', 'Female'].includes(next.gender) ? next.gender : null;
};
