export function getUI() {
  return {
    questionText: document.getElementById("questionText"),
    choices: document.getElementById("choices"),
    explanation: document.getElementById("explanation"),
    scoreEl: document.getElementById("score"),
    progressEl: document.getElementById("progress"),
    
    finalOverlay: document.getElementById("finalOverlay"),
    finalScore: document.getElementById("finalScore"),
    finalTotal: document.getElementById("finalTotal"),
    finalCorrect: document.getElementById("finalCorrect"),
    finalAccuracy: document.getElementById("finalAccuracy"),
    finalSubtitle: document.getElementById("finalSubtitle"),
    
    playAgainBtn: document.getElementById("playAgain"),
    closeFinalBtn: document.getElementById("closeFinal"),
  };
}
