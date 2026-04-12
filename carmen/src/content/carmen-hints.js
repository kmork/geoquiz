/**
 * Carmen campaign hint writing.
 *
 * Narrative-only content that foreshadows Carmen across the campaign without
 * changing deduction mechanics or route logic.
 */

const BRIEFING_HINTS = {
  prelude: [
    'ACME marginalia: the paperwork on these thefts has been neat in a way that feels impolite.',
    'ACME marginalia: local reports disagree on the thief, but not on how cleanly the exit was handled.',
    'ACME marginalia: someone keeps making small museums look very easy to rob. That is rarely one person.',
  ],
  whispers: [
    'ACME marginalia: field offices keep hearing about a woman who never enters through the front door and never leaves a loose end.',
    'ACME marginalia: different thieves, same discipline. Someone is teaching them manners.',
    'ACME marginalia: the thief on this file may be the hand, not the mind.',
  ],
  pursuit: [
    'ACME marginalia: recovered case notes suggest the jobs are being drafted centrally and executed locally.',
    'ACME marginalia: we are no longer chasing isolated vanity. We are chasing an organization with taste.',
    'ACME marginalia: three arrests, same operational fingerprints, no literal fingerprints. That narrows the poetry of it.',
  ],
  finale: [
    'ACME marginalia: no more polite phrasing. Every file in this drawer bends toward Carmen Sandiego.',
  ],
};

const ARRIVAL_HINTS = {
  prelude: {
    generic: [
      { prefix: 'Clerk\'s aside', emoji: '🗒️', text: 'The official story was tidy. The getaway was tidier. Someone had prepared the room before the thief arrived.' },
      { prefix: 'Dock gossip', emoji: '⚓', text: 'Word was the thief moved like a tourist and left like a schedule. That kind of planning usually travels with company.' },
      { prefix: 'Night desk note', emoji: '🛎️', text: 'No one agreed on the face. Everyone agreed the escape felt rehearsed. I wrote that down.' },
    ],
    airport: [
      { prefix: 'Gate rumor', emoji: '🛫', text: 'A baggage handler swore the thief already knew which cameras were dead. Airports don\'t offer that courtesy for free.' },
    ],
    hotel: [
      { prefix: 'Night clerk', emoji: '🛎️', text: 'The reservation was false, the timing was perfect, and the clerk said the thief seemed expected. That bothered me.' },
    ],
  },
  whispers: {
    generic: [
      { prefix: 'Street whisper', emoji: '🕶️', text: 'The locals spoke about the thief like hired weather. The real storm was supposed to arrive later.' },
      { prefix: 'ACME note', emoji: '📎', text: 'Same neat exit, same missing minutes, same rumor about a woman no one can describe the same way twice.' },
      { prefix: 'Customs murmur', emoji: '🧾', text: 'One officer said the thief kept glancing at a note, as if someone smarter had already done the thinking.' },
    ],
    airport: [
      { prefix: 'Gate rumor', emoji: '🛫', text: 'The manifest had been nudged just enough to help one passenger and confuse everyone else. That smelled like supervision.' },
    ],
    hotel: [
      { prefix: 'Hotel whisper', emoji: '🛎️', text: 'A maid heard the thief say, "She likes clean exits." Could have meant anyone. Didn\'t sound like anyone.' },
    ],
    market: [
      { prefix: 'Market gossip', emoji: '🧺', text: 'A vendor said the thief paid in exact change and answered to nobody there. The instructions seemed to come from somewhere else.' },
    ],
  },
  pursuit: {
    generic: [
      { prefix: 'ACME note', emoji: '📎', text: 'By now the pattern had a silhouette: daring thief up front, colder mind in the wings, and no shortage of volunteers.' },
      { prefix: 'Field memo', emoji: '📁', text: 'Witnesses kept describing different thieves and the same confidence. Carmen runs a style guide, apparently.' },
      { prefix: 'Border chatter', emoji: '🛂', text: 'The crossing logs were scrubbed with professional restraint. I was done pretending these people improvise.' },
    ],
    airport: [
      { prefix: 'Control tower note', emoji: '🛫', text: 'Someone filed a false maintenance delay at exactly the right minute. The tower blamed chance. I didn\'t.' },
    ],
    market: [
      { prefix: 'Broker whisper', emoji: '💼', text: 'A fence called the job "one of hers" and then remembered a prior engagement with fear.' },
    ],
  },
  finale: {
    generic: [
      { prefix: 'Case note', emoji: '📌', text: 'Nobody bothered speaking in riddles anymore. The crew had a queen, and every road on my wall led to her.' },
      { prefix: 'ACME note', emoji: '📎', text: 'The aliases were peeling off the file. Carmen was the only name left that explained the pattern without insulting it.' },
    ],
  },
};

