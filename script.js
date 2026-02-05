// ===== CONFIG =====
const WEDDING_DATE_ISO = "2026-06-20T17:00:00";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYbtVjtBXhuInQzqzqt-wXs0R424LhNgs1y9D_Fefuz0VZd8qIUQtyCcb_2HuPfTrS/exec"

const pad2 = (n) => String(n).padStart(2, "0");

// ===== countdown  =====
function startCountdownAll() {
  const units = ["d", "h", "m", "s"];
  const targets = {};
  units.forEach(u => {
    targets[u] = [document.getElementById(u), ...document.querySelectorAll(`[data-ct="${u}"]`)].filter(Boolean);
  });

  const targetDate = new Date(WEDDING_DATE_ISO).getTime();

  function tick() {
    const now = Date.now();
    const diff = Math.max(0, targetDate - now);

    const d = Math.floor(diff / 864e5);
    const h = Math.floor((diff % 864e5) / 36e5);
    const m = Math.floor((diff % 36e5) / 6e4);
    const s = Math.floor((diff % 6e4) / 1000);

    const values = { d, h: pad2(h), m: pad2(m), s: pad2(s) };
    units.forEach(u => {
      targets[u].forEach(el => {
        if (el.textContent !== String(values[u])) {
          el.textContent = values[u];
        }
      });
    });
  }

  tick();
  setInterval(tick, 1000);
}

function dEl(id) { return document.getElementById(id); }

// ===== calendar =====
function renderCalendar() {
  const cal = dEl("calendar");
  if (!cal) return;

  cal.innerHTML = "";
  const YEAR = 2026, MONTH = 6, HIGHLIGHT_DAY = 20;

  const head = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  head.forEach(h => {
    const div = document.createElement("div");
    div.className = "cal-head";
    div.textContent = h;
    cal.appendChild(div);
  });

  const first = new Date(YEAR, MONTH - 1, 1);
  const daysInMonth = new Date(YEAR, MONTH, 0).getDate();

  let start = first.getDay();        // 0..6 (Вс..Сб)
  start = (start === 0) ? 7 : start; // 1..7 (Пн..Вс)
  const emptyCount = start - 1;

  for (let i = 0; i < emptyCount; i++) {
    const div = document.createElement("div");
    div.className = "cal-day cal-empty";
    cal.appendChild(div);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const div = document.createElement("div");
    div.className = "cal-day";
    div.textContent = String(day);
    if (day === HIGHLIGHT_DAY) div.classList.add("cal-mark");
    cal.appendChild(div);
  }
}

// ===== rsvp local =====
function setupRSVP() {
  const form = document.getElementById("rsvpForm");
  const button = document.querySelector(".form-submit-btn");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      button.disabled = true;

      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      data.drinks = fd.getAll("drinks");
      if (data.guests) data.guests = Number(data.guests);

      try {
        const res = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data),
        });

        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Unknown error");

        alert("Спасибо! Ответ отправлен.");
        form.reset();
      } catch (err) {
        alert("Не удалось отправить. Попробуйте ещё раз.");
        console.error(err);
      } finally {
        button.disabled = false;
      }
    });
  }
}

function setupToTopOnConfirmation() {
  const link = document.getElementById("toTopLink");
  const section = document.getElementById("confirmation");
  if (!link || !section) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const show = () => {
    link.classList.add("is-visible");
    link.setAttribute("aria-hidden", "false");
  };

  const hide = () => {
    link.classList.remove("is-visible");
    link.setAttribute("aria-hidden", "true");
  };

  if (reduce) {
    // Still respect the same logic, just no animation needed (CSS handles it anyway)
  }

  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[0];
      if (e.isIntersecting) show();
      else hide();
    },
    {
      // “start” of section: triggers when its top crosses into the viewport
      root: null,
      threshold: 0,
      rootMargin: "0px 0px -99% 0px",
    }
  );

  io.observe(section);
  hide();
}

// ===== REVEAL on scroll =====
function setupReveal() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let els = Array.from(document.querySelectorAll("[data-reveal]"));

  if (!els.length) {
    els = Array.from(document.querySelectorAll(".container, .hero-inner, .count-cta, .timeline, .dress, .grid-2"));
  }

  els.forEach(el => {
    el.classList.add("reveal");
    const delay = el.dataset.delay ? `${Number(el.dataset.delay)}ms` : "0ms";
    el.style.setProperty("--reveal-delay", delay);
    if (reduce) el.classList.add("is-in");
  });

  if (reduce) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        if (e.target.dataset.once !== "false") io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => io.observe(el));
}

