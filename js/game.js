import { norm } from "./utils.js";
import { updateProgress } from "./ui.js";
import { isMobileDevice, hapticFeedback, flashCorrect, shakeWrong, shuffleInPlace } from "./game-utils.js";

// Helper to get CSS variable values
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function createGame({ ui, mapApi, confetti }) {
  const DATA = window.DATA; // IMPORTANT: data.js sets window.DATA
  const MAX_ROUNDS = 10;

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

  function animateStarsToScore(count, callback) {
    if (count <= 0) {
      callback?.();
      return;
    }

    const targetEl = ui.starsEl;
    if (!targetEl) {
      callback?.();
      return;
    }

    // Get target position - aim closer to the score number (left side of starStack)
    const targetRect = targetEl.getBoundingClientRect();
    const targetX = targetRect.left + 8; // closer to score number
    const targetY = targetRect.top + targetRect.height / 2;

    // Create container for animated stars
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.inset = "0";
    container.style.pointerEvents = "none";
    container.style.zIndex = "10000";
    document.body.appendChild(container);

    const stars = [];
    const spacing = 40; // horizontal spacing between stars

    for (let i = 0; i < count; i++) {
      const star = document.createElement("div");
      star.textContent = "★";
      star.style.position = "absolute";
      star.style.fontSize = "64px";
      star.style.color = "#ffd54a";
      star.style.textShadow = "0 0 12px rgba(255,213,74,.5)";
      star.style.left = `${window.innerWidth / 2 + (i - (count - 1) / 2) * spacing}px`;
      star.style.top = `${window.innerHeight / 2}px`;
      star.style.transform = "translate(-50%, -50%) scale(1)";
      star.style.transition = "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)";
      star.style.opacity = "1";
      container.appendChild(star);
      stars.push(star);
    }

    // Trigger animation after a brief delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stars.forEach((star) => {
          const startLeft = parseFloat(star.style.left);
          const startTop = parseFloat(star.style.top);
          star.style.left = `${targetX}px`;
          star.style.top = `${targetY}px`;
          star.style.transform = "translate(-50%, -50%) scale(0.3)";
          star.style.opacity = "0.8";
        });
      });
    });

    // Clean up and callback
    setTimeout(() => {
      container.remove();
      callback?.();
    }, 850);
  }

  function awardStarsFromAccuracy(accPct) {
    // ≥90% -> 4★, ≥80% -> 3★, ≥70% -> 2★, ≥60% -> 1★, else 0
    if (accPct >= 95) return 3;
    if (accPct >= 85) return 2;
    if (accPct >= 75) return 1;
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

      c.setAttribute("fill", getCSSVar('--star-color') || "#ffd54a");
      c.setAttribute("stroke", getCSSVar('--map-dot-stroke') || "rgba(232,236,255,.9)");
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
        animateStarsToScore(gained, () => {
          stars += gained;
          updateStarsUI();
        });
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
    // Shuffle all countries and take only first 10
    deck = shuffleInPlace([...(DATA || [])]).slice(0, MAX_ROUNDS);
    current = null;

    score = 0;
    correctFirstTry = 0;
    correctAny = 0;

    ui.scoreEl.textContent = "0";
    stars = 0;
    updateStarsUI();

    // (Removed usage of bonusHintEl entirely)
    updateProgress(ui.progressEl, 0, MAX_ROUNDS);
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
      ui.finalCountries.textContent = String(MAX_ROUNDS);
      ui.finalCorrect.textContent = String(correctAny);
      ui.finalFirstTry.textContent = String(correctFirstTry);
      ui.finalSubtitle.textContent = "Nice work!";
      return;
    }

    current = deck.pop();
    ui.elCountry.textContent = current.country;

    updateProgress(ui.progressEl, MAX_ROUNDS - deck.length, MAX_ROUNDS);
    mapApi?.draw?.(current.country, false);

    // Only auto-focus on desktop (not mobile to avoid unwanted keyboard)
    if (!isMobileDevice()) {
      ui.answer.focus();
    }
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
          flashCorrect(document.querySelector('.card'));
          hapticFeedback('correct');
          confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
          endRound({ ok: true, pointsAwarded: 1, autoMs: AUTO_MS_CORRECT_SECOND });
        } else {
          shakeWrong(b);
          hapticFeedback('wrong');
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
      shakeWrong(ui.answer);
      hapticFeedback('wrong');
      showMC();
      return;
    }

    const ok = user === norm(current.capitals[0]);

    if (ok) {
      correctAny++;
      correctFirstTry++;
      flashCorrect(document.querySelector('.card'));
      hapticFeedback('correct');
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
      startBonusRound();
    } else {
      shakeWrong(ui.answer);
      hapticFeedback('wrong');
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