const FINALE_ALIAS_HINTS = [
  { prefix: 'Border memo', emoji: '🛂', text: 'The passport was flawless, which was the first problem. Real paperwork carries a little fatigue. This one looked born ironed.' },
  { prefix: 'Witness report', emoji: '🕶️', text: 'Two clerks described the same woman an hour apart and swore they had seen different people. Same voice, same posture, different story wrapped around it.' },
  { prefix: 'Hotel note', emoji: '🛎️', text: 'The alias had a full travel history on paper and none in conversation. People who have lived a life usually remember it without rehearsal.' },
];

const SUSPECT_INTEL = {
  'Viktor Voss': {
    anomaly: 'Financial traces suggest Voss rarely funds his own travel. Someone else seems to buy the opening move.',
    network: 'Interview notes from two separate ports describe him taking instructions badly, which still means he takes them.',
  },
  'Natasha Petrova': {
    anomaly: 'Petrova changes borders cleanly even in weather that should slow her down. Support logistics are likely.',
    network: 'Recovered chatter suggests she has done courier work for higher-value theft crews.',
  },
  'The Shadow': {
    anomaly: 'Conflicting witness descriptions may be a talent, or they may be deliberate noise seeded in advance.',
    network: 'Multiple files suggest the subject appears where a larger operation needs confusion more than spectacle.',
  },
  'Lady Crimson': {
    anomaly: 'Port fees, customs seals, and yacht manifests rarely align. Her exits appear pre-cleared by unseen hands.',
    network: 'Social-club chatter links her to patrons who prefer to remain off any official ledger.',
  },
  'Scarlet Cipher': {
    anomaly: 'Cipher communications imply access to schedules she should not have. Someone upstream is feeding her the clock.',
    network: 'Her encoded notes use markers also found in unrelated theft files. Shared authorship remains unproven and irritating.',
  },
  'Dr. Atlas': {
    anomaly: 'Atlas travels like a purist and escapes like a quartermaster had a word first.',
    network: 'Map-room contacts refer to a buyer of routes, not artifacts. That distinction deserves suspicion.',
  },
  'Count Obsidian': {
    anomaly: 'Charter records imply access to aircraft well beyond Obsidian\'s declared means.',
    network: 'Antiquities brokers place him near several jobs where the visible thief was someone else.',
  },
  'Echo': {
    anomaly: 'Voiceprint fragments suggest multiple recordings were assembled for misdirection before the operation began.',
    network: 'The subject functions less like a thief than a relay point for someone who prefers clean distance.',
  },
  'Captain Marlowe': {
    anomaly: 'Shipping routes linked to Marlowe are repeatedly altered just once, at exactly the useful moment.',
    network: 'Crew statements hint he ferries people as often as cargo, usually without asking names.',
  },
  'Nova Vex': {
    anomaly: 'Fuel, landing clearances, and hangar access line up too neatly to be luck.',
    network: 'Aviation chatter suggests Vex occasionally flies distraction patterns for operations she does not personally lead.',
  },
  'Neon Specter': {
    anomaly: 'System intrusions attributed to Specter often begin before the theft team enters the building.',
    network: 'Digital signatures overlap with support actions in at least two otherwise unrelated case files.',
  },
  'Ghost Mariner': {
    anomaly: 'Fog is helpful, but not this helpful. Harbor timing suggests inland coordination.',
    network: 'Smuggling notes place the Mariner in service to clients with stricter discipline than most thieves possess.',
  },
};

