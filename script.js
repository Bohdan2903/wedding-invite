// ===== CONFIG =====
const WEDDING_DATE_ISO = "2026-06-20T17:00:00";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx_05Q7dhmUf7OWXGqFeSBtA7bfPNTjgWgrJalzVeTOZLccK3CvwtXV0oJr_kJ8bl7z/exec"

const pad2 = (n) => String(n).padStart(2, "0");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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

function showPrettyAlert(message, type = "success") {
  const prev = document.querySelector(".pretty-alert");
  if (prev) prev.remove();

  const node = document.createElement("div");
  node.className = `pretty-alert is-${type}`;
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.innerHTML = `
    <div class="pretty-alert__inner">
      <div class="pretty-alert__icon">${type === "success" ? "✓" : "!"}</div>
      <div class="pretty-alert__text">${message}</div>
      <button class="pretty-alert__close" type="button" aria-label="Закрыть">✕</button>
    </div>
  `;

  const close = () => {
    node.classList.remove("is-visible");
    setTimeout(() => node.remove(), 220);
  };

  node.querySelector(".pretty-alert__close")?.addEventListener("click", close);
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add("is-visible"));
  setTimeout(close, 3800);
}

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
  const status = document.getElementById("rsvpStatus");
  if (!form || !button || !status) return;

  const initialButtonText = button.textContent.trim();

  const setStatus = (text = "", type = "") => {
    status.textContent = text;
    status.className = "rsvp-feedback";
    if (type) status.classList.add(`is-${type}`);
  };

  const markFieldState = () => {
    const fields = Array.from(form.querySelectorAll("input[required], select[required], textarea[required]"));
    fields.forEach((field) => {
      if (field.checkValidity()) field.removeAttribute("aria-invalid");
      else field.setAttribute("aria-invalid", "true");
    });
  };

  form.addEventListener("input", () => {
    setStatus("");
    markFieldState();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (button.dataset.sent === "true") return;

    const attendValue = form.elements.attend?.value || "";
    const isValid = form.checkValidity() && Boolean(attendValue);

    markFieldState();

    if (!isValid) {
      setStatus("Проверьте обязательные поля перед отправкой.", "error");
      form.reportValidity();
      return;
    }

    button.disabled = true;
    button.textContent = "Отправляем...";
    form.setAttribute("aria-busy", "true");
    setStatus("");

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

      setStatus("");
      showPrettyAlert("Спасибо! Мы получили ваш ответ 💛", "success");
      button.textContent = "Отправлено";
      button.disabled = true;
      button.dataset.sent = "true";
      form.setAttribute("aria-busy", "false");
    } catch (err) {
      setStatus("Не удалось отправить форму. Проверьте интернет и попробуйте ещё раз.", "error");
      button.textContent = initialButtonText;
      button.disabled = false;
      form.setAttribute("aria-busy", "false");
      console.error(err);
    }
  });
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

function setupSectionNav() {
  const links = Array.from(document.querySelectorAll(".site-nav__links a[href^='#']"));
  if (!links.length) return;

  const map = links
    .map((link) => ({ link, section: document.querySelector(link.getAttribute("href")) }))
    .filter((item) => item.section);

  if (!map.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const found = map.find((item) => item.section === entry.target);
      if (!found) return;
      map.forEach(({ link }) => link.removeAttribute("aria-current"));
      found.link.setAttribute("aria-current", "true");
    });
  }, { threshold: 0.45, rootMargin: "-20% 0px -55% 0px" });

  map.forEach(({ section }) => io.observe(section));
}

