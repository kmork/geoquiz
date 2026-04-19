# Carmen Game Mechanic Analysis

## Overview

The Carmen mode is now two related games built on the same route-chase engine:

- **The Crimson Trail**: a 10-case campaign with escalating difficulty, recurring narrative foreshadowing, cumulative Interpol state, and a finale where Carmen appears through an alias after a special South America route puzzle.
- **Open Cases**: repeatable standalone cases that use the late-campaign pursuit rules without the campaign-only Carmen arc.

A third campaign, **Skyline Syndicate**, has been added as a separate implementation path for capital-area flight routes. It uses free-source aviation data: OurAirports for airport gateway matching and OpenFlights for route structure, with internal fallback links where needed for playability.

At the mechanical center, each case is still a constrained geography deduction game. The player starts in a country, investigates local sources, reads clues about the thief's next destination, and chooses from a visible set of map choices. In The Crimson Trail and Open Cases those choices are neighboring countries; in Skyline Syndicate they are capital-area flight connections. The design works because the player is not guessing from the whole world; every clue is interpreted against the active visible choice set.

The fiction model is now deliberately framed as **ACME reconstructing a border trail**, not a literal transport simulation. The thief's route is a chain of suspected border crossings; the detective redeploys through ACME transport to confirm or reject each lead. Suspect vehicles describe known getaway signatures and identity habits, not necessarily the exact vehicle used for every border crossing.

The game has also grown into a parallel detective system. The player is solving two problems at once:

1. Where did the thief go next?
2. Which suspect should be arrested at the end?

Those two problems share the same scarce resource: time. Geography clues, suspect clues, Interpol browsing, redeployments, detours, and final certainty all compete against the case clock.

## Current Case Loop

Each case begins by generating a non-repeating land route. The start country must have a heritage artifact and enough neighbors to make the opening playable. Later route choices prefer countries with stronger fact coverage and more onward neighbors, which quietly improves clue quality and reduces dead routes.

The player's Crimson Trail and Open Cases stop loop is:

- review the stolen artifact and current country;
- read the automatic suspect witness report for this stop;
- optionally spend time to refine that suspect report from vague to specific;
- investigate up to the stop's investigation limit across fixed locations;
- choose a neighboring country on the map to confirm the next border lead;
- resolve a correct route advance, a dead end, or final suspect lineup.

Skyline Syndicate follows the same stop loop, but the map choices confirm capital flight leads instead of border leads.

Wrong country choices are not instant failure. They create a detour: ACME redeploys to the wrong country, the player loses score, spends time, gets a dead-end presentation, and must recover by returning to the real current lead or continuing from a worse information state. This is important because it keeps the map spatial and physical instead of turning wrong answers into abstract button errors.

Correct trail confirmation has a strong presentation beat: map animation, ACME transport audio, optional atmosphere, score feedback, a thief taunt, and a noir country-entry monologue. That makes route progress feel like an investigation rather than a quiz page refresh.

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

Viewing a new photo profile costs 3 in-game hours unless the suspect has already been viewed, is in custody, or has been previously arrested in Open Cases. That turns archive browsing into an explicit risk. The player can spend time to improve suspect certainty, but doing so can cost the time needed to finish the route.

The archive also supports manual reasoning:

- suspects can be marked as persons of interest;
- marked suspects stay surfaced in the Interpol list;
- viewed, in-custody, and previously-arrested status are persisted;
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

The campaign's main strength is that it makes individual cases feel like part of a larger investigation. Briefing marginalia, arrival hints, Interpol anomalies, and the eventual alias finale all point toward Carmen without changing the core route logic until the finale deliberately changes shape.

Case 10 is now a distinct Crimson Trail finale. It uses `carmen/src/campaigns/crimson-trail/finale-route-provider.js` only for campaign case 10; cases 1-9, Open Cases, and Skyline Syndicate keep their normal route behavior. The theft starts in a random South American country, then the required route is Colombia, Uruguay, Brazil, Argentina, and Cuba. Each stop exposes the full South America choice set rather than only land neighbors, and Cuba appears as a visible decoy after Colombia and Uruguay have been confirmed. It remains wrong until the player reaches Argentina.

