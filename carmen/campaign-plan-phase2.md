# Carmen Campaign — Phase 2 Plan

## Context

Phase 1 added the structural backbone: `caseNumber` (1–10), `campaignPhase` (prelude / whispers / pursuit / finale), progression gating, Carmen forced as the thief only in case 10, and a `CASE X / 10` briefing header.

Phase 2 turns that scaffold into a felt arc **and** removes the rookie/detective/ace difficulty split. There is now a single campaign, which starts at roughly the old "rookie" feel and ramps up as the case number climbs.

## 2.0 — Remove the difficulty picker

- **`js/games/carmen-logic.js`**
  - Delete the `DIFFICULTY` table. Replace with a single `BASE_CONFIG = { stops: 4, cluesPerStop: 3, extraClues: Infinity, investigations: 4, totalHours: 72 }` (the former "rookie" values).
  - Constructor no longer reads `config.difficulty`. Drop `this.diffKey` / `this.diff` — build `this.config` by cloning `BASE_CONFIG` then applying the phase modifier (see 2A). Everywhere `this.diff.X` is currently read, change to `this.config.X`.
- **`js/carmen-main.js`**
  - Drop `params.get('difficulty')`. `gameId` becomes the constant `'carmen'`.
  - Stop passing `difficulty` to `CarmenGameLogic`.
- **`play.html`** lines 163–165
  - Replace the three `carmen-rookie/detective/ace` entries with a single entry: `{ key: 'carmen', url: 'carmen.html', label: 'Where in the World – Carmen Sandiego', emoji: '🔍', desc: '10-case campaign · hunt Carmen Sandiego', worldOnly: true }`.
- **`js/game-records.js`** — `GAME_NAMES.carmen` already exists; no change.
- Any existing localStorage best scores under `carmen-rookie` / `carmen-detective` / `carmen-ace` are abandoned (acceptable; the campaign is a new mode).

## 2A — Per-case difficulty modifier

- **`js/games/carmen-logic.js`** — add a `CAMPAIGN_MODIFIERS` table keyed by phase, applied after cloning `BASE_CONFIG`:

  | Phase | Δ hours | Δ stops | Δ investigations | Δ extraClues | Δ cluesPerStop |
  |-------|---------|---------|------------------|--------------|----------------|
  | prelude  (1–3)| 0  | 0  | 0  | 0  | 0 |
  | whispers (4–6)| −8 | +1 | −1 | −1 | 0 |
  | pursuit  (7–9)|−16 | +2 | −1 | −2 | −1 |
  | finale   (10) |−24 | +3 | −2 | −2 | −2 |

  Clamp: `stops ≥ 4`, `investigations ≥ 1`, `cluesPerStop ≥ 1`, `extraClues ≥ 0`, `totalHours ≥ 40`. `extraClues: Infinity` becomes a plain number (base 99, minus delta → still plenty in prelude).

- Because `reset()` already reads `this.diff.totalHours`, switching to `this.config.totalHours` is enough; no other time wiring changes.

## 2B — Phase-aware taunts

- **`js/games/carmen-logic.js`** — extend `THIEF_TAUNTS` with three new buckets (`whispers`, `pursuit`, `finale`) plus matching `wrong*` variants.
  - **whispers** (no name): *"She said you'd be slow." / "I answer to someone you haven't met yet." / "My employer sends her regards, detective." / "You think I'm the one you should be chasing?"*
  - **pursuit** (explicit): *"Carmen warned me you were persistent." / "You're closer to her than you realize." / "Carmen Sandiego doesn't lose, detective. Neither do I." / "This was never about the artifact. It's about her."*
  - **finale** (Carmen, first person): *"So. The famous detective. I expected taller." / "You've chased my lieutenants for nine cases. Now chase me." / "I left you a trail because I wanted to see you try." / "Catch me here, or I vanish for good."*
  - Wrong-guess variants for each phase (2–3 lines each).
- Rewrite `getTaunt(wrongGuess)` to blend by phase:
  - `prelude`: unchanged.
  - `whispers`: 50% whispers bucket, else existing early/mid/late by progress.
  - `pursuit`: 70% pursuit bucket, else existing.
  - `finale`: always from finale bucket.

