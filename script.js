/* ================================================================
   CONFIG
   ================================================================ */
const CONFIG = {
  colors: {
    gold: '212, 175, 55',      // D4AF37 as rgb
    cream: '246, 241, 233',    // F6F1E9
    nebulaBlue: '16, 21, 43',  // 10152B
    nebulaPurple: '78, 30, 70' // muted purple-plum
  },
  stars: {
    layer1: { count: 160, minR: 0.4, maxR: 1.0, parallax: 0.006 }, // tiny, far
    layer2: { count: 85,  minR: 1.0, maxR: 1.8, parallax: 0.016 }, // medium, twinkling
    layer3: { count: 32,  minR: 1.8, maxR: 3.0, parallax: 0.036 }  // large, golden, near
  },
  dust: { count: 55, speed: 0.06 },
  shootingStar: { minInterval: 4000, maxInterval: 8000, speed: 9 },
  starBirthDuration: 5 // seconds for the galaxy to "be born"
};

/* ================================================================
   STATE
   ================================================================ */
const state = {
  w: 0, h: 0, dpr: Math.min(window.devicePixelRatio || 1, 2),
  time: 0,
  mouseX: 0, mouseY: 0,        // smoothed
  targetMouseX: 0, targetMouseY: 0,
  starProgress: 0,             // 0 -> 1 during birth sequence, drives star fade-in
  brightness: 1,               // global multiplier, boosted during pulses
  pulse: 0,                    // 0 -> 1 -> 0 for the celebration pulse
  shootingStarsEnabled: false
};

/* ================================================================
   CANVAS ENGINE
   ================================================================ */
const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');

function resize() {
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  canvas.width = state.w * state.dpr;
  canvas.height = state.h * state.dpr;
  canvas.style.width = state.w + 'px';
  canvas.style.height = state.h + 'px';
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}
window.addEventListener('resize', resize);

window.addEventListener('mousemove', (e) => {
  state.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;   // -1 .. 1
  state.targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
});

/* ================================================================
   STARS
   ================================================================ */
function makeStarField(layerConfig, isGold) {
  const stars = [];
  for (let i = 0; i < layerConfig.count; i++) {
    stars.push({
      x: Math.random(),                 // fraction of width
      y: Math.random(),                 // fraction of height
      r: layerConfig.minR + Math.random() * (layerConfig.maxR - layerConfig.minR),
      baseOpacity: 0.35 + Math.random() * 0.55,
      twinkleSpeed: 0.4 + Math.random() * 1.1,
      twinklePhase: Math.random() * Math.PI * 2,
      appearAt: Math.random(),          // when in the birth sequence (0..1) this star fades in
      gold: isGold
    });
  }
  return stars;
}

const starLayer1 = makeStarField(CONFIG.stars.layer1, false);
const starLayer2 = makeStarField(CONFIG.stars.layer2, false);
const starLayer3 = makeStarField(CONFIG.stars.layer3, true);

/* ---- EASTER EGG: a "wishing star" hidden among the real ones ----
   It lives in layer3 (gold, parallax) but pulses a little brighter
   and slower than its neighbours, so an attentive eye can find it. */
const wishingStar = {
  x: 0.86, y: 0.18,
  r: 2.4,
  baseOpacity: 0.85,
  twinkleSpeed: 0.25,
  twinklePhase: 0,
  appearAt: 0.15,
  gold: true,
  isWish: true
};
starLayer3.push(wishingStar);
let eggFound = false;

function findEggScreenPos() {
  const parallax = CONFIG.stars.layer3.parallax;
  const offsetX = state.mouseX * parallax * state.w;
  const offsetY = state.mouseY * parallax * state.h;
  return { x: wishingStar.x * state.w + offsetX, y: wishingStar.y * state.h + offsetY };
}

