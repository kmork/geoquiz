/**
 * Carmen thief taunts — phase-aware dialogue pool + selector.
 *
 * Pure content + a single pure function. The game engine calls pickTaunt() with
 * the current campaign phase, route progress, and whether the player just guessed
 * wrong; it returns one taunt string.
 */

const THIEF_TAUNTS = {
  early: [
    "You'll never catch me!",
    "I'm always three steps ahead, detective.",
    "Is that the best ACME has to offer?",
    "By the time you read this, I'll be long gone.",
    "Better luck next country!",
    "Catch me if you can!",
  ],
  mid: [
    "Still following me? How persistent.",
    "I have to admit, you're better than the last detective.",
    "Getting warmer... or are you?",
    "You're closer than I expected. Don't get used to it.",
    "Not bad, detective. But I have a few tricks left.",
    "Enjoy the scenery — I certainly am.",
  ],
  late: [
    "How are you still on my trail?!",
    "Fine, you're good. But I'm better.",
    "I can hear your footsteps... getting closer.",
    "This isn't over yet, detective!",
    "You've earned my respect. But not my surrender.",
  ],
  wrongGuess: [
    "Ha! Wrong turn, detective!",
    "You just wasted precious time. Thanks!",
    "That's not where I went. Try again!",
    "Cold, very cold!",
    "My grandmother could track better than you!",
  ],
  whispers: [
    "She said you'd be slow.",
    "I answer to someone you haven't met yet.",
    "My employer sends her regards, detective.",
    "You think I'm the one you should be chasing?",
    "There's a bigger shadow behind me. You'll see.",
  ],
  whispersWrong: [
    "She'll be pleased you wasted the hours.",
    "My boss is laughing at you right now.",
    "Careful — the one pulling my strings is watching.",
  ],
  pursuit: [
    "Carmen warned me you were persistent.",
    "You're closer to her than you realize.",
    "Carmen Sandiego doesn't lose, detective. Neither do I.",
    "This was never about the artifact. It's about her.",
    "Tell Carmen I said hi — if you ever meet her.",
  ],
  pursuitWrong: [
    "Carmen predicted you'd pick wrong.",
    "Every wrong turn is a gift to her.",
    "You'll never reach her at this pace.",
  ],
  finale: [
    "So. The famous detective. I expected taller.",
    "You've chased my lieutenants for nine cases. Now chase me.",
    "I left you a trail because I wanted to see you try.",
    "Catch me here, or I vanish for good.",
    "Nine cases to find me. I'm almost flattered.",
    "Last dance, detective. Don't step on my toes.",
  ],
  finaleWrong: [
    "Oh dear. And you were doing so well.",
    "I expected better from my only worthy rival.",
    "One more mistake and the world loses me for good.",
  ],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a taunt based on game state.
 * @param {string}  phase        — 'prelude' | 'whispers' | 'pursuit' | 'finale'
 * @param {number}  currentStop  — 0-based index of the player's current stop
 * @param {number}  routeLength  — total stops in the route
 * @param {boolean} wrongGuess   — true if the player just made a wrong guess
 */
export function pickTaunt(phase, currentStop, routeLength, wrongGuess = false) {
  // Finale: Carmen always speaks in first person.
  if (phase === 'finale') {
    return pickRandom(wrongGuess ? THIEF_TAUNTS.finaleWrong : THIEF_TAUNTS.finale);
  }
  // Pursuit: 70% explicit Carmen references.
  if (phase === 'pursuit' && Math.random() < 0.7) {
    return pickRandom(wrongGuess ? THIEF_TAUNTS.pursuitWrong : THIEF_TAUNTS.pursuit);
  }
  // Whispers: 50% shadowy-boss hints.
  if (phase === 'whispers' && Math.random() < 0.5) {
    return pickRandom(wrongGuess ? THIEF_TAUNTS.whispersWrong : THIEF_TAUNTS.whispers);
  }
  if (wrongGuess) {
    return pickRandom(THIEF_TAUNTS.wrongGuess);
  }
  const progress = currentStop / Math.max(1, routeLength - 1);
  if (progress < 0.4) return pickRandom(THIEF_TAUNTS.early);
  if (progress < 0.75) return pickRandom(THIEF_TAUNTS.mid);
  return pickRandom(THIEF_TAUNTS.late);
}
