# Carmen Game Mechanic Analysis

## Overview

The Carmen mode is now two related games built on the same route-chase engine:

- **The Crimson Trail**: a 10-case campaign with escalating difficulty, recurring narrative foreshadowing, cumulative Interpol state, and a finale where Carmen appears through an alias.
- **Open Cases**: repeatable standalone cases that use the late-campaign pursuit rules without the campaign-only Carmen arc.

At the mechanical center, each case is still a constrained geography deduction game. The player starts in a country, investigates local sources, reads clues about the thief's next destination, and chooses from neighboring countries on the map. The design works because the player is not guessing from the whole world; every clue is interpreted against a visible border-neighbor choice set.

The game has also grown into a parallel detective system. The player is solving two problems at once:

1. Where did the thief go next?
2. Which suspect should be arrested at the end?

Those two problems share the same scarce resource: time. Geography clues, suspect clues, Interpol browsing, travel, detours, and final certainty all compete against the case clock.

## Current Case Loop

Each case begins by generating a non-repeating land route. The start country must have a heritage artifact and enough neighbors to make the opening playable. Later route choices prefer countries with stronger fact coverage and more onward neighbors, which quietly improves clue quality and reduces dead routes.

The player's stop loop is:

- review the stolen artifact and current country;
- read the automatic suspect witness report for this stop;
- optionally spend time to refine that suspect report from vague to specific;
- investigate up to the stop's investigation limit across fixed locations;
- choose a neighboring country on the map;
- resolve a correct route advance, a dead end, or final suspect lineup.

Wrong country choices are not instant failure. They create a detour: the player flies to the wrong country, loses score, spends travel time, gets a dead-end presentation, and must recover by returning to the real current stop or continuing from a worse information state. This is important because it keeps the map spatial and physical instead of turning wrong answers into abstract button errors.

Correct travel has a strong presentation beat: map animation, airplane audio, optional atmosphere, score feedback, a thief taunt, and a noir country-entry monologue. That makes route progress feel like a chase rather than a quiz page refresh.

## Geography Clue System

Clues are generated from several data pools:

- country facts;
- geography;
- heritage sites;
- rivers and mountains;
- empires;
- famous-for tags;
- exports.

Investigation locations are not cosmetic. Each one biases the clue categories:

- **Airport**: geography, rivers, mountains.
- **Hotel**: famous-for and general facts.
- **Market**: exports, facts, rivers, mountains.
- **Library**: empires, heritage, famous-for, facts.
- **Embassy**: heritage and geography.

This gives the player a light strategy layer before reading the clue. The player can choose sources based on what kind of clue they need. If geography already narrowed the answer, the library or market may be better. If the neighbor set is visually confusing, airport or embassy clues may be more direct.

The clue generator tracks used clue IDs across the case, so the same clue does not repeat. It also has useful fallback behavior: try thematic generators, then unused facts, then generic geography. The game is therefore resilient to uneven data coverage, which matters because country datasets are naturally inconsistent.

Clue redaction is important. The engine actively prevents generated or narrated clues from naming the target country. If the noir rewrite accidentally reintroduces the answer, the game falls back to the safer raw clue.

## Suspect Deduction

The suspect layer is now a real second puzzle, not just end-of-case flavor.

At each stop, the game can surface one vague identity clue about the hidden suspect. These clues use grouped traits, such as a broad hair/accessory/hobby/vehicle category. The player can spend extra time to refine the latest vague clue into a specific trait.

This creates a good tension:

- vague clues preserve uncertainty and keep multiple suspects plausible;
- specific clues make the final lineup safer;
- refinement costs time that could have been spent on route clues or Interpol files.

The final lineup is adversarially useful. Decoys are scored to overlap with the revealed vague and specific traits, so the lineup is not filled with obviously wrong suspects. The player is rewarded for paying attention to the witness reports and not just for reaching the final country.

