import { norm } from "./utils.js";
import { updateProgress } from "./ui.js";

export function createGame({ ui, mapApi, confetti }) {
  const DATA = window.DATA; // IMPORTANT: data.js sets window.DATA

  let deck = [];
  let current = null;

  let score = 0;
  let correctFirstTry = 0;
  let correctAny = 0;

  let stars = 0;
  let bonusMode = false;
  let bonusCommit = null;

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

  function updateStarsUI() {
    const el = ui.starsEl;
    if (!el) return;

    el.innerHTML = "";
    if (stars <= 0) return;

    // Display stars horizontally only, max 5 stars
    const dx = 7;  // horizontal offset in px
    const maxStarsToShow = Math.min(stars, 5);

    // Make container wide enough for displayed stars + count text
    const baseWidth = 16 + (maxStarsToShow - 1) * dx;
    const countWidth = stars > 5 ? 30 : 0; // extra space for " (n)"
    el.style.width = `${baseWidth + countWidth}px`;

    const frag = document.createDocumentFragment();

    for (let i = 0; i < maxStarsToShow; i++) {
      const s = document.createElement("span");
      s.className = "starIcon";
      s.textContent = "★";
      s.style.transform = `translateX(${i * dx}px)`;
      s.style.zIndex = String(i + 1);
      frag.appendChild(s);
    }

    // Add count if more than 5 stars
    if (stars > 5) {
      const count = document.createElement("span");
      count.textContent = ` (${stars})`;
      count.style.position = "absolute";
      count.style.left = `${16 + (maxStarsToShow - 1) * dx + 4}px`;
      count.style.fontWeight = "bold";
      count.style.whiteSpace = "nowrap";
      frag.appendChild(count);
    }

    el.appendChild(frag);
  }

  function awardStarsFromAccuracy(accPct) {
    // ≥90% -> 4★, ≥80% -> 3★, ≥70% -> 2★, ≥60% -> 1★, else 0
    if (accPct >= 90) return 3;
    if (accPct >= 80) return 2;
    if (accPct >= 70) return 1;
    return 0;
  }

  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  function startBonusRound() {
    // If we can't determine the capital location, skip bonus gracefully.
    const cap = mapApi?.getCapitalXY?.(current.country);
    const vb = mapApi?.getBaseViewBox?.();
    if (!cap || !vb) {
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
      endRound({ ok: true, pointsAwarded: 2, autoMs: AUTO_MS_CORRECT_FIRST });
      return;
    }

    bonusMode = true;
    bonusCommit = null;
    disarmAutoAdvance();

    // Replace the input field with a bonus label
    if (ui.answer) {
      ui.answer.value = "";
      ui.answer.style.display = "none";
      ui.answer.disabled = true;
    }
    if (ui.bonusLabelEl) ui.bonusLabelEl.style.display = "block";

    // Keep the button enabled (user must press Guess to commit)
    if (ui.submit) ui.submit.disabled = false;

    let candidate = null;

    const markerId = "bonusMarker";

    const drawMarker = (p) => {
      const svg = ui.map;
      if (!svg) return;
      svg.querySelector(`#${markerId}`)?.remove();

      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("id", markerId);
      c.setAttribute("cx", p.x);
      c.setAttribute("cy", p.y);

      // small marker ~3.5px regardless of zoom
      const vbNow = svg.viewBox.baseVal;
      const pxW = svg.clientWidth || 1;
      const upp = vbNow.width / pxW;
      c.setAttribute("r", String(7 * upp));

      c.setAttribute("fill", "#ffd54a");
      c.setAttribute("stroke", "rgba(232,236,255,.9)");
      c.setAttribute("stroke-width", "1");
      c.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(c);
    };

    const accuracyAtSvgPoint = (p) => {
      const dx = p.x - cap.x;
      const dy = p.y - cap.y;
      const d = Math.hypot(dx, dy);
      const maxD = Math.hypot(vb.w, vb.h) * 0.6;
      return clamp01(1 - d / maxD) * 100;
    };

    const onPlace = (e) => {
      if (!bonusMode) return;
      e.preventDefault();
      e.stopPropagation();

      const p = mapApi.clientToSvg(e.clientX, e.clientY);
      candidate = p;
      drawMarker(p);
      // (Removed: any accuracy text updates)
    };

    const cleanup = () => {
      ui.map?.removeEventListener("pointerdown", onPlace);
      ui.map?.querySelector(`#${markerId}`)?.remove();
    };

    bonusCommit = () => {
      if (!bonusMode) return;

      // Require a placed marker; no extra text needed
      if (!candidate) return;

      bonusMode = false;
      cleanup();

      const acc = accuracyAtSvgPoint(candidate);
      const gained = awardStarsFromAccuracy(acc);
      if (gained > 0) {
        stars += gained;
        updateStarsUI();
      }

      // Show the correct dot now
      mapApi?.draw?.(current.country, true);

      // Restore input for the next question
      if (ui.bonusLabelEl) ui.bonusLabelEl.style.display = "none";
      if (ui.answer) {
        ui.answer.style.display = "";
        ui.answer.disabled = false;
      }

      endRound({ ok: true, pointsAwarded: 2, autoMs: AUTO_MS_CORRECT_FIRST });
    };

    ui.map?.addEventListener("pointerdown", onPlace, { passive: false });
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
    stars = 0;
    updateStarsUI();

    // (Removed usage of bonusHintEl entirely)
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
    bonusMode = false;

    if (!deck.length) {
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

        ui.elChoices.querySelectorAll("button").forEach((btn) => (btn.disabled = true));

        ui.elChoices.querySelectorAll("button").forEach((btn) => {
          if (btn.textContent === correct) btn.classList.add("correct");
        });

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

  // Guess handler: correct on first try => bonus round; wrong/blank => MC alternatives
  ui.submit.onclick = () => {
    if (bonusMode) {
      bonusCommit?.();
      return;
    }
    if (roundEnded) return;

    const user = norm(ui.answer.value);

    if (!user) {
      showMC();
      return;
    }

    const ok = user === norm(current.capitals[0]);

    if (ok) {
      correctAny++;
      correctFirstTry++;
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
      startBonusRound();
    } else {
      showMC();
    }
  };

  // Tap anywhere / Enter to continue
  document.addEventListener(
    "pointerdown",
    () => {
      if (!roundEnded) return;
      if (bonusMode) return;
      if (ui.elChoices.style.display !== "none") return;
      disarmAutoAdvance();
      nextQ();
    },
    true
  );

  function isTextEditingTarget(t) {
    if (!t) return false;
    const tag = (t.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (t.isContentEditable) return true;
    return false;
  }

  document.addEventListener(
    "keydown",
    (e) => {
      // Enter is the only submit key.
      if (e.key !== "Enter") return;

      // If choices visible, Enter does nothing (don’t skip the choice phase)
      if (ui.elChoices.style.display !== "none") return;

      if (bonusMode) return;

      const editing = isTextEditingTarget(e.target) || document.activeElement === ui.answer;

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
