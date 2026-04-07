# Carmen Sandiego — Campaign Progression (Case 1 → Case 10)

## Context

Today, every Carmen mission is a self-contained game. The narrative has no arc: you can play forever and never "get closer" to Carmen Sandiego herself — she's just one of 43 suspects in the random pool. The user wants a **10-case campaign** where the player only advances to the next case by **correctly identifying the thief** in the previous one, culminating in a final confrontation with Carmen. Failed cases are replayed (with fresh randomness) until solved. Along the way, the tone ramps up: no Carmen mention (1–3), subtle hints (4–6), direct involvement (7–9), final showdown (10).

This plan covers **phase 1 only**: the minimum mechanics needed to track case progression and gate the campaign. Content (taunts, narrator lines, stricter constraints) is scaffolded so it can be added incrementally.

---

## Phase 1 — Progression tracking & gating (this change)

### 1. New state: `carmen-campaign-case`

New localStorage key holding the **current case number** (1–10), independent from the existing `carmen-missions` tally (which stays as a play history).

- **File:** `js/carmen-main.js`
- Add helpers next to `getMissionHistory()` (lines 24–32):
  - `getCurrentCase()` → reads key, defaults to `1`, clamps to `[1, 10]`
  - `advanceCase()` → increments (capped at 10), writes back
  - `resetCampaign()` → sets to `1` (used after case 10 completion, and exposed for a future "Restart campaign" button)
- On `won === true` in the finish flow (carmen-main.js around line 551 where the suspect arrest is handled), call `advanceCase()`. If we just completed case 10, also flag `carmen-campaign-complete` so we can show a different ending and optionally `resetCampaign()` on next play.
- On `won === false`, do **not** advance — the player replays the same case number with new random route/suspect.

### 2. Pass case number into the logic

- **File:** `js/carmen-main.js` around lines 253–264
- Add `caseNumber: getCurrentCase()` to the `CarmenGameLogic` config object.
- **File:** `js/games/carmen-logic.js` constructor (lines 485–534)
- Store `this.caseNumber = config.caseNumber || 1`.
- Store `this.campaignPhase` derived once:
  - 1–3 → `'prelude'`
  - 4–6 → `'whispers'`
  - 7–9 → `'pursuit'`
  - 10  → `'finale'`

### 3. Gate the suspect pool by case

The cleanest way to guarantee "Carmen is the thief in case 10" and "no Carmen mention in cases 1–3" is to filter `SUSPECTS` at selection time.

