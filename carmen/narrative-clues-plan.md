# Plan: Noir-Narrative Clue Dialogue

## Context

Clue text today is a single flat sentence built inside `_clueFromFact`, `_clueFromGeography`, `_clueFromExports`, `_clueFromFamousFor`, `_clueFromHeritage`, `_clueFromRiverOrMountain`, `_clueFromEmpire` in `js/games/carmen-logic.js`. The UI then wraps it in a speech bubble whose speaker name is the location informant's `prefix` (e.g. *"A market vendor confided"*). The clue itself is declarative and location-agnostic — a geography clue reads the same whether it came from an embassy attaché or a taxi driver.

Goal: match the noir dialogue style the user specified — **Character + Texture + Information** — with per-location voice, subtext, micro-actions, and variety, without rewriting the clue-generation pipeline or exploding the data files.

## Design principles

- **Clue generators stay dumb.** They still return the raw information payload (category + facts). Narrative wrapping happens in a new presentation layer.
- **Voice is driven by location, not clue type.** Each of the 5 locations gets its own tone (airport=fragmented, hotel=gossipy, market=street-smart, library=clinical, embassy=evasive).
- **Subtext is driven by clue category.** Geography/export/heritage/empire/fact each get multiple phrasings so the same raw fact can surface as 3–4 different lines.
- **Micro-actions are a thin decorative layer.** A small pool per informant, sprinkled in ~50% of clues for cinematic texture without noise.
- **Country-name redaction still runs last** on the final composed line — unchanged guarantee.

## Data model changes

### 1. Clue generators return structured payloads

Today a generator returns `{ id, text, icon, category }`. Change the return to:

```js
{
  id,              // unchanged — used for dedup
  category,        // 'geography' | 'exports' | 'fact' | 'famous_for' | 'heritage' | 'empire' | 'river_mountain'
  subtype,         // optional — e.g. 'continent' | 'landlocked' | 'capital_letter' | 'population' | 'peak' for geography
  data,            // the raw values: { items, letter, continent, elevation, riverName, siteName, empireName, factText, ... }
  icon,            // unchanged
}
```

A generator no longer builds a sentence. All phrasing moves to the composer (below).

Where the old `text` field is needed (dossier, debugging), the composer exposes `renderClue(clue, informant)` and that result is what the UI receives.

### 2. New file: `js/games/carmen-clue-voice.js`

Exports:

```js
export function composeClue(clue, informant, locationId) -> { text, speakerLine }
```

