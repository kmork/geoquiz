# Skyline Syndicate Narrative Plan

## Summary

Skyline Syndicate should feel like ACME's aviation desk reconstructing a criminal flight network, not like The Crimson Trail with a different choice list. The central fiction is that stolen artifacts move through capital-area airport corridors under corrupted manifests, cargo seals, cultural-exchange paperwork, and false gate records.

The recommended antagonist is **The Dispatcher**: a remote logistics controller who does not steal artifacts personally, but routes thieves, cargo, and aliases through a hidden capital-gateway network. The player is not following a literal airline itinerary in real time. They are using ACME intelligence, historical route records, airport witnesses, and geography clues to identify the next confirmed handoff country.

The campaign should keep the existing Carmen loop intact: investigate, gather geography clues, confirm the route choice, and identify the suspect. Skyline's distinct identity should come from its narrative wrapper and from new geography puzzles based on flight corridors, capitals, time zones, distance bands, route confidence, and airport records.

## Narrative Direction

Use an "airport noir" vocabulary instead of border-trail language:

- air trail;
- capital gateway;
- transfer corridor;
- manifest ghost;
- red-eye handoff;
- airside witness;
- cargo seal;
- cultural freight;
- diplomatic pouch;
- gate change;
- missing layover;
- rerouted baggage tag;
- flight desk notation.

Core framing:

- ACME's **Skyline Desk** catches a stolen artifact moving under false capital-airport records.
- Each stop leaves fragments: a manifest entry, a cargo tag, a witness report, or a corrupted gate change.
- The Dispatcher appears first as a pattern in the data, then as a suspected controller, and finally as the campaign target.
- The route graph should be described as ACME's reconstructed corridor file, not as a guarantee of current real-world airline schedules.

Example briefing tone:

> ACME's Skyline Desk caught the artifact moving under a false cultural-exchange manifest. The thief never stayed long; each capital gateway left only a boarding stub, a cargo seal, and one witness willing to talk. Reconstruct the air trail before the Syndicate wipes the route clean.

Example dead-end tone:

> No matching flight corridor in this file. The manifest was bait.

Example correct-lead tone:

> The route clicks into place. One gate stamp, one witness, one capital closer to The Dispatcher.

## Geography Puzzle Ideas

Add Skyline-only clue families that make the flight-corridor mode feel mechanically different while still using the visible choice set.

- **Time zone clues:** compare the current capital and active destination choices by UTC offset or broad east/west direction. Example: "The arrival board was three hours ahead of departure."
- **Distance band clues:** use route metadata or calculated capital distance to describe short-hop, regional, long-haul, or transcontinental corridors.
- **Capital comparison clues:** compare visible choices by capital initial, capital word count, elevation, coastal proximity, population bracket, latitude, or hemisphere.
- **Hub logic clues:** use the route graph to distinguish high-connectivity gateways from quieter endpoints. Example: "The next lead is not the busiest gateway in the file."
- **Route-confidence clues:** turn `historical_openflights` and `inferred_fallback` into ACME file language. Historical corridors can be "confirmed in old route records"; inferred fallback corridors can be "reconstructed from gateway behavior."
- **Airport record clues:** use airport codes, gateway names, cargo tags, gate changes, and baggage labels as flavor. Keep airport-code clues optional or late-campaign because most players will not know them.
- **Hemisphere and latitude clues:** support map reasoning. Example: "The flight crossed into the Southern Hemisphere" or "The next capital sits north of the Tropic of Cancer."
- **Cargo-type clues:** connect the artifact and country data to the aviation fiction. Example: "The crate was relabeled as coffee exports" or "The transfer paperwork referenced a cultural delegation."

Avoid clues that imply land borders, neighboring countries, overland movement, or current airline schedules. Skyline clues should be true to the visible choice set and framed as ACME intelligence.

## 10-Case Campaign Outline

### Case 1: The Misprinted Boarding Pass

Story hook: A stolen artifact turns up in a capital airport record under a passenger alias, but the boarding pass has a timezone mismatch.

Puzzle focus: Basic capital-flight deduction using continent, capital initial, and distance-band clues.

Briefing tone: Introduce the Skyline Desk and explain that ACME is reconstructing an air trail from partial airport records.

Arc reveal: The first false manifest carries a recurring stamp: **SKYLINE TRANSFER AUTHORIZED**.

### Case 2: Cargo Hold 17

Story hook: The thief moves the artifact as sealed cultural freight. Cargo handlers remember the crate, but not the destination country.

Puzzle focus: Exports, heritage, airport witness reports, and short-hop versus regional distance clues.

Briefing tone: Emphasize cargo seals, freight labels, and the difference between passenger movement and artifact movement.

Arc reveal: ACME finds that the cargo was routed by an unknown desk code: **D-0**.

### Case 3: The Diplomatic Pouch

Story hook: A diplomatic pouch number appears in the file, but the embassy denies issuing it.

