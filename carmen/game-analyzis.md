# Carmen Sandiego — Exhaustive Game Analysis

> **Updated for the 10-case campaign.** The rookie/detective/ace difficulty picker has been removed. The game is now a single progression-driven campaign of 10 cases that ramps in pressure as the player closes in on Carmen Sandiego herself in the final case. See the **Campaign Progression** section below for the new mechanics layered on top of everything else in this document.

## A. NARRATIVE & STORY

### Narrator Intro (First Game Only)
Presented via `carmen/audio/narrator - intro.mp3` with synchronized subtitles:

```
[0.0] "The world's a big place."
[1.2] "Too big, if you ask me. Too many corners to hide in.
       Too many stories buried under stone, sand, and time."
[7.5] "Most people pass through it without noticing a thing.
       Snap a picture. Buy a postcard. Move on."
[13.0] "Me?"
[14.0] "I notice what's missing."
[15.5] "That's how it starts. It always does."
[18.5] "Something small at first. A whisper.
        A detail that doesn't sit right."
[23.0] "Then the call comes in."
[24.5] "And suddenly… a piece of the world is gone."
```

### Case Briefing Overlay
- **Artifact name**: `${siteName}` (e.g., "Great Wall of China")
- **Origin**: `"Last seen in ${startCountry}"`
- **Mission text** (typewriter effect, 20ms per character):
  `"Track the thief through neighboring countries. Investigate locations, gather clues, and identify the suspect to make your arrest."`
  + optional: `"You have only ${totalHours} hours to hunt down the criminal!"`
- **Suspect badge**: `"SUSPECT: UNKNOWN"`
- **Hint**: `"Gather clues to identify the thief"`

### Case Introduction (After Briefing Accepted)
```
ACTIVE CASE
${siteName}
Stolen from ${startCountry}
Suspect: Unknown
Investigate locations, gather clues, and follow the trail.
```

### Progress Narratives (Between Stops)
- Normal: `"Intel says the thief is ${remaining} stop(s) ahead. Follow the clues."`
- Final stop: `"The thief is cornered — this is the final stop!"`

### Thief Taunts by Progress Level

**Early game (progress < 0.4):**
- "You'll never catch me!"
- "I'm always three steps ahead, detective."
- "Is that the best ACME has to offer?"
- "By the time you read this, I'll be long gone."
- "Better luck next country!"
- "Catch me if you can!"

**Mid game (0.4–0.75):**
- "Still following me? How persistent."
- "I have to admit, you're better than the last detective."
- "Getting warmer... or are you?"
- "You're closer than I expected. Don't get used to it."
- "Not bad, detective. But I have a few tricks left."
- "Enjoy the scenery — I certainly am."

**Late game (>= 0.75):**
- "How are you still on my trail?!"
- "Fine, you're good. But I'm better."
- "I can hear your footsteps... getting closer."
- "This isn't over yet, detective!"
- "You've earned my respect. But not my surrender."

**Wrong guess taunts:**
- "Ha! Wrong turn, detective!"
- "You just wasted precious time. Thanks!"
- "That's not where I went. Try again!"
- "Cold, very cold!"
- "My grandmother could track better than you!"

### Transition Overlay (Correct Guess)
```
+${stopScore} points
The thief was spotted in ${country}!
[Thief taunt]
[Continue the chase →]
```

### Dead End (Wrong Guess)
```
❌
-25 points
No trace of the thief in ${country}!
This is a dead end. You've lost precious time.
[Continue searching →]
```

### Case Solved Ending
Overlay with animated stamp + typewriter:
```
SOLVED — CASE CLOSED
${suspectName} has been arrested!
${score} points
Case completed with ${hoursLeft}h remaining
[Next case → / Quit]
```

Narrator (`narrator - mission1 success.mp3`):
```
[0.0]  "Last case… wrapped up nicely."
[2.0]  "Caught the thief. Handcuffs, paperwork, the whole routine."
[6.5]  "Still don't know who they really were.
        Didn't stick around for introductions."
[10.0] "Figures."
[11.0] "I poured myself a coffee that tasted like
        regret and bad decisions."
[15.0] "Didn't even finish it."
[16.0] "Because I know how this goes."
[18.5] "You close one case… and somewhere out there—"
[21.5] "someone's already picking their next target."
```

