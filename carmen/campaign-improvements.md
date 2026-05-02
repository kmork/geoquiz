# Carmen Campaign Improvements Plan

## Summary

Build a campaign-only **ACME Case Board** that makes The Crimson Trail feel like one investigation climbing toward Carmen, not ten isolated route cases. The board should show arrested lieutenants, recovered artifacts, growing Carmen evidence, and a visible path from street-level thieves up to the final alias accusation.

The recommended shape is **Case Board**, not long cutscenes or hard-gated deduction. The player should feel smarter and closer to Carmen after each solved case, while the core route-chase gameplay stays intact.

## Campaign Case Board

Add a campaign-only board view available from the Carmen UI, likely as a new notebook tab or a prominent panel in the existing Case/Interpol area.

Show a vertical network ladder:

- bottom: solved cases and arrested thieves;
- middle: recurring patterns such as logistics, clean exits, shared planning, and Carmen's lieutenants;
- top: Carmen file, initially redacted, becoming clearer by phase.

Derive board state from existing persistence where possible:

- current campaign case;
- mission history;
- unlocked/arrested suspects;
- theft history;
- campaign phase.

Avoid adding a complex new save model unless needed. Most board progress can be calculated from solved case count and existing records.

## Chapter Progression

Give campaign phases explicit chapter identities:

- **Cases 1-3:** isolated thefts with suspiciously professional exits.
- **Cases 4-6:** evidence of a coordinated network.
- **Cases 7-9:** Carmen's lieutenants and shared operating pattern become clear.
- **Case 10:** expose Carmen's alias.

Update campaign briefings and solved-case closings to reference the chapter arc, not just the current case.

After each successful campaign case, show a short **Board Updated** beat:

- recovered artifact added;
- arrested suspect pinned;
- one new Carmen evidence note added;
- progress marker moves closer to Carmen.

Failed cases should not advance the board because campaign case progression does not advance on failure.

## Knowledge Gained

Add persistent Carmen evidence sections that unlock by campaign progress:

- **Pattern:** the thefts share clean exits and prepared routes.
- **Network:** thieves are being coordinated.
- **Logistics:** travel records, manifests, and border timing point to central planning.
- **Alias:** Carmen is likely operating through a constructed identity.

Surface these as readable evidence cards on the board and as stronger Interpol text for Carmen.

Make the finale feel earned by reusing the same evidence categories in the alias lineup: the player should recognize why a polished, inconsistent file smells like Carmen.

## UI And Content

Keep the feature mostly in Carmen-specific modules:

- campaign/narrative content for chapter titles and evidence cards;
- UI rendering for the board;
- main orchestration for showing board updates after solved campaign cases.

Use existing noir/case-file styling: pinned files, redactions, stamps, strings/links, and compact evidence cards.

Do not turn this into a tutorial wall. The board should be inspectable, atmospheric, and useful, but not required reading for every move.

## Test Plan

- Start a new campaign and confirm the board begins mostly redacted.
- Solve a campaign case and confirm:
  - arrested suspect appears on the board;
  - recovered artifact appears;
  - a new evidence note unlocks;
  - closing flow clearly says the board was updated.
- Advance through phase boundaries:
  - case 4 should feel like "network discovered";
  - case 7 should feel like "lieutenants identified";
  - case 10 should clearly frame the alias hunt.
- Confirm Open Cases do not show campaign board progression.
- Confirm failed campaign cases do not unlock new board evidence.
- Confirm `carmen/carmen-game-reference.md` is updated with the new board and narrative progression rules when this feature is implemented.

## Assumptions

- This is a planning document only; the campaign board is not implemented yet.
- The campaign should stay playable as a geography chase; the board adds narrative continuity, not a separate mandatory puzzle.
- Open Cases should remain standalone and should not inherit campaign board progression.
- Existing saved data should remain compatible; board state should be derived from current localStorage records wherever possible.
