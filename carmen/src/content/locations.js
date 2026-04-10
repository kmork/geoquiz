/**
 * Carmen investigation locations — informants + which clue categories each location supplies.
 *
 * Pure content. The game engine asks for LOCATIONS to know what to surface in the
 * Investigate tab and which clue generators are valid for each spot.
 */

export const LOCATIONS = [
  { id: 'airport',  emoji: '✈️', name: 'Airport',  clueTypes: ['geography', 'river_mountain'], informants: [
    { emoji: '🧑‍✈️', prefix: 'An airline attendant revealed' },
    { emoji: '🧳', prefix: 'A fellow traveler shared' },
    { emoji: '🚕', prefix: 'A taxi driver outside told you' },
  ]},
  { id: 'hotel',    emoji: '🏨', name: 'Hotel',    clueTypes: ['famous_for', 'fact'], informants: [
    { emoji: '🏨', prefix: 'The hotel concierge mentioned' },
    { emoji: '🛎️', prefix: 'A bellhop whispered' },
    { emoji: '🧹', prefix: 'A housekeeper recalled' },
  ]},
  { id: 'market',   emoji: '🏪', name: 'Market',   clueTypes: ['exports', 'fact', 'river_mountain'], informants: [
    { emoji: '🛍️', prefix: 'A market vendor confided' },
    { emoji: '🧑‍🍳', prefix: 'A street food vendor said' },
    { emoji: '🏪', prefix: 'A shopkeeper overheard' },
  ]},
  { id: 'library',  emoji: '📚', name: 'Library',  clueTypes: ['empire', 'heritage', 'famous_for', 'fact'], informants: [
    { emoji: '📚', prefix: 'A librarian recalled' },
    { emoji: '👨‍🏫', prefix: 'A professor noted' },
    { emoji: '🗞️', prefix: 'An old journalist mentioned' },
  ]},
  { id: 'embassy',  emoji: '🏛️', name: 'Embassy',  clueTypes: ['heritage', 'geography'], informants: [
    { emoji: '🏛️', prefix: 'An embassy attaché noted' },
    { emoji: '👮', prefix: 'A local officer reported' },
    { emoji: '🧑‍💼', prefix: 'A diplomat mentioned' },
  ]},
];