### Case Failed Ending
```
FAILED — CASE CLOSED
${suspectName} has escaped!
${score} points
The real thief vanished into the shadows...
[Next case → / Quit]
```

Narrator (`narrator - mission1 fail.mp3`):
```
[0.0]  "The thief got away."
[1.1]  "Again."
[2.7]  "I replayed it in my head a dozen times. Maybe more.
        It doesn't get better with repetition."
[7.5]  "No face. No name."
[9.5]  "Just a disappearing act that would make
        a stage magician jealous."
[13.0] "Could be anyone."
[14.5] "Which, in my line of work, is just another way
        of saying I've got nothing."
[18.5] "But the next case is already knocking."
[20.5] "And I don't intend to be the punchline twice."
```

### Witness Reports (Suspect Clues)

**Vague clues** (first revelation):
- Hair: `"A witness noticed the suspect had ${group} hair."`
- Accessory: `"The suspect was seen wearing some kind of distinctive ${group}."`
- Hobby: `"An informant says the thief is into ${group} activities."`
- Vehicle: `"The getaway involved something that ${type}."`

**Specific clues** (after investigation):
- Hair: `"A witness positively identified the suspect as having ${val} hair."`
- Accessory: `"The suspect was confirmed to be wearing a ${val}."`
- Hobby: `"A reliable source confirms the thief is known for ${val}."`
- Vehicle: `"The getaway vehicle has been identified as a ${val}."`

### Investigation Location Informant Prefixes

Each location has 3 randomized prefixes:
- **Airport**: "An airline attendant revealed" / "A fellow traveler shared" / "A taxi driver outside told you"
- **Hotel**: "The hotel concierge mentioned" / "A bellhop whispered" / "A housekeeper recalled"
- **Market**: "A market vendor confided" / "A street food vendor said" / "A shopkeeper overheard"
- **Library**: "A librarian recalled" / "A professor noted" / "An old journalist mentioned"
- **Embassy**: "An embassy attaché noted" / "A local officer reported" / "A diplomat mentioned"

### "No New Leads"
When a location is exhausted of clues: `"No new leads here." ❌`

---

## B. SOUND DESIGN

### Background Music (25 Tracks)
Volume: 0.25. Fade in ~600ms. Random track selected each `startMusic()` call.

1. Alley Thoughts
2. Ashtray Alibi 2
3. Ashtray Alibi
4. Bass Walker
5. Broken Casefiles 2
6. Broken Casefiles
7. Case Soda Pop
8. Casefile Chrome
9. Cigar Ashes 2
10. Cigar Ashes
11. Coal-Lit Case
12. Cobalt Alibi 2
13. Cobalt Alibi
14. Cool Vibes
15. Covert Affair
16. Fallen Petals
17. Just As Soon
18. Lacquered Alibi 2
19. Lacquered Alibi
20. Night Walk In Paris
21. Noir Alley
22. Signs To Nowhere
23. Smoldered Alibis
24. Tin Stethoscope 2
25. Tin Stethoscope

### Music Ducking
- Narrator starts: volume drops to 0.10 (40% of normal)
- Narrator ends: restores to 0.25
- Smooth crossfade between states

### Ambient Sounds (Location-Based)
Volume: 0.35. Single-play per investigation.

| Location | File | Trigger |
|----------|------|---------|
| Airport | airport-terminal.mp3 | Investigation at airport |
| Hotel | hotel-bell.mp3 | Investigation at hotel |
| Market | market-area.mp3 | Investigation at market |
| Library | footsteps.mp3 | Investigation at library |
| Embassy | footsteps.mp3 | Investigation at embassy |
| Taxi | taxi.mp3 | Taxi driver informant |
| Travel | airplane.mp3 | Travel animation between countries |
| Default | footsteps.mp3 | Fallback |

### Victory Music
- File: `Catching The Thief.mp3`
- Volume: 0.25. Plays once (no loop). Replaces background music.

