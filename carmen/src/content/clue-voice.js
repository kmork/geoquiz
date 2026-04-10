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
    line => `Didn’t catch all of it, but ${line}`,
    line => `People were moving fast. Still — ${line}`,
    line => `Caught it between announcements. ${line}`,
    line => `Could’ve sworn I heard — ${line}`,
    line => `They didn’t stick around long. ${line}`,
    line => `All I got before they boarded was this: ${line}`,
  ],
  hotel: [
    line => `We don't usually say, but… ${line}`,
    line => `The guest mentioned something odd. ${line}`,
    line => `I wouldn't swear to it, but ${line}`,
    line => `Guests talk when they think no one’s listening. ${line}`,
    line => `I remember it because it stood out. ${line}`,
    line => `It wasn’t typical. ${line}`,
    line => `Something about that stayed with me. ${line}`,
    line => `They made a point of asking. ${line}`,
    line => `Quiet type. Still — ${line}`,
  ],
  market: [
    line => `Listen, friend — ${line}`,
    line => `Everyone around here talks. ${line}`,
    line => `${line} That's what they were after.`,
    line => `Word travels fast here. ${line}`,
    line => `Heard it twice already today. ${line}`,
    line => `You’re not the first to ask. ${line}`,
    line => `People notice things here. ${line}`,
    line => `That’s what the talk’s been about. ${line}`,
    line => `If you listen long enough, you hear everything. ${line}`,
  ],
  library: [
    line => `If you cross-reference the records, ${line}`,
    line => `The sources are clear on this. ${line}`,
    line => `${line} Historically speaking.`,
    line => `Records indicate that ${line}`,
    line => `It aligns with documented patterns. ${line}`,
    line => `That detail appears consistently. ${line}`,
    line => `There’s agreement across sources. ${line}`,
    line => `Cross-checking confirms it. ${line}`,
    line => `The documentation supports that. ${line}`,
  ],
  embassy: [
    line => `Off the record — ${line}`,
    line => `We've heard reports. Unconfirmed. ${line}`,
    line => `${line} You didn't hear it from me.`,
    line => `Officially, we know nothing. Unofficially… ${line}`,
    line => `You didn’t get this from me. ${line}`,
    line => `This hasn’t been confirmed, but ${line}`,
    line => `There are… indications. ${line}`,
    line => `I’d be careful repeating this, but ${line}`,
    line => `That’s all I’m willing to say: ${line}`,
  ],
};

// ─── C. Micro-actions ─────────────────────────────────────────────
// Optional 1-line actions prepended to the dialogue. Keyed by informant
// emoji, with a per-location fallback for unmapped informants.

