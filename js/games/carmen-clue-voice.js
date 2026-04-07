/**
 * Carmen Clue Voice — narrative wrapper for raw clue payloads.
 *
 * Three independent layers:
 *   A. Phrasings    — varied subtext-driven sentences for the same raw fact (by category/subtype).
 *   B. Voice        — per-location tone wrapper that surrounds the phrasing.
 *   C. Micro-action — optional 1-line cinematic action keyed off the informant.
 *
 * Pure module: no DOM, no game state.
 */

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── A. Phrasing pools ────────────────────────────────────────────
// Each entry takes the clue's `data` payload and returns a plain sentence
// fragment. Country redaction is applied to the final composed line.

const PHRASINGS = {
  geography: {
    continent: [
      d => `If you ask me, they didn't leave ${d.continent}. Crossing borders right now is too risky.`,
      d => `Still in ${d.continent}. Whoever this is, they're playing it safe.`,
      d => `No long flights. They stayed close — somewhere in ${d.continent}.`,
    ],
    landlocked: [
      () => `No ports out there. If they went that way, they're staying inland.`,
      () => `Landlocked country. No easy boat ride out.`,
      () => `Place has no coast. Whoever ran there had to go overland.`,
    ],
    capital_letter: [
      d => `City starts with a "${d.letter}", if that helps you any.`,
      d => `The capital? Begins with "${d.letter}". That's all I caught.`,
      d => `I heard the name. Started with "${d.letter}". Couldn't make out the rest.`,
    ],
    population: [
      d => `Population sits at ${d.bracket}. Make of that what you will.`,
      d => `Word is the place holds ${d.bracket} souls. That narrows things.`,
      d => `${d.bracket} people live there. Remember that — it matters.`,
      d => `Census puts it at ${d.bracket}. Don't forget the number.`,
    ],
    neighbors: [
      d => `That country shares borders with ${d.count} ${d.count === 1 ? 'neighbor' : 'neighbors'}. A lot of doors in. A lot of doors out.`,
      d => `${d.count} bordering ${d.count === 1 ? 'country' : 'countries'}. The kind of place a runner likes.`,
    ],
    peak: [
      d => `Mountains over there scrape the sky. ${d.name} tops out at ${d.elev.toLocaleString()} meters.`,
      d => `Highest point's ${d.name}. ${d.elev.toLocaleString()} meters straight up. Hard to hide on a slope like that.`,
      d => `${d.name}. ${d.elev.toLocaleString()} meters. The kind of peak you can see from the next country over.`,
    ],
  },
  exports: [
    d => `${d.list}… that's what keeps the place alive. And worth stealing from.`,
    d => `Big shipments. The kind that move money. ${d.list}.`,
    d => `They were asking about ${d.list}. Specific. Targeted.`,
    d => `The economy out there runs on ${d.list}. Always has.`,
  ],
  famous_for: [
    d => `Famous for ${d.item}, if that means anything to you.`,
    d => `People come from all over for ${d.item}. Maybe the thief did too.`,
    d => `${d.item}. That's what the place sells to the world.`,
  ],
  landmarks: [
    d => `Old stones, old secrets. Place called ${d.siteName}.`,
    d => `${d.siteName}. The kind of landmark thieves stare at a long time before they move.`,
    d => `Whoever it is, they were near ${d.siteName}. Guards saw nothing unusual. That's the tell.`,
  ],
  river_mountain: [
    d => `The ${d.name}. You can't move through that country without crossing it.`,
    d => `They followed the ${d.name}. That much is certain.`,
    d => `${d.name} runs right through the place. Convenient cover.`,
  ],
  history: [
    d => `Built empires once. Still carries the weight of it. The ${d.name}.`,
    d => `That land remembers the ${d.name}. And so does whoever's running.`,
    d => `Old ${d.name} territory. The kind of history thieves study.`,
  ],
  // Generic fallback bucket — used when a clue has only a `text` field (e.g. country facts).
  fact: [
    d => d.text,
    d => `Word on the ground: ${d.text}`,
    d => `Locals keep saying the same thing — ${d.text}`,
  ],
};

// ─── B. Location voice wrappers ───────────────────────────────────
// Each voice takes the inner phrasing and wraps it in a tone consistent
// with the kind of person at that location.

const VOICE = {
  airport: [
    line => `Yeah… ${line}`,
    line => `Hard to say for sure, but ${line}`,
    line => `Heard it on the terminal floor — ${line}`,
  ],
  hotel: [
    line => `We don't usually say, but… ${line}`,
    line => `The guest mentioned something odd. ${line}`,
    line => `I wouldn't swear to it, but ${line}`,
  ],
  market: [
    line => `Listen, friend — ${line}`,
    line => `Everyone around here talks. ${line}`,
    line => `${line} That's what they were after.`,
  ],
  library: [
    line => `If you cross-reference the records, ${line}`,
    line => `The sources are clear on this. ${line}`,
    line => `${line} Historically speaking.`,
  ],
  embassy: [
    line => `Off the record — ${line}`,
    line => `We've heard reports. Unconfirmed. ${line}`,
    line => `${line} You didn't hear it from me.`,
  ],
};