- `text` = the full noir-rendered clue as it appears in the speech bubble.
- `speakerLine` = what goes in the avatar "name" row (e.g. the existing informant prefix, unchanged, so the UI doesn't have to rewire).

Inside, `composeClue` does three things:

1. **Pick a phrasing template** from the category × subtype pool.
2. **Apply the location voice wrapper** (fragment / hedge / clinical / evasive / street-smart).
3. **Optionally prepend a micro-action** keyed off the informant.

All three are plain template arrays — no new data files, everything lives in this module.

### 3. Template pools

**Category → subtype → phrasing templates.** Each returns a plain sentence fragment containing the info. Redaction runs on the final composed line.

```js
const PHRASINGS = {
  geography: {
    continent_same:   [
      'They didn\'t leave the continent. Too risky to cross borders now.',
      'Still on the same continent. Whoever this is… they\'re playing it safe.',
      'No long flights. Stayed close — same continent.',
    ],
    continent_diff:   [ 'They crossed continents. Bold move.', ... ],
    landlocked:       [ 'No ports there. If they went that way, they\'re staying inland.', ... ],
    coastal:          [ 'Water access. Makes a clean exit easier.', ... ],
    capital_letter:   [ 'City starts with a "${L}," if that helps you any.', ... ],
    population_small: [ 'Not many people there. Easy to stand out. Or disappear.', ... ],
    population_large: [ 'Millions live there. A good crowd to vanish into.', ... ],
    peak_high:        [ 'Mountains that scrape the sky. Over ${m} meters.', ... ],
  },
  exports: [
    '${items}… that\'s what keeps this place alive. And worth stealing from.',
    'Big shipments. The kind that move money. ${items}.',
    'They were asking about ${items}. Specific. Targeted.',
  ],
  famous_for: [
    'Famous for ${item}, if that means anything.',
    'People come here for ${item}. Maybe the thief did too.',
    '${item}. That\'s what this place sells to the world.',
  ],
  heritage: [
    'Old stones. Old secrets. A place called ${siteName}.',
    '${siteName}. The kind of landmark thieves stare at a long time before they move.',
    'Whoever it is, they were near ${siteName}. Guards said nothing unusual. That\'s the tell.',
  ],
  river_mountain: [
    '${name}. You can\'t cross this country without crossing it.',
    'They followed ${name} — that much is certain.',
    'The ${name} runs through here. Convenient cover.',
  ],
  empire: [
    'Built empires once. Still carries the weight of it. The ${name}.',
    'This land remembers the ${name}. And so does whoever\'s running.',
    'Old ${name} territory. The kind of history thieves study.',
  ],
  fact: [
    '${fact}',  // facts are already narrative; just quote them
    'Word on the ground: "${fact}"',
    '"${fact}" — that\'s what the locals keep saying.',
  ],
};
```

Each template is a **function** `(data) => string`, not a literal, so we can interpolate safely and keep the country-name redaction step untouched.

**Location voices** wrap the picked phrasing:

```js
const VOICE = {
  airport:  (line) => [
    `"Yeah, I saw… ${line}"`,                     // fragmented
    `"Hard to say for sure. ${line}"`,
    `"Overheard on the terminal intercom — ${line}"`,
  ],
  hotel:    (line) => [
    `"We don't usually say, but… ${line}"`,       // polite-loaded
    `"The guest mentioned something odd. ${line}"`,
    `"I wouldn't swear to it, but ${line}"`,
  ],
  market:   (line) => [
    `"Listen, friend — ${line}"`,                 // street-smart
    `"Everyone around here talks. ${line}"`,
    `"${line} — that's what they were asking about."`,
  ],
  library:  (line) => [
    `"If you cross-reference the records, ${line}"`, // clinical
    `"The sources are clear on this. ${line}"`,
    `"${line} Historically speaking."`,
  ],
  embassy:  (line) => [
    `"Off the record — ${line}"`,                 // evasive
    `"We've heard reports. Unconfirmed. ${line}"`,
    `"${line} You didn't hear it from me."`,
  ],
};
```

**Micro-actions** keyed off informant emoji/prefix:

```js
const ACTIONS = {
  '🧑‍✈️': ['The attendant barely glanced up from her clipboard.', 'She checked her watch twice before answering.'],
  '🚕':   ['The cabbie tapped his meter and leaned back.', 'He didn\'t kill the engine.'],
  '🛎️':   ['The bellhop lowered his voice.', 'He glanced toward the front desk.'],
  '🛍️':   ['The vendor didn\'t look up from his stall.', 'She wiped her hands on her apron before speaking.'],
  '📚':   ['The librarian adjusted his glasses.', 'She closed the book carefully before answering.'],
  '👨‍🏫':  ['The professor steepled his fingers.', 'He paused, weighing his words.'],
  '🏛️':   ['The attaché chose his words with care.', 'She let a long silence pass first.'],
  // ...default fallbacks per location for informants not listed.
};
```

## Composer logic

```js
export function composeClue(clue, informant, locationId) {
  const phrasingPool = pickPhrasingPool(clue);        // category/subtype → array
  const baseLine = phrasingPool[rand].call(clue.data);

  const voiceWrappers = VOICE[locationId] || VOICE.library;
  const voiced = voiceWrappers[rand](baseLine);

  const action = Math.random() < 0.5 ? pickAction(informant) : null;

  const finalText = action ? `${action}\n${voiced}` : voiced;
  return { text: finalText, speakerLine: informant.prefix };
}
```

The `\n` is preserved by the speech-bubble CSS (set `white-space: pre-line` on `.carmen-speech-text`).

## Integration points

### `js/games/carmen-logic.js`

- Each `_clueFrom*` generator: stop building a sentence. Return `{ id, category, subtype?, data, icon }`. Keep the dedup `id` format unchanged to preserve existing used-clue tracking.
- `_redactCountryName` still runs — but now on the composed line, inside the composer's final step. Move the redaction call into `composeClue` (it already has access to the `country` via the data payload). The `_containsCountryName` safety check moves there too.
- `investigateLocation(locationId)` currently returns the generator output directly. Change it to: pick generator → get payload → call `composeClue(payload, informant, locationId)` → return `{ id, text, icon, category }` (so the UI and dossier signatures are unchanged).

### `js/ui-components/carmen-ui.js`

- `addClue(clue, informant)` already accepts `clue.text` — **no signature change needed**.
- CSS: `.carmen-speech-text { white-space: pre-line; }` so the micro-action line break renders.
- `addDossierEntry(...)` also receives `clue.text`; it'll work unchanged, though dossier lines will be longer. Worth a spot-check to confirm the existing CSS handles the extra lines cleanly.

### Witness reports (suspect clues)

Out of scope for this plan — suspect clues go through `getSuspectClue()` / `investigateSuspectClue()`, a separate pipeline. They already have a "vague vs specific" texture. If desired, a follow-up can apply the same voice wrappers to witness-report text.

## Variety math

With:
- ~3 phrasings per category/subtype (so ~25 phrasings total across 7 categories)
- 3 voice wrappers per location × 5 locations = 15 wrappers
- ~2–3 micro-actions per informant × 15 informants = ~35 actions
- Action appears ~50% of the time

A single "exports: coffee, gold" clue can now surface as **3 phrasings × 3 wrappers × (1 + ~2 action options) ≈ 27 distinct lines** from a single location, plus another 27 from any other location the clue can appear at. Multiply by the 7 categories and the noise floor for repetition moves way past the current 3-template ceiling.

## Files touched

- `js/games/carmen-clue-voice.js` — **new**. All templates + composer.
- `js/games/carmen-logic.js` — generator returns restructured (payload instead of sentence); `investigateLocation` calls the composer; redaction call moves into composer.
- `js/ui-components/carmen-ui.js` — no logic change; optional CSS tweak for `white-space: pre-line`.
- `css/carmen.css` — single rule for `.carmen-speech-text { white-space: pre-line; }` (and matching rule on dossier entries if needed).

No new data files. No changes to `countries.json`, `country-facts.json`, etc.

## Phased rollout (independent, can ship one at a time)

1. **Phase A — Phrasing pools only.** Generators restructured + composer built with phrasing pools; voice wrappers are pass-through; no micro-actions. Biggest variety gain for the least risk. Ship and play-test.
2. **Phase B — Location voices.** Add the 5 voice wrappers. This is where the user's "distinct voice per location" lands.
3. **Phase C — Micro-actions.** Add the action pool and the 50% sprinkle. CSS `white-space: pre-line` ships here.
4. **Phase D — Witness reports (optional).** Apply voice wrappers to the suspect-clue pipeline too, if the detective-speaker vibe works there.

## Verification

1. Play a single case, investigate the same location type 3 times, confirm the text differs each time.
2. Confirm the same raw clue (e.g. same exports tuple) renders differently when found at different locations.
3. Confirm dedup still works — force `usedClueIds` collision by re-investigating after a known clue; verify "No new leads here" still triggers.
4. Confirm country-name redaction still runs (grep a few country names in the composed output — should be `this country` / `local`).
5. Confirm the dossier tab renders multi-line entries cleanly (micro-action on line 1, dialogue on line 2).
6. Confirm the typewriter effect still runs on composed text (including the embedded `\n`).

## Risks & edge cases

- **Long clue text** may overflow the speech bubble on mobile. Fix by bumping the speech-bubble max-height or shrinking the font slightly when `clue.text.length > 140`.
- **Typewriter pacing** on a 2-line clue with micro-action: at 20ms/char a 180-char line is ~3.6s. Acceptable but worth a spot-check — the player can still click to skip per existing behavior.
- **Redaction-after-composition** can fail more often because the composer adds surrounding narrative that might introduce new demonym mentions. Mitigation: redaction is pure regex, runs last, and the `_containsCountryName` safety check is already in place — the clue is skipped if the country name leaks. Zero regression risk, worst case a clue gets dropped and the next generator is tried (existing fallback behavior).
- **Dossier readability**: dossier currently groups by stop. Longer entries are fine; they'll just scroll. No change needed.