## 2C — Phase-aware briefing copy & campaign-complete overlay

- **`js/ui-components/carmen-ui.js`**, `showCaseBriefing()` — accept `campaignPhase`, pick mission copy from a lookup:
  - `prelude`: current copy.
  - `whispers`: *"Track the thief through neighboring countries. Witnesses keep mentioning a shadow behind the shadow — someone bigger is pulling strings."*
  - `pursuit`: *"ACME has traced this theft to Carmen Sandiego's network. The thief is one of her lieutenants — every arrest brings you closer to her."*
  - `finale`: *"This is it. Carmen Sandiego herself has surfaced. No more proxies. Track her across the globe and bring her in — or she vanishes forever."*

- **`js/ui-components/carmen-ui.js`** — add a new `showCampaignComplete(score)` that renders a full-screen overlay (reusing `.carmen-closing-overlay` structure) stamped *"CAMPAIGN COMPLETE — CARMEN SANDIEGO: IN CUSTODY"* with a single *Restart campaign* button. Resolves when clicked.

- **`js/carmen-main.js`** — after `showCaseSolved(...)` in the finale branch, if `logic.caseNumber === TOTAL_CASES`, call `await ui.showCampaignComplete(results.score)`. On click, `localStorage.removeItem('carmen-campaign-case'); localStorage.removeItem('carmen-campaign-complete');` so the next play starts at case 1.

- **`js/carmen-main.js`**, `handleEndChoice()` — branch narrator selection on `logic.campaignPhase` first:
  - `finale && won` → stub finale-success file path + subtitle cues (audio can be recorded later; subtitles ship immediately with a silent timing fallback so it still reads).
  - `finale && !won` → stub finale-fail equivalent.
  - otherwise → existing mission1/mission3 flow.

## 2D — Interpol dossier evolution & mission label

- **`js/ui-components/carmen-ui.js`**, `showInterpolProfile()` — accept an optional `campaignPhase`. For **Carmen Sandiego only**, redact fields by phase:
  - `prelude`: hair/accessory/hobby/vehicle all show `[REDACTED]`; description overridden to *"Subject exists only in rumor. ACME has no confirmed file."*
  - `whispers`: hair + accessory visible; hobby + vehicle redacted.
  - `pursuit`: hair + accessory + hobby visible; vehicle redacted.
  - `finale` / campaign complete: fully visible.
  Other suspects render unchanged.
- **`js/carmen-main.js`**, `refreshInterpolList()` — pass `logic?.campaignPhase` into `showInterpolProfile`.
- **`js/ui-components/carmen-ui.js`**, `updateMissions()` — accept optional `caseNumber`/`totalCases`; prepend the tally with a `Case X / 10` label element (styled via existing CSS variables only).
- **`js/carmen-main.js`** — pass `logic.caseNumber, logic.totalCases` into the `updateMissions` call.

## Files touched

- `js/games/carmen-logic.js` (2.0, 2A, 2B)
- `js/carmen-main.js` (2.0, 2C, 2D)
- `js/ui-components/carmen-ui.js` (2C, 2D)
- `play.html` (2.0)
- `css/carmen.css` — small additions for `Case X / 10` label and campaign-complete stamp styling, **only** using existing CSS variables

No new files. No new data files. Audio stubs are deferred content work.

## Verification

1. `localStorage.clear()`; open `play.html` → only one Carmen tile. Click → briefing reads `CASE 1 / 10` with prelude copy, base totals (4 stops / 72h).
2. Force case 5 → whispers copy, −8h, +1 stop. Win → briefing shows `CASE 6 / 10`.
3. Force case 8 → pursuit copy, explicit Carmen mention in at least one taunt on correct guess.
4. Force case 10 → `FINAL CASE` header, finale briefing copy, Carmen Sandiego is in the suspect lineup, finale taunts in first person.
5. Win case 10 → campaign-complete overlay appears; click *Restart campaign* → `carmen-campaign-case` is gone; next start is case 1 again.
6. Interpol → Carmen card: prelude fully redacted, whispers partial, pursuit more revealed, finale fully visible.
7. Lose any case → case number unchanged on replay.
8. Dark and light themes both look correct for the new label + overlay.