### Procedural Sound Effects

**Stamp (playStamp):** Sine 120→40 Hz over 150ms + noise burst overlay (80ms white noise with decay). Used for briefing/closing overlays.

**Clock Tick (playTick):** Alternates 900 Hz / 600 Hz, ramps down over 40ms. Gain: 0.12→0.001. Triggers every 2–3 characters during typewriter.

**Typewriter Key (playTypeKey):** 30ms noise buffer with bandpass filter (2000–3000 Hz). Sharp mechanical click with quick decay.

**Clock Ticking Loop:** `clock-ticking.mp3`, volume 0.4, loops during clock countdown animation. Stops when countdown reaches target.

---

## C. DIFFICULTY ANALYSIS

> **Note:** The rookie/detective/ace picker has been removed. Difficulty now scales automatically with the **case number** via the campaign modifier table (see **Campaign Progression** below). The "Rookie" column is the current campaign baseline; the former Detective/Ace tiers no longer exist as independent modes, but their values roughly correspond to mid- and late-campaign cases on top of the baseline.

### Baseline Parameters (every case starts here)

| Parameter | Value |
|-----------|-------|
| Stops | 4 |
| Clues per stop | 3 |
| Extra clues | 99 (effectively unlimited) |
| Investigations | 4 |
| Total hours | 72 |

### Legacy Difficulty Parameters (removed)

| Parameter | Rookie | Detective | Ace |
|-----------|--------|-----------|-----|
| Stops | 4 | 6 | 8 |
| Clues per stop | 3 | 2 | 1 |
| Extra clues | Infinity | 2 | 1 |
| Investigations | 4 | 3 | 2 |
| Total hours | 72 | 72 | 64 |

### Time Costs
- Investigation: **3 hours**
- Travel: **5 hours**
- Extra clue: **2 hours**
- Interpol file (first view of any suspect with a photo, including Carmen): **3 hours**. Subsequent views within or across games are free.

### Time Budget Analysis

**Rookie (4 stops, 72h):**
- Travel: 4 x 5h = 20h
- Investigations: 4 x 4 x 3h = 48h
- **Total: 68h** (4h buffer)
- Pressure: **LOW**

**Detective (6 stops, 72h):**
- Travel: 6 x 5h = 30h
- Investigations: 6 x 3 x 3h = 54h
- **Total: 84h** (12h OVER budget)
- Pressure: **MODERATE** — must skip ~2 investigations or fail

**Ace (8 stops, 64h):**
- Travel: 8 x 5h = 40h
- Investigations: 8 x 2 x 3h = 48h
- **Total: 88h** (24h OVER budget)
- Pressure: **SEVERE** — any dead end = instant loss (5h penalty)

### Clue Effectiveness at Narrowing Neighbors
- Geography clues (continent, landlocked, capital letter, population, borders, peak): Best when neighbors span multiple feature types
- Heritage sites: Location-specific, low overlap between neighbors
- Rivers/Mountains: Medium overlap (e.g., Nile through 5 countries)
- Exports: Commodity-based, may overlap
- Empire clues: Many neighbors share same historical empires
- **Average deduction confidence after all clues: ~60–70%**

### Suspect Lineup Difficulty

Decoy selection algorithm scores candidates:
- +10 per matching vague clue group
- +15 per matching specific (confirmed) attribute
- +random(0–2) tiebreaker
- Top 3 candidates become decoys

| Player clues gathered | Effective difficulty |
|-----------------------|-------------------|
| 0 specific clues | ~25% guess |
| 1 specific clue | ~33–40% |
| 2+ specific clues | ~50–60% |
| 4 specific clues | Near-guaranteed |

Lineup is intentionally hard with few clues, easy with many — encourages thorough investigation.

---

## D. VARIETY & REPLAYABILITY

### Suspects: 43 Total

**Original 12:** Carmen Sandiego, Viktor Voss, Natasha Petrova, El Zorro, The Shadow, Lady Crimson, Phantom Fox, Raven, Scarlet Cipher, Dr. Atlas, The Cartographer, Velvet Mask

