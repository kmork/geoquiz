function storyParagraphs(parts) {
  return parts.filter(Boolean);
}

const OVERRIDES = {
  'Viktor Voss': storyParagraphs([
    'ACME believes Voss began his criminal career the way lesser men begin a crossword: with entirely unwarranted confidence. At nineteen he lost a regional chess final, blamed the board, the lighting, and eventually the Habsburg decline, then announced that the only honest competition left in Europe was theft. Nobody stopped him. That was the first administrative mistake in a long and distinguished series.',
    'His early work was less "master criminal" and more "overdressed nuisance." He once broke into a private train carriage merely to replace a baron\'s ivory rook with a note explaining the positional weakness of the original arrangement. A year later he graduated to museum burglary, not out of greed but because he objected to curatorial labeling. He reportedly described one theft as "a correction to history." The court transcript declines to endorse the phrase.',
    'Post-arrest interviews suggest Voss still believes he was conducting an international tutorial. He asked for a better chair, rejected three maps as badly folded, and tried to explain to ACME that checkmate and extradition were "strategically adjacent concepts." The room remained unconvinced.'
  ]),
  'Ivy Virelli': storyParagraphs([
    'Virelli did not drift into crime so much as cultivate it. She began as a celebrated horticultural obsessive with a greenhouse, a patron, and the sort of smile that convinces sensible people to finance terrible ideas. The trouble started when customs officials objected to her importing an endangered vine in a violin case. Ivy objected right back, then concluded that if the botanical world insisted on rules, she would simply steal from richer institutions with better climate control.',
    'Her middle period was defined by escalating theatricality. There were orchids hidden inside reliquaries, ferns smuggled through diplomatic receptions, and one particularly unnecessary operation involving a conservatory roof, a pulley system, and a handwritten note accusing the target museum of "aesthetic negligence." ACME records also preserve the moment she allegedly tried to blackmail a duke using mildew. The duke paid. The mildew did most of the work.',
    'In custody, Virelli remains polite, terrifyingly patient, and deeply offended by artificial flowers. She has already corrected the placement of three office plants, filed a written complaint about fluorescent lighting, and informed ACME that their evidence lockers have "the emotional atmosphere of an overwatered cellar." No one was eager to argue.'
  ]),
  'Copper Sparrow': storyParagraphs([
    'Copper Sparrow claims she entered crime by accident, which would be more persuasive if the accident had not involved forged shipping papers, a stolen bicycle, and a serialized memoir proposal already titled Across Borders With Style. Early reports describe her as a minor smuggler with literary ambitions. Later reports describe her as a literary ambition with minor smuggling as overhead.',
    'Her habit of turning every operation into material is well documented and widely resented. She once mailed chapter outlines to two editors while still fleeing the scene of a theft in Marseille. Another file records a burglary in Havana interrupted because the subject stopped to improve a sentence in her notebook. ACME was impressed against its better judgment. It is difficult not to admire a criminal who treats self-incrimination as a copy-editing problem.',
    'Since arrest, Sparrow has requested ribbon-bound stationery, objected to the phrase "known offender" as dramatically flat, and offered to write ACME\'s internal history if given a window and better coffee. The offer was declined. The coffee request remains under review.'
  ]),
};

function pickVariant(name, variants) {
  const total = Array.from(name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return variants[total % variants.length];
}

function buildParagraphOne(suspect) {
  const openers = [
    `The file says ${suspect.name} was born in ${suspect.origin || 'parts unknown'}, which is ACME shorthand for "someone should have noticed the warning signs earlier."`,
    `${suspect.name} emerged from ${suspect.origin || 'an unhelpfully vague origin story'} with the kind of biography that makes ordinary delinquency seem underambitious.`,
    `According to the least embarrassed version of events, ${suspect.name} started in ${suspect.origin || 'an undisclosed corner of the map'} and proceeded to treat respectable society as a scheduling inconvenience.`,
  ];
  const secondBeats = [
    `The first trouble appears to have involved ${suspect.quirk.toLowerCase()}, which was tolerated as eccentricity right up to the point where property started changing hands without permission.`,
    `The slide into criminality seems to have begun when ${suspect.geoFact.toLowerCase()}. Somewhere between obsession and logistics, the law lost the argument.`,
    `Witnesses describe an early fixation with ${suspect.hobby.toLowerCase()} and ${suspect.accessory.toLowerCase()}, which sounds harmless until one reads the inventory reports.`,
  ];
  return `${pickVariant(suspect.name, openers)} ${pickVariant(`${suspect.name}-beat1`, secondBeats)}`;
}

function buildParagraphTwo(suspect) {
  const escalations = [
    `What followed was an unnecessarily elaborate rise through the international theft circuit: rehearsed entrances, impossible exits, and a professional devotion to ${suspect.vehicle.toLowerCase()} that accounting still refuses to classify sensibly.`,
    `The subject\'s middle career reads like a dare written on expensive stationery. There were border crossings, improvised aliases, and at least one operation in which ${suspect.geoFact.toLowerCase()} was treated as tactical inspiration rather than trivia.`,
    `ACME attributes the subject\'s notoriety to three qualities: nerve, vanity, and a near-religious commitment to doing things the hardest possible way. ${suspect.quirk} only made the paperwork stranger.`,
  ];
  const punchlines = [
    `One incident report ends with the sentence, "suspect escaped, but with visible satisfaction," which is not a line any bureaucracy enjoys writing.`,
    `By this point, the subject had stopped behaving like a thief and started behaving like an editorial note on civilization.`,
    `Several investigators described the whole affair as "deeply preventable," which is accurate without being useful.`,
  ];
  return `${pickVariant(`${suspect.name}-escalation`, escalations)} ${pickVariant(`${suspect.name}-punch`, punchlines)}`;
}

function buildParagraphThree(suspect) {
  const custodyNotes = [
    `Now in custody, ${suspect.name} has remained composed, vain, and distressingly conversational. ACME notes that the subject speaks about prior crimes as if discussing travel inconveniences and still appears to believe taste is a legal defense.`,
    `Custody has not improved the subject\'s humility. ${suspect.name} has already corrected two filing errors, criticized the stationery, and implied that the arrest would have been avoidable if the detectives had shown more artistic discipline.`,
    `Post-arrest behavior suggests the subject confuses interrogation with guest lecturing. ${suspect.name} has offered critiques of security design, map labeling, and coffee service with the serene confidence of someone who cannot imagine being unwelcome.`,
  ];
  const closingNotes = [
    'ACME recommends keeping the file for morale purposes. It is useful to remember that world-class criminals are still, at heart, capable of making ridiculous life choices with absolute conviction.',
    'Final assessment: dangerous, theatrical, and catastrophically pleased with the sound of their own legend.',
    'Administrative note: the subject remains a security risk, a paperwork burden, and, in ways nobody requested, a surprisingly committed stylist.',
  ];
  return `${pickVariant(`${suspect.name}-custody`, custodyNotes)} ${pickVariant(`${suspect.name}-closing`, closingNotes)}`;
}

export function getInterpolBackgroundStory(suspect) {
  if (!suspect || suspect.name === 'Carmen Sandiego') return null;
  const override = OVERRIDES[suspect.name];
  if (override) return override.join('\n\n');
  return [
    buildParagraphOne(suspect),
    buildParagraphTwo(suspect),
    buildParagraphThree(suspect),
  ].join('\n\n');
}
