export function getUI() {
  return {
    elCountry: document.getElementById("countryName"),
    elChoices: document.getElementById("choices"),
    answer: document.getElementById("answer"),
    submit: document.getElementById("submit"),
    scoreEl: document.getElementById("score"),
    progressEl: document.getElementById("progress"),
    map: document.getElementById("map"),

    finalOverlay: document.getElementById("finalOverlay"),
    finalSubtitle: document.getElementById("finalSubtitle"),
    finalScore: document.getElementById("finalScore"),
    finalCountries: document.getElementById("finalCountries"),
    finalCorrect: document.getElementById("finalCorrect"),
    finalFirstTry: document.getElementById("finalFirstTry"),
    playAgainBtn: document.getElementById("playAgain"),
    closeFinalBtn: document.getElementById("closeFinal"),
  };
}

export function updateProgress(el, asked, total) {
  if (el) el.textContent = `${asked} / ${total}`;
}
