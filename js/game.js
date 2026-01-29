import { norm } from "./utils.js";
import { updateProgress } from "./ui.js";

export function createGame({ ui, mapApi, confetti }) {
  const DATA = window.DATA; // IMPORTANT: data.js sets window.DATA

  let deck = [];
  let current = null;

  let score = 0;
  let correctFirstTry = 0;
  let correctAny = 0;

  let roundEnded = false;
  let continueTimer = null;

  const AUTO_MS_CORRECT_FIRST = 900;
  const AUTO_MS_CORRECT_SECOND = 1100;
  const AUTO_MS_WRONG_SECOND = 1700;

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function disarmAutoAdvance() {
    if (continueTimer) {
      clearTimeout(continueTimer);
      continueTimer = null;
    }
  }

  function armAutoAdvance(ms) {
    disarmAutoAdvance();
    continueTimer = setTimeout(() => {
      nextQ();
    }, ms);
  }

  function reset() {
    deck = shuffleInPlace([...(DATA || [])]);
    current = null;

    score = 0;
    correctFirstTry = 0;
    correctAny = 0;

    ui.scoreEl.textContent = "0";
    updateProgress(ui.progressEl, 0, deck.length);
  }

  function nextQ() {
    disarmAutoAdvance();
    ui.elChoices.style.display = "none";
    ui.elChoices.innerHTML = "";
    ui.answer.disabled = false;
    ui.submit.disabled = false;
    ui.answer.value = "";
    roundEnded = false;

    if (!deck.length) {
      // Finished -> show your final overlay (if you have this logic elsewhere, keep it)
      ui.finalOverlay.style.display = "flex";
      ui.finalScore.textContent = String(score);
      ui.finalCountries.textContent = String(DATA.length);
      ui.finalCorrect.textContent = String(correctAny);
      ui.finalFirstTry.textContent = String(correctFirstTry);
      ui.finalSubtitle.textContent = "Nice work!";
      return;
    }

    current = deck.pop();
    ui.elCountry.textContent = current.country;

    updateProgress(ui.progressEl, DATA.length - deck.length, DATA.length);
    mapApi?.draw?.(current.country, false);

    ui.answer.focus();
  }

  function endRound({ ok, pointsAwarded, autoMs }) {
    if (roundEnded) return;
    roundEnded = true;

    ui.answer.disabled = true;
    ui.submit.disabled = true;

    // show map dot
    mapApi?.draw?.(current.country, true);

    if (ok) {
      score += pointsAwarded;
      ui.scoreEl.textContent = String(score);
    }

    armAutoAdvance(autoMs);
  }

  function showMC() {
    if (roundEnded) return;

    ui.answer.disabled = true;
    ui.submit.disabled = true;

    ui.elChoices.style.display = "grid";
    ui.elChoices.innerHTML = "";

    const correct = current.capitals[0];

    // build 4 options (1 correct + 3 random)
    let opts = [correct];
    while (opts.length < 4) {
      const c = DATA[(Math.random() * DATA.length) | 0].capitals[0];
      if (!opts.includes(c)) opts.push(c);
    }
    opts.sort(() => Math.random() - 0.5);

    opts.forEach((option) => {
      const b = document.createElement("button");
      b.className = "choiceBtn";
      b.type = "button";
      b.textContent = option;

      b.onclick = () => {
        if (roundEnded) return;

        const isCorrect = option === correct;

        // disable all buttons immediately (no double clicks)
        ui.elChoices.querySelectorAll("button").forEach((btn) => (btn.disabled = true));

        // mark correct in green
        ui.elChoices.querySelectorAll("button").forEach((btn) => {
          if (btn.textContent === correct) btn.classList.add("correct");
        });

        // if wrong, mark selected in red
        if (!isCorrect) b.classList.add("wrong");

        if (isCorrect) {
          correctAny++;
          confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
          endRound({ ok: true, pointsAwarded: 1, autoMs: AUTO_MS_CORRECT_SECOND });
        } else {
          endRound({ ok: false, pointsAwarded: 0, autoMs: AUTO_MS_WRONG_SECOND });
        }
      };

      ui.elChoices.appendChild(b);
    });
  }

  // Submit handler: correct => confetti => fast advance; wrong => show alternatives
  ui.submit.onclick = () => {
    if (roundEnded) return;

    const user = norm(ui.answer.value);

    // blank submit = treat as wrong -> show alternatives
    if (!user) {
      showMC();
      return;
    }

    const ok = user === norm(current.capitals[0]);

    if (ok) {
      correctAny++;
      correctFirstTry++;
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
      endRound({ ok: true, pointsAwarded: 2, autoMs: AUTO_MS_CORRECT_FIRST });
    } else {
      showMC();
    }
  };

  // Tap anywhere / Enter to continue (optional, without a Next button)
  document.addEventListener(
    "pointerdown",
    () => {
      if (!roundEnded) return;
      if (ui.elChoices.style.display !== "none") return; // don’t skip while choices visible
      disarmAutoAdvance();
      nextQ();
    },
    true
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;

      // If choices visible, Enter does nothing (don’t skip the choice phase)
      if (ui.elChoices.style.display !== "none") return;

      if (roundEnded) {
        e.preventDefault();
        disarmAutoAdvance();
        nextQ();
      } else {
        e.preventDefault();
        ui.submit.click();
      }
    },
    true
  );

  return {
    reset,
    nextQ,
    getCurrent: () => current,
  };
}