Before Argentina, the finale still uses normal investigation locations and normal geography/fact clue style, but weak clues are filtered more aggressively against the broad South America choice pool. Curated fallback clues for Colombia, Uruguay, Brazil, and Argentina keep the 12-country challenge difficult rather than random. In Argentina, clues shift from normal factual hints to subtle acrostic hints: the player is expected to read the first letters of the confirmed countries, C-U-B-A, and infer the final destination. Reaching Cuba still leads into the existing Carmen alias lineup.

## Open Cases

Open Cases are now a distinct entry point rather than just post-campaign residue. They use `open_cases` mode and present cases as an indefinite sequence.

Mechanically, Open Cases use the pursuit-style configuration:

- 5 stops;
- 2 clues per stop;
- 3 investigations;
- 64 hours.

They do not exclude previously arrested suspects, and Carmen is removed from the normal Open Cases suspect list. Previously arrested suspects remain reusable for repeatable play, but Interpol labels them as `PREVIOUSLY ARRESTED` instead of `IN CUSTODY` so the archive does not imply they are unavailable. That makes Open Cases cleaner as standalone detective puzzles while preserving the pressure and richer rules of late campaign play.

This split is good product structure. Campaign play is about escalation and payoff; Open Cases are about replayable geography-deduction cases.

## Skyline Syndicate

Skyline Syndicate is the capital-flight campaign. Its code is isolated under `carmen/src/campaigns/skyline-syndicate/` so most of the existing Carmen files can remain focused on The Crimson Trail and Open Cases.

The browser campaign is designed to consume a static JSON snapshot at `data/capital-flight-routes.json`. That file should be generated by an offline importer, not by live API calls from the browser. This preserves fast static hosting, keeps aviation API keys out of client code, and makes the age/source of factual route data explicit.

The current committed route graph is generated from free datasets. OurAirports supplies scheduled-service airport metadata and capital gateway matching. OpenFlights supplies a historical route snapshot, and the importer may add fallback links where needed for playability. Those source details remain internal. Player-facing Skyline wording treats visible destination choices as usable capital flight facts inside ACME's case file, not as a confidence-ranking exercise and not as a guarantee of today's exact airline schedules.

The importer lives at `carmen/scripts/import-capital-flight-routes.js`. It supports both OpenFlights plus OurAirports local files and Aviationstack-style provider records. It writes both the browser route JSON and an airport-mapping review report.

Mechanically, Skyline Syndicate uses the same Carmen case loop, scoring, suspect deduction, Interpol archive, map renderer, and clue workflow. The difference is the route provider: instead of land-border neighbors, a `CapitalFlightRouteProvider` supplies country choices from capital-area flight connections. This keeps the new campaign separate while allowing clue generators to continue evaluating facts against the visible choice set.

The Play page exposes Skyline Syndicate as `carmen.html?mode=skyline_syndicate`. The provider caps visible route choices to eight countries per stop, while the generated graph ensures every UN country has at least three available choices. This includes island and no-land-border countries that the border-trail campaign cannot naturally support.

Skyline Syndicate has its own campaign progression state. Its current case is stored separately from `carmen-campaign-case`, mission history is stored separately from The Crimson Trail history, and successful Skyline cases 1-9 advance only the Skyline counter. Failed Skyline cases replay the same Skyline case number with fresh randomness. The Crimson Trail finale, Carmen alias accusation, and automatic transition into Open Cases do not apply to Skyline.

Skyline wording must stay flight-corridor oriented. Briefings, travel prompts, dead-end overlays, case cards, and narrated clues should refer to air trails, capital connections, corridors, or active destination choices rather than neighboring countries, border trails, border crossings, or land-border counts.