**Added 31:** Raven Noir, Professor Paradox, Luna Nocturne, Count Obsidian, Ivy Virelli, Echo, The Locksmith, Captain Marlowe, Nova Vex, Saffron Silk, Silk Serpent, Crimson Dagger, Golden Lynx, Ivory Whisper, Neon Specter, Scarlet Swan, Midnight Owl, Dusty Nomad, Silver Comet, Velvet Raven, Amber Fox, Storm Herald, Crimson Mirage, Onyx Panther, Golden Seraph, Ivory Phantom, Emerald Kite, Shadow Lynx, Copper Sparrow, Ghost Mariner, Velvet Cipher

### Suspect Attributes
- **Hair** (11 values): black, blond, red, auburn, platinum, silver, white, gray, green, brown, unknown
- **Accessory** (22 values): monocle, red trench coat, fur hat, mask, ruby necklace, etc.
- **Hobby** (34+ values): tango dancing, chess, ice skating, fencing, opera singing, etc.
- **Vehicle** (16 values): red convertible, submarine, snowmobile, hot air balloon, motorcycle, etc.

**Vague clue groupings:**
- Hair: 4 groups (dark, light, unusual, red)
- Accessory: 6 groups (headwear, eyewear, jewelry, outerwear, gadget, other)
- Hobby: 5 groups (physical, cerebral, artistic, outdoors, collector)
- Vehicle: 3 groups (air, land, sea)

### Clue Types: 7 Distinct

1. **Geography** — continent, landlocked, capital letter, population, border count, peak elevation
2. **Facts** — from country-facts.json (5–10 facts per country)
3. **Heritage** — from heritage-sites.json
4. **Rivers/Mountains** — from rivers.json and mountains.json
5. **Empires** — from empires.json (15–20 empires)
6. **Famous For** — curated attributes in countries.json
7. **Exports** — commodity lists in countries.json

### Location Clue Specialization

| Location | Clue types offered |
|----------|--------------------|
| Airport | geography, river_mountain |
| Hotel | famous_for, fact |
| Market | exports, fact, river_mountain |
| Library | empire, heritage, famous_for, fact |
| Embassy | heritage, geography |

Library is the most comprehensive (4 types).

### Route Generation
1. Start country: must have heritage site + >=2 neighbors
2. Each next country: weighted random from neighbors with >=1 neighbor
3. Weight: `(facts_count + 1) x neighbors_count`
4. Selects from top 5 candidates per step
5. Retries up to 20 times for longest possible route
6. **Thousands of unique route combinations**

### Informant Variety
5 locations x 3 variants = 243 unique informant combinations per stop

### Predictability Analysis

**Becomes predictable after 3–5 plays:**
- Library is always best (4 clue types)
- Continent clues narrow instantly when neighbors span continents
- Suspect names/attributes become familiar
- Wrong guesses always cost -25 points and 5 hours

**Remains unpredictable:**
- Route generation (new sequence every game)
- Clue order (shuffled generators and facts)
- Informant text (3 variants per location)
- Background music (25 tracks)
- Suspect assignment (43 suspects)

**Replayability ceiling:** Good for 10–20 plays before pattern recognition dominates; sufficient for educational purposes.

### Data Usage

| Field | Used | Notes |
|-------|------|-------|
| country | YES | Every clue |
| continent | YES | Geography clues |
| capitals | YES | Capital letter clues, dossier |
| neighbors | YES | Route building, narrowing |
| landlocked | YES | Geography clue |
| population | YES | Bracket-based clue |
| highestPeak | YES | Geography clue |
| famousFor | YES | 3 templates per item |
| exports | YES | 3 templates per 2–3 items |
| facts | YES | Primary clue source |
| flagCode | YES | UI only (flag display) |
| cities | **NO** | Loaded but never used |
| area | **NO** | Loaded but never used |
| un | **NO** | Loaded but never used |
| closestLat | **NO** | Loaded but never used |

---

## E. CLUE GENERATION DEEP DIVE

### Pipeline

`investigateLocation(locationId)` tries each location's `clueTypes` in random order:

```
_generateClues(targetCountry, count):
  1. Gather neighbor choices
  2. Shuffle 7 generators randomly
  3. For each: try to get 1 clue (if not in usedClueIds)
  4. If still need more: loop through facts again
  5. If still need more: try all geography clues (always available)
  6. Return up to `count` clues
```

### Generator Details

**_clueFromFact(country):** Shuffles `facts[country]`, redacts country name/demonym, returns first usable fact.

**_clueFromGeography(country, neighborChoices):** Builds all possible geography clues. Filters out unhelpful ones (e.g., continent clue only if neighbors span multiple continents; landlocked only if not all neighbors landlocked). Returns random one.

**_clueFromHeritage(country):** Shuffles heritage sites for country, uses first with successful redaction. Fallback: generic "a priceless artifact".

**_clueFromRiverOrMountain(country):** Merges rivers + mountains, shuffles, returns first unused.

**_clueFromEmpire(country):** Shuffles empires for country, returns first unused.

**_clueFromFamousFor(country):** 3 templates ("This place is known for X" / "The destination is famous for X" / "You'll find X in this country"). Shuffles items, tries each with redaction.

**_clueFromExports(country):** Randomly selects 2–3 export items. 3 templates ("Major exporter of X" / "Key exports include X" / "The local economy runs on X"). Formats as "a, b, and c".

### Deduplication

Global `usedClueIds` Set tracks every clue given in the game. ID formats:
- `fact-${country}-${first30chars}`
- `geo-continent-${country}`
- `heritage-${country}-${siteName}`
- `feature-${type}-${name}`
- `empire-${name}`
- `famous-${country}-${i}`
- `exports-${country}-${sorted_items}`

### Country Name Redaction

`_redactCountryName(text, country)`:
1. Replace country name (case-insensitive, word boundary) with "this country"
2. Replace each demonym in `DEMONYM_MAP[country]` with "local"

Example: "Brazilian coffee is world-famous" → "local coffee is world-famous"

### Edge Cases

| Scenario | Result |
|----------|--------|
| No heritage sites | Returns null, skips to next generator |
| No rivers/mountains | Returns null, skips |
| No empire history | Returns null, skips |
| No facts | Geography clues as fallback (always available) |
| All clues exhausted | "No new leads here" message |
| Redaction fails (name still visible) | Clue skipped |

---

## F. GAME STATE & PROGRESSION

### Core State (CarmenGameLogic)

```javascript
// Game state
route = []              // Array of countries
currentStop = 0         // Current index in route
suspect = {}            // Picked suspect object
score = 0
hoursRemaining = totalHours
timeExpired = false
gameOver = false
won = false

// Suspect identity (warrant system)
_suspectClueIndex = 0   // Which attribute to reveal next
_suspectClueStop = -1   // Which stop last revealed clue at
_revealedAttrs = []     // Array of {attr, value, vague}
_pendingSpecificClue = null

// Clue tracking
usedClueIds = new Set()
_investigationsUsed = 0  // Per stop
```

### Game Flow

```
1. logic.start()
   → Generate route → Pick suspect → Pick artifact → Create clues

2. UI: Briefing overlay (artifact + time limit)

3. showInvestigationLocations()
   → 5 location buttons + witness report (vague suspect clue)

4. Player investigates (per click):
   → logic.investigateLocation(id) → clue or null
   → Typewriter reveal → Clock -3h → Check time expired

5. Player guesses neighbor (map click):
   → Correct: Travel animation → Transition overlay → Next stop
   → Wrong: Dead end overlay (-25 pts, -5h) → Return

6. Final stop reached:
   → Lineup overlay (4 suspects) → Player picks
   → Correct: Victory → Wrong: Failure

7. showCaseSolved() or showCaseFailed()
   → Narrator audio → Save to localStorage
```

### Scoring

| Event | Points |
|-------|--------|
| Correct guess (first try) | +150 |
| Correct guess (after dead end) | +100 |
| Dead end | -25 |
| Wrong suspect identification | -200 |

### Dossier System