function setupGalleryLightbox() {
  const images = Array.from(document.querySelectorAll(".js-gallery-image"));
  const lightbox = document.getElementById("lightbox");
  if (!images.length || !lightbox) return;

  const dialog = lightbox.querySelector(".lightbox__dialog");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const closeBtn = lightbox.querySelector("[data-lb-close]");
  const prevBtn = lightbox.querySelector("[data-lb-prev]");
  const nextBtn = lightbox.querySelector("[data-lb-next]");
  if (!dialog || !lightboxImage || !lightboxCaption || !closeBtn || !prevBtn || !nextBtn) return;

  let currentIndex = 0;
  let lastFocused = null;
  let touchStartX = 0;
  let touchStartY = 0;

  const cards = images.map((img) => img.closest(".photo-card")).filter(Boolean);
  cards.forEach((card, index) => {
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "Открыть фото");
    card.dataset.galleryIndex = String(index);
  });

  const getCaption = (img) => img.closest(".photo-card")?.querySelector("figcaption")?.textContent?.trim() || "";

  const update = () => {
    const img = images[currentIndex];
    lightboxImage.src = img.currentSrc || img.src;
    lightboxImage.alt = img.alt || "";
    lightboxCaption.textContent = getCaption(img);
  };

  const focusables = () => Array.from(dialog.querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])"));

  const open = (index) => {
    currentIndex = (index + images.length) % images.length;
    update();
    lastFocused = document.activeElement;
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  };

  const close = () => {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  };

  const prev = () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    update();
  };

  const next = () => {
    currentIndex = (currentIndex + 1) % images.length;
    update();
  };

  images.forEach((img, index) => {
    img.addEventListener("click", () => open(index));
    const card = img.closest(".photo-card");
    card?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(index);
      }
    });
  });

  lightbox.addEventListener("click", (e) => {
    if (e.target.matches("[data-lb-close]")) close();
  });

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  dialog.addEventListener("touchstart", (e) => {
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  dialog.addEventListener("touchend", (e) => {
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) prev();
      else next();
    }
  }, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;

    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
      return;
    }

    if (e.key === "Tab") {
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
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

  const itemByEl = new Map(items.map(item => [item.el, item]));

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const item = itemByEl.get(entry.target);
      if (item) item.visible = entry.isIntersecting;
    });
  }, { threshold: 0 });

  items.forEach(item => io.observe(item.el));

  let raf = 0;
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
      cleanup = setupCanvasDesktop();
    } else {
      cleanup = setupCanvasMobileHero();
    }
  };

  const onChange = () => apply();
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange);
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
  let raf = 0;
  let resizeRaf = 0;
  let lastLen = -1;
  let viewW = 0;
  let viewH = 0;

  function getCanvasTopOffset() {
    const nav = document.querySelector(".site-nav");
    if (!nav) return 0;
    return Math.max(0, Math.round(nav.getBoundingClientRect().height));
  }

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
      raf = 0;
      if (document.hidden) return;

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 1;
      const len = Math.max(0, Math.min(1, progress)) * totalLength;

      if (Math.abs(len - lastLen) < 0.8) return;
      lastLen = len;

      for (const ctx of ctxs) drawPartial(ctx, viewW, viewH, len);
    });
  }

  function resizeAll() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const topOffset = getCanvasTopOffset();
    const h = Math.max(1, window.innerHeight - topOffset);
    viewW = w;
    viewH = h;

    for (const canvas of canvases) {
      const nextW = Math.round(w * dpr);
      const nextH = Math.round(h * dpr);

      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }

      canvas.style.top = `${topOffset}px`;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
    }

    for (const ctx of ctxs) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildPathPoints(w, h);
    lastLen = -1;
    drawAllByScroll();
  }

  function onResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      resizeAll();
    });
  }

  window.addEventListener("scroll", drawAllByScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", drawAllByScroll);
  resizeAll();

  return () => {
    window.removeEventListener("scroll", drawAllByScroll);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", drawAllByScroll);
    if (raf) cancelAnimationFrame(raf);
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
  };
}