Skyline now has case-specific campaign copy in `carmen/src/campaigns/skyline-syndicate/flight-campaign-config.js`. The 10-case arc centers on **The Dispatcher**, a logistics controller who moves artifacts through corrupted manifests, cargo seals, and capital gateways. Each Skyline case can provide its own briefing, ACME note, solved text, and failed-case text while still using the shared Carmen route and suspect systems.

The Skyline-only geography clue families are **distance band**, **legal time-zone shift**, **gateway connectivity**, and **hemisphere/latitude**. `CapitalFlightRouteProvider` calculates capital-to-capital great-circle distance from the static gateway snapshot and can produce clues such as short-hop, regional, and long-haul capital connections. It also compares the current legal IANA time zone for the departure and destination capitals using the shared `capitalTimeZone` data in `data/countries.json`, producing clues such as the next capital being several hours ahead of or behind departure.

Gateway connectivity clues bucket the destination country's capital gateway by how many capital corridors it has in the Skyline file, allowing later cases to play with hub and false-hub logic without claiming today's live airline schedules. These clues are generated from the active route provider and compared against the visible flight choices, so they behave like route-deduction clues rather than general trivia.

Hemisphere/latitude clues use capital coordinates from the gateway snapshot. When the flight crosses the equator, the clue reports a hemisphere crossing ("The flight crossed into the Southern Hemisphere"). Otherwise, it falls back to a latitude band clue ("The next capital sits north of the Tropic of Cancer"). Latitude bands are: above the Arctic Circle, north of the Tropic of Cancer, between the equator and the Tropic of Cancer, between the equator and the Tropic of Capricorn, south of the Tropic of Capricorn, and below the Antarctic Circle. These clues appear primarily at airport and embassy investigations and support spatial map reasoning that feels distinct from the land-border campaign.

Capital comparison clues add three more clue families that use country metadata from the context:

- **Capital initial**: reveals the first letter of the destination capital ("The boarding stub shows the destination capital starts with the letter K."). Appears at hotel and library investigations. Useful for direct elimination when several choices share similar geography.
- **Continent**: reports whether the flight crosses continents or stays within the same one ("The air trail crosses into Africa." / "The next lead stays within Europe."). Appears at airport, embassy, and market investigations. A strong spatial signal especially for intercontinental routes.
- **Landlocked**: reports whether the destination country has a coastline ("The destination country has no coastline — cargo arrived by air only."). Appears at embassy, library, and market investigations. Complements the flight fiction since landlocked countries are only reachable by air.

All capital comparison clues count matching visible choices and use the `usedClueIds` deduplication system.

**Airport code clues** reveal a partial IATA code from the destination gateway. Each clue randomly reveals either the first or last letter of the 3-letter code ("The gate stamp shows an arrival code starting with K." / "...ending in L."). Airport code clues appear only from case 5 onward and are available at airport investigations. They add a harder deduction signal for experienced players without requiring memorized airport codes — the partial letter still narrows the visible choices.

**Cargo clues** connect the stolen artifact to the destination country's exports. The clue picks a random export from the target country and frames it as a cargo manifest label using one of several templates ("The crate was relabeled as", "The cargo manifest listed the contents as", etc.). Cargo clues appear primarily at market and hotel investigations and add thematic flavor that reinforces the freight-investigation fiction. They use the `exports` field from `data/countries.json` (194 countries have export data).

**Visual clues** are interactive evidence items that appear from case 3 onward with a ~40% chance at specific investigation locations. Three types exist: **scramble** (airport, case 3+) presents the destination capital's letters jumbled on a boarding pass for the player to rearrange via drag-and-drop; **outline** (library, case 3+) shows the destination country's silhouette on a torn atlas page without labels; **flag** (market, case 4+) displays a torn fragment of the destination country's flag with a jagged clip-path revealing roughly half, expanding slightly on hover. All visual clues use the "Examine Evidence" button pattern, rendering inside a themed evidence card with a dismiss button. When an outline or flag fragment is examined, a compact copy of that visual evidence is added to the Dossier for later review; scramble clues add the decoded capital after the player solves them. They are tracked by the `usedClueIds` deduplication system. The debug command "clues" forces 100% visual clue generation at eligible locations.