function pickDeterministic(pool, seed) {
  if (!pool || pool.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

function countRecordedThefts(allTheftHistory = {}) {
  return Object.values(allTheftHistory).reduce((sum, records) => sum + records.length, 0);
}

export function buildCaseBriefingHint(phase, caseNumber, missionHistory = []) {
  const pool = BRIEFING_HINTS[phase] || BRIEFING_HINTS.prelude;
  const result = pickDeterministic(pool, `${phase}:${caseNumber}:${missionHistory.length}`);
  return result || '';
}

export function pickArrivalAmbientHint({ phase, caseNumber, currentStop, locationId, missionHistory = [] }) {
  const stopSeed = `${phase}:${caseNumber}:${currentStop}:${locationId}:${missionHistory.length}`;
  const phaseHints = ARRIVAL_HINTS[phase];
  if (!phaseHints) return null;

  if (phase === 'prelude' && currentStop === 0) {
    return null;
  }
  if (phase === 'prelude') {
    let hash = 0;
    for (let i = 0; i < stopSeed.length; i++) hash = ((hash << 5) - hash + stopSeed.charCodeAt(i)) | 0;
    if (Math.abs(hash) % 2 === 1) return null;
  }

  const pool = phaseHints[locationId] || phaseHints.generic;
  return pickDeterministic(pool, stopSeed);
}

export function pickFinaleAliasHint(currentStop) {
  return FINALE_ALIAS_HINTS[currentStop] || null;
}

export function buildInterpolIntel(suspect, phase, theftRecords = [], missionHistory = [], allTheftHistory = {}) {
  const totalSolvedThefts = countRecordedThefts(allTheftHistory);
  const intel = {};

  if (suspect.name === 'Carmen Sandiego') {
    if (phase === 'prelude' || !phase) {
      intel.anomaly = 'No stable photograph, no confirmed fingerprint, and still too many field reports to dismiss as folklore.';
      intel.network = 'Associated names surface in fragments, never in full sentences. Someone is editing the truth before it reaches ACME.';
      return intel;
    }
    if (phase === 'whispers') {
      intel.anomaly = 'Separate case notes now repeat the same pattern: bold operative, immaculate exit, invisible coordinator.';
      intel.network = 'Three different witnesses across unrelated files mention a woman who never seems to carry the artifact herself.';
      return intel;
    }
    if (phase === 'pursuit') {
      intel.anomaly = 'Cross-case analysis supports a central planner with strong geographic fluency and disciplined surrogate crews.';
      intel.network = 'Recovered arrests suggest Carmen rarely repeats personnel exactly, but repeats method with almost theatrical confidence.';
      return intel;
    }
    intel.anomaly = 'The redactions are over. The pattern, the style, and the missing artifacts now belong to one file.';
    intel.network = 'Every lieutenant file eventually points upward. This one does not point anywhere else.';
    intel.irregularity = 'Older field notes repeatedly mention border work done under borrowed names, costumes, and identities that dissolved as soon as ACME wrote them down.';
    intel.pattern = 'Carmen’s profile remains the only one in the archive that can survive contradictory witness descriptions without losing coherence.';
    return intel;
  }

  const suspectIntel = SUSPECT_INTEL[suspect.name] || {};
  if (phase === 'prelude' && missionHistory.length < 2) {
    intel.anomaly = suspectIntel.anomaly || 'Travel records and witness timing both suggest the subject is better prepared than the average freelancer.';
    return intel;
  }

  intel.anomaly = suspectIntel.anomaly
    || 'Field reports imply the subject receives cleaner operational support than their public profile would justify.';

  if (phase === 'whispers') {
    intel.network = suspectIntel.network
      || 'Scattered notes suggest the subject may work inside a looser network rather than alone.';
  } else if (phase === 'pursuit') {
    intel.network = suspectIntel.network
      || 'Pattern overlap with other active files suggests shared planning, resources, or both.';
  } else if (phase === 'finale') {
    intel.network = suspectIntel.network
      || 'Retrospective review places this subject on the edge of a larger operational circle tied to Carmen Sandiego.';
  }

  if (totalSolvedThefts >= 2) {
    intel.pattern = `${totalSolvedThefts} recovered artifact ${totalSolvedThefts === 1 ? 'entry' : 'entries'} now show timing and exit discipline consistent with centralized planning.`;
  } else if (theftRecords.length > 0) {
    intel.pattern = `Recorded theft history suggests this subject prefers prepared exits over improvisation.`;
  }

  return intel;
}
