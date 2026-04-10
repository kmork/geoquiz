/**
 * Narrator script — audio file paths + subtitle cue timings for mission transitions.
 *
 * Pure content. The main orchestrator picks a script based on mission history
 * and plays it via the audio engine.
 */

const SCRIPTS = {
  repeat: {
    file: 'carmen/audio/narrator - mission3.mp3',
    cues: [
      [0.0,  "Done."],
      [1.0,  "For now."],
      [2.5,  "Different country.\nSame kind of landmark."],
      [5.5,  "I'm starting to think\nthe world's got habits."],
      [8.5,  "And someone out there\nis taking notes."],
    ],
  },
  success: {
    file: 'carmen/audio/narrator - mission1 success.mp3',
    cues: [
      [0.0,  "Last case\u2026\nwrapped up nicely."],
      [2.0,  "Caught the thief.\nHandcuffs, paperwork, the whole routine."],
      [6.5,  "Still don't know\nwho they really were."],
      [8.5,  "Didn't stick around\nfor introductions."],
      [9.5,  "Figures."],
      [11.0, "I poured myself a coffee\nthat tasted like regret."],
      [15.0, "Didn't even finish it."],
      [16.5, "Because I know\nhow this goes."],
      [18.5, "You close one case\u2026\nand somewhere out there\u2014"],
      [21.5, "someone's already\npicking their next target."],
    ],
  },
  fail: {
    file: 'carmen/audio/narrator - mission1 fail.mp3',
    cues: [
      [0.0,  "The thief got away."],
      [1.1,  "Again."],
      [2.7,  "I replayed it in my head\na dozen times. Maybe more."],
      [5.5,  "It doesn't get better\nwith repetition."],
      [7.5,  "No face. No name."],
      [9.5,  "Just a disappearing act\nthat would make a magician jealous."],
      [13.0, "Could be anyone."],
      [14.5, "Which, in my line of work,\nis just saying I've got nothing."],
      [18.5, "But the next case\nis already knocking."],
      [20.5, "And I don't intend\nto be the punchline twice."],
    ],
  },
};

/**
 * Choose the right narrator script for a mission transition.
 * @param {boolean} wasSuccess — did the player solve the previous case?
 * @param {number}  missionCount — how many missions completed so far
 * @returns {{ file: string, cues: [number, string][] }}
 */
export function chooseNarratorScript(wasSuccess, missionCount) {
  if (missionCount >= 3) return SCRIPTS.repeat;
  return wasSuccess ? SCRIPTS.success : SCRIPTS.fail;
}