// ===== PARALLAX like react-scroll-parallax =====
// Двигаем любые элементы с атрибутами:
// data-parallax-y="60" data-parallax-x="-20" data-parallax-scale="1.06"
function setupParallax() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const items = Array.from(document.querySelectorAll(".parallax-item")).map(el => ({
    el,
    y: Number(el.dataset.parallaxY || 0),
    x: Number(el.dataset.parallaxX || 0),
    s: Number(el.dataset.parallaxScale || 1),
    rect: null,
    visible: false
  }));

  if (!items.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const item = items.find(i => i.el === entry.target);
      if (item) item.visible = entry.isIntersecting;
    });
  }, { threshold: 0 });

  items.forEach(item => io.observe(item.el));

  let raf = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const update = () => {
    raf = 0;
    const vh = window.innerHeight;

    items.forEach(item => {
      if (!item.visible) return;

      const rect = item.el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const t = (mid - vh / 2) / (vh / 2);
      const p = clamp(t, -1, 1);

      const y = item.y * p;
      const x = item.x * p;
      const ease = 1 - Math.abs(p);
      const scale = 1 + (item.s - 1) * (0.35 + 0.65 * ease);

      item.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
    });
  };

  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    onScroll();
  }, { passive: true });
  update();
}

function setupCanvasResponsive() {
  const mq = window.matchMedia("(min-width: 1200px)");

  let cleanup = null;

  const apply = () => {
    if (cleanup) cleanup();

    if (mq.matches) {
      cleanup = setupCanvasDesktop();   // твой старый setupCanvas, только возвращает cleanup
    } else {
      cleanup = setupCanvasMobileHero(); // новый моб. режим
    }
  };

  mq.addEventListener?.("change", apply);
  apply();

  // на всякий: если нужно снять слушатели при SPA — можно вернуть cleanup
}

function setupCanvasDesktop() {
  const canvases = Array.from(document.querySelectorAll("canvas.canvas:not(.canvas--mobile)"));
  if (!canvases.length) return () => {};

  const ctxs = canvases.map(c => c.getContext("2d")).filter(Boolean);

  let points = [];
  let segLengths = [];
  let totalLength = 0;
  let raf = null;

  function cubicBezier(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const mt2 = mt * mt, t2 = t * t;
    return {
      x: (mt2 * mt) * p0.x + (3 * mt2 * t) * p1.x + (3 * mt * t2) * p2.x + (t2 * t) * p3.x,
      y: (mt2 * mt) * p0.y + (3 * mt2 * t) * p1.y + (3 * mt * t2) * p2.y + (t2 * t) * p3.y,
    };
  }

  function reflect(p, c) {
    return { x: 2 * p.x - c.x, y: 2 * p.y - c.y };
  }

  function buildPathPoints(w, h) {
    const s = Math.min(w, h);

    const rightExit = s * 0.22;
    const spread = s * 0.10;
    const skew = s * 0.02;
    const loopW = s * 0.14;
    const bottomY = h * 0.993;
    const margin = 16;
    const topY = -h * 0.16;
    const crossY = h * 0.36;

    let x = w * 0.9;
    x = Math.max(margin + loopW * 0.9, Math.min(w - margin - loopW * 1.2, x));

    const A = { x: x + spread * 0.2, y: topY };
    const D = { x: x + spread * 0.4 + rightExit, y: topY - h * 0.02 };
    const X = { x: x, y: crossY };
    const B = { x: x + skew, y: bottomY };

    const c1_1 = { x: x - loopW * 0.22, y: h * 0.05 };
    const c2_1 = { x: x - loopW * 0.22, y: crossY - h * 0.24 };

    const c1_2 = reflect(X, c2_1);
    const c2_2 = { x: x + loopW * 1.35, y: B.y - h * 0.06 };

    const c1_3 = reflect(B, c2_2);
    const c2_3 = { x: x - loopW * 1.20, y: crossY + h * 0.24 };

    const c1_4 = reflect(X, c2_3);
    const c2_4 = { x: D.x - loopW * 0.80, y: h * 0.07 };

    const segs = [
      [A, c1_1, c2_1, X],
      [X, c1_2, c2_2, B],
      [B, c1_3, c2_3, X],
      [X, c1_4, c2_4, D],
    ];

    points = [];
    const STEPS = 140;

    for (let si = 0; si < segs.length; si++) {
      const [p0, p1, p2, p3] = segs[si];
      for (let i = 0; i <= STEPS; i++) {
        if (si > 0 && i === 0) continue;
        points.push(cubicBezier(p0, p1, p2, p3, i / STEPS));
      }
    }

    segLengths = [];
    totalLength = 0;
    for (let i = 1; i < points.length; i++) {
      const l = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      segLengths.push(l);
      totalLength += l;
    }
  }

  function drawPartial(ctx, w, h, targetLen) {
    ctx.clearRect(0, 0, w, h);
    if (!points.length) return;

    ctx.strokeStyle = "rgba(200, 183, 165, 0.75)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    let acc = 0;
    for (let i = 1; i < points.length; i++) {
      const segLen = segLengths[i - 1];
      if (acc + segLen <= targetLen) {
        ctx.lineTo(points[i].x, points[i].y);
        acc += segLen;
      } else {
        const t = segLen ? (targetLen - acc) / segLen : 0;
        ctx.lineTo(
          points[i - 1].x + (points[i].x - points[i - 1].x) * t,
          points[i - 1].y + (points[i].y - points[i - 1].y) * t
        );
        break;
      }
    }
    ctx.stroke();
  }

  function drawAllByScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 1;
      const len = Math.max(0, Math.min(1, progress)) * totalLength;

      const w = window.innerWidth;
      const h = window.innerHeight;
      for (const ctx of ctxs) drawPartial(ctx, w, h, len);
    });
  }

  function resizeAll() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const canvas of canvases) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
    }

    for (const ctx of ctxs) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildPathPoints(w, h);
    drawAllByScroll();
  }

  window.addEventListener("scroll", drawAllByScroll, { passive: true });
  window.addEventListener("resize", resizeAll);
  resizeAll();

  return () => {
    window.removeEventListener("scroll", drawAllByScroll);
    window.removeEventListener("resize", resizeAll);
  };
}

