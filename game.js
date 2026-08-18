/* ================= Bruno's World — game.js ================= */
(function () {
  'use strict';

  // ---------- DOM ----------
  var yard = document.getElementById('yard');
  var bruno = document.getElementById('bruno');
  var brunoImg = document.getElementById('bruno-img');
  var bowlEl = document.getElementById('bowl');
  var ballEl = document.getElementById('ball');
  var hintEl = document.getElementById('tap-hint');
  var fxLayer = document.getElementById('fx-layer');
  var actionBar = document.getElementById('action-bar');
  var btnFeed = document.getElementById('btn-feed');
  var btnWash = document.getElementById('btn-wash');
  var btnFetch = document.getElementById('btn-fetch');
  var btnSleep = document.getElementById('btn-sleep');
  var btnHome = document.getElementById('btn-home');
  var btnStickers = document.getElementById('btn-stickers');
  var btnSound = document.getElementById('btn-sound');
  var fetchChip = document.getElementById('fetch-chip');
  var fetchCountEl = document.getElementById('fetch-count');
  var btnGames = document.getElementById('btn-games');
  var gameLayer = document.getElementById('game-layer');
  var treatChip = document.getElementById('treat-chip');
  var treatCountEl = document.getElementById('treat-count');
  var dashChip = document.getElementById('dash-chip');
  var dashCountEl = document.getElementById('dash-count');
  var skyChip = document.getElementById('sky-chip');
  var skyCountEl = document.getElementById('sky-count');
  var grassEl = document.getElementById('grass');
  var fenceEl = document.getElementById('fence');
  var pickerOverlay = document.getElementById('game-picker');
  var tileTreat = document.getElementById('tile-treat');
  var tileDash = document.getElementById('tile-dash');
  var tileSky = document.getElementById('tile-sky');
  var btnPickerClose = document.getElementById('btn-picker-close');
  var bookOverlay = document.getElementById('sticker-book');
  var bookPage = document.getElementById('book-page');
  var bookTitle = document.getElementById('book-title');
  var stickerGrid = document.getElementById('sticker-grid');
  var btnBookClose = document.getElementById('btn-book-close');
  var celebrateEl = document.getElementById('celebrate');
  var celebrateSticker = document.getElementById('celebrate-sticker');

  // ---------- Poses ----------
  // h = display height as fraction of viewport height.
  // nativeFacing: which way the raw art points ('right' | 'left' | 'front').
  // ox = horizontal shift of the img, as a fraction of the pose's display
  //      width, applied in the current facing direction (keeps the dog's
  //      body anchored when frames have side-cars like eat_01's bowl).
  var SPRITE_DIR = 'assets/sprites/';
  var POSES = {
    portrait:      { file: 'portrait.png',      w: 1082, h: 1173, disp: 0.34, nativeFacing: 'front' },
    profile_right: { file: 'profile_right.png', w: 848,  h: 810,  disp: 0.285, nativeFacing: 'right' },
    profile_left:  { file: 'profile_left.png',  w: 822,  h: 810,  disp: 0.285, nativeFacing: 'left' },
    run_01:        { file: 'run_01.png',        w: 964,  h: 766,  disp: 0.271, nativeFacing: 'right' },
    run_02:        { file: 'run_02.png',        w: 882,  h: 823,  disp: 0.291, nativeFacing: 'right' },
    run_03:        { file: 'run_03.png',        w: 800,  h: 777,  disp: 0.275, nativeFacing: 'right' },
    run_04:        { file: 'run_04.png',        w: 810,  h: 847,  disp: 0.300, nativeFacing: 'right' },
    eat_01:        { file: 'eat_01.png',        w: 1152, h: 661,  disp: 0.234, nativeFacing: 'right', ox: -0.14 },
    eat_02:        { file: 'eat_02.png',        w: 848,  h: 847,  disp: 0.300, nativeFacing: 'right', ox: -0.10 },
    wash_wet:      { file: 'wash_wet.png',      w: 1071, h: 956,  disp: 0.32,  nativeFacing: 'front' },
    wash_shake:    { file: 'wash_shake.png',    w: 860,  h: 965,  disp: 0.32,  nativeFacing: 'right' },
    sleep:         { file: 'sleep.png',         w: 1478, h: 811,  disp: 0.21,  nativeFacing: 'left' },
    catch:         { file: 'catch.png',         w: 1421, h: 2075, disp: 0.42,  nativeFacing: 'right' }
  };
  var RUN_FRAMES = ['run_01', 'run_02', 'run_03', 'run_04'];

  // Preload every sprite up front so first actions never flash.
  Object.keys(POSES).forEach(function (k) {
    var im = new Image();
    im.src = SPRITE_DIR + POSES[k].file;
  });

  // ---------- Persistence ----------
  var STORE_KEY = 'brunos-world-v1';
  var STICKERS = ['🎾', '🦴', '🫧', '⭐', '🌈', '🍖', '🐾', '❤️', '🌞', '🌙', '🏆', '🎉'];
  var store = { stickers: [], fetchCount: 0, treatCount: 0, dashCount: 0, skyBest: 0, skyBones: 0, actions: 0, sound: true };
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.stickers)) store.stickers = parsed.stickers.filter(function (i) { return typeof i === 'number' && i >= 0 && i < 12; });
        if (typeof parsed.fetchCount === 'number') store.fetchCount = parsed.fetchCount;
        if (typeof parsed.treatCount === 'number') store.treatCount = parsed.treatCount;
        if (typeof parsed.dashCount === 'number') store.dashCount = parsed.dashCount;
        if (typeof parsed.skyBest === 'number') store.skyBest = parsed.skyBest;
        if (typeof parsed.skyBones === 'number') store.skyBones = parsed.skyBones;
        if (typeof parsed.actions === 'number') store.actions = parsed.actions;
        if (typeof parsed.sound === 'boolean') store.sound = parsed.sound;
      }
    }
  } catch (e) { /* fresh start */ }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ok */ }
  }

  // ---------- Sound (WebAudio chiptune synth) ----------
  var audioCtx = null;
  var masterGain = null;
  function ensureAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.16;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, dur, opts) {
    if (!store.sound || !ensureAudio()) return;
    opts = opts || {};
    var t0 = audioCtx.currentTime + (opts.delay || 0);
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slide), t0 + dur);
    var vol = opts.vol || 0.5;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
  function noise(dur, opts) {
    if (!store.sound || !ensureAudio()) return;
    opts = opts || {};
    var t0 = audioCtx.currentTime + (opts.delay || 0);
    var len = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    var buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    var filt = audioCtx.createBiquadFilter();
    filt.type = opts.filterType || 'highpass';
    filt.frequency.value = opts.filterFreq || 2000;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.25, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    src.start(t0);
  }
  var sfx = {
    bark: function () {
      tone(340, 0.09, { type: 'square', slide: 190, vol: 0.5 });
      tone(300, 0.11, { type: 'square', slide: 150, vol: 0.5, delay: 0.11 });
    },
    chomp: function () {
      tone(150, 0.07, { type: 'square', slide: 70, vol: 0.45 });
      noise(0.05, { filterType: 'lowpass', filterFreq: 900, vol: 0.2, delay: 0.02 });
    },
    splash: function () {
      noise(0.28, { filterType: 'bandpass', filterFreq: 3200, vol: 0.18 });
      tone(900, 0.12, { type: 'sine', slide: 400, vol: 0.2, delay: 0.03 });
    },
    bubble: function () {
      tone(700 + Math.random() * 500, 0.08, { type: 'sine', slide: 1400, vol: 0.14 });
    },
    rattle: function () {
      for (var i = 0; i < 6; i++) noise(0.04, { filterType: 'highpass', filterFreq: 3500, vol: 0.16, delay: i * 0.07 });
    },
    whoosh: function () {
      noise(0.3, { filterType: 'bandpass', filterFreq: 1200, vol: 0.2 });
      tone(220, 0.28, { type: 'triangle', slide: 720, vol: 0.25 });
    },
    boing: function () {
      tone(160, 0.14, { type: 'triangle', slide: 420, vol: 0.3 });
    },
    blip: function () {
      tone(988, 0.07, { type: 'triangle', vol: 0.22 });
    },
    starArp: function () {
      [659, 831, 988, 1319].forEach(function (n, i) {
        tone(n, 0.1, { type: 'square', vol: 0.26, delay: i * 0.07 });
      });
    },
    softRattle: function () {
      for (var i = 0; i < 3; i++) noise(0.05, { filterType: 'highpass', filterFreq: 2800, vol: 0.1, delay: i * 0.08 });
    },
    catchYay: function () {
      tone(523, 0.09, { type: 'square', vol: 0.35 });
      tone(659, 0.09, { type: 'square', vol: 0.35, delay: 0.09 });
      tone(784, 0.16, { type: 'square', vol: 0.35, delay: 0.18 });
    },
    skyBoing: function (combo) {
      // pitch creeps up with each consecutive bounce, resets on a fall
      var f = 150 + Math.min(combo, 10) * 22;
      tone(f, 0.14, { type: 'triangle', slide: f * 2.6, vol: 0.26 });
    },
    megaBoing: function () {
      tone(120, 0.18, { type: 'triangle', slide: 700, vol: 0.32 });
      [523, 659, 784, 1047].forEach(function (n, i) {
        tone(n, 0.09, { type: 'square', vol: 0.22, delay: 0.1 + i * 0.06 });
      });
    },
    chuteOpen: function () {
      noise(0.35, { filterType: 'bandpass', filterFreq: 900, vol: 0.15 });
      [880, 784, 659, 587, 523].forEach(function (n, i) {
        tone(n, 0.18, { type: 'triangle', vol: 0.18, delay: 0.2 + i * 0.32 });
      });
    },
    snoreOnce: function () {
      tone(72, 0.8, { type: 'sine', slide: 58, vol: 0.3 });
    },
    jingle: function () {
      var notes = [523, 659, 784, 1047, 1319];
      notes.forEach(function (n, i) {
        tone(n, 0.14, { type: 'square', vol: 0.3, delay: i * 0.11 });
      });
    },
    rainbow: function () {
      var notes = [392, 440, 494, 523, 587, 659, 740, 784];
      notes.forEach(function (n, i) {
        tone(n, 0.18, { type: 'triangle', vol: 0.3, delay: i * 0.13 });
      });
    }
  };
  var snoreTimer = null;
  function startSnore() {
    stopSnore();
    sfx.snoreOnce();
    snoreTimer = setInterval(function () { sfx.snoreOnce(); }, 1900);
  }
  function stopSnore() {
    if (snoreTimer) { clearInterval(snoreTimer); snoreTimer = null; }
  }

  // ---------- Geometry ----------
  var W = 0, H = 0, baselineY = 0;
  function measure() {
    W = yard.clientWidth;
    H = yard.clientHeight;
    baselineY = Math.round(H * 0.18); // feet line, px up from bottom of yard
  }
  measure();

  // Bruno logical position: xFrac = fraction of yard width (feet-center).
  var brunoState = {
    xFrac: 0.5,
    facing: 1, // 1 = right, -1 = left
    pose: 'portrait'
  };

  // Global sprite scale: Sky Bruno shrinks the dog so the sky feels big.
  var poseScale = 1;
  function setPose(name, facing) {
    if (facing) brunoState.facing = facing;
    brunoState.pose = name;
    var p = POSES[name];
    var dispH = p.disp * H * poseScale;
    var dispW = dispH * (p.w / p.h);
    brunoImg.src = SPRITE_DIR + p.file;
    brunoImg.style.height = Math.round(dispH) + 'px';
    brunoImg.style.width = Math.round(dispW) + 'px';
    // flip so the art matches the requested facing
    var flip = 1;
    if (p.nativeFacing === 'right' && brunoState.facing === -1) flip = -1;
    if (p.nativeFacing === 'left' && brunoState.facing === 1) flip = -1;
    brunoImg.style.setProperty('--flip', flip);
    // per-pose anchor shift (in facing direction) to keep the body centered
    var shift = 0;
    if (p.ox) shift = Math.round(p.ox * dispW * (flip === -1 ? -1 : 1) * (p.nativeFacing === 'left' ? -1 : 1));
    brunoImg.style.marginLeft = shift + 'px';
    if (!brunoImg.classList.contains('anim-wiggle')) {
      brunoImg.style.transform = 'scaleX(' + flip + ')';
    }
  }
  function setAnim(cls) {
    brunoImg.classList.remove('anim-breathe', 'anim-bounce', 'anim-wiggle', 'anim-sleepy');
    brunoImg.style.transform = '';
    if (cls) brunoImg.classList.add(cls);
  }
  function placeBruno() {
    bruno.style.left = Math.round(brunoState.xFrac * W) + 'px';
    bruno.style.bottom = baselineY + 'px';
  }

  // ---------- State machine ----------
  var S = {
    IDLE: 'IDLE',
    FEEDING: 'FEEDING',
    WASHING: 'WASHING',
    SLEEPING: 'SLEEPING',
    FETCH_READY: 'FETCH_READY',
    FETCH_THROW: 'FETCH_THROW',
    FETCH_RUN_OUT: 'FETCH_RUN_OUT',
    FETCH_CATCH: 'FETCH_CATCH',
    FETCH_RUN_BACK: 'FETCH_RUN_BACK',
    FETCH_ENTER: 'FETCH_ENTER',
    FETCH_EXIT: 'FETCH_EXIT',
    TC_ENTER: 'TC_ENTER',
    TC_PLAY: 'TC_PLAY',
    TC_EXIT: 'TC_EXIT',
    BD_ENTER: 'BD_ENTER',
    BD_PLAY: 'BD_PLAY',
    BD_EXIT: 'BD_EXIT',
    SB_PLAY: 'SB_PLAY',
    SB_FALL: 'SB_FALL',
    SB_READY: 'SB_READY',
    SB_EXIT: 'SB_EXIT'
  };
  var state = S.IDLE;
  var seqGen = 0; // generation token: bumping it cancels in-flight sequences

  function inFetch() { return state.indexOf('FETCH') === 0; }
  function inTC() { return state.indexOf('TC_') === 0; }
  function inBD() { return state.indexOf('BD_') === 0; }
  function inSB() { return state.indexOf('SB_') === 0; }
  function inMini() { return inTC() || inBD() || inSB(); }

  function setState(next) {
    state = next;
    var busy = state !== S.IDLE;
    btnFeed.disabled = busy;
    btnWash.disabled = busy;
    btnFetch.disabled = busy;
    btnSleep.disabled = busy;
    btnGames.disabled = busy;
    yard.classList.toggle('bar-hidden', state === S.SLEEPING || inFetch() || inMini());
    var homeOn = (inFetch() && state !== S.FETCH_EXIT) ||
                 (state === S.TC_PLAY) || (state === S.BD_PLAY) ||
                 (state === S.SB_PLAY) || (state === S.SB_FALL) || (state === S.SB_READY);
    btnHome.classList.toggle('hidden', !homeOn);
    // 🎮 chip shares the btn-home slot; only one of the two is ever visible
    btnGames.classList.toggle('hidden', state === S.SLEEPING || inFetch() || inMini());
    fetchChip.classList.toggle('hidden', !inFetch());
    treatChip.classList.toggle('hidden', !inTC());
    dashChip.classList.toggle('hidden', !inBD());
    skyChip.classList.toggle('hidden', !inSB());
    hintEl.classList.toggle('hidden', !(state === S.FETCH_READY || state === S.SB_READY));
  }

  function delay(ms, gen) {
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(gen === seqGen); }, ms);
    });
  }

  function goIdle() {
    stopSnore();
    poseScale = 1;
    yard.classList.remove('night');
    yard.classList.remove('dashing');
    grassEl.style.transform = '';
    fenceEl.style.transform = '';
    brunoImg.classList.remove('sb-spin', 'sb-squash');
    if (typeof sb !== 'undefined' && sb.chute) { sb.chute.remove(); sb.chute = null; }
    gameLayer.innerHTML = '';
    bowlEl.classList.add('hidden');
    ballEl.classList.add('hidden');
    brunoState.xFrac = 0.5;
    placeBruno();
    setPose('portrait', 1);
    setAnim('anim-breathe');
    setState(S.IDLE);
  }

  // ---------- FX helpers ----------
  function brunoHeadPoint() {
    var r = bruno.getBoundingClientRect();
    var y = yard.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - y.left,
      y: r.top + r.height * 0.15 - y.top
    };
  }
  function spawnFx(cls, x, y, text, extra) {
    var el = document.createElement('div');
    el.className = cls;
    if (text) el.textContent = text;
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    if (extra) extra(el);
    fxLayer.appendChild(el);
    el.addEventListener('animationend', function () { el.remove(); });
    setTimeout(function () { el.remove(); }, 6000); // safety net
    return el;
  }
  function popHearts(n) {
    var p = brunoHeadPoint();
    for (var i = 0; i < n; i++) {
      (function (i) {
        setTimeout(function () {
          spawnFx('heart', p.x - 30 + Math.random() * 60, p.y - 10 + Math.random() * 20, ['❤️', '💛', '🧡'][i % 3]);
        }, i * 120);
      })(i);
    }
  }
  function popSparkles(n) {
    var p = brunoHeadPoint();
    for (var i = 0; i < n; i++) {
      spawnFx('sparkle', p.x - 60 + Math.random() * 120, p.y - 20 + Math.random() * 90, '✨');
    }
  }
  function confettiBurst(n) {
    var colors = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#ff8fab', '#b892ff'];
    for (var i = 0; i < n; i++) {
      spawnFx('confetti', Math.random() * W, -20, '', function (el) {
        el.style.background = colors[Math.floor(Math.random() * colors.length)];
        el.style.animationDelay = (Math.random() * 0.5) + 's';
        el.style.animationDuration = (1.4 + Math.random() * 0.9) + 's';
      });
    }
  }

  // ---------- Bruno tap = always love ----------
  function brunoTapReaction() {
    if (state === S.SLEEPING) return; // wake handler owns sleep taps
    sfx.bark();
    popHearts(1 + Math.floor(Math.random() * 3));
    if (state === S.IDLE || state === S.FETCH_READY) {
      setAnim('anim-bounce');
      brunoImg.addEventListener('animationend', function onEnd() {
        brunoImg.removeEventListener('animationend', onEnd);
        if (state === S.IDLE) setAnim('anim-breathe');
        else setAnim(null);
      });
    }
  }

  // ---------- Movement (rAF) ----------
  // Runs bruno from current xFrac to targetFrac at fixed speed with the run
  // cycle. Resolves true when arrived, false if the sequence was cancelled.
  function runTo(targetFrac, gen) {
    return new Promise(function (resolve) {
      var speed = 0.42 * H; // px per second
      var dir = targetFrac > brunoState.xFrac ? 1 : -1;
      brunoState.facing = dir;
      var frame = 0;
      var lastFrameSwap = 0;
      setAnim(null);
      setPose(RUN_FRAMES[0], dir);
      var lastT = null;
      function step(t) {
        if (gen !== seqGen) { resolve(false); return; }
        if (lastT === null) lastT = t;
        var dt = (t - lastT) / 1000;
        lastT = t;
        var dx = (speed * dt) / W * dir;
        brunoState.xFrac += dx;
        var done = (dir === 1 && brunoState.xFrac >= targetFrac) ||
                   (dir === -1 && brunoState.xFrac <= targetFrac);
        if (done) brunoState.xFrac = targetFrac;
        placeBruno();
        if (t - lastFrameSwap > 100) { // ~10 fps run cycle
          lastFrameSwap = t;
          frame = (frame + 1) % RUN_FRAMES.length;
          setPose(RUN_FRAMES[frame], dir);
        }
        if (done) { resolve(true); return; }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // ---------- FEED ----------
  function doFeed() {
    if (state !== S.IDLE) return;
    var gen = ++seqGen;
    setState(S.FEEDING);
    (async function () {
      try {
        // bowl pops in on the right side of the yard
        var bowlFrac = 0.74;
        bowlEl.style.left = Math.round(bowlFrac * W) + 'px';
        bowlEl.style.bottom = baselineY + 'px';
        bowlEl.classList.remove('hidden', 'empty');
        bowlEl.classList.add('pop-in');
        sfx.boing();
        if (!(await delay(420, gen))) return;
        bowlEl.classList.remove('pop-in');

        // trot over — stop so eat_01's baked-in bowl lands exactly on the
        // CSS bowl. In eat_01 the bowl center sits at ~85.5% of the frame
        // width; with the pose's ox shift the offset from wrapper center is:
        var eat01W = POSES.eat_01.disp * H * (POSES.eat_01.w / POSES.eat_01.h);
        // (ox is applied as an img margin inside a translateX(-50%) wrapper,
        // so it only shifts the visual center by half its value)
        var eatBowlOffset = (0.855 - 0.5 + POSES.eat_01.ox / 2) * eat01W; // px right of wrapper center
        if (!(await runTo(bowlFrac - eatBowlOffset / W, gen))) return;

        // chomp: alternate eat_01 (head down, bowl baked in) / eat_02 (head up)
        // While eat_01 shows, hide the CSS bowl so there is only one bowl.
        var chomps = 5;
        for (var i = 0; i < chomps; i++) {
          setPose('eat_01', 1);
          bowlEl.style.visibility = 'hidden';
          sfx.chomp();
          if (i === 2) popHearts(1);
          if (!(await delay(380, gen))) return;
          setPose('eat_02', 1);
          bowlEl.style.visibility = 'visible';
          if (i === chomps - 2) bowlEl.classList.add('empty');
          if (!(await delay(320, gen))) return;
        }
        bowlEl.style.visibility = 'visible';

        // bowl vanishes, happy hearts
        bowlEl.classList.add('empty');
        popHearts(3);
        sfx.bark();
        if (!(await delay(350, gen))) return;
        bowlEl.classList.add('hidden');

        // trot back home
        if (!(await runTo(0.5, gen))) return;
        goIdle();
        completeAction();
      } catch (e) {
        if (gen === seqGen) goIdle();
      }
    })();
  }

  // ---------- WASH ----------
  function doWash() {
    if (state !== S.IDLE) return;
    var gen = ++seqGen;
    setState(S.WASHING);
    (async function () {
      try {
        // bubbles drift down over Bruno
        var p = brunoHeadPoint();
        for (var i = 0; i < 14; i++) {
          (function (i) {
            setTimeout(function () {
              if (gen !== seqGen) return;
              var size = 14 + Math.random() * 26;
              spawnFx('bubble-fx', p.x - 90 + Math.random() * 180, p.y - 40 + Math.random() * 60, '', function (el) {
                el.style.width = size + 'px';
                el.style.height = size + 'px';
                el.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
              });
              if (i % 3 === 0) sfx.bubble();
            }, i * 160);
          })(i);
        }
        sfx.splash();
        if (!(await delay(700, gen))) return;

        // soapy Bruno
        setAnim(null);
        setPose('wash_wet', 1);
        sfx.bubble();
        if (!(await delay(1000, gen))) return;
        sfx.splash();
        if (!(await delay(1000, gen))) return;

        // the big shake
        setPose('wash_shake', 1);
        setAnim('anim-wiggle');
        sfx.rattle();
        var sp = brunoHeadPoint();
        for (var d = 0; d < 10; d++) {
          spawnFx('droplet', sp.x, sp.y + 40 + Math.random() * 60, '💧', function (el) {
            el.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
            el.style.setProperty('--dy', (-20 - Math.random() * 90) + 'px');
          });
        }
        if (!(await delay(1100, gen))) return;
        setAnim(null);

        // sparkling clean
        popSparkles(8);
        sfx.catchYay();
        setPose('portrait', 1);
        if (!(await delay(700, gen))) return;
        sfx.bark();
        goIdle();
        completeAction();
      } catch (e) {
        if (gen === seqGen) goIdle();
      }
    })();
  }

  // ---------- SLEEP ----------
  var zzzTimer = null;
  function doSleep() {
    if (state !== S.IDLE) return;
    seqGen++;
    setState(S.SLEEPING);
    yard.classList.add('night');
    setAnim(null);
    setPose('sleep', -1);
    placeBruno();
    setAnim('anim-sleepy');
    startSnore();
    if (zzzTimer) clearInterval(zzzTimer);
    zzzTimer = setInterval(function () {
      if (state !== S.SLEEPING) { clearInterval(zzzTimer); zzzTimer = null; return; }
      var p = brunoHeadPoint();
      spawnFx('zzz', p.x + 30 + Math.random() * 30, p.y - 20, 'Z');
    }, 1100);
  }
  function wakeUp() {
    if (state !== S.SLEEPING) return;
    var gen = ++seqGen;
    if (zzzTimer) { clearInterval(zzzTimer); zzzTimer = null; }
    stopSnore();
    yard.classList.remove('night'); // gentle sunrise via CSS transition
    (async function () {
      if (!(await delay(900, gen))) return;
      sfx.bark();
      popHearts(2);
      goIdle();
      completeAction();
    })();
  }

  // ---------- FETCH ----------
  // Bruno's fetch station: far enough in that his rear never clips off-screen
  function profileW() {
    return POSES.profile_right.disp * H * (POSES.profile_right.w / POSES.profile_right.h);
  }
  function fetchSpot() {
    return Math.min(0.4, Math.max(0.16, (0.5 * profileW() + 10) / W));
  }
  function ballHomeX() {
    return fetchSpot() * W + 0.58 * profileW(); // just past his nose
  }
  var ballPos = { x: 0, y: 0 }; // x px, y px above baseline

  function placeBall() {
    ballEl.style.left = Math.round(ballPos.x) + 'px';
    ballEl.style.bottom = Math.round(baselineY + ballPos.y) + 'px';
  }
  function updateFetchChip() {
    fetchCountEl.textContent = String(store.fetchCount);
  }

  function enterFetch() {
    if (state !== S.IDLE) return;
    var gen = ++seqGen;
    setState(S.FETCH_ENTER);
    updateFetchChip();
    (async function () {
      try {
        if (!(await runTo(fetchSpot(), gen))) return;
        setPose('profile_right', 1);
        setAnim('anim-breathe');
        // ball pops in at Bruno's feet
        ballPos.x = ballHomeX();
        ballPos.y = 0;
        placeBall();
        ballEl.classList.remove('hidden');
        ballEl.classList.add('pop-in');
        sfx.boing();
        if (!(await delay(400, gen))) return;
        ballEl.classList.remove('pop-in');
        // wordless hint: pulsing ripple + ghost finger mid-yard
        hintEl.style.left = Math.round(0.62 * W) + 'px';
        hintEl.style.top = Math.round(0.42 * H) + 'px';
        setState(S.FETCH_READY);
      } catch (e) {
        if (gen === seqGen) goIdle();
      }
    })();
  }

  function throwBall(tapX) {
    if (state !== S.FETCH_READY) return; // mid-run taps are safely ignored
    var gen = ++seqGen;
    setState(S.FETCH_THROW);
    setAnim(null);
    setPose('profile_right', 1);
    var targetX = Math.min(Math.max(tapX, 0.12 * W), 0.9 * W);
    sfx.whoosh();
    ballEl.classList.remove('pop-in');

    // ballistic arc with two bounces, deterministic rAF integration
    var startX = ballPos.x;
    var flightT = 0.9; // seconds to first touchdown
    var vx = (targetX - startX) / flightT;
    var g = 2.6 * H; // px/s^2 gravity, tuned for a chunky arc
    var vy = g * flightT / 2; // reaches apex mid-flight
    var bounces = 0;
    var lastT = null;
    var settled = false;

    function step(t) {
      if (gen !== seqGen) return;
      if (lastT === null) lastT = t;
      var dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;
      ballPos.x += vx * dt;
      ballPos.y += vy * dt;
      vy -= g * dt;
      if (ballPos.y <= 0 && vy < 0) {
        ballPos.y = 0;
        bounces++;
        if (bounces > 2 || Math.abs(vy) < 0.25 * H) {
          settled = true;
        } else {
          sfx.boing();
          vy = -vy * 0.42;
          vx *= 0.55;
        }
      }
      // keep the ball inside the yard
      if (ballPos.x < 0.05 * W) { ballPos.x = 0.05 * W; vx = Math.abs(vx) * 0.4; }
      if (ballPos.x > 0.95 * W) { ballPos.x = 0.95 * W; vx = -Math.abs(vx) * 0.4; }
      placeBall();
      if (!settled) { requestAnimationFrame(step); return; }
      fetchRunOut(gen);
    }
    requestAnimationFrame(step);
  }

  function fetchRunOut(gen) {
    if (gen !== seqGen) return;
    setState(S.FETCH_RUN_OUT);
    (async function () {
      try {
        var mouthOffset = (0.1 * H) / W;
        var ballFrac = ballPos.x / W;
        var target = ballFrac > brunoState.xFrac ? ballFrac - mouthOffset : ballFrac + mouthOffset;
        target = Math.min(Math.max(target, 0.06), 0.94);
        if (!(await runTo(target, gen))) return;

        // the catch!
        setState(S.FETCH_CATCH);
        var dir = ballPos.x >= brunoState.xFrac * W ? 1 : -1;
        setAnim(null);
        setPose('catch', dir);
        ballEl.classList.add('hidden'); // into the mouth
        sfx.catchYay();
        popSparkles(3);
        if (!(await delay(650, gen))) return;

        // trot back to the fetch spot
        setState(S.FETCH_RUN_BACK);
        if (!(await runTo(fetchSpot(), gen))) return;
        setPose('profile_right', 1);
        setAnim('anim-breathe');

        // drop the ball — ready to go again
        ballPos.x = ballHomeX();
        ballPos.y = 0;
        placeBall();
        ballEl.classList.remove('hidden');
        ballEl.classList.add('pop-in');
        sfx.boing();
        popHearts(1);

        store.fetchCount++;
        save();
        updateFetchChip();
        fetchChip.classList.remove('bump');
        void fetchChip.offsetWidth;
        fetchChip.classList.add('bump');

        if (!(await delay(300, gen))) return;
        ballEl.classList.remove('pop-in');
        setState(S.FETCH_READY);

        // every 3 fetches count as one completed action
        if (store.fetchCount % 3 === 0) completeAction();
      } catch (e) {
        if (gen === seqGen) { setState(S.FETCH_READY); }
      }
    })();
  }

  function exitFetch() {
    if (!inFetch()) return;
    var gen = ++seqGen;
    setState(S.FETCH_EXIT);
    ballEl.classList.add('hidden');
    hintEl.classList.add('hidden');
    (async function () {
      try {
        if (!(await runTo(0.5, gen))) return;
        goIdle();
      } catch (e) {
        if (gen === seqGen) goIdle();
      }
    })();
  }

  // ---------- Mini-game picker ----------
  function openPicker() {
    if (state !== S.IDLE) return;
    pickerOverlay.classList.remove('hidden');
  }
  function closePicker() {
    pickerOverlay.classList.add('hidden');
  }

  // ---------- Mini-game shared ----------
  function updateTreatChip() { treatCountEl.textContent = String(store.treatCount); }
  function updateDashChip() { dashCountEl.textContent = String(store.dashCount); }
  function bumpChip(chip) {
    chip.classList.remove('bump');
    void chip.offsetWidth;
    chip.classList.add('bump');
  }
  function profileSize() {
    var p = POSES.profile_right;
    var h = p.disp * H * poseScale;
    return { h: h, w: h * (p.w / p.h) };
  }
  function clampFrac(f) {
    var half = (0.5 * profileSize().w + 6) / W; // keep the whole dog on-screen
    return Math.min(1 - half, Math.max(half, f));
  }

  // ---------- TREAT CATCH (TC_*) ----------
  // Treats drift down over the yard; Bruno runs under them and chomps.
  // Missing is a non-event: the treat lands, bounces once, fades away.
  var tc = {
    treats: [], target: null, dragging: false,
    catchUntil: 0, mode: 'idle', frame: 0, lastSwap: 0, nextSpawn: 0
  };

  function enterTreatCatch() {
    if (state !== S.IDLE) return;
    var gen = ++seqGen;
    updateTreatChip();
    tc.treats = [];
    tc.target = null;
    tc.dragging = false;
    tc.catchUntil = 0;
    tc.mode = 'idle';
    setAnim(null);
    setPose('profile_right', 1);
    setAnim('anim-breathe');
    setState(S.TC_PLAY);
    tcLoop(gen);
  }

  function spawnTreat() {
    var size = Math.max(48, Math.round(H * 0.065));
    var kind;
    if (Math.random() < 0.125) kind = 'star'; // ~1 in 8 bonus
    else kind = ['bone', 'meat', 'ball'][Math.floor(Math.random() * 3)];
    var el = document.createElement('div');
    el.className = 'treat' + (kind === 'ball' ? ' treat-ball-art' : '');
    if (kind === 'bone') el.textContent = '🦴';
    if (kind === 'meat') el.textContent = '🍖';
    if (kind === 'star') el.textContent = '⭐';
    el.style.fontSize = size + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    var fallT = 3.5 + Math.random(); // 3.5–4.5s to reach the grass
    tc.treats.push({
      el: el,
      x0: (0.1 + Math.random() * 0.8) * W,
      y: -size,
      size: size,
      kind: kind,
      speed: (H - baselineY + size * 2) / fallT,
      swayAmp: 10 + Math.random() * 18,
      swayFreq: 0.8 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2
    });
    gameLayer.appendChild(el);
  }

  function tcCatch(tr, t) {
    tr.el.classList.add('treat-pop');
    (function (el) { setTimeout(function () { el.remove(); }, 450); })(tr.el);
    tc.catchUntil = t + 450;
    setAnim(null);
    setPose('catch');
    tc.mode = 'catch';
    if (tr.kind === 'star') {
      sfx.starArp();
      popHearts(3);
      popSparkles(4);
    } else {
      sfx.chomp();
      sfx.blip();
      popHearts(1 + Math.floor(Math.random() * 2));
    }
    store.treatCount++;
    save();
    updateTreatChip();
    bumpChip(treatChip);
    // every 4 catches count as one completed action
    if (store.treatCount % 4 === 0) completeAction();
  }

  function tcLoop(gen) {
    var lastT = null;
    tc.nextSpawn = performance.now() + 700;
    function step(t) {
      if (gen !== seqGen) return;
      if (lastT === null) lastT = t;
      var dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      // spawn: one every ~1.6–2.2s, max 3 on screen
      if (t >= tc.nextSpawn && tc.treats.length < 3) {
        spawnTreat();
        tc.nextSpawn = t + 1600 + Math.random() * 600;
      }

      var ps = profileSize();
      var bx = brunoState.xFrac * W;
      var headTop = H - baselineY - ps.h;
      var mouthX = bx + brunoState.facing * ps.w * 0.28;
      var groundY = H - baselineY;

      for (var i = tc.treats.length - 1; i >= 0; i--) {
        var tr = tc.treats[i];
        tr.y += tr.speed * dt;
        var tx = tr.x0 + Math.sin((t / 1000) * tr.swayFreq * Math.PI * 2 + tr.phase) * tr.swayAmp;
        tr.el.style.left = Math.round(tx) + 'px';
        tr.el.style.top = Math.round(tr.y) + 'px';
        var bottom = tr.y + tr.size;
        // catch: bottom reaches the head zone AND overlaps the mouth area
        var inHeadBand = bottom >= headTop - 8 && bottom <= headTop + ps.h * 0.55;
        var overMouth = Math.abs(tx - mouthX) < ps.w * 0.38 + tr.size / 2;
        if (inHeadBand && overMouth) {
          tc.treats.splice(i, 1);
          tcCatch(tr, t);
          continue;
        }
        // miss: soft bounce on the grass, then fade — no penalty, no sound
        if (bottom >= groundY) {
          tc.treats.splice(i, 1);
          tr.el.style.top = Math.round(groundY - tr.size) + 'px';
          tr.el.classList.add('treat-land');
          (function (el) { setTimeout(function () { el.remove(); }, 1000); })(tr.el);
        }
      }

      // Bruno runs toward the last tapped x at fetch speed
      var moving = false;
      if (tc.target !== null) {
        var dir = tc.target > brunoState.xFrac ? 1 : -1;
        var dxF = (0.42 * H * dt) / W;
        if (Math.abs(tc.target - brunoState.xFrac) <= dxF) {
          brunoState.xFrac = tc.target;
          tc.target = null;
        } else {
          brunoState.xFrac += dxF * dir;
          brunoState.facing = dir;
          moving = true;
        }
        placeBruno();
      }

      // pose priority: catch flash > running > idle profile breathing
      if (t < tc.catchUntil) {
        if (tc.mode !== 'catch') { tc.mode = 'catch'; setAnim(null); setPose('catch'); }
      } else if (moving) {
        if (tc.mode !== 'run') {
          tc.mode = 'run';
          setAnim(null);
          tc.frame = 0;
          tc.lastSwap = t;
          setPose(RUN_FRAMES[0]);
        }
        if (t - tc.lastSwap > 100) { // ~10 fps run cycle, same as fetch
          tc.lastSwap = t;
          tc.frame = (tc.frame + 1) % RUN_FRAMES.length;
          setPose(RUN_FRAMES[tc.frame]);
        }
      } else if (tc.mode !== 'idle') {
        tc.mode = 'idle';
        setPose('profile_right');
        setAnim('anim-breathe');
      }

      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function exitTreatCatch() {
    if (state !== S.TC_PLAY) return;
    var gen = ++seqGen;
    setState(S.TC_EXIT);
    gameLayer.innerHTML = '';
    tc.treats = [];
    tc.dragging = false;
    (async function () {
      try {
        setAnim(null);
        if (!(await runTo(0.5, gen))) return;
        goIdle();
      } catch (e) {
        if (gen === seqGen) goIdle();
      }
    })();
  }

  // ---------- BACKYARD DASH (BD_*) ----------
  // The yard scrolls under Bruno while he jogs in place; tap = jump.
  // Bumping an obstacle just puffs it away with a shake — never a failure.
  var BD_JUMP_MS = 700;
  var bd = {
    obs: null, nextSpawn: 0, jumping: false, jumpStart: 0,
    wiggleUntil: 0, frame: 0, lastSwap: 0, mode: 'run'
  };

  function enterDash() {
    if (state !== S.IDLE) return;
    var gen = ++seqGen;
    setState(S.BD_ENTER);
    updateDashChip();
    (async function () {
      try {
        if (!(await runTo(0.25, gen))) return;
        yard.classList.add('dashing');
        bd.obs = null;
        bd.jumping = false;
        bd.wiggleUntil = 0;
        bd.mode = 'run';
        bd.frame = 0;
        setAnim(null);
        setPose(RUN_FRAMES[0], 1);
        setState(S.BD_PLAY);
        bdLoop(gen);
      } catch (e) {
        if (gen === seqGen) goIdle();
      }
    })();
  }

  function spawnObstacle() {
    var isLog = Math.random() < 0.5;
    var el = document.createElement('div');
    el.className = isLog ? 'obstacle obs-log' : 'obstacle obs-puddle';
    gameLayer.appendChild(el);
    bd.obs = {
      el: el,
      x: W + 100,
      w: Math.round(H * (isLog ? 0.12 : 0.15)),
      scored: false
    };
    el.style.left = Math.round(bd.obs.x) + 'px';
  }

  function bdJump() {
    if (state !== S.BD_PLAY) return;
    if (bd.jumping) return; // mid-air taps are safely ignored — never queued
    bd.jumping = true;
    bd.jumpStart = performance.now();
    // Generous timing window (ages 4–7): a jump started while the obstacle
    // is anywhere on approach guarantees the clear — Bruno's chunky sprite
    // is wider than the whole jump arc, so exact timing can never be asked.
    if (bd.obs && !bd.obs.scored) {
      var dist = bd.obs.x - brunoState.xFrac * W;
      var reach = ((W + 220) / 3) * (BD_JUMP_MS / 1000); // px the obstacle travels mid-air
      if (dist > -bd.obs.w / 2 - 40 && dist < reach + bd.obs.w / 2 + 60) bd.obs.safe = true;
    }
    sfx.boing();
    setAnim(null);
    setPose('catch', 1);
    bd.mode = 'jump';
  }

  function bdLoop(gen) {
    var lastT = null;
    bd.nextSpawn = performance.now() + 1400;
    function step(t) {
      if (gen !== seqGen) return;
      if (lastT === null) lastT = t;
      var dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      // jump arc: smooth sine up-over-down
      if (bd.jumping) {
        var u = (t - bd.jumpStart) / BD_JUMP_MS;
        if (u >= 1) {
          bd.jumping = false;
          bruno.style.bottom = baselineY + 'px';
        } else {
          bruno.style.bottom = Math.round(baselineY + Math.sin(Math.PI * u) * 0.24 * H) + 'px';
        }
      }

      // obstacle: one at a time, gentle fixed speed (~3s to cross)
      var obsSpeed = (W + 220) / 3;
      if (!bd.obs && t >= bd.nextSpawn) spawnObstacle();
      if (bd.obs) {
        var o = bd.obs;
        o.x -= obsSpeed * dt;
        o.el.style.left = Math.round(o.x) + 'px';
        var bx = brunoState.xFrac * W;
        var ps = profileSize();
        var overlap = Math.abs(o.x - bx) < o.w / 2 + ps.w * 0.22;
        if (overlap && !o.scored && !o.safe && !bd.jumping) {
          // gentle bump: obstacle puffs away, Bruno shakes it off, run continues
          o.scored = true;
          o.el.classList.add('puff');
          (function (el) { setTimeout(function () { el.remove(); }, 450); })(o.el);
          bd.obs = null;
          bd.nextSpawn = t + 2200 + Math.random() * 1000;
          sfx.softRattle();
          bd.wiggleUntil = t + 500;
          setPose('wash_shake', 1);
          setAnim('anim-wiggle');
          bd.mode = 'wiggle';
        } else if (!o.scored && o.x + o.w / 2 < bx - ps.w * 0.25) {
          // cleared!
          o.scored = true;
          sfx.blip();
          store.dashCount++;
          save();
          updateDashChip();
          bumpChip(dashChip);
          // every 6 cleared obstacles count as one completed action
          if (store.dashCount % 6 === 0) completeAction();
        }
        if (bd.obs && bd.obs.x < -bd.obs.w - 60) {
          bd.obs.el.remove();
          bd.obs = null;
          bd.nextSpawn = t + 2200 + Math.random() * 1000;
        }
      }

      // pose priority: shake-it-off wiggle > jump pose > run cycle
      if (bd.mode === 'wiggle') {
        if (t >= bd.wiggleUntil) {
          setAnim(null);
          bd.mode = 'run';
          bd.frame = 0;
          bd.lastSwap = t;
          setPose(RUN_FRAMES[0], 1);
        }
      } else if (bd.jumping) {
        // hold the leap pose for the whole arc
      } else {
        if (bd.mode !== 'run') {
          bd.mode = 'run';
          setAnim(null);
          bd.frame = 0;
          bd.lastSwap = t;
          setPose(RUN_FRAMES[0], 1);
        }
        if (t - bd.lastSwap > 100) { // ~10 fps run cycle, same as fetch
          bd.lastSwap = t;
          bd.frame = (bd.frame + 1) % RUN_FRAMES.length;
          setPose(RUN_FRAMES[bd.frame], 1);
        }
      }

      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function exitDash() {
    if (state !== S.BD_PLAY) return;
    var gen = ++seqGen;
    setState(S.BD_EXIT);
    yard.classList.remove('dashing');
    gameLayer.innerHTML = '';
    bd.obs = null;
    bd.jumping = false;
    bruno.style.bottom = baselineY + 'px';
    (async function () {
      try {
        setAnim(null);
        if (!(await runTo(0.5, gen))) return;
        goIdle();
      } catch (e) {
        if (gen === seqGen) goIdle();
      }
    })();
  }

  // ---------- SKY BRUNO (SB_*) ----------
  // Bruno bounces up cloud platforms forever. Falling is never a failure:
  // a parachute pops open and floats him gently back to the grass.
  var sb = {
    x: 0, y: 0, vx: 0, vy: 0, cam: 0, maxY: 0,
    steer: 0, holding: false, face: 1,
    plats: [], bones: [], genY: 0, lastX: 0,
    combo: 0, chute: null
  };
  function sbNums() {
    var g = 2.2 * H;                 // gravity px/s^2
    var v0 = 0.95 * H;               // bounce impulse px/s
    return {
      g: g, v0: v0,
      apex: (v0 * v0) / (2 * g),     // normal bounce height ~0.205 * H
      tramp: 2.2,                    // trampoline impulse multiplier
      acc: 3.2 * W,                  // steer acceleration px/s^2
      maxVx: 0.95 * W,               // steer top speed px/s
      platW: Math.max(72, Math.round(W * 0.2))
    };
  }
  function updateSkyChip(n) { skyCountEl.textContent = String(n); }
  function sbWrapDX(a, b) {
    var d = a - b;
    if (d > W / 2) d -= W;
    if (d < -W / 2) d += W;
    return d;
  }
  function sbScreenBottom(worldY) { return baselineY + (worldY - sb.cam); }
  function sbClampX(x) {
    var m = sbNums().platW / 2 + 8;
    return Math.min(W - m, Math.max(m, x));
  }

  function sbAddPlat(x, y, type) {
    var n = sbNums();
    var el = document.createElement('div');
    el.className = 'sb-plat' +
      (type === 'drift' ? ' sb-drift' : '') +
      (type === 'puff' ? ' sb-puff' : '');
    el.style.width = n.platW + 'px';
    if (type === 'tramp') {
      var tr = document.createElement('div');
      tr.className = 'sb-tramp';
      el.appendChild(tr);
    }
    gameLayer.appendChild(el);
    sb.plats.push({
      el: el, x: x, y: y, type: type,
      vx: type === 'drift' ? (0.07 + Math.random() * 0.06) * W * (Math.random() < 0.5 ? -1 : 1) : 0
    });
  }
  function sbAddBone(x, y) {
    var el = document.createElement('div');
    el.className = 'sb-bone';
    el.textContent = '🦴';
    gameLayer.appendChild(el);
    sb.bones.push({ el: el, x: x, y: y });
  }

  // Procedural climb: cozy and dense near the grass, airier higher up,
  // but the next cloud is ALWAYS within 78% of a normal bounce apex.
  function sbGenUpTo(top) {
    var n = sbNums();
    while (sb.genY < top) {
      var pm = sb.genY / 10; // paw-meters at this altitude
      var grow = Math.min(1, Math.max(0, (sb.genY - 300) / 3000)); // 0 cozy -> 1 airy
      var gap = n.apex * (0.3 + 0.2 * grow) + Math.random() * n.apex * (0.2 + 0.08 * grow);
      gap = Math.min(gap, 0.78 * n.apex);
      var y = sb.genY + gap;
      var dxMax = W * (0.22 + 0.2 * grow); // steerable in one bounce's airtime
      var x = sbClampX(sb.lastX + (Math.random() * 2 - 1) * dxMax);
      var type = 'normal';
      var r = Math.random();
      if (r < 0.1) type = 'tramp';                 // ~1 in 10
      else if (pm > 60 && r < 0.3) type = 'puff';  // ~1 in 5 above height 60
      else if (pm > 30 && r < 0.55) type = 'drift';// ~1 in 4 above height 30
      sbAddPlat(x, y, type);
      // cozy low altitude: often a second cloud on the same row
      if (pm < 30 && Math.random() < 0.5) {
        sbAddPlat(sbClampX(x + (x < W / 2 ? 1 : -1) * (0.3 + Math.random() * 0.15) * W),
                  y + (Math.random() * 20 - 10), 'normal');
      }
      if (Math.random() < 0.33) {
        sbAddBone(sbClampX(x + (Math.random() * 2 - 1) * 50), y + 55 + Math.random() * 25);
      }
      sb.lastX = x;
      sb.genY = y;
    }
  }

  function skyStartRun(gen) {
    poseScale = 0.62; // smaller dog, bigger sky
    gameLayer.innerHTML = '';
    if (sb.chute) { sb.chute.remove(); sb.chute = null; }
    sb.plats = [];
    sb.bones = [];
    sb.x = 0.5 * W;
    sb.y = 0;
    sb.vx = 0;
    sb.cam = 0;
    sb.maxY = 0;
    sb.steer = 0;
    sb.holding = false;
    sb.face = 1;
    sb.combo = 0;
    var n = sbNums();
    sb.vy = n.v0; // the first bounce fires itself from the grass
    // starter row: cozy clouds right above the yard
    sb.lastX = 0.5 * W;
    sbAddPlat(sbClampX(0.26 * W), 0.5 * n.apex, 'normal');
    sbAddPlat(sbClampX(0.5 * W), 0.56 * n.apex, 'normal');
    sbAddPlat(sbClampX(0.74 * W), 0.5 * n.apex, 'normal');
    sb.genY = 0.9 * n.apex;
    sbGenUpTo(H * 1.3);
    updateSkyChip(0);
    brunoImg.classList.remove('sb-spin', 'sb-squash');
    setAnim(null);
    setPose('catch', 1);
    bruno.style.left = Math.round(sb.x) + 'px';
    bruno.style.bottom = baselineY + 'px';
    sfx.skyBoing(0);
    setState(S.SB_PLAY);
    sbLoop(gen);
  }

  function enterSky() {
    if (state !== S.IDLE) return;
    var gen = ++seqGen;
    skyStartRun(gen);
  }

  function sbBounce(p) {
    var n = sbNums();
    var isTramp = p && p.type === 'tramp';
    sb.vy = n.v0 * (isTramp ? n.tramp : 1);
    if (isTramp) {
      sb.combo = 0;
      sfx.megaBoing();
      popSparkles(2);
      brunoImg.classList.remove('sb-spin', 'sb-squash');
      void brunoImg.offsetWidth;
      brunoImg.classList.add('sb-spin');
      setTimeout(function () { brunoImg.classList.remove('sb-spin'); }, 800);
    } else {
      sb.combo = Math.min(sb.combo + 1, 10);
      sfx.skyBoing(sb.combo);
      brunoImg.classList.remove('sb-squash');
      void brunoImg.offsetWidth;
      brunoImg.classList.add('sb-squash');
    }
    if (p && p.type === 'puff') {
      // one bounce, then the wispy cloud poofs away
      var idx = sb.plats.indexOf(p);
      if (idx !== -1) sb.plats.splice(idx, 1);
      p.el.classList.add('sb-puffed');
      noise(0.12, { filterType: 'highpass', filterFreq: 1800, vol: 0.1 });
      (function (el) { setTimeout(function () { el.remove(); }, 500); })(p.el);
    }
  }

  function sbLoop(gen) {
    var lastT = null;
    function step(t) {
      if (gen !== seqGen) return;
      if (lastT === null) lastT = t;
      var dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;
      var n = sbNums();
      var i, p;

      // steering: press-and-hold halves, with a little inertia
      if (sb.steer !== 0) sb.vx += sb.steer * n.acc * dt;
      else sb.vx *= Math.max(0, 1 - 3.2 * dt); // slight damping
      sb.vx = Math.min(n.maxVx, Math.max(-n.maxVx, sb.vx));
      sb.x += sb.vx * dt;
      if (sb.x < 0) sb.x += W;   // wrap-around at the side edges
      if (sb.x >= W) sb.x -= W;
      if (Math.abs(sb.vx) > 0.05 * W) sb.face = sb.vx > 0 ? 1 : -1;

      // gravity
      var prevY = sb.y;
      sb.vy -= n.g * dt;
      if (sb.vy < -1.8 * H) sb.vy = -1.8 * H;
      sb.y += sb.vy * dt;

      // drifters slide back and forth
      for (i = 0; i < sb.plats.length; i++) {
        p = sb.plats[i];
        if (p.vx) {
          p.x += p.vx * dt;
          var m = n.platW / 2 + 8;
          if (p.x < m) { p.x = m; p.vx = Math.abs(p.vx); }
          if (p.x > W - m) { p.x = W - m; p.vx = -Math.abs(p.vx); }
        }
      }

      var ps = profileSize();
      // land only when falling onto a cloud from above (pass-through going up)
      if (sb.vy < 0) {
        for (i = 0; i < sb.plats.length; i++) {
          p = sb.plats[i];
          if (p.y > prevY || p.y < sb.y) continue; // feet must cross the cloud top
          if (Math.abs(sbWrapDX(sb.x, p.x)) < n.platW / 2 + ps.w * 0.18) {
            sb.y = p.y;
            sbBounce(p);
            break;
          }
        }
        // at ground level the grass itself is springy — no way to fail early
        if (sb.vy < 0 && sb.y <= 0 && sb.cam < 2) {
          sb.y = 0;
          sbBounce(null);
        }
      }

      // camera scrolls the world down once Bruno crosses ~55% screen height
      var sBottom = sbScreenBottom(sb.y);
      if (sBottom > 0.55 * H) {
        sb.cam += sBottom - 0.55 * H;
        sBottom = 0.55 * H;
      }

      if (sb.y > sb.maxY) {
        sb.maxY = sb.y;
        updateSkyChip(Math.floor(sb.maxY / 10)); // 1 paw-meter = 10px climbed
      }

      sbGenUpTo(sb.cam + H * 1.3);

      // bones: pure bonus, +blip and sparkle
      for (i = sb.bones.length - 1; i >= 0; i--) {
        var b = sb.bones[i];
        if (Math.abs(sbWrapDX(sb.x, b.x)) < 46 && Math.abs(sb.y + ps.h * 0.45 - b.y) < 60) {
          sb.bones.splice(i, 1);
          b.el.classList.add('sb-got');
          (function (el) { setTimeout(function () { el.remove(); }, 450); })(b.el);
          sfx.blip();
          spawnFx('sparkle', b.x, H - sbScreenBottom(b.y), '✨');
          store.skyBones++;
          save();
          bumpChip(skyChip);
          // every 15 bones ever collected counts as one completed action
          if (store.skyBones % 15 === 0) completeAction();
        } else if (b.y < sb.cam - 0.25 * H) {
          sb.bones.splice(i, 1);
          b.el.remove();
        }
      }

      // cull clouds that scrolled away below
      for (i = sb.plats.length - 1; i >= 0; i--) {
        if (sb.plats[i].y < sb.cam - 0.25 * H) {
          sb.plats[i].el.remove();
          sb.plats.splice(i, 1);
        }
      }

      // render
      for (i = 0; i < sb.plats.length; i++) {
        p = sb.plats[i];
        p.el.style.left = Math.round(p.x) + 'px';
        p.el.style.bottom = Math.round(sbScreenBottom(p.y)) + 'px';
      }
      for (i = 0; i < sb.bones.length; i++) {
        sb.bones[i].el.style.left = Math.round(sb.bones[i].x) + 'px';
        sb.bones[i].el.style.bottom = Math.round(sbScreenBottom(sb.bones[i].y)) + 'px';
      }
      var ground = Math.min(sb.cam, H);
      grassEl.style.transform = 'translateY(' + Math.round(ground) + 'px)';
      fenceEl.style.transform = 'translateY(' + Math.round(ground) + 'px)';
      bruno.style.left = Math.round(sb.x) + 'px';
      bruno.style.bottom = Math.round(sBottom) + 'px';

      // pose: leaping up (paws out) vs sailing down (profile)
      var wantPose = sb.vy > 0 ? 'catch' : 'profile_right';
      if (brunoState.pose !== wantPose || brunoState.facing !== sb.face) {
        setPose(wantPose, sb.face);
      }

      // fell past the bottom edge: deploy the parachute ride home
      if (sbScreenBottom(sb.y) < -ps.h * 0.6 && sb.cam > 2) {
        skyFall(gen);
        return;
      }

      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function skyFall(gen) {
    if (gen !== seqGen) return;
    setState(S.SB_FALL);
    sb.combo = 0;
    sb.steer = 0;
    sb.holding = false;
    var heightPm = Math.floor(sb.maxY / 10);
    // parachute pops open above Bruno
    var chute = document.createElement('div');
    chute.className = 'sb-chute';
    bruno.insertBefore(chute, brunoImg);
    sb.chute = chute;
    setAnim(null);
    setPose('profile_right', 1);
    sfx.chuteOpen();
    var camStart = sb.cam;
    var xStart = sb.x;
    var y0 = camStart + H + 60 - baselineY; // re-enter from just above the top
    var t0 = null;
    var DUR = 2000; // the gentle ~2s float down
    function step(t) {
      if (gen !== seqGen) return;
      if (t0 === null) t0 = t;
      var u = Math.min(1, (t - t0) / DUR);
      var e = u * u * (3 - 2 * u); // smoothstep
      sb.cam = camStart * (1 - e);
      sb.y = y0 * (1 - e);
      sb.x = xStart + (0.5 * W - xStart) * e + Math.sin(u * 5) * 14 * (1 - u);
      var ground = Math.min(sb.cam, H);
      grassEl.style.transform = 'translateY(' + Math.round(ground) + 'px)';
      fenceEl.style.transform = 'translateY(' + Math.round(ground) + 'px)';
      var i;
      for (i = 0; i < sb.plats.length; i++) {
        sb.plats[i].el.style.bottom = Math.round(sbScreenBottom(sb.plats[i].y)) + 'px';
      }
      for (i = 0; i < sb.bones.length; i++) {
        sb.bones[i].el.style.bottom = Math.round(sbScreenBottom(sb.bones[i].y)) + 'px';
      }
      bruno.style.left = Math.round(sb.x) + 'px';
      bruno.style.bottom = Math.round(sbScreenBottom(sb.y)) + 'px';
      if (u < 1) { requestAnimationFrame(step); return; }
      skyLand(gen, heightPm);
    }
    requestAnimationFrame(step);
  }

  function skyLand(gen, heightPm) {
    if (gen !== seqGen) return;
    // parachute folds away
    if (sb.chute) {
      sb.chute.classList.add('fold');
      (function (el) { setTimeout(function () { el.remove(); }, 350); })(sb.chute);
      sb.chute = null;
    }
    sfx.boing();
    setPose('profile_right', 1);
    setAnim('anim-breathe');
    bruno.style.left = Math.round(0.5 * W) + 'px';
    bruno.style.bottom = baselineY + 'px';
    // friendly results: this climb + best ever (icons only)
    var newBest = heightPm > (store.skyBest || 0);
    if (newBest) store.skyBest = heightPm;
    save();
    var res = document.createElement('div');
    res.className = 'sb-results';
    res.innerHTML = '<div class="sb-res-chip">🐾 ' + heightPm + '</div>' +
                    '<div class="sb-res-chip sb-res-best">🏆 ' + store.skyBest + '</div>';
    gameLayer.appendChild(res);
    // one tap anywhere relaunches — big pulsing ripple hint
    hintEl.style.left = Math.round(0.5 * W) + 'px';
    hintEl.style.top = Math.round(0.55 * H) + 'px';
    setState(S.SB_READY);
    if (newBest) {
      popSparkles(5);
      completeAction(); // beating the best counts as one completed action
    }
  }

  function skyRelaunch() {
    if (state !== S.SB_READY) return;
    var gen = ++seqGen;
    skyStartRun(gen);
  }

  function exitSky() {
    if (!inSB()) return;
    var wasReady = state === S.SB_READY; // results already banked that run
    var gen = ++seqGen; // kills any sb rAF loop instantly
    setState(S.SB_EXIT);
    // an exit mid-climb still counts toward the best height
    var heightPm = Math.floor(sb.maxY / 10);
    if (!wasReady && heightPm > (store.skyBest || 0)) {
      store.skyBest = heightPm;
      save();
      completeAction();
    }
    sb.plats = [];
    sb.bones = [];
    sb.holding = false;
    sb.steer = 0;
    goIdle();
  }

  // ---------- Stickers ----------
  function renderStickerBook() {
    stickerGrid.innerHTML = '';
    STICKERS.forEach(function (emoji, i) {
      var cell = document.createElement('div');
      var earned = store.stickers.indexOf(i) !== -1;
      cell.className = 'sticker' + (earned ? '' : ' locked');
      cell.textContent = emoji;
      stickerGrid.appendChild(cell);
    });
    bookPage.classList.toggle('complete', store.stickers.length >= 12);
  }

  function completeAction() {
    store.actions++;
    save();
    if (store.actions % 3 !== 0) return;
    var unearned = [];
    for (var i = 0; i < 12; i++) if (store.stickers.indexOf(i) === -1) unearned.push(i);
    if (unearned.length === 0) return;
    var pick = unearned[Math.floor(Math.random() * unearned.length)];
    store.stickers.push(pick);
    save();
    // celebration moment
    celebrateSticker.textContent = STICKERS[pick];
    celebrateEl.classList.remove('hidden');
    confettiBurst(26);
    sfx.jingle();
    var allDone = store.stickers.length >= 12;
    if (allDone) {
      setTimeout(function () { sfx.rainbow(); confettiBurst(40); }, 900);
    }
    setTimeout(function () {
      celebrateEl.classList.add('hidden');
    }, allDone ? 3600 : 2200);
  }

  // ---------- Sticker book UI ----------
  function openBook() {
    renderStickerBook();
    bookOverlay.classList.remove('hidden');
  }
  function closeBook() {
    bookOverlay.classList.add('hidden');
  }
  // hidden parent reset: long-press the paw title for 1.5s
  var pressTimer = null;
  function titleDown() {
    pressTimer = setTimeout(function () {
      store.stickers = [];
      store.actions = 0;
      save();
      renderStickerBook();
    }, 1500);
  }
  function titleUp() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  }
  bookTitle.addEventListener('pointerdown', titleDown);
  bookTitle.addEventListener('pointerup', titleUp);
  bookTitle.addEventListener('pointerleave', titleUp);

  // ---------- Sound toggle ----------
  function renderSoundBtn() {
    btnSound.textContent = store.sound ? '🔊' : '🔇';
  }
  btnSound.addEventListener('click', function () {
    store.sound = !store.sound;
    save();
    renderSoundBtn();
    if (store.sound) { ensureAudio(); sfx.bark(); }
    else stopSnore();
    if (store.sound && state === S.SLEEPING) startSnore();
  });

  // ---------- Input wiring ----------
  btnFeed.addEventListener('click', function () { ensureAudio(); doFeed(); });
  btnWash.addEventListener('click', function () { ensureAudio(); doWash(); });
  btnSleep.addEventListener('click', function () { ensureAudio(); doSleep(); });
  btnFetch.addEventListener('click', function () { ensureAudio(); enterFetch(); });
  btnHome.addEventListener('click', function () {
    ensureAudio();
    if (inFetch()) exitFetch();
    else if (state === S.TC_PLAY) exitTreatCatch();
    else if (state === S.BD_PLAY) exitDash();
    else if (inSB()) exitSky();
  });
  btnGames.addEventListener('click', function () { ensureAudio(); openPicker(); });
  btnPickerClose.addEventListener('click', closePicker);
  pickerOverlay.addEventListener('click', function (e) {
    if (e.target === pickerOverlay) closePicker();
  });
  tileTreat.addEventListener('click', function () { ensureAudio(); closePicker(); enterTreatCatch(); });
  tileDash.addEventListener('click', function () { ensureAudio(); closePicker(); enterDash(); });
  tileSky.addEventListener('click', function () { ensureAudio(); closePicker(); enterSky(); });
  btnStickers.addEventListener('click', function () { ensureAudio(); openBook(); });
  btnBookClose.addEventListener('click', closeBook);
  bookOverlay.addEventListener('click', function (e) {
    if (e.target === bookOverlay) closeBook();
  });

  // yard-level taps (pointerdown = snappy for kids)
  yard.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button')) return;
    ensureAudio();
    if (state === S.SLEEPING) { wakeUp(); return; }
    var rect = yard.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var br = bruno.getBoundingClientRect();
    var onBruno = e.clientX >= br.left - 20 && e.clientX <= br.right + 20 &&
                  e.clientY >= br.top - 20 && e.clientY <= br.bottom + 20;
    if (state === S.FETCH_READY) {
      throwBall(x);
      if (onBruno) popHearts(1);
      return;
    }
    if (state === S.TC_PLAY) {
      tc.dragging = true;
      tc.target = clampFrac(x / W);
      if (onBruno) popHearts(1);
      return;
    }
    if (state === S.BD_PLAY) {
      bdJump();
      return;
    }
    if (state === S.SB_PLAY) {
      // press-and-hold steering: left half = left, right half = right
      sb.holding = true;
      sb.steer = x < W / 2 ? -1 : 1;
      return;
    }
    if (state === S.SB_READY) {
      skyRelaunch(); // one tap anywhere = instant new climb
      return;
    }
    if (onBruno) brunoTapReaction();
  });

  // drag steering in Treat Catch + held steering in Sky Bruno
  yard.addEventListener('pointermove', function (e) {
    if (state === S.TC_PLAY && tc.dragging) {
      var rect = yard.getBoundingClientRect();
      tc.target = clampFrac((e.clientX - rect.left) / W);
      return;
    }
    if (state === S.SB_PLAY && sb.holding) {
      var r2 = yard.getBoundingClientRect();
      sb.steer = (e.clientX - r2.left) < W / 2 ? -1 : 1;
    }
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    yard.addEventListener(ev, function () {
      tc.dragging = false;
      sb.holding = false;
      sb.steer = 0;
    });
  });

  // ---------- Resize ----------
  window.addEventListener('resize', function () {
    measure();
    placeBruno();
    setPose(brunoState.pose); // re-derive display size at the new H
    if (inFetch() && !ballEl.classList.contains('hidden')) {
      ballPos.x = Math.min(ballPos.x, 0.95 * W);
      placeBall();
    }
  });

  // ---------- Boot ----------
  renderSoundBtn();
  updateFetchChip();
  updateTreatChip();
  updateDashChip();
  updateSkyChip(0);
  goIdle();
})();
