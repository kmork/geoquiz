function storyParagraphs(parts) {
  return parts.filter(Boolean);
}

const OVERRIDES = {
  'Carmen Sandiego': storyParagraphs([
    'Carmen Sandiego entered ACME records less like a suspect and more like a weather system: first a rumor, then a pattern, then a red coat seen everywhere except where anyone could file a clean arrest report. Early cases disagree on her origin because Carmen made geography part of the disguise. Every border, capital, and customs desk became another place to leave a signature without leaving a forwarding address.',
    'Her organization grew around movement. Lesser thieves stole artifacts; Carmen stole the certainty around them. She favored impossible routes, theatrical timing, and accomplices who believed they were the cleverest person in the room until the room turned out to be hers. ACME analysts eventually stopped asking whether a theft was connected to Carmen and started asking how long she had been arranging the connection.',
    'The Crimson Trail file changed the archive. Carmen was no longer only a figure behind redacted memos and nervous witness statements; she became a solved operational pattern with a known profile, known associates, and a case history ACME could finally read without guessing at every margin note. Skyline access does not mean she is part of the current flight-manifest case. It means the detective has clearance to read the old file while chasing a new network.'
  ]),
  'Natasha Petrova': storyParagraphs([
    'Petrova began as a promising skater in Saint Petersburg until judges discovered her free routine included entering through a skylight, replacing the trophy with a decoy, and leaving by snowmobile. The federation called it unsportsmanlike. Natasha called it "interpretive logistics" and asked whether the score included border control.',
    'Her Lake Baikal story has been disputed by scientists, skaters, and one exhausted insurance investigator, but the ice shavings are real. ACME has found them in hotel corridors, museum vaults, and once inside a diplomatic briefcase that was supposed to contain warm sandwiches.',
    'In custody she has requested a colder cell, sharper stationery, and permission to resurface the interrogation room floor. The request was denied after she described cross-examination as "pairs skating for cowards."'
  ]),
  'El Zorro': storyParagraphs([
    'El Zorro insists he is a romantic outlaw, which would be more convincing if romance required carving a large Z into public property and then billing the museum for "dramatic improvement." Seville remembers him as a fencing prodigy. ACME remembers him as a man who once challenged a revolving door to single combat.',
    'His Mediterranean tour produced twenty-one coastal sightings, fourteen confused customs officers, and one horse passport that remains legally distressing. The black stallion appears better organized than the suspect and has never misspelled Gibraltar.',
    'Since arrest, Zorro has tried to duel the booking camera, a coat rack, and the concept of extradition. ACME recommends keeping pens away from him unless the office wants every form initialed with unnecessary flair.'
  ]),
  'The Shadow': storyParagraphs([
    'The Shadow has no confirmed birthplace, no reliable photograph, and no two witnesses who agree on height, voice, shoes, or whether he was technically present. ACME opened the file after a museum guard reported being robbed by "a draft with opinions."',
    'The Sahara crossing rumor persists because it is impossible, theatrical, and exactly the kind of thing a person in a dark cloak would leak about himself. A motorcycle was later found near a dune with no tracks around it, which experts described as either impossible or very rude.',
    'Interrogation notes are sparse. When questioned, The Shadow performed three magic tricks, corrected the lighting, and vanished behind a filing cabinet that had been bolted to the wall since 1978.'
  ]),
  'Lady Crimson': storyParagraphs([
    'Lady Crimson emerged from Monte Carlo society with a ruby necklace, an opera vibrato, and the firm belief that moonlight was a legal alibi. Her first theft occurred during a gala aria so loud that the alarm system filed a noise complaint and retired.',
    'Her yacht has appeared at Atlantic island ports with the subtlety of a floating chandelier. Dock workers describe impeccable manners, impossible luggage, and a captain who was paid entirely in roses and plausible deniability.',
    'In custody she refuses to answer questions unless they are sung in the correct key. ACME tried. The resulting transcript is classified for morale reasons.'
  ]),
  'Phantom Fox': storyParagraphs([
    'Phantom Fox turned origami from a peaceful art into a prosecutable warning system. Kyoto police first noticed her after an exhibit vanished and was replaced by a paper fox folded so precisely that three officers apologized to it before collecting evidence.',
    'Her hang glider operations are elegant, silent, and deeply irritating to anyone who believes doors exist for a reason. She has folded paper models of every country she visits, though accounting stopped reimbursing "tiny Luxembourg" after the third claim.',
    'Post-arrest, she has been folding court summons into foxes, cranes, and one miniature judge that everyone agrees looked disappointed.'
  ]),
  'Raven': storyParagraphs([
    'Raven began in Quito with a bird guide, a feathered hat, and a dawn schedule that made ordinary criminals look lazy. Her first known heist happened at sunrise; by breakfast she had escaped in a hot air balloon and left binoculars pointed accusingly at the guards.',
    'Her condor sighting at 6,000 meters may be exaggerated, but her Andes routes are not. ACME has followed her over ridgelines, through cloud forests, and into one balloon basket containing twelve feathers and a note reading "wrong altitude."',
    'In custody she only speaks at dawn or dusk. Between those hours she watches the ceiling with the patience of a person planning migration.'
  ]),
  'Scarlet Cipher': storyParagraphs([
    'Scarlet Cipher left Berlin with red hair, a coded tattoo, and an attitude toward longitude that made cartographers consider witness protection. Her early ransom notes were so well encrypted that victims sometimes thanked her for the puzzle before remembering the stolen artifact.',
    'She favors prime meridian jokes, coordinate ciphers, and sports-car exits calibrated to humiliate traffic cameras. ACME once decoded a clue that led to Greenwich, then another that led to lunch, then a third explaining that lunch had been the real clue.',
    'During interrogation she requested graph paper and immediately encrypted the coffee order. The machine produced tea out of fear.'
  ]),
  'Dr. Atlas': storyParagraphs([
    'Dr. Atlas is a Lisbon cartographer who treats GPS as a moral collapse. His first theft was mapped on vellum, sealed with wax, and annotated so beautifully that the arresting officer framed a copy before filing charges.',
    'He mapped capitals near the equator with scholarly precision and criminal enthusiasm. His seaplane routes contain more footnotes than most dissertations, including one note describing airport security as "a cartographic misunderstanding with uniforms."',
    'In custody he refuses to sit unless oriented north. ACME moved the chair once. Atlas noticed immediately and called it "institutional drift."'
  ]),
  'The Cartographer': storyParagraphs([
    'The Cartographer left Kathmandu with a satchel, a jeep, and the unsettling habit of treating every crime scene as a field survey. His early mountain work was impressive until museums realized the summit register was not supposed to include stolen relics.',
    'He claims the Seven Summits taught him patience. ACME believes they taught him to carry too many ropes. At every border he takes a soil sample, labels it, and somehow makes geology feel like an accomplice.',
    'His cell contains no contraband, but twelve tiny piles of floor dust have been cataloged by altitude, mood, and "probable escape value."'
  ]),
  'Velvet Mask': storyParagraphs([
    'Velvet Mask waltzed out of Parisian high society wearing gloves and the expression of someone who had never personally touched a consequence. Her Versailles incident began as ballroom dancing and ended with a mirror missing, which the palace called "difficult to overlook."',
    'She believes fingerprints are for amateurs and door handles are for staff. Her limousine routes were choreographed to music; one getaway driver resigned after being corrected on tempo during a police chase.',
    'In custody she has requested a parquet floor, better lighting, and a partner who understands timing. ACME supplied none of these and locked the evidence cabinet twice.'
  ]),
  'Raven Noir': storyParagraphs([
    'Raven Noir weaponized bird watching in Bogota, which sounds harmless until one discovers the bird calls were actually tactical commands. Her first crew reportedly included three lookouts, two couriers, and one very confused parakeet with diplomatic immunity.',
    'Colombia has extraordinary bird diversity, and Raven Noir has used that fact to justify every whistle, trill, and suspiciously specific chirp near a vault. ACME linguists briefly tried to decode her calls before admitting they had been insulted by a finch.',
    'In custody she communicates through bird sounds during questioning. The transcript reads "caw, trill, objection sustained," which legal has asked us not to explain.'
  ]),
  'Professor Paradox': storyParagraphs([
    'Professor Paradox came out of Geneva with a pocket watch for every time zone and no respect for linear cause. His first recorded theft was reported three hours before it happened, which made ACME look punctual and useless at the same time.',
    'He lectures constantly about China using one official time zone, usually while wearing watches set to everywhere except the room he occupies. His experimental car has been ticketed for speeding, idling, and arriving yesterday.',
    'In custody he insists the arrest has not happened yet. This would be more persuasive if he had not already filed three complaints about tomorrow\'s breakfast.'
  ]),
  'Luna Nocturne': storyParagraphs([
    'Luna Nocturne followed the northern lights out of Reykjavik and into crime with the serene certainty of a person who schedules burglaries by moon phase. Her first alibi was "the sky was doing something important," which nearly worked on two romantics and one meteorologist.',
    'She flies gliders at night, leaves moon-pendant impressions in wax seals, and refuses cases with bad celestial composition. ACME once predicted her next target by checking astronomy tables and the availability of dramatic fog.',
    'Since arrest, Luna has objected to fluorescent lights as "aggressively lunar-neutral." Facilities has declined to install an aurora in holding.'
  ]),
  'Count Obsidian': storyParagraphs([
    'Count Obsidian began in Istanbul, which he mentions so often that ACME suspects he thinks straddling two continents is a personality. His obsidian ring, antique lectures, and helicopter exits made him intolerable in both Europe and Asia.',
    'He collects volcanic glass from eruption sites and behaves as if geology personally invited him to steal. One museum report says he paused mid-heist to explain the Bosphorus to a guard who had grown up beside it.',
    'In custody he requested darker curtains, older furniture, and recognition as "Count" in all paperwork. ACME compromised by writing "count: one suspect."'
  ]),
  'Echo': storyParagraphs([
    'Echo has no confirmed identity, which is impressive for someone so committed to audio production. The first ACME recording of Echo contains seven distorted voices, a lecture on canyon acoustics, and forty seconds of an investigator apologizing to a speaker.',
    'The Yarlung Tsangpo echo recordings are real, or at least loud enough to be legally persuasive. Echo uses drones, voice modulators, and sound cues so elaborate that several witnesses described being robbed by a podcast with altitude sickness.',
    'Interrogation is ongoing. Every answer returns through a filter labelled "haunted submarine," and the stenographer has requested hazard pay.'
  ]),
  'The Locksmith': storyParagraphs([
    'The Locksmith left Prague with a keychain large enough to qualify as luggage. His first arrest report notes that he opened the police van from the inside, corrected the hinge alignment, and asked whether anyone had something more challenging.',
    'He claims to have picked locks in every EU capital, a boast ACME cannot disprove because half the locks sent thank-you notes. His van contains antique keys, modern picks, and one key labelled "Belgium maybe."',
    'In custody he has escaped no fewer than zero times, because ACME gave him a door with no lock. He called this unsporting and submitted a formal complaint.'
  ]),
  'Captain Marlowe': storyParagraphs([
    'Captain Marlowe sailed out of Liverpool convinced that modern navigation was a fad and that cargo manifests were merely poems with invoices. His first heist involved a ship, three stars, and a customs officer who was told he lacked "tidal imagination."',
    'The Strait of Malacca incident remains a masterpiece of nautical inconvenience. Marlowe navigated by stars, ignored every instrument, and still arrived exactly where the stolen cargo needed him to be, which annoyed everyone with batteries.',
    'In custody he refers to hallways as channels and meals as provisions. ACME removed the compass from his hat after he tried to sail the lunch cart north-by-northwest.'
  ]),
  'Nova Vex': storyParagraphs([
    'Nova Vex came from Houston with a visor, a jet, and the belief that every theft deserved a constellation name. Her first operation, "Operation Mildly Confident Orion," failed only because the target museum noticed the launch countdown.',
    'Her Atacama observatory gave her clear skies, dry air, and enough astronomical vocabulary to make insurance claims sound like space programs. She exits crime scenes upward whenever possible, partly for speed and partly to make witnesses point dramatically.',
    'In custody she has renamed the holding cells after star clusters. Cell B is apparently "disappointing Cassiopeia."'
  ]),
  'Saffron Silk': storyParagraphs([
    'Saffron Silk left Jaipur with a silk fan, impeccable tea manners, and a criminal tempo so calm that guards often assumed they were being hosted. Her first theft ended with the artifact gone and everyone else holding tiny cups they did not remember accepting.',
    'She follows Silk Road history with devotion and saffron threads with theatrical excess. ACME has traced her by aroma, textile fiber, and one rickshaw driver who described the getaway as "polite but legally busy."',
    'In custody she has requested better tea, warmer porcelain, and a less vulgar lock. The lock has not commented.'
  ]),
  'Silk Serpent': storyParagraphs([
    'Silk Serpent learned Bangkok night markets so well that she could vanish between lanterns, motorbikes, and three people selling the same impossible watch. Her early thefts were blamed on crowd flow until the crowd started leaving gold earrings behind.',
    'She moves through markets like a rumor with excellent balance. Thailand\'s independence history appears in her calling cards because, according to one note, "no empire caught the country and no detective catches me." Modesty was not recovered at the scene.',
    'In custody she has mapped every blind spot in the cafeteria using chopsticks and disdain.'
  ]),
  'Crimson Dagger': storyParagraphs([
    'Crimson Dagger began in Marrakech, where he mistook dueling etiquette for a career plan. His first known theft was preceded by a formal challenge, two witnesses, and a five-minute delay while he found sufficiently dramatic lighting.',
    'He is obsessed with the Strait of Gibraltar, possibly because fourteen kilometers sounds like an escape route with a punchline. His motorcycle departures are loud, fast, and usually announced beforehand because subtlety never accepted his invitation.',
    'In custody he has challenged his reflection, the coffee machine, and extradition law. Extradition law declined.'
  ]),
  'Golden Lynx': storyParagraphs([
    'Golden Lynx came from Antwerp with diamond facts, a necklace, and the extremely specific morality of stealing gems but never gold. Her first crew quit after she returned a gold bracelet to the display case mid-heist on principle.',
    'Antwerp\'s rough diamond trade gave her both opportunity and an unbearable lecture topic. Witnesses recall a sports car, perfect gloves, and a ten-minute explanation of why emeralds were "emotionally underpriced."',
    'In custody she has appraised every screw in the interview room and found them all disappointing.'
  ]),
  'Ivory Whisper': storyParagraphs([
    'Ivory Whisper grew up near Salzburg and treats piano benches as both furniture and escape infrastructure. Her first theft was discovered only because she stopped to play a short farewell piece on the museum piano, which critics called "technically elegant, legally disastrous."',
    'She leaves gloves, sheet music, and emotionally confusing clues along the German border. ACME once followed a trail of perfect cadences for six hours before realizing she had modulated into another country.',
    'In custody she answers questions pianissimo and objects to squeaky chairs as a violation of due process.'
  ]),
  'Neon Specter': storyParagraphs([
    'Neon Specter made Seoul\'s digital billboards into a criminal diary with better typography than ACME enjoyed admitting. His first taunt appeared above traffic during rush hour and included a QR code, a joke, and a deeply unnecessary loading animation.',
    'He rides a motorbike, hacks everything with a screen, and treats fast internet as a constitutional right. Several arrests failed because officers stopped to read the insult he had posted about their route planning.',
    'In custody he has asked for a keyboard. ACME gave him a pencil. He jailbroke the pencil emotionally.'
  ]),
  'Scarlet Swan': storyParagraphs([
    'Scarlet Swan began at Moscow\'s Bolshoi with perfect posture and a theft style choreographed down to the eyebrow. Her first museum job included a pirouette through a laser grid, which security described as "beautiful until payroll saw the footage."',
    'She leaves ballet slippers as calling cards and expects investigators to appreciate the symbolism. ACME appreciates evidence bags. The slippers are usually dramatic, expensive, and wildly impractical for fleeing along the Moskva River.',
    'In custody she has corrected everyone\'s stance, including the guard dog\'s. The dog took it personally.'
  ]),
  'Midnight Owl': storyParagraphs([
    'Midnight Owl left Oxford with glasses, a bicycle, and a criminal devotion to first editions so intense that librarians formed a support group. His first theft included a photocopy replacement and a note apologizing for the binding quality.',
    'He studies Thames geography, catalog systems, and the moral collapse of paperback spines. ACME once caught him because he returned to alphabetize the shelf he had robbed.',
    'In custody he has requested silence, tea, and access to the prison library "for professional reasons." The library has requested protection.'
  ]),
  'Dusty Nomad': storyParagraphs([
    'Dusty Nomad came from Ulaanbaatar with a hat, a jeep, and the kind of restlessness that makes hotel clerks look personally betrayed. He never stays in one country for more than forty-eight hours, which he calls discipline and customs calls paperwork aggression.',
    'Mongolia\'s open spaces taught him speed, patience, and the ability to pack a getaway in under four minutes. ACME has found his trail in tire marks, dust clouds, and one guestbook entry reading "lovely border, must flee."',
    'In custody he paces so efficiently that facilities considered charging him mileage.'
  ]),
  'Silver Comet': storyParagraphs([
    'Silver Comet left Nairobi at a run and has made every pursuit since feel like a fitness test nobody consented to. His first theft was solved on paper in minutes and physically caught up with three countries later.',
    'He loves jets, watches, and the Great Rift Valley, preferably discussed while moving faster than the listener. ACME once set a roadblock; he thanked them for the hydration station and kept going.',
    'In custody he jogs in place during interviews. The transcript contains several pages of breathing and one detective reconsidering lunch.'
  ]),
  'Velvet Raven': storyParagraphs([
    'Velvet Raven came from Dublin with a cloak, a boat, and poetry so dramatic that several crime scenes required both evidence tape and literary criticism. Her first stolen manuscript was replaced with an original poem that made the curator angrier than the theft.',
    'Ireland\'s rain suits her brand, which is fortunate because she mentions it constantly. She leaves handwritten verse at crime scenes, usually rhyming "vault" with "fault" in a way that legal cannot prosecute but would like to.',
    'In custody she has submitted seventeen poems about the holding cell. Facilities says the leak is fixed; Velvet says the symbolism is not.'
  ]),
  'Amber Fox': storyParagraphs([
    'Amber Fox came from Gdansk with a brooch and a collecting habit that made the Baltic coast feel personally endangered. Her first theft involved amber, a display case, and a lecture on prehistoric tree resin delivered during the escape.',
    'She collects amber from every Baltic country and treats each piece as if it chose crime. ACME found one calling card trapped in resin, which was impressive, useless, and suspiciously on theme.',
    'In custody she has asked whether the interrogation room furniture is pine. Nobody answered, and that may have saved the furniture.'
  ]),
  'Storm Herald': storyParagraphs([
    'Storm Herald left Reykjavik believing weather was not a condition but a co-conspirator. His first operation began when the forecast said "unlikely" and ended when the museum roof said "why me?"',
    'He times thefts with storms, studies pressure systems, and talks about the Mid-Atlantic Ridge as if tectonic plates were unreliable cousins. ACME has learned to fear any case file containing both barometric notes and smug raincoat sketches.',
    'In custody he predicts every interrogation will become turbulent. So far the only front moving through is paperwork.'
  ]),
  'Crimson Mirage': storyParagraphs([
    'Crimson Mirage came from Cairo with a scarf, a train schedule, and enough mirrors to make witnesses doubt their own elbows. His first theft involved three identical corridors, two false exits, and one guard who filed a report against "light."',
    'He loves Nile facts and optical diversions, preferably at the same time. ACME once chased his reflection through an exhibit while the actual suspect left by train, waving from the dining car with unforgivable courtesy.',
    'In custody he asked for a mirror. ACME gave him a spoon. He called it minimalist and escaped only from the conversation.'
  ]),
  'Onyx Panther': storyParagraphs([
    'Onyx Panther came out of Lagos with a mask, a motorcycle, and a stealth record so clean that several alarms have written letters of resignation. His first known job was discovered because the artifact was gone and the alarm system looked embarrassed.',
    'Nigeria\'s scale and speed seem to suit him. He moves through crowds without ripple, enters vaults without noise, and exits with the calm of a man returning a library book to the wrong continent.',
    'In custody he has still not set off a single alarm, despite ACME installing three around his chair for morale.'
  ]),
  'Golden Seraph': storyParagraphs([
    'Golden Seraph left Athens with a pendant, a ship, and the belief that ancient artifacts were happier under her supervision. Her first theft included a handwritten apology to history, which history has declined to accept.',
    'She targets ancient civilizations with reverence and absolutely no respect for ownership. Greece\'s archaeological museums gave her knowledge, taste, and enough confidence to correct exhibit labels while stealing from them.',
    'In custody she insists the evidence locker has poor curatorial philosophy. ACME insists she stop rearranging it by century.'
  ]),
  'Ivory Phantom': storyParagraphs([
    'Ivory Phantom learned disguise in Venice, a city already pretending to be water, stone, and theatre at once. His first border crossing used three identities, two hats, and one customs officer who later admitted he had stamped "probably."',
    'The bridges of Venice trained him in exits. He changes persona at every border, vehicle, and inconvenient mirror. ACME once arrested his waiter disguise, only to discover the waiter was a different suspect entirely and also annoyed.',
    'In custody he has requested costume changes for "emotional continuity." The request was denied after he tried to leave as the request form.'
  ]),
  'Emerald Kite': storyParagraphs([
    'Emerald Kite came from Lahore with a ring, a glider, and the tactical conviction that kites were just surveillance drones with better manners. His first museum scout was a bright green kite that hovered over the skylight until security applauded.',
    'He invokes K2 often, usually to make ordinary walls sound lazy. His kite strings have triggered alarms, mapped rooftops, and once delivered a note reading "look up," which everyone did too late.',
    'In custody he folds napkins into flight plans and complains about ceiling height.'
  ]),
  'Shadow Lynx': storyParagraphs([
    'Shadow Lynx left Windhoek with gloves, a jeep, and tracking skills that made footprints feel like confessions. Her first case was solved when she tracked the investigator tracking her and left him a helpful diagram.',
    'The Skeleton Coast suits her sense of humor: dangerous, quiet, and full of things that disappear. She can follow a trail through sand, stone, and bureaucratic denial, which has made ACME both impressed and tired.',
    'In custody she identified everyone who had entered the room that morning by dust pattern. One was a janitor. One was a sandwich. She was correct enough to worry people.'
  ]),
  'Ghost Mariner': storyParagraphs([
    'Ghost Mariner sailed out of Bergen in fog so thick that witnesses described the ship as "a rumor with rigging." His first theft vanished into a fjord and reappeared three days later as an insurance headache.',
    'Norway\'s coastline gave him hiding places, routes, and the confidence to treat geography as camouflage. His compass points somewhere, though no two navigators agree where, and the ship seems to enjoy making officials doubt themselves.',
    'In custody he speaks softly about tides until clocks slow down out of courtesy. ACME has banned fog machines from the building.'
  ]),
  'Velvet Cipher': storyParagraphs([
    'Velvet Cipher came from Tallinn with a tattoo, a car, and encrypted clues so smug they seemed to wink in hexadecimal. His first ransom note took weeks to decode and ultimately said "too slow," which was accurate and professionally hurtful.',
    'Estonia\'s digital systems inspired him; unfortunately, so did dramatic nonsense. He leaves puzzles across e-services, museum kiosks, and once a parking meter that began issuing haiku about jurisdiction.',
    'In custody he asked for a password reset. ACME replied with a paper form. He has been staring at it as if it were medieval punishment.'
  ]),
    'Ms Pentimento': storyParagraphs([
    'Ms Pentimento trained as a painting restorer at the Uffizi during the postwar reorganisation, when half the great Italian collections were still being unpacked from rural villas and the chain of custody for half a continent had been written, lost, and rewritten by men in a hurry. She was very good. The certificates of authenticity she issued in those years are still in circulation, and several of them are even genuine. The trouble began when she discovered that the paperwork around a painting was easier to forge than the painting itself, and that institutions were trained to trust the paperwork.',
    'She moves on the Wagons-Lits sleeper network — Paris-Milan, Simplon-Orient, Rome Express — and signs hotel registers as a different scholar each week. Witnesses agree on auburn hair, a silver loupe on a chain, and Italian so cultivated that customs officers volunteer rather than ask. Her trademark is structural: every forgery she releases contains a deliberate pentimento, an underlying detail visible only to a restorer working under raking light. She calls it "an honest signature in a dishonest profession," which ACME considers the single most irritating phrase in the file.',
    'In custody she has corrected the lighting in three interview rooms, identified two reproductions on the wall as "passable but provincial," and explained at length that arrest is "merely a documentary inconvenience." When asked about The Cartographer, with whom early reports confused her, she replied that mountaineers leave footprints and she does not.'
  ]),
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
  if (!suspect) return null;
  const override = OVERRIDES[suspect.name];
  if (override) return override.join('\n\n');
  return [
    buildParagraphOne(suspect),
    buildParagraphTwo(suspect),
    buildParagraphThree(suspect),
  ].join('\n\n');
}