const ACTIONS_BY_INFORMANT = {
  // ── Airport ──
  '🧑‍✈️': [
    `The attendant barely glanced up from her clipboard.`,
    `She checked her watch twice before answering.`,
    `She tore a boarding pass in half without looking.`,
    `Her pen hovered over the manifest as she spoke.`,
    `She tilted her head toward the gate, eyes elsewhere.`,
    `She spoke over the PA hiss, voice flat.`,
    `Her badge swung as she turned to face you.`,
  ],
  '🧳': [
    `The traveler set down his bag, careful, deliberate.`,
    `He kept one eye on the departure board.`,
    `He zipped his bag shut before saying a word.`,
    `He pulled his hat low and spoke without turning.`,
    `His passport poked out of his jacket pocket.`,
    `He shifted his weight from one foot to the other.`,
    `He glanced at the arrivals screen mid-sentence.`,
  ],
  '🚕': [
    `The cabbie tapped his meter and leaned back.`,
    `He didn't kill the engine.`,
    `He drums his fingers on the steering wheel.`,
    `The engine idles low while he talks.`,
    `He checks the mirror before answering.`,
    `He adjusted the rearview and caught your eye in it.`,
    `His radio crackled between words.`,
    `He spoke through the half-open window.`,
    `He kept both hands on the wheel the whole time.`,
  ],
  // ── Hotel ──
  '🏨': [
    `The concierge straightened a stack of brochures.`,
    `He glanced toward the lobby before answering.`,
    `He smooths the counter before answering.`,
    `She adjusts the register slightly.`,
    `A bell rings softly somewhere behind him.`,
    `He aligned a pen with the edge of the desk.`,
    `She checked the guest ledger before looking up.`,
    `He spoke just above a whisper, hotel-quiet.`,
    `She folded a napkin into a precise triangle as she talked.`,
  ],
  '🛎️': [
    `The bellhop lowered his voice.`,
    `He glanced toward the front desk.`,
    `He set a suitcase down gently, then turned to you.`,
    `He straightened his uniform before speaking.`,
    `He kept his back to the elevator doors.`,
    `He spoke fast, like his break was almost over.`,
    `His white gloves fidgeted at his sides.`,
  ],
  '🧹': [
    `She set the linens down before she'd talk.`,
    `She wouldn't meet your eyes.`,
    `She kept folding towels as she answered.`,
    `Her cart blocked the hallway. She didn't move it.`,
    `She spoke into the closet, not to you.`,
    `She checked both ways down the corridor first.`,
    `She lowered the vacuum noise before answering.`,
  ],
  // ── Market ──
  '🛍️': [
    `The vendor didn't look up from his stall.`,
    `He kept counting coins as he spoke.`,
    `A coin flips between his fingers as he talks.`,
    `She rearranges fruit without looking at you.`,
    `Voices crowd in around you while he speaks.`,
    `He weighed something in his palm while talking.`,
    `She waved a fly from the display, eyes on you.`,
    `He stacked cans one-handed while answering.`,
    `She slid a sample across the counter, testing you.`,
  ],
  '🧑‍🍳': [
    `She wiped her hands on her apron before speaking.`,
    `He stirred the pot, slow.`,
    `Steam rose between you as she spoke.`,
    `He flipped something on the grill without looking.`,
    `She tasted the broth, then talked.`,
    `He chopped herbs in a quick rhythm while answering.`,
    `Grease popped. He didn't flinch.`,
    `She ladled soup into a bowl and pushed it toward you.`,
  ],
  '🏪': [
    `The shopkeeper drew the curtain half-closed.`,
    `He pretended to count inventory.`,
    `She polished a glass that was already clean.`,
    `He leaned on the counter with both elbows.`,
    `She glanced at the street through the window first.`,
    `He turned the sign to CLOSED, then turned back to you.`,
    `She spoke from behind a shelf of bottles.`,
  ],
  // ── Library ──
  '📚': [
    `The librarian adjusted his glasses.`,
    `She closed the book carefully before answering.`,
    `He runs a finger along the page before answering.`,
    `Dust shifts as she pulls a book free.`,
    `He doesn't look up until he's finished reading.`,
    `She marked her page with a ribbon, precise.`,
    `He slid a reference volume toward you without a word.`,
    `She whispered, even though the floor was empty.`,
    `His finger traced a line on the index card catalogue.`,
  ],
  '👨‍🏫': [
    `The professor steepled his fingers.`,
    `He paused, weighing his words.`,
    `He removed his glasses, cleaned them, put them back.`,
    `She uncapped a pen, then capped it again.`,
    `He leaned back in his chair until it creaked.`,
    `She tapped the desk once, like starting a lecture.`,
    `He looked at you over the rim of his reading glasses.`,
    `She turned to the chalkboard, then back to you.`,
  ],
  '🗞️': [
    `The old reporter exhaled smoke through his nose.`,
    `She tapped a yellowed clipping for emphasis.`,
    `He folded the newspaper to a specific column.`,
    `She pulled a clipping from her breast pocket.`,
    `He pointed at a headline without saying which one.`,
    `She scribbled something in shorthand, then looked up.`,
    `He crushed out a cigarette that was barely lit.`,
    `His voice carried the weight of too many deadlines.`,
  ],
  // ── Embassy ──
  '🏛️': [
    `The attaché chose his words with care.`,
    `She let a long silence pass first.`,
    `He lowers his voice halfway through.`,
    `She folds her hands before answering.`,
    `The door clicks shut behind you before he speaks.`,
    `He straightened the flag pin on his lapel.`,
    `She glanced at the security camera, then back at you.`,
    `He pressed his intercom once, then released it.`,
    `She opened a folder, closed it, and set it aside.`,
  ],
  '👮': [
    `The officer adjusted his cap.`,
    `He looked left, then right, then talked.`,
    `She kept one hand on her radio.`,
    `He wrote something down, tore the page out, and pocketed it.`,
    `She crossed her arms before answering.`,
    `He leaned against the doorframe, blocking the hall.`,
    `She checked your ID twice before saying anything.`,
    `His walkie crackled. He ignored it.`,
  ],
  '🧑‍💼': [
    `The diplomat fixed his cufflinks.`,
    `She poured tea for both of you before answering.`,
    `He smoothed his tie and spoke toward the window.`,
    `She placed both palms flat on the table.`,
    `He closed the blinds halfway before turning to you.`,
    `She offered you a seat. You stayed standing.`,
    `His smile was practiced. His words were not.`,
    `She set down her pen like it was a decision.`,
  ],
};

