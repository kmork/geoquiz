export const SKYLINE_SYNDICATE_MODE = 'skyline_syndicate';

export const SKYLINE_SYNDICATE = {
  id: SKYLINE_SYNDICATE_MODE,
  title: 'Skyline Syndicate',
  routeKind: 'capital_flights',
  caseLabel: 'SKYLINE CASE',
  dataUrl: 'carmen/src/campaigns/skyline-syndicate/data/capital-flight-routes.json',
  briefing:
    'ACME has traced this theft through capital-area flight links. Reconstruct the air trail from country to country, gather witness reports, and close the file before the route goes cold.',
};

export const SKYLINE_CASE_NARRATIVE = [
  {
    title: 'The Misprinted Boarding Pass',
    briefing:
      'ACME\'s Skyline Desk caught the artifact moving under a passenger alias with a misprinted boarding pass. Reconstruct the first air trail from capital gateway to capital gateway before the false ticket disappears from the file.',
    note:
      'Skyline Desk note: the first false manifest carries a recurring stamp — SKYLINE TRANSFER AUTHORIZED.',
    solved:
      'The false ticket is in evidence. ACME has its first clean look at the Syndicate\'s capital-gateway routing pattern.',
    failed:
      'The boarding pass was scrubbed from the file before ACME could pin the next gateway.',
  },
  {
    title: 'Cargo Hold 17',
    briefing:
      'The thief has moved the artifact as sealed cultural freight. Cargo handlers remember the crate, the seal, and the rush order, but the destination is buried in the transfer corridor.',
    note:
      'Cargo note: the crate was routed by an unknown desk code, D-0.',
    solved:
      'Cargo Hold 17 is sealed off. ACME has matched the desk code to another Skyline transfer.',
    failed:
      'The cargo seal broke in transit, and the Syndicate used the confusion to move the artifact again.',
  },
  {
    title: 'The Diplomatic Pouch',
    briefing:
      'A diplomatic pouch number appears in the airport file, but the embassy denies issuing it. Follow the capital records, compare the geography, and expose the next handoff.',
    note:
      'Embassy note: the same false authorization has appeared in multiple capitals.',
    solved:
      'The forged pouch number is logged. ACME can now treat these cases as one coordinated air network.',
    failed:
      'The pouch record vanished behind polite denials and cleaner paperwork.',
  },
  {
    title: 'The Red-Eye Chain',
    briefing:
      'Witnesses keep mentioning night flights, but the arrival times only make sense if the trail jumps across time zones. Use the airport chatter to find the next capital gateway.',
    note:
      'Skyline Desk note: ACME is no longer treating these as isolated thefts. Someone is dispatching the handoffs.',
    solved:
      'The red-eye sequence lines up. The Dispatcher is no longer a rumor in the margins.',
    failed:
      'The red-eye trail went dark, and the arrival board no longer matches ACME\'s copy.',
  },
  {
    title: 'The Hub That Wasn\'t',
    briefing:
      'The manifest points toward a famous hub capital, but every reliable witness contradicts it. The Syndicate is planting plausible transit hubs as decoys.',
    note:
      'Analyst note: The Dispatcher is predicting what ACME expects to see.',
    solved:
      'The decoy hub is crossed out. ACME has a better read on how The Dispatcher misdirects the file.',
    failed:
      'The false hub did its job. ACME chased a plausible gate while the real handoff cleared.',
  },
  {
    title: 'Weather Over the Meridian',
    briefing:
      'Bad weather forced a route adjustment, leaving ACME with a rare clean trace of the real corridor. Use the capital geography before the Syndicate repairs the manifest.',
    note:
      'Weather note: the route change exposed a repeated cargo relabel before the final flight.',
    solved:
      'The weather break held long enough. ACME now knows the Syndicate relabels cargo before the last hop.',
    failed:
      'The weather cleared, the records normalized, and the trace collapsed into routine airport noise.',
  },
  {
    title: 'The Missing Layover',
    briefing:
      'The file includes a layover that never happened. Reject the fake stop, compare the active gateways, and identify the country that fits the remaining air trail.',
    note:
      'Interpol note: The Dispatcher may have access to airline, customs, or cultural-freight systems.',
    solved:
      'The missing layover is exposed. ACME can prove the file was edited after the artifact moved.',
    failed:
      'The fake layover held, and the real route slipped out under a clean connection.',
  },
  {
    title: 'The Inferred Corridor',
    briefing:
      'One corridor in ACME\'s file is reconstructed from weak intelligence instead of confirmed old route records. Treat the manifest as evidence, not certainty, and find the next handoff.',
    note:
      'Skyline Desk note: The Dispatcher relies on weak corridors because ACME hesitates when the data is uncertain.',
    solved:
      'The inferred corridor was enough. ACME has learned how The Dispatcher hides inside uncertainty.',
    failed:
      'The uncertain corridor bought the Syndicate time, and the manifest no longer separates signal from noise.',
  },
  {
    title: 'Gate Zero',
    briefing:
      'Every clue points to a hidden controller who can erase gate changes before ACME receives the file. Follow the capital evidence back toward the command pattern.',
    note:
      'ACME identifier: Gate Zero is not a place. It is the fake origin The Dispatcher uses to rewrite the route.',
    solved:
      'Gate Zero is on the board. ACME has traced the command pattern behind the Skyline Syndicate.',
    failed:
      'Gate Zero rewrote the file again, and the controller stayed one step outside the manifest.',
  },
  {
    title: 'The Final Manifest',
    briefing:
      'The Dispatcher has sent one final chain through the capital gateways. Reconstruct the air trail, read the manifest pattern, and identify the controller before the Skyline file is wiped.',
    note:
      'Final note: the route is no longer just a chase. It is The Dispatcher\'s signature.',
    solved:
      'The final manifest is locked. The Dispatcher\'s network has been pulled out of the clouds and into evidence.',
    failed:
      'The final manifest burned clean, leaving only blank gates and a missing controller.',
  },
];

export function getSkylineCaseNarrative(caseNumber = 1) {
  const index = Math.max(0, Math.min(SKYLINE_CASE_NARRATIVE.length - 1, (caseNumber | 0) - 1));
  return SKYLINE_CASE_NARRATIVE[index];
}