/* ===== MOBILE: canvas only in HERO, autoplay on page entry ===== */
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
  let delayTimer = 0;
  let w = 1, h = 1;
  let dpr = 1;
  let drawP = 0;
  let animationStarted = false;
  let animationDone = false;
  let animationStartTs = 0;
  let bleedX = 0;
  let bleedY = 0;

  const START_DELAY_MS = 600;
  const DRAW_DURATION_MS = 1400;
  const MOBILE_CANVAS_TILT = -8 * Math.PI / 180;
  const MOBILE_CANVAS_WIDTH_TRIM = 12;

  function getMobileCanvasVisuals() {
    const isTablet = window.innerWidth >= 600;
    return {
      scale: isTablet ? 1.15 : 1.12,
      shiftX: isTablet ? window.innerWidth * 0.02 : window.innerHeight * 0.05,
    };
  }

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
    const s = Math.min(W, H);

    const rightExit = s * 0.2;
    const spread = s * 0.10;
    const skew = s * 0.02;
    const loopW = s * 0.14;
    const bottomY = H * 0.993;
    const margin = 16;
    const topY = -H * 0.16;
    const crossY = H * 0.36;

    let x = W * 1.2;
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
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    if (!points.length) return;

    ctx.save();
    const { scale } = getMobileCanvasVisuals();

    ctx.translate(bleedX, bleedY);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(MOBILE_CANVAS_TILT);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);
    ctx.translate(0, h);
    ctx.rotate(-Math.PI / 2);

    const pad = Math.ceil((ctx.lineWidth || 4) * 2.5);
    ctx.translate(pad, pad);

    ctx.strokeStyle = "rgba(200, 183, 165, 0.75)";
    ctx.lineWidth = 4;
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

  function renderCurrentFrame() {
    drawPartial(totalLength * drawP);
  }

  function animateDraw(ts) {
    if (!animationStartTs) animationStartTs = ts;

    drawP = clamp((ts - animationStartTs) / DRAW_DURATION_MS, 0, 1);
    renderCurrentFrame();

    if (drawP >= 1) {
      raf = 0;
      animationDone = true;
      return;
    }

    raf = requestAnimationFrame(animateDraw);
  }

  function startAnimation() {
    if (animationStarted) return;
    animationStarted = true;

    delayTimer = window.setTimeout(() => {
      delayTimer = 0;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        drawP = 1;
        animationDone = true;
        renderCurrentFrame();
        return;
      }

      if (animationDone) return;
      animationStartTs = 0;
      raf = requestAnimationFrame(animateDraw);
    }, START_DELAY_MS);
  }

  function resizeToHero() {
    dpr = window.devicePixelRatio || 1;
    const r = hero.getBoundingClientRect();
    const { scale, shiftX } = getMobileCanvasVisuals();
    const cos = Math.cos(MOBILE_CANVAS_TILT);
    const sin = Math.sin(MOBILE_CANVAS_TILT);

    w = Math.max(1, Math.round(window.innerWidth - MOBILE_CANVAS_WIDTH_TRIM));
    h = Math.max(1, Math.round(r.height));

    const rotatedW = scale * (Math.abs(w * cos) + Math.abs(h * sin));
    const rotatedH = scale * (Math.abs(w * sin) + Math.abs(h * cos));
    bleedX = Math.max(32, Math.ceil((rotatedW - w) / 2) + 16);
    bleedY = Math.max(32, Math.ceil((rotatedH - h) / 2) + 16);

    canvas.width = Math.round((w + bleedX * 2) * dpr);
    canvas.height = Math.round((h + bleedY * 2) * dpr);
    canvas.style.width = `${w + bleedX * 2}px`;
    canvas.style.height = `${h + bleedY * 2}px`;
    canvas.style.left = `${Math.round(shiftX - bleedX)}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildPathPoints(h, w);
    renderCurrentFrame();
  }

  window.addEventListener("resize", resizeToHero);

  resizeToHero();
  startAnimation();

  return () => {
    window.removeEventListener("resize", resizeToHero);
    if (delayTimer) clearTimeout(delayTimer);
    if (raf) cancelAnimationFrame(raf);
  };
}

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function forceTop() {
  if (window.location.hash) return;
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
setupSectionNav();
setupReveal();
setupParallax();
setupToTopOnConfirmation();
setupCanvasResponsive();
setupGalleryLightbox();
