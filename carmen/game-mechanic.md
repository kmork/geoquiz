# Carmen Game Mechanic Analysis

## Overview
The Carmen mode is a route-chase detective game layered on top of the repository's border-neighbor map system. Mechanically, it combines three loops:

1. Investigate the current country for destination clues.
2. Spend time to travel to a neighboring country.
3. Build enough suspect evidence to win the final lineup.

The design is structurally strong because the player is always balancing two scarce resources: time and certainty. The campaign framing adds long-term pressure without requiring complex progression systems. The current implementation also leans harder into a detective-notebook presentation than before: dossier entries are grouped by stop, Interpol supports manual marking of persons of interest, and successful country transitions now carry a short inner-monologue caption drawn from each country's historical profile.

## Core Loop
Each case begins in a country that has both a heritage site and enough border connections to support route generation. The game then generates a non-repeating route of connected countries. The player is never choosing from the whole world; every move is constrained to neighboring countries, which keeps the search space readable and makes every clue actionable.

At each stop, the player can investigate five fixed locations: airport, hotel, market, library, and embassy. Each location is associated with clue categories, so the choice is not cosmetic. Airport and embassy favor geography; library leans toward heritage and history; market leans toward exports and terrain-adjacent clues. This gives the investigation phase a light deduction flavor even before the player interprets the clue itself.

After gathering clues, the player travels by selecting a neighboring country on the map. Correct guesses advance the chase. Wrong guesses create a dead-end trip, cost time, subtract score, and force the player to return or continue from a worse information state.

What has improved recently is the clarity of the transition between stops. A correct travel choice now resolves as a short three-part beat:

- the route animation lands in the next country;
- the player gets the usual score and thief-spotted confirmation;
- a noir detective inner-monologue line appears at the bottom, themed to that country's `history` field.

This gives the country arrival more identity without changing the mechanical logic of the chase.

## Time Economy
Time is the primary failure pressure:

- Travel costs `5` hours.
- Each investigation costs `3` hours.
- Refining a suspect clue costs `2` hours.
- Viewing a new Interpol profile with a photo costs `3` hours.

Campaign pacing is controlled by phase-based modifiers:

- Cases 1-3 (`prelude`): 4 stops, 3 clues per stop, 4 investigations, 72 hours.
- Cases 4-6 (`whispers`): 5 stops, 2 clues per stop, 3 investigations, 72 hours.
- Cases 7-9 (`pursuit`): 5 stops, 2 clues per stop, 3 investigations, 64 hours.
- Case 10 (`finale`): 5 stops, 1 clue per stop, 3 investigations, 56 hours.

This is a good pressure curve. Early cases allow experimentation, while later cases reduce clue density and compress the time budget. The strongest mechanical idea here is that difficulty rises mostly by restricting information, not by adding arbitrary punishment.

## Clue System
Clues are drawn from multiple content pools: country facts, geography, heritage, rivers or mountains, empires, famous-for tags, and exports. The generator tracks used clue IDs globally inside a case, which prevents repeated clue spam and helps the route feel like a coherent investigation instead of a slot machine.

A notable strength is that clue generation falls back gracefully:

- Try thematic generators first.
- Retry unused country facts if needed.
- Fall back to geography clues as a last resort.

That means the game is resilient to uneven data coverage. Route generation also favors countries with more facts and more neighbors, which quietly improves clue quality and future route viability.

## Suspect Identification Layer
The suspect system creates a second puzzle running in parallel with the route chase. Each stop can reveal one vague clue about hair, accessory, hobby, or vehicle. The player can then spend extra time to upgrade that clue from a grouped description to a specific fact.

This is mechanically effective for two reasons:

- Vague clues support deduction without collapsing the lineup too early.
- Specific clues increase confidence but cost time, so the player must decide when certainty is worth the expense.

The final lineup intentionally chooses decoys that overlap with both vague and confirmed attributes. That is a good anti-bruteforce mechanic. It ensures the suspect phase is not just flavor text attached to the route game.

This layer has become more legible through UI changes already in place:

- Interpol files can now be manually marked as persons of interest.
- The Interpol list surfaces those marked suspects in a separate strip for quick recall.
- The dossier is visually grouped by stop, which makes clue chronology easier to reconstruct during a case.

These are not full deduction mechanics yet, but they are strong manual-support tools and move the game closer to a real detective workflow.

## Scoring Model
The score model is simple:

- Base correct stop: `100`
- First-try bonus: `+50`
- Perfect case bonus: `+200`
- Wrong destination guess: `-25`
- Extra clue request: `-20`
- Wrong final suspect: `-200`

One important implementation detail: stop score currently ignores time taken. The score function receives time but does not use it. That means the hour clock governs win/loss tension, while score mainly rewards clean routing and punishes mistakes. This is clear and readable, but it also means fast play is not meaningfully differentiated from merely successful play.

## What Works Well
- The route constraint makes geography knowledge and clue reading feel tightly connected.
- Investigation locations create controlled clue specialization without overwhelming the player.
- Time pressure is legible because every major action has a fixed cost.
- The campaign ramp is easy to understand and easy to tune.
- The suspect layer gives the finale of each case a second form of tension beyond just reaching the last country.
- The grouped dossier and marked-suspect Interpol flow now support manual reasoning better than the earlier flat presentation.
- Country-entry monologues give each arrival more personality and help the geography feel less abstract.

## Friction Points
- Investigations are limited by time but not by per-location exhaustion rules beyond clue reuse, so some player choices may feel trial-and-error rather than strategic.
- Interpol browsing costs time, but its payoff depends on how well the player remembers prior suspects. That is interesting for campaign play, but potentially opaque for first-time players.
- The extra clue system exists in logic but is less central than the location investigation loop, so its role in the decision space may feel underdeveloped.
- Because wrong guesses always cost the same `-25` and `5` hours, the tension comes more from route uncertainty than from contextual risk.
- The new country-entry monologues are flavorful, but at the moment they are still close to paraphrased history text. They need more authored personality and stronger rhythm.
- The narrator caption currently fades automatically, which is stylish, but it can still feel too brief or too detached from the continue flow if the player is reading slowly.
- The top-level status row has been visually tightened, but it still does mostly functional work; it does not yet contribute much to the detective fiction.

## Design Opportunities
- Tie scoring partly to hours remaining if you want speed to matter beyond survival.
- Differentiate location value further by making some clue categories rarer but stronger.
- Make Interpol more explicitly strategic by signaling when dossier evidence has narrowed the viable suspect pool.
- Consider giving the finale a slightly different mechanical rule, since Carmen being fixed as the final thief is already a narrative escalation.
- Push the narrator system from "country fact with voice" toward "short authored beat with attitude," while still keeping it grounded in real country history.
- Use the improved dossier and Interpol layout as a base for stronger manual comparison rather than jumping immediately to automatic suspect narrowing.

## Conclusion
The current Carmen game has a solid mechanical backbone: constrained map pursuit, readable time costs, data-backed clue generation, and a suspect-identification subgame that meaningfully affects the ending. Its best quality is that nearly all pressure comes from information management. The next level of improvement is not more content volume, but sharper differentiation between clue sources, stronger payoffs for good deduction, and clearer signaling around when to spend time on suspect certainty versus route certainty.

## Current Implemented State

### Manual Deduction Support
The game now has the beginning of a usable casework surface:

- dossier entries are grouped by stop instead of appearing as one long flat log;
- dead ends are logged as their own dossier sections;
- Interpol profiles can be marked manually as persons of interest;
- marked suspects are surfaced separately in the Interpol list.

This is enough to support "compare by hand" play, which fits the design better than instant automation.

### Country Arrival Presentation
Country-to-country travel now has more narrative identity:

- successful arrivals trigger a bottom-screen caption;
- the caption is written as the detective's inner monologue;
- its content is sourced from the destination country's `history` in `countries.json`;
- there is now a specific monologue entry for every country in the dataset, including a fallback tone for entries with thin or missing history.

This is a meaningful atmospheric improvement, but the content still needs editorial sharpening.

### UI Tone Direction
The current visual direction is clearly detective-noir with some self-aware pulp framing:

- the status row has been tightened and simplified;
- the heritage archive backside uses a more authored paper/record look;
- dossier and Interpol panels now feel more like case materials than generic game widgets.

The next UI gains should come from stronger narrative usefulness, not more decoration.

## Improvement Roadmap

### Guiding Principle
The game should remain a geography-learning game first, with noir flavor and self-ironic detective framing used to make the learning loop more memorable. Every new mechanic should either clarify a geography concept, reward close reading of clues, or increase the emotional payoff of solving the geography puzzle.

### Phase 1: Improve the Narrator Monologues
The new caption system is the most obvious recent addition, so it should be polished before more systems are added on top.

Planned improvements:

- Hand-edit the country-entry monologues so they feel more authored and less like dressed-up summary text.
- Keep the tone dry, noir, and slightly self-parodic without turning jokey.
- Tune caption timing and possibly let especially long lines stay visible until the transition button is pressed.
- Add a few structural variations so not every line starts with the same cadence.

Design goal:
The player should feel that entering a country has mood and narrative identity, not just another stop marker.

### Phase 2: Make Interpol Strategically Legible
Interpol should stop feeling like optional flavor and start acting as a detective's reference cabinet. The key change is not automatic narrowing, but making the files and clues easier to compare by hand.

Planned improvements:

- Expose a consistent clue vocabulary across witness reports, dossier entries, and Interpol files.
- Use player-facing category labels such as `dark hair`, `headwear`, `jewelry`, `land vehicle`, `air vehicle`, `artistic`, `outdoors`, and `collector`.
- Let the player pin suspects and pin clue entries for manual comparison.
- Add short detective commentary that suggests how to reason, not who to suspect.

Design goal:
The player should understand why opening Interpol matters, but should still have to do the deduction work themselves.

### Phase 3: Fuse Dossier and Interpol Into One Deduction System
The dossier should feel like a detective notebook, not a solved spreadsheet. It should support comparison and memory without grading the player's logic in real time.

Planned improvements:

- Let dossier clues and Interpol profiles share the same structured clue language without auto-resolving matches.
- Add a small working-board concept where pinned clues and pinned suspects can be kept side by side during a case.
- Add neutral profile fields such as `known regions`, `known associates`, `behavior notes`, and `record irregularities`.
- Add alias evidence, recurring criminal patterns, and links between suspects.
- Use prior arrests and theft history to imply that Carmen is connected to the whole network.
- Seed references in later cases that suggest one unseen mastermind is coordinating the crimes.

Design goal:
The player should start feeling that they are not only chasing thieves, but slowly uncovering the structure of Carmen's organization.

### Phase 4: Manual-First Dossier Workflow
The dossier already looks more like a case file than before. The next step is to make it more useful without turning it into an auto-solver.

Planned improvements:

- Split dossier entries more clearly into `Witness report`, `Confirmed report`, `Geography clue`, `Behavior clue`, and `Dead end`.
- Let the player add lightweight manual marks such as `relevant`, `contradiction`, and `check Interpol`.
- Allow one or more pinned dossier entries to remain visible while browsing Interpol.
- Keep all marks case-local and player-driven, with no hidden suspect scoring behind them.

Design goal:
The player should feel like they are maintaining a case file by hand, using tools that support attention rather than inference automation.

### Phase 5: Strengthen Campaign Foreshadowing and Noir Feel
The atmosphere should become richer without drowning the player in text. The right tone is moody, lightly self-aware, and supportive of the geography puzzle.

Planned improvements:

- Add more variation to case introductions, tuned by campaign phase.
- Add short mid-case comments after strong deductions, dead ends, and close calls.
- Introduce recurring references to Carmen before the finale so her reveal feels earned.
- Lean into noir self-irony: the detective knows the genre is melodramatic, but still lives inside it.

Design goal:
The player should feel an escalating campaign arc, not ten isolated cases.

### Phase 6: Add Sparse, Targeted Audio Punctuation
Sound should reinforce important moments, not constantly compete with clue reading and narration.

Planned improvements:

- Add subtle one-shot sounds for clue breakthroughs, dossier confirmations, suspect elimination, and dead ends.
- Add rare travel stingers or ambient accents for especially important transitions.
- Reserve stronger audio punctuation for lineup tension and finale reveals.
- Keep all additions sporadic so the geography and text clues remain central.

Design goal:
Increase atmosphere and emotional rhythm without making the experience noisy.

### Phase 7: Give the Finale a Distinct Mechanical Identity
The finale should not just be a harder normal case, because Carmen being the fixed super-villain is already a special narrative event. The recommended direction is a two-phase finale that uses both the dossier and Interpol.

Planned finale structure:

1. The player first solves the final geography and time-order mystery to reach Carmen's true destination.
2. Once there, the player faces a special finale lineup that includes Carmen, Carmen's active alias or disguise, and two close decoys.
3. The correct solution is not to click Carmen directly, but to identify which lineup identity is actually Carmen in disguise.
4. Choosing the alias then triggers the reveal that the alias was Carmen all along.

Core mechanic direction:

- Carmen should be hinted at through earlier cases, especially through linked suspect histories and organizational traces.
- Previously caught or encountered thieves should imply that they worked for, protected, or feared a larger figure.
- Interpol should contain the key to the final identity reveal, for example by exposing that one suspect identity has inconsistent history, duplicate traits, or an alias trail that points back to Carmen.
- The player should already understand that Carmen is the mastermind before the final pick; the deduction challenge is identifying which visible suspect identity she is currently inhabiting.

Design goal:
The finale should feel like the player is solving both the last geography puzzle and the last disguise puzzle, not merely identifying one more thief.

### Phase 8: Add a Geography Twist to the Final Destination
Because this is fundamentally a geography game, the final step should require understanding a genuinely interesting global phenomenon. The strongest current direction is an International Date Line puzzle.

Recommended implementation:

- Witnesses in the finale describe sightings that are all locally plausible.
- Their timestamps appear contradictory if read in local order.
- The player must infer that Carmen crossed the International Date Line, so the reports must be reordered in global time rather than local time.
- Earlier cases should lightly prepare the player for this by introducing time zones, border-crossing oddities, or "the story does not add up" style remarks.
- Solving this puzzle should determine the final travel destination before the alias lineup begins.

Why this works:

- It is geographically educational.
- It feels like detective work rather than trivia recall.
- It gives the final route choice a unique logic distinct from normal adjacency chasing.
- It lets the alias reveal become the final social deduction beat after the geography puzzle has already paid off.

Design goal:
The player should first earn the finale through a geography insight, then land the final emotional payoff through the disguise reveal.

### Phase 8.5: Preserve and Upgrade the Final Lineup
The lineup is too strong a payoff moment to remove from the finale. Instead, it should be rewritten to serve the Carmen disguise twist.

Planned improvements:

- Build a fixed finale lineup with four entries: Carmen, Carmen's alias, and two deliberately similar suspects from the existing roster overlap.
- Use dossier and Interpol clues so the player can justify why the alias is the correct pick and Carmen's visible profile is the trap.
- Distinguish failure messaging:
  choosing Carmen means the player understood the mastermind but missed the disguise;
  choosing a decoy means the player misread the evidence.
- Make the reveal cinematic and explicit: the alias portrait or file should collapse into Carmen once the correct choice is made.

Design goal:
Keep the dramatic satisfaction of the lineup while making it mechanically richer than the standard case-ending suspect pick.

### Phase 9: Final Balancing and Fairness Pass
Once the strategic and atmospheric layers are in place, the final job is tuning. This stage should focus on fairness, readability, and learning value.

Planned improvements:

- Tune how quickly Interpol becomes useful so it helps without spoiling the answer.
- Ensure the Carmen foreshadowing is noticeable in hindsight but not obvious too early.
- Make the finale hints generous enough that players can solve the Date Line logic from in-game evidence.
- Review text density so narration enriches pacing instead of slowing it down.
- Verify that every new feature still supports geography retention and clue comprehension.

Design goal:
Ship a finale and campaign structure that feels richer, smarter, and more memorable without becoming obscure or overdesigned.
