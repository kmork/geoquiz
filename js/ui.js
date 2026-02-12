export function getUI() {
  return {
    elCountry: document.getElementById("countryName"),
    elChoices: document.getElementById("choices"),
    answer: document.getElementById("answer"),
    submit: document.getElementById("submit"),
    scoreEl: document.getElementById("score"),
    progressEl: document.getElementById("progress"),
    map: document.getElementById("map"),

    starsEl: document.getElementById("starStack"),
    bonusLabelEl: document.getElementById("bonusLabel"),

    finalOverlay: document.getElementById("finalOverlay"),
  };
}

export function updateProgress(el, asked, total) {
  if (el) el.textContent = `${asked} / ${total}`;
}