// ─── C. Micro-actions ─────────────────────────────────────────────
// Optional 1-line actions prepended to the dialogue. Keyed by informant
// emoji, with a per-location fallback for unmapped informants.

const ACTIONS_BY_INFORMANT = {
  '🧑‍✈️': [`The attendant barely glanced up from her clipboard.`, `She checked her watch twice before answering.`],
  '🧳':   [`The traveler set down his bag, careful, deliberate.`, `He kept one eye on the departure board.`],
  '🚕':   [`The cabbie tapped his meter and leaned back.`, `He didn't kill the engine.`],
  '🏨':   [`The concierge straightened a stack of brochures.`, `He glanced toward the lobby before answering.`],
  '🛎️':   [`The bellhop lowered his voice.`, `He glanced toward the front desk.`],
  '🧹':   [`She set the linens down before she'd talk.`, `She wouldn't meet your eyes.`],
  '🛍️':   [`The vendor didn't look up from his stall.`, `He kept counting coins as he spoke.`],
  '🧑‍🍳': [`She wiped her hands on her apron before speaking.`, `He stirred the pot, slow.`],
  '🏪':   [`The shopkeeper drew the curtain half-closed.`, `He pretended to count inventory.`],
  '📚':   [`The librarian adjusted his glasses.`, `She closed the book carefully before answering.`],
  '👨‍🏫': [`The professor steepled his fingers.`, `He paused, weighing his words.`],
  '🗞️':   [`The old reporter exhaled smoke through his nose.`, `She tapped a yellowed clipping for emphasis.`],
  '🏛️':   [`The attaché chose his words with care.`, `She let a long silence pass first.`],
  '👮':   [`The officer adjusted his cap.`, `He looked left, then right, then talked.`],
  '🧑‍💼': [`The diplomat fixed his cufflinks.`, `She poured tea for both of you before answering.`],
};

const ACTIONS_BY_LOCATION = {
  airport: [`Footsteps on tile. Announcements overhead.`, `An overhead speaker garbled a flight number.`],
  hotel:   [`Somewhere down the hall, a door clicked shut.`, `The lobby clock ticked once, loud.`],
  market:  [`Smoke from a nearby grill curled past you.`, `A radio played somewhere behind the stalls.`],
  library: [`Pages turned in the next aisle.`, `The reading lamp threw long shadows on the table.`],
  embassy: [`A clock somewhere in the building chimed the hour.`, `The flag in the corner stirred when the door opened.`],
};

function pickAction(informant, locationId) {
  const fromInformant = informant?.emoji && ACTIONS_BY_INFORMANT[informant.emoji];
  if (fromInformant) return pick(fromInformant);
  const fromLocation = ACTIONS_BY_LOCATION[locationId];
  if (fromLocation) return pick(fromLocation);
  return null;
}

// ─── Composer ─────────────────────────────────────────────────────

/**
 * Compose a noir-rendered clue line.
 *
 * @param {Object} clue        — { id, category, subtype?, data, text? }
 * @param {Object} informant   — { emoji, prefix }
 * @param {string} locationId  — 'airport' | 'hotel' | 'market' | 'library' | 'embassy'
 * @param {Function} redactFn  — (text) => text — runs country-name redaction
 * @returns {string} The full speech-bubble text (may include a leading micro-action line + newline).
 */
export function composeClue(clue, informant, locationId, redactFn) {
  // 1. Pick a phrasing.
  let pool = null;
  if (clue.category === 'geography' && clue.subtype && PHRASINGS.geography[clue.subtype]) {
    pool = PHRASINGS.geography[clue.subtype];
  } else if (PHRASINGS[clue.category]) {
    pool = PHRASINGS[clue.category];
  } else {
    pool = PHRASINGS.fact;
  }
  const phrasing = pick(pool);

  // Build the data payload — fall back to clue.text if no structured data.
  const data = clue.data || { text: clue.text };
  let inner;
  try {
    inner = phrasing(data);
  } catch {
    inner = clue.text || '';
  }

  // 2. Voice wrapper by location.
  const voicePool = VOICE[locationId] || VOICE.library;
  let voiced = pick(voicePool)(inner);

  // Capitalize first letter of the dialogue.
  if (voiced) voiced = voiced.charAt(0).toUpperCase() + voiced.slice(1);

  // Run country-name redaction on the final composed line.
  if (redactFn) voiced = redactFn(voiced);

  // 3. Optional micro-action (~50% of the time).
  let action = null;
  if (Math.random() < 0.5) {
    action = pickAction(informant, locationId);
    if (action && redactFn) action = redactFn(action);
  }

  return { dialogue: voiced, action };
}