Skyline also adds a current-case **Manifest Board** inside the Dossier tab. It is enabled only for Skyline mode, resets at the start of each case, and does not persist to localStorage. Each correct air-corridor confirmation appends one recovered segment with the capital pair, gateway connectivity band, distance band, legal clock shift when available, and a deterministic recovered fragment keyed to the Skyline case arc. Investigations, wrong guesses, go-back travel, and failed suspect accusations do not add board entries, so the board records solved route evidence without revealing future stops or advancing failed-case story state.

The Manifest Board includes a **Dispatcher Signature** section that reveals predictive route-wide patterns. Unlike backward-looking observations, these patterns are computed against the full generated route at case start and are guaranteed to hold for all remaining stops. When the board says "The Dispatcher favors regional corridors," the player can trust the next stop is also regional and use that to narrow choices.

Each Skyline case is assigned a specific pattern type via `CASE_PATTERN_TYPES` in the route provider. Route generation preferentially selects routes that satisfy the assigned pattern. The assignments are: cases 1, 4, and 10 use same-continent; cases 2 and 8 use same-hemisphere; cases 3, 6, and 9 use distance-band; and cases 5 and 7 use gateway-band. Clock-direction patterns can still appear when a generated route naturally supports them, but they are not required campaign assignments because the available capital-flight graph cannot guarantee them reliably. Run `node carmen/validate-skyline-patterns.mjs` after changing Skyline route generation or pattern assignments to verify that every case can generate full routes with its assigned Dispatcher Signature.

The pattern section is hidden until 3 segments are confirmed (showing a short atmospheric text), then reveals more specific detail at 4+ segments. This gives the player 1-2 stops of predictive value — enough to be useful for deduction but not given too early to be obvious. The label "DISPATCHER SIGNATURE" frames the analysis as intelligence about The Dispatcher's routing habits being exposed through accumulated evidence.

Skyline Case 10 adds a **Final Manifest Proof** before the normal suspect lineup. One middle route segment is shown on the Manifest Board as a Gate Zero redaction: the country pair is known, but its checksum row is erased. After the final corridor is confirmed, the player must choose the checksum row that matches the missing segment's distance band, gateway band, legal clock shift, and destination hemisphere. A wrong proof choice costs 4 in-game hours and lets the player retry; if time expires, the case fails through the normal Skyline failure path. A correct proof locks the final manifest, reveals the redacted board row, and then proceeds to the regular suspect accusation. This makes The Dispatcher payoff a logistics-pattern proof rather than another alias accusation.

After a successful Skyline Case 10 suspect accusation, Skyline shows its own campaign-complete overlay instead of advancing into another case. The overlay states that the final operative is in custody and that ACME has exposed The Dispatcher's Gate Zero command pattern, but it does not claim The Dispatcher was arrested in person. The primary action returns to the Play page, and saved Skyline progress remains at case 10.

Country time-zone data is stored on each `data/countries.json` entry as:

- `timeZones`: all IANA zones for that country or territory in the local tzdb source;
- `capitalTimeZone`: the IANA zone used for the capital, chosen directly for single-zone entries and by nearest tzdb representative coordinate for multi-zone countries.

Study Mode can display these shared legal time zones, and Skyline uses `capitalTimeZone` for manifest-clock clues.

Campaign-specific launch behavior is now centralized in `carmen/src/campaign/modes.js`. The main Carmen entrypoint loads generic game data and asks this module for the active run configuration, mission label, route provider, and briefing copy. New campaigns should add their mode-specific data and provider wiring there or in their own campaign folder, rather than adding new direct campaign branches to `carmen/src/main.js`.

Small-island usability is handled inside Carmen only, not by changing shared map modules. `carmen/src/ui/carmen-route-renderer.js` wraps the shared route renderer and draws destination choices as the real country polygons. Carmen should not add visible circular proxy markers, separate ledger entries, or other off-country click targets when the country can be reached by zooming and panning the map. Labels are only shown when the projected country shape is large enough for the label to fit; tiny islands and microstates rely on zoom so the player clicks the geography itself. Long but narrow countries such as Panama should remain polygon-first. Shared files such as `js/ui-components/route-renderer.js` and `js/canvas-map-engine.js` should remain untouched for this behavior.