Entries accumulate chronologically:
```javascript
{ stop, stopKey, type, clueText, informantPrefix, emoji, country, capital }
```
- Each investigation adds an entry
- Dead ends add: `{ stop: -1, type: 'detour', clueText: 'No witnesses...', emoji: '❌' }`
- UI groups by stopKey with headers: "Stop 1 — Capital, Country"

### Time Display
Format: `"${days}d ${hours}h"` (e.g., "2d 8h" for 56 hours)

### Mission History (localStorage)
- Key: `carmen-missions`
- Stores array of `'success'` / `'fail'` strings
- UI shows last 12 missions as tally marks

### Interpol Database (localStorage)
- Key: `carmen-interpol-unlocked` (starts empty — no suspects are unlocked by default)
- **All** suspects with photos cost **3 hours** on first view. Subsequent views are free (tracked via `carmen-interpol-viewed`, which persists across games).
- Carmen Sandiego is **not** pre-unlocked and is **sorted to the bottom** of the list so she doesn't visually stand out as the eventual boss.
- Arrested suspects are marked `IN CUSTODY`; everyone else is `AT LARGE` (including Carmen until case 10 is won).
- Persists across games.

### Campaign Progression (localStorage)
- Key: `carmen-campaign-case` — current case number (1–10). Defaults to 1.
- Key: `carmen-campaign-complete` — set when case 10 is won; cleared after the player dismisses the campaign-complete overlay.
- Advances **only** on a correctly identified suspect. Failed cases replay the same case number with fresh randomness.

---

## G. UI/UX DETAILS

### Tab System

**Left panel tabs:**
1. Case — Narrative + witness reports
2. Investigate — Location buttons
3. Travel — Hidden during investigation
4. Dossier — Accumulating clues list
5. Interpol — Suspect database

**Right panel content (dynamic per left tab):**
| Left Tab | Right Content |
|----------|---------------|
| Case | Artifact image |
| Investigate | Clue reveal speech bubble |
| Travel | Map |
| Dossier | Full dossier |
| Interpol | Suspect profile |

### Panel Layout

**Desktop (>600px):** `[Status Bar] [Left Panel 260px | Right Panel flex]`

**Mobile (<=600px):** Stacked layout, bottom tabs, full-width content, right panel as overlay.

### Animations

| Effect | Trigger | Details |
|--------|---------|---------|
| Briefing slide-in | showCaseBriefing() | translateY(30px) scale(0.95) → normal, 500ms |
| Stamp bounce | Overlay appears | Scale 0→0.9→1, 400ms, rotated 12deg |
| Typewriter text | Clue/brief text | 20–25ms per char, key sound every 2–3 chars |
| Clock countdown | Clock updates | 120ms per hour tick |
| Clock pulse | <25% time left | Blink 1s loop |
| Clock critical | <12% time left | Faster blink (0.6s) + red |
| Clue fade-in | Speech bubble | 250ms ease-out |
| Travel animation | Map pan/zoom | Current → destination |
| Wrong flash | Dead end | Red flash 350ms |
| Taunt slide-in | Transition overlay | Silhouette + speech bubble, 400ms |
| Closing stamp | Case solved/failed | Same as briefing stamp |

### Typewriter Effect
- Speed: 25ms per character (configurable)
- Triggers `playTypeKey()` every 2–3 characters
- Click anywhere skips to full text
- Returns promise (awaitable)

### Location Buttons
```
[Airport] [Hotel] [Market] [Library] [Embassy]
```
States: enabled → investigated (faded) → exhausted (disabled)

### Suspect Lineup Grid
2x2 grid of suspect cards, each showing: name, hair, accessory, hobby, vehicle.

### Overlay System
1. **Briefing** — z-index 300, centered
2. **Closing** — full screen, z-index 300+
3. **Map overlay** — positioned on map, z-index 100+
4. **Lineup** — modal dialog on body

---

## H. IDENTIFIED FLAWS & ISSUES

### Detective Difficulty is Mathematically Over-Budget
Requires ~84h minimum but only provides 72h. Must skip ~2 investigations per game or fail. Unclear if intentional.

