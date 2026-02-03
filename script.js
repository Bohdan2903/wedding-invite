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

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    // Используем только часть ширины, если нужно, но здесь на весь вьюпорт
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildPathPoints();
    drawByScroll();
  }

  function cubicBezier(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const mt2 = mt * mt, t2 = t * t;
    return {
      x: (mt2 * mt) * p0.x + (3 * mt2 * t) * p1.x + (3 * mt * t2) * p2.x + (t2 * t) * p3.x,
      y: (mt2 * mt) * p0.y + (3 * mt2 * t) * p1.y + (3 * mt * t2) * p2.y + (t2 * t) * p3.y,
    };
  }

  function buildPathPoints() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Основная вертикальная ось (справа)
    const xBase = vw * 0.85;
    // Ширина петли
    const loopWidth = vw * 0.25;

    const segs = [
      // 1. НАЧАЛО: Практически прямая вертикальная линия ("Школа")
      // Контрольные точки выстроены в линию, чтобы изгиб был едва заметен
      [
        { x: xBase - loopWidth * 0.2, y: -vh * 0.1 },
        { x: xBase - 15, y: vh * 0.2 },
        { x: xBase, y: vh * 0.4 },
        { x: xBase, y: vh * 0.5 } // Легкое отклонение перед началом петли
      ],
      // 2. ПЕРЕХОД: Плавный уход вправо и глубокий "нырок" вниз
      [
        { x: xBase + loopWidth * 0.2, y: vh * 0.65 },
        { x: xBase + loopWidth * 0.3, y: vh * 0.7 },
        { x: xBase + loopWidth * 0.8, y: vh * 0.82 }, // Самая правая нижняя точка (за краем)
        { x: xBase + loopWidth * 0.1, y: vh * 0.92 } // Возврат к центру
      ],
      // 3. ПЕТЛЯ (∞): Резкий разворот влево и перехлест вверх
      // Эта часть создает тот самый каллиграфический узел
      [
        { x: xBase + loopWidth * 0.1, y: vh * 0.92 },
        { x: xBase - loopWidth * 0.6, y: vh * 0.82 }, // Левое "ушко" петли
        { x: xBase - loopWidth * 0.2, y: vh * 0.7 }, // Точка перехлеста (на стержне)
        { x: xBase + loopWidth * 0.6, y: vh * 0.25 }  // Финальный взмах вправо-вверх
      ]
    ];

    points = [];
    const STEPS = 300; // Высокая детализация для плавности

    for (const s of segs) {
      for (let i = 0; i <= STEPS; i++) {
        points.push(cubicBezier(s[0], s[1], s[2], s[3], i / STEPS));
      }
    }

    // Расчет длин сегментов (оставляем без изменений)
    segLengths = [];
    totalLength = 0;
    for (let i = 1; i < points.length; i++) {
      const l = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      segLengths.push(l);
      totalLength += l;
    }
  }

  function drawPartial(targetLen) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(200, 183, 165, 0.75)"; // Чуть прозрачнее
    ctx.lineWidth = 2.4; // Тоньше — значит изящнее
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
        const t = (targetLen - acc) / segLen;
        ctx.lineTo(
          points[i - 1].x + (points[i].x - points[i - 1].x) * t,
          points[i - 1].y + (points[i].y - points[i - 1].y) * t
        );
        break;
      }
    }
    ctx.stroke();
  }

  let raf = null;

  function drawByScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.max(0, Math.min(1, scrollY / maxScroll));
      drawPartial(progress * totalLength);
    });
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