## Time Economy

Time is the main loss condition and the most important strategic resource.

Current costs:

- investigation: 3 hours;
- ACME redeployment: 5 hours;
- suspect clue refinement: 2 hours;
- new Interpol photo profile: 3 hours.

Time is spent on route certainty, suspect confidence, and ACME redeployment. That creates meaningful tradeoffs. The player can over-investigate and run out of time, under-investigate and choose wrong routes, or ignore suspect work and fail the final lineup.

Time now affects both survival and final score, but only lightly. A solved case receives a small speed bonus based on hours remaining, which makes efficient play matter without letting the clock dominate route accuracy.

## Scoring Model

The score model is intentionally simple:

- correct stop: 100 points;
- first-try stop bonus: 50 points;
- perfect route bonus: 200 points;
- hours-remaining speed bonus: 1 point per 2 hours left, capped at 50 points;
- wrong destination: -25 points;
- extra clue request: -20 points;
- wrong final suspect: -200 points.

Manual investigation, suspect refinement, Interpol browsing, and redeployment still do not directly reduce score. They reduce the clock, which can lower or erase the speed bonus and can still cause outright failure.

The current model remains readable: score primarily rewards accuracy, while the speed bonus gives clean, confident play a modest extra payoff.

## Presentation And Feedback

The presentation layer now does more mechanical work than before.

Important feedback systems include:

- the case briefing overlay with phase-specific mission copy;
- campaign-only briefing hints that foreshadow Carmen;
- typewriter text and stamp effects for case framing;
- route animation and ACME transport sound for redeployment;
- ambient sounds for locations and arrivals;
- narrator captions based on country-entry monologues;
- dead-end overlays and dossier detour entries;
- solved/failed closing overlays;
- special campaign-complete transition into Open Cases.

These are not just decoration. They help the player understand state transitions: investigation, redeployment, lead confirmation, dead end, final accusation, and campaign progression. The noir layer works best when it reinforces the geography chase rather than replacing it.

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
- The hours-remaining bonus is intentionally small, so fast successful play has some extra payoff but route accuracy still dominates.
- Wrong-route recovery is mechanically interesting, but the available options after a dead end can be mentally confusing because the player position and logical route position diverge.
- Campaign foreshadowing is strong in tone, but much of it is interpretive rather than mechanically inspectable.
- Open Cases inherit pursuit difficulty, which is good for engaged players but may be sharp for someone using Open Cases as their first Carmen experience.

## Design Opportunities

- Add a subtle UI cue showing each investigation location's clue tendency without turning it into tutorial text.
- Monitor whether the hours-remaining bonus is visible enough to influence play without making players avoid useful investigation.
- Make Interpol browsing value more legible, for example by distinguishing active-case candidates from broader archive files.
- Strengthen dead-end recovery messaging so the player understands when they are physically in the wrong country versus logically still solving the current stop.
- Give Open Cases a short first-run framing that explains they are standalone pursuit cases.
- Continue making campaign hints more inspectable through dossier/Interpol artifacts, not only transient flavor text.
- Expand the finale alias puzzle with more evidence that directly rewards comparing file irregularities.

## Conclusion

The current Carmen game has matured from a themed route quiz into a hybrid geography chase and detective notebook game. Its best mechanic is still constrained movement: every clue matters because every answer must be a neighboring country. The newer systems work when they serve that core: suspect clues add a second deduction track, Interpol adds memory and risk, campaign phases add pressure, and the finale alias gives long-term play a concrete payoff.

The next improvements should focus less on adding more systems and more on clarifying the systems already present. Players should better understand why investigation locations differ, when Interpol is worth the time, how dead-end recovery works, and how campaign evidence points toward the finale. The game has enough mechanical depth now; the highest-value work is making that depth easier to read while preserving the manual detective feel.