In the campaign finale, the suspect system changes shape. Carmen is the true target, but the player is asked to identify her active alias. The lineup becomes an alias accusation rather than a normal suspect accusation. This is the strongest current narrative-mechanical integration in the game because the final click asks the player to resolve a disguise, not merely pick the famous villain.

## Interpol Archive

Interpol has become a cumulative detective surface with real mechanical pressure.

Visible Interpol files come from several sources:

- suspects relevant to the current route's regions;
- suspects already viewed;
- suspects already arrested and unlocked;
- Carmen during campaign play;
- the finale alias during the finale.

Viewing a new photo profile costs 3 in-game hours unless the suspect has already been viewed or is already in custody. That turns archive browsing into an explicit risk. The player can spend time to improve suspect certainty, but doing so can cost the time needed to finish the route.

The archive also supports manual reasoning:

- suspects can be marked as persons of interest;
- marked suspects stay surfaced in the Interpol list;
- viewed and in-custody status are persisted;
- theft history accumulates after successful arrests;
- profiles receive contextual intel based on phase, theft history, and Carmen-network foreshadowing.

This system is strongest when treated as a manual case notebook, not an automatic solver. It gives the player memory aids and flavor evidence while preserving the need to compare evidence by hand.

## Campaign Structure

The Crimson Trail uses four campaign phases:

- **Cases 1-3, prelude**: 4 stops, 3 clues per stop, 4 investigations, 72 hours.
- **Cases 4-6, whispers**: 5 stops, 2 clues per stop, 3 investigations, 72 hours.
- **Cases 7-9, pursuit**: 5 stops, 2 clues per stop, 3 investigations, 64 hours.
- **Case 10, finale**: 5 stops, 1 clue per stop, 3 investigations, 56 hours.

The difficulty curve mostly reduces information instead of increasing punishment. That is the right direction for this game. Later cases feel harder because the player has fewer clues, fewer investigations, and less time, not because the interface becomes more hostile.

Campaign persistence matters mechanically:

- successful campaign cases advance the saved case number;
- arrested suspects become excluded from later campaign suspect selection;
- mission history affects some deterministic campaign flavor;
- campaign completion unlocks the natural transition into Open Cases;
- the campaign and Open Cases can now be launched explicitly from the Play page.

The campaign's main strength is that it makes individual cases feel like part of a larger investigation. Briefing marginalia, arrival hints, Interpol anomalies, and the eventual alias finale all point toward Carmen without changing the core route logic.

## Open Cases

Open Cases are now a distinct entry point rather than just post-campaign residue. They use `open_cases` mode and present cases as an indefinite sequence.

Mechanically, Open Cases use the pursuit-style configuration:

- 5 stops;
- 2 clues per stop;
- 3 investigations;
- 64 hours.

They do not exclude previously arrested suspects, and Carmen is removed from the normal Open Cases suspect list. That makes Open Cases cleaner as repeatable standalone detective puzzles. They keep the pressure and richer rules of late campaign play without requiring the player to be inside the campaign narrative.

This split is good product structure. Campaign play is about escalation and payoff; Open Cases are about replayable geography-deduction cases.

## Time Economy

Time is the main loss condition and the most important strategic resource.

Current costs:

- investigation: 3 hours;
- travel: 5 hours;
- suspect clue refinement: 2 hours;
- new Interpol photo profile: 3 hours.

Time is spent on route confidence, suspect confidence, and map movement. That creates meaningful tradeoffs. The player can over-investigate and run out of time, under-investigate and choose wrong routes, or ignore suspect work and fail the final lineup.

A subtle issue remains: time affects survival but not score. The score function receives elapsed stop time but does not use it. This is not necessarily wrong, because it keeps score readable, but it means the clock and score measure different skills. The clock measures efficiency under pressure; score mostly measures clean routing and final correctness.

## Scoring Model

The score model is intentionally simple:

- correct stop: 100 points;
- first-try stop bonus: 50 points;
- perfect route bonus: 200 points;
- wrong destination: -25 points;
- extra clue request: -20 points;
- wrong final suspect: -200 points.

Manual investigation, suspect refinement, Interpol browsing, and time spent do not directly reduce score. They reduce the clock instead. This separation is clear: score rewards accuracy; time governs survival.

The current model is easy to understand, but it also under-rewards fast, confident play. A player who solves with many spare hours gets the same route score as a player who barely survives, provided both avoided wrong guesses.

## Presentation And Feedback

The presentation layer now does more mechanical work than before.

Important feedback systems include:

- the case briefing overlay with phase-specific mission copy;
- campaign-only briefing hints that foreshadow Carmen;
- typewriter text and stamp effects for case framing;
- route animation and airplane sound for travel;
- ambient sounds for locations and arrivals;
- narrator captions based on country-entry monologues;
- dead-end overlays and dossier detour entries;
- solved/failed closing overlays;
- special campaign-complete transition into Open Cases.

These are not just decoration. They help the player understand state transitions: investigation, travel, arrival, dead end, final accusation, and campaign progression. The noir layer works best when it reinforces the geography chase rather than replacing it.

The audio model is also intentionally gated by the front-screen tap, which avoids browser autoplay issues and makes the opening feel deliberate.

## What Works Well

- The neighboring-country constraint makes every geography clue actionable.
- Location-specific clue categories give investigation choices real texture.
- Time pressure ties together route deduction, suspect deduction, and archive browsing.
- The campaign difficulty ramp is simple and effective.
- The suspect lineup uses overlapping decoys, which prevents trivial final accusations.
- Interpol has become a useful manual reasoning surface without solving the case for the player.
- The finale alias mechanic gives the campaign a distinct payoff.
- Open Cases cleanly separate replayable cases from campaign progression.
- Presentation beats make case state changes legible and atmospheric.

## Friction Points

- The route and suspect puzzles can compete for attention, especially for first-time players who do not yet know how important suspect clues are.
- Interpol profile browsing costs time, but the value of browsing is not always predictable before spending that time.
- Investigation location strategy is present but still partly opaque; players may not fully understand why airport, library, market, hotel, and embassy differ.
- Score does not account for hours remaining, so fast successful play has limited extra payoff.
- Wrong-route recovery is mechanically interesting, but the available options after a dead end can be mentally confusing because the player position and logical route position diverge.
- Campaign foreshadowing is strong in tone, but much of it is interpretive rather than mechanically inspectable.
- Open Cases inherit pursuit difficulty, which is good for engaged players but may be sharp for someone using Open Cases as their first Carmen experience.

## Design Opportunities

- Add a subtle UI cue showing each investigation location's clue tendency without turning it into tutorial text.
- Consider a small end-of-case hours-remaining bonus if speed should matter in score.
- Make Interpol browsing value more legible, for example by distinguishing active-case candidates from broader archive files.
- Strengthen dead-end recovery messaging so the player understands when they are physically in the wrong country versus logically still solving the current stop.
- Give Open Cases a short first-run framing that explains they are standalone pursuit cases.
- Continue making campaign hints more inspectable through dossier/Interpol artifacts, not only transient flavor text.
- Expand the finale alias puzzle with more evidence that directly rewards comparing file irregularities.

## Conclusion

The current Carmen game has matured from a themed route quiz into a hybrid geography chase and detective notebook game. Its best mechanic is still constrained movement: every clue matters because every answer must be a neighboring country. The newer systems work when they serve that core: suspect clues add a second deduction track, Interpol adds memory and risk, campaign phases add pressure, and the finale alias gives long-term play a concrete payoff.

The next improvements should focus less on adding more systems and more on clarifying the systems already present. Players should better understand why investigation locations differ, when Interpol is worth the time, how dead-end recovery works, and how campaign evidence points toward the finale. The game has enough mechanical depth now; the highest-value work is making that depth easier to read while preserving the manual detective feel.