Puzzle focus: Embassy-heavy clues, capital geography, political facts, and hemisphere clues.

Briefing tone: The case should feel quieter and more bureaucratic, with polite witnesses and suspicious paperwork.

Arc reveal: The same false authorization appears in multiple capitals, suggesting a coordinated logistics network.

### Case 4: The Red-Eye Chain

Story hook: Several witnesses mention night flights, but the arrival times do not line up unless the route jumps east.

Puzzle focus: Time zone and longitude reasoning. Use "ahead/behind departure" clues without requiring exact offset math.

Briefing tone: ACME starts treating the thefts as one campaign instead of isolated airport cases.

Arc reveal: The Dispatcher is named for the first time as an unknown operator controlling handoffs.

### Case 5: The Hub That Wasn't

Story hook: The manifest points toward a famous hub capital, but every reliable witness contradicts it.

Puzzle focus: Hub logic. Distinguish high-connectivity decoy choices from the actual destination using geography and route graph clues.

Briefing tone: Warn that the Syndicate is planting plausible transit hubs as decoys.

Arc reveal: The Dispatcher does not just hide routes; they predict what ACME expects to see.

### Case 6: Weather Over the Meridian

Story hook: Bad weather forced a route adjustment, leaving ACME with a rare clean trace of the real corridor.

Puzzle focus: Latitude, mountain, climate, and regional route clues. Use physical geography to make flight corridors feel spatial.

Briefing tone: The case should feel like ACME caught the network under pressure.

Arc reveal: The route changes expose a repeated handoff method: cargo is always relabeled before the final flight.

### Case 7: The Missing Layover

Story hook: The file includes a layover that never happened. ACME must identify the country that fits the remaining trail.

Puzzle focus: Elimination against visible choices. Use "not the busiest gateway," "same hemisphere," and distance-band clues to reject the fake stop.

Briefing tone: The campaign enters a sharper phase; ACME knows the Syndicate is editing records after the fact.

Arc reveal: An Interpol note suggests The Dispatcher may have access to airline, customs, or cultural-freight systems.

### Case 8: The Inferred Corridor

Story hook: ACME's file includes one route reconstructed from weak intelligence rather than confirmed historical route records.

Puzzle focus: Route-confidence clues. Let the player reason from a mix of confirmed corridors and inferred fallback links.

Briefing tone: Be transparent: ACME has a reconstructed corridor, not a perfect airline schedule.

Arc reveal: The Dispatcher relies on weak corridors because they know ACME hesitates when the data is uncertain.

### Case 9: Gate Zero

Story hook: Every clue points to a hidden controller who can erase gate changes before ACME receives the file.

Puzzle focus: Combine several Skyline clue families: time zone, hub logic, capital comparison, and route confidence.

Briefing tone: The case should feel like a direct hunt for the control point behind the network.

Arc reveal: ACME identifies **Gate Zero** as the Dispatcher's command pattern: a fake origin used to rewrite the rest of the manifest.

### Case 10: The Final Manifest

Story hook: The Dispatcher sends one final route through capital gateways that spell out their operating pattern.

Puzzle focus: Finale pattern puzzle. Options:

- first letters of confirmed capitals reveal a call sign;
- time zone shifts reveal a numeric route code;
- the route alternates hemispheres or continents in a deliberate pattern;
- each confirmed stop unlocks a manifest fragment that identifies the final suspect.

Briefing tone: ACME has one clean shot before The Dispatcher wipes the Skyline file.

Arc payoff: The final suspect accusation should ask the player to identify the person whose Interpol file matches the route pattern, not just the person with matching visual traits.

## Implementation Notes For Later

Keep the first implementation small:

- add Skyline-specific briefing and closing copy before adding new mechanics;
- add one or two clue families first, preferably distance band and time zone;
- use the existing route provider and visible choice set for all clue comparisons;
- surface route confidence only as ACME file language, not as factual present-day flight certainty;
- avoid a separate UI until there are enough manifest fragments to justify a Manifest Board.

A later **Manifest Board** could become Skyline's signature campaign surface. It would show confirmed capitals, corridor metadata, route-confidence labels, and recovered manifest fragments. It should help players notice patterns without replacing manual deduction.

## Test And Review Checklist

- Confirm Skyline copy avoids border, land-neighbor, and overland wording.
- Confirm every clue is interpreted against the active visible route choices.
- Confirm no narrative claims that OpenFlights or inferred fallback links are current airline schedules.
- Confirm the campaign arc does not reuse The Crimson Trail finale, Carmen alias accusation, or Open Cases transition.
- Confirm failed Skyline cases do not advance narrative reveals that imply a solved case.

## Assumptions

- This is a planning document only.
- Skyline remains a separate 10-case campaign.
- The Dispatcher is the recommended campaign antagonist unless a later design chooses a different name.
- The current shared Carmen systems remain in place: scoring, suspect deduction, Interpol browsing, map rendering, and investigation locations.
