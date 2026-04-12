/**
 * Narrator script — audio file paths for mission transitions.
 *
 * Pure content. The main orchestrator picks a script based on case number
 * and whether the player succeeded, then plays it via the audio engine.
 */

/**
 * Choose the narrator audio file for a mission transition.
 * @param {boolean} wasSuccess  — did the player solve the previous case?
 * @param {number}  caseNumber  — the case just completed (1–10)
 * @returns {{ file: string, cues: [number, string][] }}
 */
const CASE_CUES = {
  1: [
    [0.0,  "The world's a big place."],
    [2.0,  "Too big, if you ask me."],
    [5.0,  "You miss one thing\u2026\nand suddenly it matters."],
    [9.0,  "That's why ACME\nkeeps me on the payroll."],
    [12.0, "Somewhere, a jazz track\nprobably started playing."],
    [16.0, "I didn't hear it."],
    [17.0, "Phone rang anyway."],
  ],
  2: [
    [0.0,  "Closed one case.\nDidn't feel closed."],
    [3.0,  "They rarely do."],
    [4.5,  "I was halfway through bad coffee\nwhen the next file landed."],
    [8.0,  "Still warm."],
    [9.5, "Funny thing\u2014coffee always\ntastes worse when it's accurate."],
  ],
  3: [
    [0.0,  "Different job. Same shape."],
    [3.0,  "You start noticing that\nafter a while."],
    [6.0,  "I told myself\nit was coincidence."],
    [9.5,  "I've told myself worse."],
    [12.0, "If this were a movie,\nthis is where it gets complicated."],
  ],
  4: [
    [0.0,  "Someone mentioned a name\nthis time."],
    [2.0,  "Quiet. Like it might break\nif they said it louder."],
    [6.5,  "I didn't ask them\nto repeat it."],
    [8.5,  "In my line of work,\nnames don't get clearer the second time."],
    [13.0, "The next case came in\nbefore I could forget it."],
  ],
  5: [
    [0.0,  "Patterns don't form\nby accident."],
    [2.5,  "Not clean ones, anyway."],
    [4.5,  "I was starting\nto see the lines\u2026"],
    [7.5,  "Then the next case\ncut right through them."],
    [11.0, "Timing like that\nisn't luck."],
    [13.5, "It just likes\nto pretend it is."],
  ],
  6: [
    [0.0,  "Something didn't sit right\nlast time."],
    [2.5,  "Clue that didn't behave\nlike a clue."],
    [5.0,  "That usually means\none thing."],
    [7.5,  "Someone's paying attention."],
    [10.0, "I should've been flattered.\nI wasn't."],
  ],
  7: [
    [0.0,  "You follow enough trails,\neventually one looks back at you."],
    [4.5,  "That's new."],
    [6.5,  "I was thinking about that\u2026"],
    [8.5,  "When the next file showed up\nlike it had somewhere to be."],
    [13.5, "I don't like paperwork\nwith urgency."],
  ],
  8: [
    [0.0,  "I got close.\nClose enough to feel it."],
    [3.5,  "Witness said they saw her.\nMaybe."],
    [6.5,  "Red coat.\nGone before it mattered."],
    [10.0,  "That's how legends\nstay legends."],
    [13.5, "Also how they\nstay employed."],
  ],
  9: [
    [0.0,  "This last one\nfelt too clean."],
    [2.5,  "I don't trust clean.\nNever have."],
    [6.0,  "Things that neat usually\ncome with fingerprints\u2014"],
    [9.5,  "Just not the kind\nyou can dust."],
    [13.0, "The next case didn't wait\nfor me to decide."],
  ],
  10: [
    [0.0,  "Nine cases.\nNine steps closer to something\nI can't quite see yet."],
    [5.5,  "But it's there.\nHas been the whole time."],
    [10.0,  "Funny thing\nabout stories like this\u2014"],
    [13.5, "They don't wait\nfor the ending."],
  ],
};

const FAILURE_CUES = [
  [0.0,  "I was close.\nClose enough to see the outline."],
  [3.5,  "But outlines\ndon't wear handcuffs."],
  [7.0,  "Somewhere out there,\nthey're already moving again."],
  [11.0, "And I'm still here\u2026\nthinking I almost had it."],
];

export function chooseNarratorScript(wasSuccess, caseNumber) {
  if (!wasSuccess) {
    return { file: 'carmen/audio/narrator-case-failure.mp3', cues: FAILURE_CUES };
  }
  const n = Math.max(1, Math.min(10, caseNumber));
  return { file: `carmen/audio/narrator-case${n}.mp3`, cues: CASE_CUES[n] || [] };
}