function drawStarLayer(stars, parallax) {
  const offsetX = state.mouseX * parallax * state.w;
  const offsetY = state.mouseY * parallax * state.h;

  for (const s of stars) {
    const appearFactor = clamp((state.starProgress - s.appearAt) / 0.06, 0, 1);
    if (appearFactor <= 0) continue;

    const twinkle = 0.6 + 0.4 * Math.sin(state.time * s.twinkleSpeed + s.twinklePhase);
    let opacity = s.baseOpacity * twinkle * appearFactor * state.brightness;
    opacity += state.pulse * 0.25;
    opacity = clamp(opacity, 0, 1);
    if (opacity <= 0.01) continue;

    const x = s.x * state.w + offsetX;
    const y = s.y * state.h + offsetY;
    const color = s.gold ? CONFIG.colors.gold : CONFIG.colors.cream;

    // soft glow for larger / gold stars
    if (s.r > 1.4) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, s.r * 5);
      glow.addColorStop(0, `rgba(${color}, ${opacity * 0.35})`);
      glow.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, s.r * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (s.isWish) {
      const haloPulse = 0.5 + 0.5 * Math.sin(state.time * 0.6);
      const halo = ctx.createRadialGradient(x, y, 0, x, y, s.r * 9);
      halo.addColorStop(0, `rgba(${color}, ${0.12 + haloPulse * 0.08})`);
      halo.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, s.r * 9, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.fillStyle = `rgba(${color}, ${opacity})`;
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ================================================================
   NEBULA + MILKY WAY (soft, almost invisible background glow)
   ================================================================ */
function drawNebula() {
  const breathe = 0.5 + 0.5 * Math.sin(state.time * 0.05);

  const g1 = ctx.createRadialGradient(
    state.w * 0.25, state.h * 0.35, 0,
    state.w * 0.25, state.h * 0.35, state.w * 0.55
  );
  g1.addColorStop(0, `rgba(${CONFIG.colors.nebulaPurple}, ${0.10 + breathe * 0.03})`);
  g1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, state.w, state.h);

  const g2 = ctx.createRadialGradient(
    state.w * 0.75, state.h * 0.65, 0,
    state.w * 0.75, state.h * 0.65, state.w * 0.6
  );
  g2.addColorStop(0, `rgba(${CONFIG.colors.nebulaBlue}, ${0.16 + (1 - breathe) * 0.04})`);
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, state.w, state.h);

  // faint touch of gold deep in the nebula
  const g3 = ctx.createRadialGradient(
    state.w * 0.5, state.h * 0.5, 0,
    state.w * 0.5, state.h * 0.5, state.w * 0.3
  );
  g3.addColorStop(0, `rgba(${CONFIG.colors.gold}, ${0.03 * state.brightness})`);
  g3.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g3;
  ctx.fillRect(0, 0, state.w, state.h);
}

function drawMilkyWay() {
  ctx.save();
  ctx.translate(state.w * 0.5, state.h * 0.5);
  ctx.rotate(-0.35); // diagonal band
  const bandLength = Math.max(state.w, state.h) * 1.6;
  const band = ctx.createLinearGradient(0, -80, 0, 80);
  band.addColorStop(0, 'rgba(246, 241, 233, 0)');
  band.addColorStop(0.5, `rgba(246, 241, 233, ${0.05 * state.starProgress})`);
  band.addColorStop(1, 'rgba(246, 241, 233, 0)');
  ctx.fillStyle = band;
  ctx.fillRect(-bandLength / 2, -80, bandLength, 160);
  ctx.restore();
}

/* ================================================================
   FLOATING DUST
   ================================================================ */
const dustParticles = [];
function initDust() {
  dustParticles.length = 0;
  for (let i = 0; i < CONFIG.dust.count; i++) {
    dustParticles.push({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.2,
      opacity: 0.05 + Math.random() * 0.25,
      speed: (0.2 + Math.random() * 0.8) * CONFIG.dust.speed
    });
  }
}

