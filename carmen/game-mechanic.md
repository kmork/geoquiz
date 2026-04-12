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

### Phase 1: Finish the Narrator System Properly
The arrival monologues are now a visible part of the game identity, so the remaining work here is editorial and pacing polish rather than new mechanics.

Planned improvements:

- Keep tightening the country-entry monologues so they sound authored, overcommitted, and consistently noir-self-aware.
- Continue handling modern or anachronistic history facts with explicit narrator self-awareness instead of pretending the period mismatch does not exist.
- Tune where and how narrator beats appear outside country arrivals, especially for repeated dead ends, close calls, and finale-adjacent moments.
- Keep the narrator useful as atmosphere, not as a hint-delivery system.

Design goal:
The detective voice should feel like a coherent character layer across the campaign, not just a caption feature.

### Phase 2: Deepen Interpol as a Flavor Archive
Interpol is now working best as a detective-fiction reward surface rather than a comparison engine. That direction should be pushed further.

Planned improvements:

- Expand the `IN CUSTODY` file concept with more second-page and supplemental material in the same style as the new background stories.
- Add richer file-only material such as ACME remarks, failed operation summaries, post-arrest habits, or known-associate anecdotes.
- Keep these additions flavor-first and retrospective; they should add character, not help solve the current suspect lineup.
- Make the archive feel cumulative across the campaign, so prior arrests gradually become a gallery of Carmen's absurd orbit.

Design goal:
Interpol should reward curiosity and success without doing the detective work for the player.

### Phase 3: Strengthen Campaign Foreshadowing
The next major gain should come from making the campaign feel like one growing investigation rather than a chain of disconnected chases.

Planned improvements:

- Add more Carmen-network hints across briefings, taunts, Interpol anomalies, witness-side flavor notes, and dossier-adjacent story beats.
- Make phase progression more legible through tone:
  early cases feel like isolated professionals;
  mid-campaign cases imply a structure;
  late cases make Carmen's presence unmistakable.
- Use prior arrests, theft history, and repeated patterns to suggest that the player is slowly surrounding an organization rather than catching random thieves.
- Keep every hint interpretive rather than mechanical.

Design goal:
The player should feel the net closing around Carmen long before the finale begins.

### Phase 4: Build the Finale Setup
The finale should become a distinct payoff, not just a harder standard case. The most important work now is setting up the logic that will make the ending feel earned.

Planned improvements:

- Seed the Interpol inconsistencies, alias traces, and suspicious file irregularities that will matter in the final reveal.
- Prepare the campaign so the player already understands Carmen is the mastermind before the last accusation.
- Make the final geography step depend on a real global concept, with the International Date Line still the strongest current direction.
- Ensure earlier cases quietly prepare the player for time-order and cross-border logic so the final puzzle feels solvable, not arbitrary.

Design goal:
The finale should pay off both geography knowledge and accumulated detective interpretation.

### Phase 5: Upgrade the Finale Lineup Into a Disguise Puzzle
The lineup should remain the emotional climax, but it should become more specific to Carmen instead of functioning like a normal end-of-case accusation.

Planned improvements:

- Build a fixed finale lineup around Carmen, Carmen's active alias or disguise, and two strong decoys.
- Make the real question "which identity is Carmen using right now?" rather than "is Carmen present?"
- Use Interpol irregularities, accumulated campaign knowledge, and final-case evidence to justify the correct choice.
- Differentiate failure states so misunderstanding the disguise is treated differently from misunderstanding the evidence entirely.

Design goal:
The player should land the final win by solving Carmen's disguise, not merely by clicking the obvious villain.

### Phase 6: Add Sparse, Targeted Audio Punctuation
Sound should come after the structural campaign work, because it is there to sharpen moments that already function well.

Planned improvements:

- Add restrained one-shot punctuation for breakthroughs, dead ends, file reveals, and lineup locking.
- Reserve stronger accents for the finale reveal and campaign-complete beats.
- Keep the mix sparse so clue reading, map interpretation, and narration remain dominant.

Design goal:
Increase rhythm and payoff without turning the game noisy or overdirected.

### Phase 7: Final Balancing and Fairness Pass
Once the campaign arc and finale logic are in place, the remaining job is tuning difficulty, pacing, and readability.

Planned improvements:

- Tune how quickly Interpol becomes rewarding without becoming too informative too early.
- Make sure Carmen foreshadowing is satisfying in hindsight but not blunt in the first half of the campaign.
- Verify that the finale's geography and disguise logic can be solved from in-game evidence alone.
- Review text density, narration frequency, and archive-reading volume so flavor enriches the game instead of stalling it.
- Confirm that every new addition still supports geography retention and the manual-deduction philosophy.

Design goal:
Ship a campaign that feels richer and smarter without becoming overexplained, overassisted, or dramatically heavier than the core geography game can support.