const ACTIONS_BY_LOCATION = {
  airport: [
    `Footsteps on tile. Announcements overhead.`,
    `An overhead speaker garbled a flight number.`,
    `A suitcase wheel squeaked past on the polished floor.`,
    `The departure board clicked over to a new gate.`,
    `Jet engines whined outside the window.`,
    `A child ran past dragging a carry-on twice her size.`,
    `The terminal hummed with a thousand small departures.`,
  ],
  hotel: [
    `Somewhere down the hall, a door clicked shut.`,
    `The lobby clock ticked once, loud.`,
    `An elevator chimed softly behind the front desk.`,
    `Ice settled in a bucket on a passing cart.`,
    `Piano music drifted from the lounge, just one floor down.`,
    `The revolving door turned. No one came in.`,
    `A key card beeped somewhere on the second floor.`,
  ],
  market: [
    `Smoke from a nearby grill curled past you.`,
    `A radio played somewhere behind the stalls.`,
    `Haggling voices rose and fell like waves.`,
    `A crate of oranges tipped. Nobody moved to fix it.`,
    `Incense mixed with diesel in the afternoon heat.`,
    `A motorcycle threaded through the crowd, engine coughing.`,
    `Someone was frying something sweet nearby.`,
  ],
  library: [
    `Pages turned in the next aisle.`,
    `The reading lamp threw long shadows on the table.`,
    `A cart of returns rattled past on the hardwood.`,
    `Dust caught the light through a high window.`,
    `The heating vent hummed. Otherwise, silence.`,
    `A book dropped somewhere. The sound carried.`,
    `The clock on the wall was three minutes slow.`,
  ],
  embassy: [
    `A clock somewhere in the building chimed the hour.`,
    `The flag in the corner stirred when the door opened.`,
    `Heels clicked down the marble hallway outside.`,
    `A phone rang in an office that no one answered.`,
    `The security guard watched without watching.`,
    `A shredder ran somewhere behind the wall.`,
    `The air conditioning was too cold. On purpose, probably.`,
  ],
};

const GENERIC_ACTIONS = [
  `They take a moment before answering.`,
  `A pause hangs in the air.`,
  `They look around before speaking.`,
  `The answer comes slow, like it matters.`,
  `They hesitate just a second.`,
  `They lower their voice without meaning to.`,
  `Their eyes move to something behind you, then back.`,
  `A long breath before the first word.`,
  `They lean in slightly.`,
  `Silence first. Then the answer.`,
  `They glance at the door before continuing.`,
];

// ─── D. Helpfulness commentary ───────────────────────────────────
// Appended to the phrasing when the clue data includes matchCount/totalChoices,
// indicating how many neighbor choices the clue also applies to.

const HELPFUL_SUFFIXES = [
  `That should narrow it down.`,
  `Not many places nearby match that.`,
  `Use that one. It matters.`,
  `That's a real lead, if you ask me.`,
  `Worth remembering.`,
  `Only one answer fits that.`,
  `That detail stands out around here.`,
];

const UNHELPFUL_SUFFIXES = [
  `But I guess that doesn't narrow it down much.`,
  `Half the places nearby could say the same.`,
  `Won't help you much, I'm afraid.`,
  `Don't hang your hat on that one.`,
  `Doesn't exactly make it obvious, does it.`,
  `Common enough around here, though.`,
  `Could be a few places, honestly.`,
];

function pickHelpfulnessSuffix(matchCount, totalChoices) {
  if (totalChoices === 0) return null;
  const ratio = matchCount / totalChoices;
  if (matchCount === 0) return pick(HELPFUL_SUFFIXES);
  if (ratio >= 0.5) return pick(UNHELPFUL_SUFFIXES);
  return null; // neutral — no commentary for in-between cases
}

function pickAction(informant, locationId) {
  const fromInformant = informant?.emoji && ACTIONS_BY_INFORMANT[informant.emoji];
  if (fromInformant) return pick(fromInformant);
  const fromLocation = ACTIONS_BY_LOCATION[locationId];
  if (fromLocation) return pick(fromLocation);
  return pick(GENERIC_ACTIONS);
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

  // Helpfulness commentary — append when the clue data carries neighbor-match info.
  if (data.matchCount !== undefined && data.totalChoices > 0) {
    const suffix = pickHelpfulnessSuffix(data.matchCount, data.totalChoices);
    if (suffix) inner = inner + ' ' + suffix;
  }

  // 2. Voice wrapper by location.
  // Lowercase the phrasing's first letter so it reads naturally when placed
  // mid-sentence by a voice wrapper (e.g. "but ${line}"). The final `voiced`
  // string gets its first character capitalized below, so sentence starts are fine.
  if (inner) inner = inner.charAt(0).toLowerCase() + inner.slice(1);

  const voicePool = VOICE[locationId] || VOICE.library;
  let voiced = pick(voicePool)(inner);

  // Capitalize after sentence boundaries: start of string, and after . ! ? — followed by space.
  if (voiced) {
    voiced = voiced.charAt(0).toUpperCase() + voiced.slice(1);
    voiced = voiced.replace(/([.!?—]\s+)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
  }

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
