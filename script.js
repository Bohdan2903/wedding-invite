// ===== CONFIG =====
const WEDDING_DATE_ISO = "2026-06-20T17:00:00";
const SCRIPT_URL = ""

const pad2 = (n) => String(n).padStart(2, "0");

// ===== countdown  =====
function startCountdownAll() {
  // поддерживаем и старые id (d/h/m/s), и новые data-ct
  const targets = {
    d: [
      document.getElementById("d"),
      ...document.querySelectorAll('[data-ct="d"]')
    ],
    h: [
      document.getElementById("h"),
      ...document.querySelectorAll('[data-ct="h"]')
    ],
    m: [
      document.getElementById("m"),
      ...document.querySelectorAll('[data-ct="m"]')
    ],
    s: [
      document.getElementById("s"),
      ...document.querySelectorAll('[data-ct="s"]')
    ],
  };

  const target = new Date(WEDDING_DATE_ISO).getTime();

  function setAll(list, value) {
    for (const el of list) {
      if (el) el.textContent = value;
    }
  }

  function tick() {
    let diff = Math.max(0, target - Date.now());

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    diff -= days * (1000 * 60 * 60 * 24);

    const hours = Math.floor(diff / (1000 * 60 * 60));
    diff -= hours * (1000 * 60 * 60);

    const mins = Math.floor(diff / (1000 * 60));
    diff -= mins * (1000 * 60);

    const secs = Math.floor(diff / 1000);

    setAll(targets.d, String(days));
    setAll(targets.h, pad2(hours));
    setAll(targets.m, pad2(mins));
    setAll(targets.s, pad2(secs));
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
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

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
    }
  });
}

// ===== REVEAL on scroll =====
function setupReveal() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Помечаем элементы, которые хотим анимировать
  const els = Array.from(document.querySelectorAll("[data-reveal]"));

  // Если ничего не отмечено — мягкий fallback как было
  if (!els.length) {
    const fallback = Array.from(document.querySelectorAll(".container, .hero-inner, .count-cta, .timeline, .dress, .grid-2"));
    fallback.forEach(el => el.classList.add("reveal"));
    if (reduce) {
      fallback.forEach(el => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.classList.add("is-in");
      }
    }, { threshold: 0.12 });

    fallback.forEach(el => io.observe(el));
    return;
  }

  // Основной AOS-like режим
  els.forEach(el => {
    el.classList.add("reveal");
    const delay = el.dataset.delay ? `${Number(el.dataset.delay)}ms` : "0ms";
    el.style.setProperty("--reveal-delay", delay);
  });

  if (reduce) {
    els.forEach(el => el.classList.add("is-in"));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;

      e.target.classList.add("is-in");

      // data-once="true" — анимация только один раз
      if (e.target.dataset.once !== "false") {
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12 });

  els.forEach(el => io.observe(el));
}

// ===== PARALLAX like react-scroll-parallax =====
// Двигаем любые элементы с атрибутами:
// data-parallax-y="60" data-parallax-x="-20" data-parallax-scale="1.06"
function setupParallax() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const items = Array.from(document.querySelectorAll(".parallax-item"));
  if (!items.length) return;

  let raf = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const update = () => {
    raf = 0;
    const vh = window.innerHeight || 800;

    for (const el of items) {
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;

      // прогресс -1..1 относительно центра экрана
      const t = (mid - vh / 2) / (vh / 2);
      const p = clamp(t, -1, 1);

      const y = Number(el.dataset.parallaxY || 0) * p;
      const x = Number(el.dataset.parallaxX || 0) * p;
      const s = Number(el.dataset.parallaxScale || 1);

      // чуть усиливаем эффект ближе к центру
      const ease = 1 - Math.abs(p);
      const scale = 1 + (s - 1) * (0.35 + 0.65 * ease);

      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    }
  };

  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
}

function setupCanvas() {
  const canvas = document.getElementById("symbolCanvas");
  const ctx = canvas.getContext("2d");

  let points = [];
  let segLengths = [];
  let totalLength = 0;
  let raf = null;

  const STEPS_PER_SEG = 70;

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

  // Catmull-Rom spline -> chain of cubic beziers (smooth, no sharp corners)
  function catmullRomToBeziers(P, tension = 0.55) {
    const segs = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i];
      const p1 = P[i];
      const p2 = P[i + 1];
      const p3 = P[i + 2] || P[i + 1];

      const c1 = {
        x: p1.x + (p2.x - p0.x) * (tension / 6),
        y: p1.y + (p2.y - p0.y) * (tension / 6),
      };
      const c2 = {
        x: p2.x - (p3.x - p1.x) * (tension / 6),
        y: p2.y - (p3.y - p1.y) * (tension / 6),
      };

      segs.push([p1, c1, c2, p2]);
    }
    return segs;
  }

  function buildPathPoints() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw, vh);

    const topSlant = s * 0.14;
    const rightExit = s * 0.22;  // насколько правая нить уходит вправо в конце (0.14–0.30)

    const spread = s * 0.10;    // расстояние между верхними “нитями”
    const skew = s * 0.02;    // лёгкий сдвиг капли вправо
    const loopW = s * 0.11;      // было 0.14 (уже капля)
    const bottomY = vh * 0.997;
    const margin = 16;
    const topY = -vh * 0.16;
    const crossY = vh * 0.36;

    let x = vw * 0.9;       // правее
    // позиция символа по X (как у тебя справа, но не даём уйти за край)
    x = Math.max(margin + loopW * 0.9, Math.min(vw - margin - loopW * 1.2, x));


    // точки
    const A = { x: x + spread * 0.2, y: topY };                 // верх слева
    const D = { x: x + spread * 0.4 + rightExit, y: topY - vh * 0.02 }; // конец сверху уходит вправо
    const X = { x: x, y: crossY };
    const B = { x: x + skew, y: bottomY };

// 1) A -> X (левая нить сверху вниз) — делаем плавный загиб как в рефе
    const c1_1 = { x: D.x - topSlant * 0.8, y: vh * 0.05 };
    const c2_1 = { x: x - loopW * 0.22,     y: crossY - vh * 0.24 };

// 2) X -> B
    const c1_2 = reflect(X, c2_1);
    const c2_2 = { x: x + loopW * 1.05, y: B.y + vh * 0.01 };

// 3) B -> X — левая сторона петли (меньше влево, чуть глубже вниз)

    const c1_3 = reflect(B, c2_2);
    const c2_3 = { x: x - loopW * 0.65, y: crossY + vh * 0.28 };

// 4) X -> D (правая нить вверх) — уводим вправо на выходе
    const c1_4 = reflect(X, c2_3);
    const c2_4 = { x: D.x - topSlant * 0.8, y: vh * 0.1 }; // касательная направлена к D вправо

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


  function drawPartial(targetLen) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

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

  function drawByScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 1;
      drawPartial(Math.max(0, Math.min(1, progress)) * totalLength);
    });
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    // рисуем в CSS-пикселях
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildPathPoints();
    drawByScroll();
  }

  window.addEventListener("scroll", drawByScroll, { passive: true });
  window.addEventListener("resize", resize);
  resize();
}


// ===== init =====
startCountdownAll();
renderCalendar();
setupRSVP();
setupReveal();
setupParallax();
setupCanvas();
