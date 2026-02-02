// ===== CONFIG =====
const WEDDING_DATE_ISO = "2026-06-20T17:00:00";
const pad2 = (n) => String(n).padStart(2, "0");

// ===== countdown  =====
function startCountdownAll(){
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

  function setAll(list, value){
    for(const el of list){
      if(el) el.textContent = value;
    }
  }

  function tick(){
    let diff = Math.max(0, target - Date.now());

    const days = Math.floor(diff / (1000*60*60*24));
    diff -= days * (1000*60*60*24);

    const hours = Math.floor(diff / (1000*60*60));
    diff -= hours * (1000*60*60);

    const mins = Math.floor(diff / (1000*60));
    diff -= mins * (1000*60);

    const secs = Math.floor(diff / 1000);

    setAll(targets.d, String(days));
    setAll(targets.h, pad2(hours));
    setAll(targets.m, pad2(mins));
    setAll(targets.s, pad2(secs));
  }

  tick();
  setInterval(tick, 1000);
}

function dEl(id){ return document.getElementById(id); }

// ===== calendar =====
function renderCalendar(){
  const cal = dEl("calendar");
  if(!cal) return;

  cal.innerHTML = "";
  const YEAR = 2026, MONTH = 6, HIGHLIGHT_DAY = 20;

  const head = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  head.forEach(h=>{
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

  for(let i=0;i<emptyCount;i++){
    const div = document.createElement("div");
    div.className = "cal-day cal-empty";
    cal.appendChild(div);
  }

  for(let day=1; day<=daysInMonth; day++){
    const div = document.createElement("div");
    div.className = "cal-day";
    div.textContent = String(day);
    if(day === HIGHLIGHT_DAY) div.classList.add("cal-mark");
    cal.appendChild(div);
  }
}

// ===== rsvp local =====
function setupRSVP(){
  const form = dEl("rsvpForm");
  if(!form) return;

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    localStorage.setItem("rsvp_" + Date.now(), JSON.stringify(data));
    alert("Спасибо! Ответ сохранён.");
    form.reset();
  });
}

// ===== REVEAL on scroll =====
function setupReveal(){
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Помечаем элементы, которые хотим анимировать
  const els = Array.from(document.querySelectorAll("[data-reveal]"));

  // Если ничего не отмечено — мягкий fallback как было
  if(!els.length){
    const fallback = Array.from(document.querySelectorAll(".container, .hero-inner, .count-cta, .timeline, .dress, .grid-2"));
    fallback.forEach(el => el.classList.add("reveal"));
    if(reduce) { fallback.forEach(el => el.classList.add("is-in")); return; }

    const io = new IntersectionObserver((entries)=>{
      for(const e of entries){
        if(e.isIntersecting) e.target.classList.add("is-in");
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

  if(reduce){
    els.forEach(el => el.classList.add("is-in"));
    return;
  }

  const io = new IntersectionObserver((entries)=>{
    for(const e of entries){
      if(!e.isIntersecting) continue;

      e.target.classList.add("is-in");

      // data-once="true" — анимация только один раз
      if(e.target.dataset.once !== "false"){
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12 });

  els.forEach(el => io.observe(el));
}
// ===== PARALLAX like react-scroll-parallax =====
// Двигаем любые элементы с атрибутами:
// data-parallax-y="60" data-parallax-x="-20" data-parallax-scale="1.06"
function setupParallax(){
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce) return;

  const items = Array.from(document.querySelectorAll(".parallax-item"));
  if(!items.length) return;

  let raf = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const update = () => {
    raf = 0;
    const vh = window.innerHeight || 800;

    for(const el of items){
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height/2;

      // прогресс -1..1 относительно центра экрана
      const t = (mid - vh/2) / (vh/2);
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
    if(raf) return;
    raf = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive:true });
  window.addEventListener("resize", onScroll);
  update();
}

// ===== init =====
startCountdownAll();
renderCalendar();
setupRSVP();
setupReveal();
setupParallax();