### Ace Difficulty is Nearly Impossible
Requires ~88h but provides 64h. Any single wrong guess = game over (5h travel penalty). Must make near-perfect deductions every stop with only 2 investigations each.

### Geography Clues Over-Represented Late Game
Geography is the fallback when all other clue types are exhausted. Late-game investigations heavily favor geography clues, reducing variety.

### Lineup Difficulty Doesn't Scale Gracefully
With only 1–2 clues gathered, lineup becomes 75% guessing. No partial-match feedback.

### No Time Preview Before Decisions
Player can't see how spending 2h on an extra clue will affect remaining budget. No tentative clock state.

### Route Can Be Shorter Than Target
Algorithm retries 20 times but doesn't guarantee target length. May produce 5-stop route on Detective (expects 6).

### Some Countries Lack Heritage Sites
~120 countries have no heritage sites. Falls back to generic "a priceless artifact" — less immersive.

### Near-Duplicate Clues Possible
Deduplication uses clue ID, but different generators could produce very similar text.

### No Hint System
If stuck on neighbor guesses, no way to request a directional hint.

### Typewriter Speed Not Adjustable
Fixed 20–25ms per character. No accessibility control for speed readers or slower readers.

### Unused Data Fields
`cities`, `area`, `un`, and `closestLat` are loaded but never referenced in game logic.

---

## I. STRENGTHS

### Mechanical
- **Multi-dimensional deduction:** Geography knowledge + suspect identification create two parallel challenges
- **Elegant time pressure:** Investigation (3h), travel (5h), extra clues (2h) create natural pacing urgency without artificial timers
- **Smart lineup system:** Decoy matching scales difficulty with clue gathering effort
- **Location specialization:** Strategic choice between 5 locations with different clue type coverage
- **Redaction system:** Country name/demonym replacement protects puzzle integrity

### Narrative
- **Noir framing:** Narrator intro + taunts + mission briefing create immersive detective fantasy
- **Progressive taunts:** Thief personality shifts from dismissive to respectful as player progresses
- **Cinematic transitions:** Overlays with scores + taunts create satisfying pacing peaks
- **Distinct endings:** Both success and failure have full narrator voiceovers with noir character

### Educational
- **Active learning:** Players gather geographic facts through investigation, not passive reading
- **Interconnected knowledge:** Heritage, empires, rivers, exports build holistic world understanding
- **Neighbor relationships:** Routes force players to think about geographic adjacency
- **Demand-driven facts:** Facts encountered when needed for puzzle-solving, improving retention

### Technical
- **Clean separation:** `CarmenGameLogic` has zero DOM dependencies — fully testable
- **Modular audio:** Web Audio API synthesis + file-based music + ambient sounds managed cleanly
- **Efficient state:** Despite complex routing/clue generation, core state object is clean and traceable
- **Route diversity:** Country neighbor graph naturally generates thousands of unique routes

---

## J. SUMMARY METRICS

| Metric | Value |
|--------|-------|
| Suspects | 43 |
| Suspect attributes | 4 (hair, accessory, hobby, vehicle) |
| Clue types | 7 |
| Difficulty levels | 3 |
| Investigation locations | 5 |
| Informant variants per location | 3 |
| Background music tracks | 25 |
| Narrator audio files | 3 |
| Ambient sound effects | 8 |
| Hair values | 11 |
| Accessory values | 22 |
| Hobby values | 34+ |
| Vehicle values | 16 |
| Time budget — Rookie | 72h (4h buffer) |
| Time budget — Detective | 72h (12h over) |
| Time budget — Ace | 64h (24h over) |
| Points per stop (first try) | 150 |
| Points per stop (retry) | 100 |
| Wrong suspect penalty | -200 |
| Replayability ceiling | ~10–20 plays |

---

## K. CAMPAIGN PROGRESSION (10-case arc)

### Overview
The game is now a single campaign of 10 sequential cases. The player advances only by correctly identifying the thief in the suspect lineup; failed cases are replayed with new randomness. The arc culminates in a direct confrontation with Carmen Sandiego in case 10.

