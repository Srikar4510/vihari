// Seat layouts by bus type. Keep in sync with frontend/src/utils/seatLayout.js.
//   seater:  one deck, 10 rows of 2+2 seats         -> 1A..10D
//   sleeper: two decks, 6 rows of 2+1 berths each    -> L1A..L6C (lower), U1A..U6C (upper)
//   mixed:   seats downstairs (8 rows of 2+2), berths upstairs (6 rows of 2+1)
// In each row the letters in one group sit next to each other (A-B and C-D, or A-B with C alone).

const DECKS = {
  seats10: { prefix: '', rows: 10, groups: [['A', 'B'], ['C', 'D']], kind: 'seat' },
  seats8: { prefix: '', rows: 8, groups: [['A', 'B'], ['C', 'D']], kind: 'seat' },
  lowerBerths: { prefix: 'L', rows: 6, groups: [['A', 'B'], ['C']], kind: 'berth' },
  upperBerths: { prefix: 'U', rows: 6, groups: [['A', 'B'], ['C']], kind: 'berth' },
};

const layoutType = (btype = '') => {
  const sleeper = /sleeper/i.test(btype);
  const seater = /seater/i.test(btype);
  if (sleeper && seater) return 'mixed';
  if (sleeper) return 'sleeper';
  return 'seater';
};

const decksFor = (btype) => ({
  seater: [DECKS.seats10],
  sleeper: [DECKS.lowerBerths, DECKS.upperBerths],
  mixed: [DECKS.seats8, DECKS.upperBerths],
}[layoutType(btype)]);

const allSeats = (btype) => decksFor(btype).flatMap((deck) =>
  Array.from({ length: deck.rows }, (_, i) => deck.groups.flat().map((c) => `${deck.prefix}${i + 1}${c}`)).flat());

// Seats that share a pair with `seat` (the passenger sitting right next to you).
const neighbours = (btype, seat) => {
  for (const deck of decksFor(btype)) {
    const m = seat.match(new RegExp(`^${deck.prefix}(\\d+)([A-D])$`));
    if (!m || Number(m[1]) > deck.rows) continue;
    const group = deck.groups.find((g) => g.includes(m[2]));
    if (!group) continue;
    return group.filter((c) => c !== m[2]).map((c) => `${deck.prefix}${m[1]}${c}`);
  }
  return [];
};

module.exports = { layoutType, allSeats, neighbours };