function drawDust(dt) {
  for (const d of dustParticles) {
    d.y -= d.speed * dt * 0.001;
    if (d.y < -0.02) d.y = 1.02;

    const x = d.x * state.w + state.mouseX * 4;
    const y = d.y * state.h;
    const opacity = d.opacity * state.starProgress * state.brightness;
    if (opacity <= 0.01) continue;

    ctx.beginPath();
    ctx.fillStyle = `rgba(${CONFIG.colors.gold}, ${opacity})`;
    ctx.arc(x, y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ================================================================
   SHOOTING STARS
   ================================================================ */
const shootingStars = [];
let nextShootingStarAt = Infinity;

function scheduleNextShootingStar() {
  const { minInterval, maxInterval } = CONFIG.shootingStar;
  nextShootingStarAt = state.time * 1000 + minInterval + Math.random() * (maxInterval - minInterval);
}

function spawnShootingStar(bright = false) {
  const startX = Math.random() * state.w * 0.6 + state.w * 0.2;
  const startY = Math.random() * state.h * 0.25;
  const angle = (Math.PI / 4) + (Math.random() * 0.3 - 0.15);
  const speed = CONFIG.shootingStar.speed * (bright ? 1.4 : 1);

  shootingStars.push({
    x: startX, y: startY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: 60 + Math.random() * 30,
    length: bright ? 140 : 90,
    bright
  });
}

function updateAndDrawShootingStars(dt) {
  if (state.shootingStarsEnabled && state.time * 1000 >= nextShootingStarAt) {
    spawnShootingStar(false);
    scheduleNextShootingStar();
  }

  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const s = shootingStars[i];
    s.x += s.vx * dt * 0.06;
    s.y += s.vy * dt * 0.06;
    s.life++;

    const lifeFrac = s.life / s.maxLife;
    const fade = 1 - lifeFrac;
    if (fade <= 0) { shootingStars.splice(i, 1); continue; }

    const tailX = s.x - s.vx * s.length * 0.02;
    const tailY = s.y - s.vy * s.length * 0.02;

    const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
    grad.addColorStop(0, 'rgba(246, 241, 233, 0)');
    grad.addColorStop(1, `rgba(${CONFIG.colors.cream}, ${0.8 * fade})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = s.bright ? 2.2 : 1.4;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();

    // glowing head
    ctx.beginPath();
    ctx.fillStyle = `rgba(${CONFIG.colors.gold}, ${fade})`;
    ctx.arc(s.x, s.y, s.bright ? 2.6 : 1.8, 0, Math.PI * 2);
    ctx.fill();
    
    // tiny breakaway particles
    if (Math.random() < 0.5) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${CONFIG.colors.gold}, ${fade * 0.6})`;
      const px = tailX + (Math.random() - 0.5) * 6;
      const py = tailY + (Math.random() - 0.5) * 6;
      ctx.arc(px, py, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    if (s.x > state.w + 100 || s.y > state.h + 100) shootingStars.splice(i, 1);
  }
}

/* ================================================================
   Confetti
   ================================================================ */

const colors=[
"#FFD700",
"#F7C873",
"#FF5C8A",
"#7EE8FA",
"#FFFFFF",
"#CFA15C"
];

function createConfetti(x,y){

    const piece=document.createElement("div");

    piece.className="confetti";

    piece.style.left=x+"px";
    piece.style.top=y+"px";

    piece.style.background=
        colors[
            Math.floor(
                Math.random()*colors.length
            )
        ];

    piece.style.width=
        (4+Math.random()*8)+"px";

    piece.style.height=
        (8+Math.random()*12)+"px";

    piece.style.opacity=
        .7+Math.random()*.3;

    piece.style.setProperty(
        "--drift",
        (Math.random()*300-150)+"px"
    );

    piece.style.setProperty(
        "--rotate",
        (Math.random()*1080-540)+"deg"
    );

    piece.style.animation=
        "fall "
        +(3+Math.random()*2)
        +"s linear forwards";

    document.body.appendChild(piece);

    piece.addEventListener(
        "animationend",
        ()=>piece.remove()
    );

}

function confettiRain(){

    for(let i=0;i<200;i++){

        setTimeout(()=>{

            createConfetti(

                Math.random()*window.innerWidth,

                -20

            );

        },i*15);

    }

}


/* ================================================================
   RENDERER — single requestAnimationFrame loop
   ================================================================ */
let lastFrame = performance.now();

function render(now) {
  const dt = Math.min(now - lastFrame, 50); // clamp to avoid big jumps on tab switch
  lastFrame = now;
  state.time += dt * 0.001;

  // smooth mouse parallax
  state.mouseX += (state.targetMouseX - state.mouseX) * 0.04;
  state.mouseY += (state.targetMouseY - state.mouseY) * 0.04;

  ctx.clearRect(0, 0, state.w, state.h);

  drawNebula();
  drawMilkyWay();
  drawDust(dt);
  drawStarLayer(starLayer1, CONFIG.stars.layer1.parallax);
  drawStarLayer(starLayer2, CONFIG.stars.layer2.parallax);
  drawStarLayer(starLayer3, CONFIG.stars.layer3.parallax);
  updateAndDrawShootingStars(dt);

  requestAnimationFrame(render);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ================================================================
   AUDIO
   ================================================================ */
const bgMusic = document.getElementById('bgMusic');
let musicStarted = false;

function fadeInMusic() {
  if (musicStarted) return;
  musicStarted = true;
  bgMusic.volume = 0;
  bgMusic.play().catch(() => { /* file missing or blocked — fails silently */ });
  gsap.to(bgMusic, { volume: 0.55, duration: 3, ease: 'power1.inOut' });
}

/* ---- small synthesized sound effects (no external files needed) ---- */
let sfxCtx;
function getSfxCtx() {
  if (!sfxCtx) sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (sfxCtx.state === 'suspended') sfxCtx.resume();
  return sfxCtx;
}
function playBlow() {
  try {
    const ctx = getSfxCtx();
    const bufferSize = Math.floor(ctx.sampleRate * 0.3);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    noise.connect(filter); filter.connect(g); g.connect(ctx.destination);
    noise.start();
  } catch (e) { /* audio unavailable — fail silently */ }
}
function playSeal() {
  try {
    const ctx = getSfxCtx();
    const bufferSize = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    noise.connect(filter); filter.connect(g); g.connect(ctx.destination);
    noise.start();
  } catch (e) { /* audio unavailable — fail silently */ }
}
function playChime() {
  try {
    const ctx = getSfxCtx();
    [660, 880, 1320].forEach((freq, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const start = ctx.currentTime + idx * 0.09;
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.16, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      o.connect(g); g.connect(ctx.destination);
      o.start(start); o.stop(start + 0.65);
    });
  } catch (e) { /* audio unavailable — fail silently */ }
}

/* ================================================================
   SCENE CONTROLLER — GSAP master timeline
   ================================================================ */
const messages = [
  'Hey Motu...',
  "Today isn't just another birthday.",
  "It's the day...",
  'The universe gave us someone truly special.'
];

function initTimeline() {
  const msgEl = document.getElementById('messages');
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

  // Scene 1 — black, silence, then the galaxy begins to be born
  tl.to({}, { duration: 1 }); // pure silence
  tl.to(state, {
    starProgress: 1,
    duration: CONFIG.starBirthDuration,
    ease: 'power1.out',
    onStart: () => { state.shootingStarsEnabled = false; }
  }, '<');

  // Scene 2 — messages, one at a time, blur + fade + slight upward drift
  messages.forEach((text) => {
    tl.call(() => { msgEl.textContent = text; });
    tl.fromTo(msgEl,
      { opacity: 0, filter: 'blur(10px)', y: 16 },
      { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.3 }
    );
    tl.to({}, { duration: 1.1 }); // hold / pause
    tl.to(msgEl, { opacity: 0, filter: 'blur(10px)', y: -16, duration: 1.0, ease: 'power2.in' });
    tl.to({}, { duration: 0.3 });
  });

  // Scene 3 — transition: bright shooting star, galaxy brightens and glows
  tl.call(() => {
    state.shootingStarsEnabled = true;
    scheduleNextShootingStar();
    spawnShootingStar(true);
  });
  tl.to(state, { brightness: 1.5, duration: 1.2, ease: 'power2.out' });
  tl.to(state, { brightness: 1.15, duration: 1.0, ease: 'power2.inOut' });

  // Scene 4 — Birthday reveal
  tl.fromTo('#happyBirthday',
    { opacity: 0, filter: 'blur(14px)' },
    { opacity: 1, filter: 'blur(0px)', duration: 1.6 }
  );
  tl.to({}, { duration: 0.5 });
  tl.fromTo('#signature',
    { opacity: 0, filter: 'blur(14px)', scale: 0.9 },
    { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 1.6 }
  );

  // galaxy pulses like it's celebrating
  tl.to(state, { pulse: 1, duration: 0.4, ease: 'power2.out' }, '-=0.2');
  tl.to(state, { pulse: 0, duration: 0.4, ease: 'power2.in' });

  // Scene 5 — continue button
  tl.call(() => { document.getElementById('continueBtn').classList.add('active'); });
  tl.to('#continueBtn', { opacity: 1, duration: 1.2 });
}

/* ================================================================
   EASTER EGG — click detection on the wishing star
   ================================================================ */
canvas.addEventListener('click', (e) => {
  if (state.starProgress < 0.99) return; // sky isn't fully born yet
  const pos = findEggScreenPos();
  const dx = e.clientX - pos.x;
  const dy = e.clientY - pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= 22) triggerEasterEgg();
});

function triggerEasterEgg() {
  if (!eggFound) {
    eggFound = true;
    spawnShootingStar(true);
    setTimeout(() => spawnShootingStar(true), 250);
    setTimeout(() => spawnShootingStar(false), 500);
    gsap.to(state, { brightness: 1.6, duration: 0.5, yoyo: true, repeat: 1, ease: 'power2.inOut' });
  }
  const modal = document.getElementById('eggModal');
  modal.classList.add('show');
}
document.getElementById('closeEgg').addEventListener('click', () => {
  document.getElementById('eggModal').classList.remove('show');
});

/* ================================================================
   INTERACTION — begin the journey
   ================================================================ */
document.getElementById('continueBtn').addEventListener('click', () => {
  fadeInMusic();
  gsap.to('#overlay', {
    opacity: 0, duration: 1.2, ease: 'power2.inOut',
    onComplete: () => {
      document.getElementById('overlay').style.display = 'none';
      revealPhase2();
    }
  });
});

/* ================================================================
   PHASE 2 — cake, sealed letter, gallery, finale
   ================================================================ */
const PHASE2_SCENES = ['scene-cake', 'scene-letter', 'scene-gallery', 'scene-finale'];

function goToScene(id) {
  PHASE2_SCENES.forEach((s) => document.getElementById(s).classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function revealPhase2() {
  const p2 = document.getElementById('phase2');
  p2.hidden = false;
  gsap.to(p2, { opacity: 1, duration: 1.2, ease: 'power2.inOut' });
  goToScene('scene-cake');
  initCandles();
  initGallery();
}

/* ---- Cake ---- */
const CANDLE_COUNT = 5;
let litCount = CANDLE_COUNT;

function initCandles() {
  const wrap = document.getElementById('candles');
  wrap.innerHTML = '';
  litCount = CANDLE_COUNT;
  document.getElementById('cakeGlow').classList.remove('show');
  document.getElementById('wishLine').textContent = 'tap each candle to blow it out';
  document.getElementById('toLetterBtn').classList.remove('show');

  for (let i = 0; i < CANDLE_COUNT; i++) {
    const c = document.createElement('div');
    c.className = 'candle';
    const flame = document.createElement('div');
    flame.className = 'flame';
    c.appendChild(flame);
    c.addEventListener('click', () => {
      if (c.classList.contains('out')) return;
      c.classList.add('out');
      playBlow();
      litCount--;
      if (litCount === 0) {
        document.getElementById('wishLine').textContent = 'Make a wish, Motu ✨';
        document.getElementById('cakeGlow').classList.add('show');
        playChime();
        confettiRain();
        setTimeout(() => document.getElementById('toLetterBtn').classList.add('show'), 500);
      }
    });
    wrap.appendChild(c);
  }
}

/* ---- Sealed letter ---- */
const seal = document.getElementById('seal');
const letterCard = document.getElementById('letterCard');
const sealHint = document.getElementById('sealHint');
seal.addEventListener('click', () => {
  if (seal.classList.contains('broken')) return;
  seal.classList.add('broken');
  playSeal();
  sealHint.style.display = 'none';
  setTimeout(() => {
    letterCard.classList.add('show');
    document.getElementById('toGalleryBtn').classList.add('show');
  }, 350);
});

/* ---- Gallery ---- */
function initGallery() {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = '';
  for (let i = 1; i <= 4; i++) {
    const frame = document.createElement('div');
    frame.className = 'photo-frame';

    const img = document.createElement('img');
    img.alt = `A shared memory, photo ${i}`;
    img.onerror = () => {
      frame.classList.add('empty');
      frame.innerHTML = `<span class="icon">✦</span><span>photo${i}.jpg</span>`;
    };
    img.onload = () => {
      frame.addEventListener('click', () => openLightbox(img.src));
    };
    img.src = `assets/photos/photo${i}.jpg`;
    frame.appendChild(img);
    grid.appendChild(frame);
  }
}

function openLightbox(src) {
  const box = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = src;
  box.classList.add('show');
}
document.getElementById('lightbox').addEventListener('click', () => {
  document.getElementById('lightbox').classList.remove('show');
});

/* ---- Navigation ---- */
document.getElementById('toLetterBtn').addEventListener('click', () => goToScene('scene-letter'));
document.getElementById('toGalleryBtn').addEventListener('click', () => goToScene('scene-gallery'));
document.getElementById('toFinaleBtn').addEventListener('click', () => { goToScene('scene-finale'); confettiRain(); });
document.getElementById('replayBtn').addEventListener('click', () => {
  seal.classList.remove('broken');
  letterCard.classList.remove('show');
  document.getElementById('toGalleryBtn').classList.remove('show');
  sealHint.style.display = 'block';
  document.getElementById('lightbox').classList.remove('show');
  initCandles();
  location.reload();
  //goToScene('scene-cake');
});

/* ================================================================
   BOOT
   ================================================================ */
resize();
initDust();
requestAnimationFrame(render);
initTimeline();