/* ===== MOBILE: canvas только в HERO, рисуем "сразу", когда HERO видим ===== */
function setupCanvasMobileHero() {
  const canvas = document.querySelector("canvas.canvas--mobile");
  const hero = document.getElementById("top");
  if (!canvas || !hero) return () => {};

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let points = [];
  let segLengths = [];
  let totalLength = 0;

  let raf = 0;
  let w = 1, h = 1;
  let dpr = 1;
  let drawP = 0;        // 0..1 прогресс дорисовки
  let done = false;     // дорисовано ли
  let locked = false;   // сейчас блокируем скролл
  let accPx = 0;        // накопленные "пиксели" жеста
  let touchY = null;
  let savedScrollY = 0;

  const DRAW_SCROLL_PX = 420;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function cubicBezier(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const mt2 = mt * mt, t2 = t * t;
    return {
      x: (mt2 * mt) * p0.x + (3 * mt2 * t) * p1.x + (3 * mt * t2) * p2.x + (t2 * t) * p3.x,
      y: (mt2 * mt) * p0.y + (3 * mt2 * t) * p1.y + (3 * mt * t2) * p2.y + (t2 * t) * p3.y,
    };
  }

  function reflect(p, c) { return { x: 2 * p.x - c.x, y: 2 * p.y - c.y }; }

  function buildPathPoints(W, H) {
    // строим ПОД “вертикальный” путь (как раньше), но потом повернём ctx
    const s = w

    const rightExit = s * 0.2;
    const spread = s * 0.10;
    const skew = s * 0.02;
    const loopW = s * 0.14;
    const bottomY = H * 0.993;
    const margin = 16;
    const topY = -H * 0.16;
    const crossY = H * 0.36;

    let x = W * 1.2
    x = Math.max(margin + loopW * 0.99, Math.min(W - margin - loopW * 1.2, x));

    const A = { x: x + spread * 0.2, y: topY };
    const D = { x: x + spread * 0.4 + rightExit, y: topY - H * 0.02 };
    const X = { x: x, y: crossY };
    const B = { x: x + skew, y: bottomY };

    const c1_1 = { x: x - loopW * 0.22, y: H * 0.05 };
    const c2_1 = { x: x - loopW * 0.22, y: crossY - H * 0.24 };

    const c1_2 = reflect(X, c2_1);
    const c2_2 = { x: x + loopW * 1.4, y: B.y - H * 0.06 };

    const c1_3 = reflect(B, c2_2);
    const c2_3 = { x: x - loopW * 1.20, y: crossY + H * 0.24 };

    const c1_4 = reflect(X, c2_3);
    const c2_4 = { x: D.x - loopW * 0.80, y: H * 0.07 };

    const segs = [
      [A, c1_1, c2_1, X],
      [X, c1_2, c2_2, B],
      [B, c1_3, c2_3, X],
      [X, c1_4, c2_4, D],
    ];

    points = [];
    const STEPS = 120;
    for (let si = 0; si < segs.length; si++) {
      const [p0, p1, p2, p3] = segs[si];
      for (let i = 0; i <= STEPS; i++) {
        if (si > 0 && i === 0) continue;
        points.push(cubicBezier(p0, p1, p2, p3, i / STEPS));
      }
    }

    segLengths = [];
    totalLength = 0;
    for (let i = 1; i < points.length; i++) {
      const l = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      segLengths.push(l);
      totalLength += l;
    }
  }

  function drawPartial(targetLen) {
    ctx.clearRect(0, 0, w, h);
    if (!points.length) return;

    ctx.save();

    ctx.translate(0, h);
    ctx.rotate(-Math.PI / 2);

    // ⚠️ padding чтобы stroke не резался
    const pad = Math.ceil((ctx.lineWidth || 4) * 2.5); // под 3-4px хватает
    ctx.translate(pad, pad);

    ctx.strokeStyle = "rgba(200, 183, 165, 0.75)";
    ctx.lineWidth = 4;               // можно 3-4
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    let acc = 0;
    for (let i = 1; i < points.length; i++) {
      const segLen = segLengths[i - 1];
      if (acc + segLen <= targetLen) {
        ctx.lineTo(points[i].x, points[i].y);
        acc += segLen;
      } else {
        const t = segLen ? (targetLen - acc) / segLen : 0;
        ctx.lineTo(
          points[i - 1].x + (points[i].x - points[i - 1].x) * t,
          points[i - 1].y + (points[i].y - points[i - 1].y) * t
        );
        break;
      }
    }
    ctx.stroke();

    ctx.restore();
  }


  function lockPage() {
    if (locked || done) return;
    savedScrollY = window.scrollY || window.pageYOffset || 0;

    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockPage() {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";

    window.scrollTo(0, savedScrollY);
  }


  function lockScroll() {
    if (locked || done) return;
    locked = true;

    lockPage();

    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overscrollBehavior = "none";
  }

  function unlockScroll() {
    if (!locked) return;
    locked = false;
    done = true;

    document.documentElement.style.overscrollBehavior = "";
    document.body.style.overscrollBehavior = "";

    unlockPage();
  }

  function consumeDelta(deltaPx) {
    if (done) return;

    accPx = clamp(accPx + deltaPx, 0, DRAW_SCROLL_PX);
    drawP = clamp(accPx / DRAW_SCROLL_PX, 0, 1);

    if (!raf) raf = requestAnimationFrame(update);

    if (drawP >= 1) {
      unlockScroll();
    }
  }

  function onWheel(e) {
    if (done) return;
    if (!heroVisible()) return;

    if (!locked) lockScroll();
    e.preventDefault();
    consumeDelta(e.deltaY);
  }

  function onTouchStart(e) {
    if (done) return;
    if (!heroVisible()) return;

    if (!locked) lockScroll();
    touchY = e.touches?.[0]?.clientY ?? null;
  }

  function onTouchMove(e) {
    if (!locked) return;
    if (done) return;
    if (!heroVisible()) return;
    if (!locked) lockScroll();

    const y = e.touches?.[0]?.clientY ?? null;
    if (touchY == null || y == null) return;

    const delta = touchY - y; // свайп вверх => положительный delta
    touchY = y;

    e.preventDefault();
    consumeDelta(delta);
  }

  function onTouchEnd() {
    touchY = null;
  }

  function heroVisible() {
    const rect = hero.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    return rect.bottom > 0 && rect.top < vh;
  }

  function update() {
    raf = 0;
    drawPartial(totalLength * drawP);
  }

  function onScroll() {
    if (!done && heroVisible()) {
      lockScroll();
      // важно: тут не надо считать прогресс от scrollY
      // прогресс будет идти от wheel/touchmove (consumeDelta)
    }
  }

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });

  function resizeToHero() {
    dpr = window.devicePixelRatio || 1;
    const r = hero.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));

    const pad = 12; // 8-16px
    canvas.width = Math.round((w + pad * 2) * dpr);
    canvas.height = Math.round((h + pad * 2) * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(pad, pad);

    buildPathPoints(h, w);

    update();
    drawP = 0;
    accPx = 0;
    done = false;
    locked = false;
    drawPartial(0);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", resizeToHero);

  resizeToHero();


  return () => {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", resizeToHero);
    unlockScroll();
    if (raf) cancelAnimationFrame(raf);

  };
}

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function forceTop() {
  // два раза — чтобы перекрыть восстановление браузером после layout
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

window.addEventListener("load", forceTop);
window.addEventListener("pageshow", (e) => {
  // особенно важно для bfcache (Safari/iOS)
  if (e.persisted) forceTop();
});

// ===== init =====
startCountdownAll();
renderCalendar();
setupRSVP();
setupReveal();
setupParallax();
setupToTopOnConfirmation();
setupCanvasResponsive();