### Phases
| Cases | Phase | Narrative tone |
|-------|-------|----------------|
| 1–3 | `prelude`   | Ordinary thieves. No mention of Carmen anywhere. |
| 4–6 | `whispers`  | Taunts and briefings hint at "a shadow behind the shadow". Carmen is not named. |
| 7–9 | `pursuit`   | The thief is explicitly a Carmen lieutenant. Carmen is named in taunts and briefings. |
| 10  | `finale`    | Carmen Sandiego herself is forced as the thief and speaks in first person. |

Carmen is **excluded** from the suspect pool in cases 1–9 and **forced** as the suspect in case 10.

### Per-case Difficulty Modifier
Applied on top of the baseline (4 stops, 72h, 4 investigations, 3 clues/stop, 99 extra clues):

| Phase | Δ hours | Δ stops | Δ investigations | Δ extra clues | Δ clues/stop |
|-------|---------|---------|------------------|---------------|--------------|
| prelude  (1–3) | 0   | 0  | 0  | 0  | 0  |
| whispers (4–6) | −8  | +1 | −1 | −1 | 0  |
| pursuit  (7–9) | −16 | +2 | −1 | −2 | −1 |
| finale   (10)  | −24 | +3 | −2 | −2 | −2 |

Clamps: `stops ≥ 4`, `investigations ≥ 1`, `cluesPerStop ≥ 1`, `extraClues ≥ 0`, `totalHours ≥ 40`.

### Phase-aware Content

**Briefing mission copy** (`showCaseBriefing` in `js/ui-components/carmen-ui.js`):
- prelude: original "Track the thief…" copy.
- whispers: "Witnesses keep mentioning a shadow behind the shadow — someone bigger is pulling strings."
- pursuit: "ACME has traced this theft to Carmen Sandiego's network. The thief is one of her lieutenants…"
- finale: "This is it. Carmen Sandiego herself has surfaced…"

**Briefing header:** `CASE X / 10`, or `FINAL CASE — 10 / 10` in the finale.

**Taunts** (`THIEF_TAUNTS` in `js/games/carmen-logic.js`, `getTaunt()`):
- prelude: original early/mid/late pool by progress %.
- whispers: 50% chance to pick from the new `whispers` bucket (shadowy-boss hints), else original pool.
- pursuit: 70% chance `pursuit` bucket (explicit Carmen references).
- finale: always from the `finale` bucket — Carmen speaking in first person.
- Each new phase bucket has matching `*Wrong` taunts for incorrect guesses.

**Interpol dossier evolution** (Carmen's file, `showInterpolProfile`):
- prelude: all fields `[REDACTED]`; notes say *"Subject exists only in rumor. ACME has no confirmed file."*
- whispers: hair + accessory visible; hobby + vehicle redacted.
- pursuit: hair + accessory + hobby visible; vehicle redacted.
- finale: fully visible; notes: *"Primary target. All cases lead here."*

### Campaign-complete Overlay
After winning case 10, `ui.showCampaignComplete(score)` displays a full-screen "CAMPAIGN COMPLETE — CARMEN SANDIEGO: IN CUSTODY" stamp with a single *Restart campaign* button. Clicking it removes `carmen-campaign-case` and `carmen-campaign-complete` so the next game begins at case 1.

### UI Surfacing
- Status-bar tally now reads `Case X / 10` instead of "Cases solved:" (`updateMissions()` takes `caseNumber` / `totalCases`).
- `play.html` exposes a single Carmen tile (`Where in the World – Carmen Sandiego`). The three old `carmen-rookie / carmen-detective / carmen-ace` entries are gone.

---

## L. DEBUG / TESTING SHORTCUTS

For quickly jumping to a specific case without playing through the campaign (`js/carmen-main.js`):

- **URL param:** `carmen.html?case=N` — sets the campaign case to `N` (clamped 1–10) on load and clears `carmen-campaign-complete`.
- **Secret key sequence:** type `carmen` anywhere on the page → a `window.prompt` asks for a case number (1–10). Entering a value writes `carmen-campaign-case` and reloads. Ignored when focus is in an input/textarea/select.

Both routes funnel through a single `setCase(n)` helper that clamps and writes localStorage.