- **File:** `js/games/carmen-logic.js`, `start()` (lines 571–579)
- Before the existing region-based filter, apply a campaign filter:
  - `prelude` (1–3): exclude Carmen from candidates entirely.
  - `whispers` (4–6): exclude Carmen (she's only *hinted at* in clues/taunts, not the actual thief).
  - `pursuit` (7–9): exclude Carmen (she's pulling strings but a lieutenant is the thief). Optionally tag the chosen suspect as a "Carmen associate" so taunts can reference her.
  - `finale` (10): force `this.suspect = SUSPECTS.find(s => s.name === 'Carmen Sandiego')` and skip the random pick.
- Keep the existing region-match filter applied *after* the campaign filter.

### 4. Expose case info to the UI

- **File:** `js/games/carmen-logic.js`, `start()` return value (around line 595)
- Add `caseNumber`, `campaignPhase`, `totalCases: 10` to the intro object that carmen-main.js already consumes.

### 5. Briefing shows the case number

- **File:** `js/ui-components/carmen-ui.js`, `showCaseBriefing()` (lines 503–537)
- Accept `caseNumber` and `campaignPhase` as new arguments (carmen-main.js already calls this — update the call site too).
- Prepend the mission title with `CASE ${caseNumber} / 10` in the existing briefing header (no new DOM — reuse the artifact-name region or add to the existing `briefingMission` typewriter prefix). Styling via existing CSS only (no inline styles, no `<style>` blocks).
- For `campaignPhase === 'finale'`, swap the mission text for a finale-specific string (see Phase 2 content).

### 6. Mission tally shows campaign progress

- **File:** `js/ui-components/carmen-ui.js`, `updateMissions()` (around lines 591–610)
- Alongside the existing last-12 play tally, render a small "Case X of 10" label. Reuse existing CSS variables. This is the player's visible progression indicator.

### 7. Completing case 10

- **File:** `js/carmen-main.js`, finish flow
- If `caseNumber === 10 && won`: mark `carmen-campaign-complete = true`, show a campaign-completed overlay (Phase 2 content), then on next game `getCurrentCase()` can either stay at 10 (replay finale) or reset — default plan: **stay at 10**, and add a "Restart campaign" control later.

---

## Files to modify

- `js/carmen-main.js` — case helpers, pass caseNumber, advance on win, wire UI
- `js/games/carmen-logic.js` — constructor, campaign filter in `start()`, return campaign info
- `js/ui-components/carmen-ui.js` — briefing header, mission tally label
- `css/styles.css` (or existing carmen CSS file, whichever currently styles the briefing/tally) — small additions for the case label, using existing CSS variables

No new files, no new data files required for Phase 1.

---

## Verification

1. Start dev server: `python3 -m http.server 8080`, open `carmen.html`.
2. Fresh state: `localStorage.removeItem('carmen-campaign-case')` → briefing shows "CASE 1 / 10". Carmen must **not** appear in the lineup.
3. Win the case → reload → briefing shows "CASE 2 / 10".
4. Lose a case → reload → case number is unchanged, new route/suspect.
5. Manually set `localStorage.setItem('carmen-campaign-case','10')` → reload → suspect is forced to Carmen Sandiego; she appears in the final lineup.
6. Win case 10 → `carmen-campaign-complete` is set in localStorage.
7. Confirm dark/light theme both look right on the new case label.

---

## Phase 2+ content scaffolding (not implemented yet, listed so Phase 1 leaves clean hooks)

These all key off `this.campaignPhase` / `this.caseNumber`, which Phase 1 exposes — so adding them later is additive, no refactors.

### Narrative tone per phase
- **Prelude (1–3):** generic thieves, current taunt pool, no Carmen references. Briefing uses the existing "Track the thief…" copy.
- **Whispers (4–6):** thief taunts occasionally namedrop a shadowy boss ("*She* said you'd be slow." / "I answer to someone you haven't met yet."). Witness reports sometimes add a flourish ("…and mentioned another traveler in a red coat."). Add a new `THIEF_TAUNTS.whispers` bucket, merged into the existing early/mid/late selection when phase is `whispers`.
- **Pursuit (7–9):** suspect is explicitly a Carmen lieutenant. Briefing text changes to "ACME has traced this theft to Carmen Sandiego's network…". Narrator audio variants. Interpol card for the arrested lieutenant can include a "Known associate: Carmen Sandiego" line.
- **Finale (10):** briefing becomes "FINAL CASE — Carmen Sandiego herself has surfaced." Dedicated narrator intro + closing audio. Victory overlay is a full campaign ending, not just a case screen.

### Tightening difficulty by case (stacked on top of chosen rookie/detective/ace)
Introduce a per-case modifier object in `carmen-logic.js` applied *after* the difficulty preset:
- Cases 1–3: no modifier.
- Cases 4–6: `-4h` to `hoursRemaining`, `-1` extra clue.
- Cases 7–9: `+1` stop on the route, `-1` investigation per stop.
- Case 10: `-1` investigation per stop, `-8h`, Interpol Carmen lookup becomes free (she's already known), lineup decoys biased toward Carmen-adjacent attributes so it's a real identification, not a giveaway.

### Other later additions
- **Campaign screen** on `carmen.html` entry: "Case 3 of 10 — the trail is cold…" style card before the difficulty picker.
- **Interpol dossier evolution:** Carmen's Interpol entry gains redacted fields that unlock as cases progress (locked at 1–3, partial at 4–6, full at 10).
- **Persistent artifact gallery:** each won case adds the recovered artifact to a museum view; case 10 unlocks a "campaign complete" artifact.
- **Restart campaign** button on the finish screen once case 10 is won.
- **Per-case saved best score** (separate from the current `carmen-${difficulty}` game record key) so players can chase campaign leaderboards.
- **Stricter travel-time cost or mandatory minimum stops** in the finale so Carmen genuinely feels harder than an Ace run.
