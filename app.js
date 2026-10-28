/* 雨爱（司凤版）· Folia 风格播放器
 * 中央动图（aaa.gif）随旋律持续旋转，检测到鼓点/重拍时踩点蹦哒
 * 背景 Mesh 渐变色从动图中自动提取（Folia 的 AI 配色思路）
 */

const $ = (s) => document.querySelector(s);

const audio = $('#audio');
const cover = $('#cover');
const disc = $('#disc');
const halo = $('#halo');
const shadow = $('#shadow');
const playBtn = $('#play');
const startMask = $('#start-mask');
const waveCv = $('#wave');
const wctx = waveCv.getContext('2d');
const orbit = $('#orbit');

const curEl = $('#cur'), durEl = $('#dur'), fillEl = $('#fill'), knobEl = $('#knob');
const barEl = $('#bar'), volEl = $('#vol'), loopBtn = $('#loop');
const muteBtn = $('#mute'), muteBtn2 = $('#mute2');
const lyricsInner = $('#lyrics-inner');

/* 曲目固定为《雨爱（司凤版）》 */
const DEFAULT_SRC = 'audio/yuai.mp3';
audio.src = DEFAULT_SRC;

let actx = null, analyser = null, srcNode = null;
let freq = null, wave = null;
let playing = false;

/* ---------- 音频图 ---------- */
function ensureGraph() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = actx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.72;
  srcNode = actx.createMediaElementSource(audio);
  srcNode.connect(analyser);
  analyser.connect(actx.destination);
  freq = new Uint8Array(analyser.frequencyBinCount);
  wave = new Uint8Array(analyser.fftSize);
}

/* ---------- 播放控制 ---------- */
async function togglePlay() {
  ensureGraph();
  if (actx.state === 'suspended') await actx.resume();
  if (audio.paused) {
    try { await audio.play(); } catch (e) { console.warn(e); }
  } else {
    audio.pause();
  }
}

playBtn.addEventListener('click', togglePlay);
startMask.addEventListener('click', togglePlay);

audio.addEventListener('play', () => {
  playing = true;
  playBtn.classList.add('playing');
  startMask.classList.add('gone');
});
audio.addEventListener('pause', () => {
  playing = false;
  playBtn.classList.remove('playing');
});
audio.addEventListener('ended', () => {
  playing = false;
  playBtn.classList.remove('playing');
});
audio.addEventListener('loadedmetadata', () => { durEl.textContent = fmt(audio.duration); });
audio.addEventListener('error', () => {
  startMask.querySelector('.start-title').textContent = '未找到 audio/雨爱（司凤版）.mp3';
});

/* ---------- 音量 / 静音 / 循环 ---------- */
volEl.addEventListener('input', () => { audio.volume = volEl.value / 100; });
audio.volume = volEl.value / 100;

function setMuted(m) {
  audio.muted = m;
  muteBtn.classList.toggle('muted', m);
  muteBtn2.textContent = m ? '开启' : '关闭';
  muteBtn2.classList.toggle('active', !m);
}
muteBtn.addEventListener('click', () => setMuted(!audio.muted));
muteBtn2.addEventListener('click', () => setMuted(!audio.muted));

loopBtn.addEventListener('click', () => {
  const on = loopBtn.classList.toggle('active');
  audio.loop = on;
});

/* ---------- 进度条 ---------- */
let seeking = false;
function seekFromEvent(e) {
  const r = barEl.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const p = Math.min(1, Math.max(0, x / r.width));
  if (audio.duration) audio.currentTime = p * audio.duration;
  paintProgress(p);
}
barEl.addEventListener('pointerdown', (e) => { seeking = true; barEl.setPointerCapture(e.pointerId); seekFromEvent(e); });
barEl.addEventListener('pointermove', (e) => { if (seeking) seekFromEvent(e); });
barEl.addEventListener('pointerup', () => { seeking = false; });

function paintProgress(p) {
  fillEl.style.width = (p * 100) + '%';
  knobEl.style.left = (p * 100) + '%';
}
audio.addEventListener('timeupdate', () => {
  if (seeking || !audio.duration) return;
  paintProgress(audio.currentTime / audio.duration);
  curEl.textContent = fmt(audio.currentTime);
});

function fmt(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + String(r).padStart(2, '0');
}

/* ---------- 右侧面板 ---------- */
$('#panel-toggle').addEventListener('click', () => $('#panel').classList.toggle('hidden'));
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    document.querySelectorAll('.tab-page').forEach((p) => p.classList.remove('active'));
    $('#tab-' + t.dataset.tab).classList.add('active');
  });
});

/* ---------- 快捷键 ---------- */
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') audio.currentTime += 5;
  if (e.code === 'ArrowLeft') audio.currentTime -= 5;
  if (e.key === 'm' || e.key === 'M') setMuted(!audio.muted);
});

/* ---------- 从动图提取配色（Folia AI 主题配色思路） ---------- */
const FALLBACK_PALETTE = [[340, 82, 68], [190, 90, 66], [268, 84, 70]];
let waveC1 = 'hsl(340 82% 68%)';
let waveC2 = 'hsl(190 90% 66%)';

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

function extractPalette() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const g = c.getContext('2d', { willReadFrequently: true });
    const im = new Image();
    im.onload = () => {
      try {
        g.drawImage(im, 0, 0, 48, 48);
        const d = g.getImageData(0, 0, 48, 48).data;
        const buckets = {};
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], gg = d[i + 1], b = d[i + 2];
          const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
          if (max < 50) continue;
          const sat = (max - min) / max;
          if (sat < 0.2) continue;
          let h;
          if (max === r) h = 60 * (((gg - b) / (max - min)) % 6);
          else if (max === gg) h = 60 * ((b - r) / (max - min) + 2);
          else h = 60 * ((r - gg) / (max - min) + 4);
          if (h < 0) h += 360;
          const key = Math.round(h / 24) * 24 % 360;
          buckets[key] = (buckets[key] || 0) + sat * (max / 255);
        }
        const top = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 3);
        if (!top.length) throw new Error('no color');
        applyPalette(top.map(([h]) => [Number(h), 72, 62]));
      } catch (err) {
        applyPalette(FALLBACK_PALETTE);
      }
    };
    im.onerror = () => applyPalette(FALLBACK_PALETTE);
    im.src = cover.src;
  } catch (err) {
    applyPalette(FALLBACK_PALETTE);
  }
}

function applyPalette(pal) {
  const css = pal.map(([h, s, l]) => 'hsl(' + h + ' ' + s + '% ' + l + '%)');
  const rs = document.documentElement.style;
  rs.setProperty('--c1', css[0]);
  rs.setProperty('--c2', css[1] || css[0]);
  rs.setProperty('--c3', css[2] || css[1] || css[0]);
  waveC1 = css[0];
  waveC2 = css[1] || css[0];
  if (bg) {
    const gl = bg.gl;
    for (let i = 0; i < 3; i++) {
      const src = pal[i] || pal[0];
      const rgb = hslToRgb(src[0], src[1], src[2]);
      gl.uniform3f(bg.u['uC' + (i + 1)], rgb[0], rgb[1], rgb[2]);
    }
  }
}

/* ---------- WebGL Mesh 渐变背景（Folia latent 风格，GPU 渲染） ---------- */
const BG_VS = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';
const BG_FS = [
  '#ifdef GL_FRAGMENT_PRECISION_HIGH',
  'precision highp float;',
  '#else',
  'precision mediump float;',
  '#endif',
  'uniform vec2 uRes;',
  'uniform float uT;',
  'uniform float uLevel;',
  'uniform float uBeat;',
  'uniform vec3 uC1;',
  'uniform vec3 uC2;',
  'uniform vec3 uC3;',
  'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
  'void main(){',
  '  vec2 p=(gl_FragCoord.xy-0.5*uRes)/uRes.y;',
  '  float t=uT;',
  '  vec3 col=vec3(0.030,0.030,0.042);',
  '  float pulse=0.60+uLevel*0.85+uBeat*0.45;',
  '  vec2 q1=vec2(sin(t*0.21)*0.60,cos(t*0.16)*0.34);',
  '  vec2 q2=vec2(cos(t*0.15+1.8)*0.56,sin(t*0.19+0.7)*0.36);',
  '  vec2 q3=vec2(sin(t*0.12+3.2)*0.48+0.22,cos(t*0.14+2.4)*0.28-0.12);',
  '  col+=uC1*(0.075*pulse)/(dot(p-q1,p-q1)+0.060);',
  '  col+=uC2*(0.062*pulse)/(dot(p-q2,p-q2)+0.055);',
  '  col+=uC3*(0.055*pulse)/(dot(p-q3,p-q3)+0.050);',
  '  col+=vec3(0.045,0.045,0.065)*exp(-dot(p,p)*1.1);',
  // 漂浮粒子光点
  '  float pts=0.0;',
  '  for(int i=0;i<14;i++){',
  '    float fi=float(i);',
  '    vec2 c=vec2(sin(t*(0.10+0.028*fi)+fi*2.4)*0.85,cos(t*(0.08+0.022*fi)+fi*1.7)*0.50);',
  '    float r=0.0038*(0.65+0.35*sin(t*2.2+fi*3.1));',
  '    pts+=1.0-smoothstep(0.0,r,length(p-c));',
  '  }',
  '  col+=vec3(0.85,0.90,1.0)*min(pts,1.3)*(0.30+uLevel*0.85+uBeat*0.35);',
  '  col*=1.0-0.30*dot(p,p);',
  '  col=1.0-exp(-col*1.35);',
  '  col+=(hash(gl_FragCoord.xy+fract(t)*137.0)-0.5)*0.020;',
  '  gl_FragColor=vec4(col,1.0);',
  '}'
].join('\n');

let bg = null;
function initBG() {
  const cv = $('#bg');
  const opts = { alpha: false, antialias: false, depth: false, powerPreference: 'high-performance' };
  const gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts);
  if (!gl) return null;
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = mk(gl.VERTEX_SHADER, BG_VS);
  const fs = mk(gl.FRAGMENT_SHADER, BG_FS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('link:', gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = {};
  ['uRes', 'uT', 'uLevel', 'uBeat', 'uC1', 'uC2', 'uC3'].forEach((n) => { u[n] = gl.getUniformLocation(prog, n); });
  return { gl, cv, u };
}
bg = initBG();
if (bg) {
  FALLBACK_PALETTE.forEach((c, i) => {
    const rgb = hslToRgb(c[0], c[1], c[2]);
    bg.gl.uniform3f(bg.u['uC' + (i + 1)], rgb[0], rgb[1], rgb[2]);
  });
} else {
  $('#bg').style.display = 'none';
}
extractPalette();

function resizeBG() {
  if (!bg) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(bg.cv.clientWidth * dpr);
  const h = Math.round(bg.cv.clientHeight * dpr);
  if (bg.cv.width !== w || bg.cv.height !== h) {
    bg.cv.width = w;
    bg.cv.height = h;
    bg.gl.viewport(0, 0, w, h);
  }
}

function drawBG(now) {
  if (!bg) return;
  resizeBG();
  const gl = bg.gl;
  gl.uniform2f(bg.u.uRes, bg.cv.width, bg.cv.height);
  gl.uniform1f(bg.u.uT, now / 1000);
  gl.uniform1f(bg.u.uLevel, smoothLevel);
  gl.uniform1f(bg.u.uBeat, beatFlash);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/* ---------- 波形画布 ---------- */
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = waveCv.clientWidth; H = waveCv.clientHeight;
  waveCv.width = W * DPR; waveCv.height = H * DPR;
  wctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', () => { resize(); resizeBG(); });
resize();
resizeBG();

/* ---------- 节拍检测 ---------- */
const hist = [];
let lastBeat = 0;
let beatFlash = 0;     // 0~1 衰减，驱动蹦哒
let spinBoost = 0;     // 踩点时的额外转速
let angle = 0;         // 当前旋转角（弧度）
let smoothBass = 0, smoothMid = 0, smoothHigh = 0, smoothLevel = 0;
let beatTimes = [], bpm = 0;

function bandAvg(arr, fromHz, toHz, sr, fftSize) {
  const per = sr / fftSize;
  let a = Math.max(0, Math.floor(fromHz / per));
  let b = Math.min(arr.length - 1, Math.ceil(toHz / per));
  let s = 0;
  for (let i = a; i <= b; i++) s += arr[i];
  return s / Math.max(1, (b - a + 1)) / 255;
}

function detectBeat(bass, now) {
  hist.push(bass);
  if (hist.length > 48) hist.shift();
  let avg = 0;
  for (const v of hist) avg += v;
  avg /= hist.length;
  const variance = hist.reduce((s, v) => s + (v - avg) ** 2, 0) / hist.length;
  const threshold = avg * (1.25 + Math.min(0.35, variance * 8));

  if (bass > threshold && bass > 0.16 && now - lastBeat > 230 && hist.length > 12) {
    lastBeat = now;
    const strength = Math.min(1, (bass - avg) / (avg + 0.001) / 1.6);
    beatFlash = Math.max(beatFlash, 0.55 + 0.45 * strength);
    spinBoost = Math.max(spinBoost, 1.4 + 2.6 * strength);

    beatTimes.push(now);
    if (beatTimes.length > 9) beatTimes.shift();
    if (beatTimes.length >= 5) {
      const gaps = [];
      for (let i = 1; i < beatTimes.length; i++) gaps.push(beatTimes[i] - beatTimes[i - 1]);
      gaps.sort((a, b) => a - b);
      const med = gaps[Math.floor(gaps.length / 2)];
      if (med > 240 && med < 1400) bpm = Math.round(60000 / med);
    }
  }
}

/* ---------- 主循环：旋转 + 蹦哒 ---------- */
let prev = performance.now();
function loop(now) {
  const dt = Math.min(50, now - prev) / 1000;
  prev = now;

  let bass = 0, mid = 0, high = 0, level = 0;

  if (analyser && playing) {
    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(wave);
    const sr = actx.sampleRate;
    bass = bandAvg(freq, 20, 150, sr, analyser.fftSize);
    mid = bandAvg(freq, 150, 2000, sr, analyser.fftSize);
    high = bandAvg(freq, 2000, 9000, sr, analyser.fftSize);
    let sum = 0;
    for (let i = 0; i < wave.length; i += 4) { const v = (wave[i] - 128) / 128; sum += v * v; }
    level = Math.min(1, Math.sqrt(sum / (wave.length / 4)) * 2.4);
  }

  const k = playing ? 0.18 : 0.08;
  smoothBass += (bass - smoothBass) * k;
  smoothMid += (mid - smoothMid) * k;
  smoothHigh += (high - smoothHigh) * k;
  smoothLevel += (level - smoothLevel) * k;

  if (playing) detectBeat(smoothBass, now);

  beatFlash *= Math.pow(0.0025, dt);   // 蹦哒包络衰减
  spinBoost *= Math.pow(0.02, dt);     // 踩点转速衰减

  // 转速：基础速度随旋律能量变化，踩点瞬间额外加速（在合适的位置转）
  const base = 0.55 + smoothLevel * 2.6 + smoothMid * 1.1;
  const omega = playing ? base + spinBoost : 0.35;
  angle += omega * dt;
  if (angle > Math.PI * 2) angle -= Math.PI * 2;   // 防止长时间播放后精度衰减

  const bounce = Math.sin(beatFlash * Math.PI) * 30;        // 上下蹦哒
  const scale = 1 + beatFlash * 0.16 + smoothBass * 0.06;  // 缩放弹性
  const tilt = Math.sin(angle * 0.5) * beatFlash * 8;      // 轻微倾斜

  disc.style.transform =
    'translateY(' + (-bounce) + 'px) rotate(' + (angle * 180 / Math.PI).toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ') rotate(' + tilt.toFixed(2) + 'deg)';

  if (orbit) orbit.style.transform = 'rotate(' + (angle * 180 / Math.PI).toFixed(2) + 'deg)';

  halo.style.opacity = (0.32 + smoothBass * 0.9 + beatFlash * 0.4).toFixed(3);
  halo.style.transform = 'scale(' + (1 + smoothLevel * 0.16 + beatFlash * 0.12).toFixed(3) + ')';
  shadow.style.transform = 'scale(' + (1 - bounce / 90).toFixed(3) + ')';
  shadow.style.opacity = (0.85 - bounce / 40).toFixed(3);

  updateLyrics(audio.currentTime);

  drawBG(now);

  drawWave(now);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- 逐词歌词（Folia 风格） ---------- */
const LYRICS_URL = 'lyrics/yuai.lrc';
const LINE_H = 56;   // 与 CSS .lyric-line 高度一致
let lines = [];
let curLine = -1;

function tokenize(text) {
  const tokens = [];
  const re = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]|[a-zA-Z0-9']+/g;
  let m;
  while ((m = re.exec(text))) tokens.push(m[0]);
  return tokens;
}

function parseLRC(txt) {
  const raw = [];
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\[(\d+):(\d+\.\d+)\](.*)$/);
    if (!m) continue;
    const t = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
    const text = m[3].trim();
    if (text) raw.push({ t, text });
  }
  raw.sort((a, b) => a.t - b.t);
  const songEnd = audio.duration && isFinite(audio.duration) ? audio.duration : 138.45;
  return raw.map((l, i) => {
    const end = i + 1 < raw.length ? raw[i + 1].t : songEnd;
    const dur = Math.max(0.4, end - l.t);
    const toks = tokenize(l.text);
    const total = toks.reduce((s, c) => s + c.length, 0) || 1;
    let acc = 0;
    const words = toks.map((ch) => {
      const w = ch.length / total * dur;
      const t0 = l.t + acc;
      acc += w;
      return { ch, t0, t1: l.t + acc, state: '', el: null };
    });
    return { t: l.t, end, text: l.text, words, el: null };
  });
}

function buildLyrics() {
  lyricsInner.innerHTML = '';
  lines.forEach((l, i) => {
    const div = document.createElement('div');
    div.className = 'lyric-line';
    l.words.forEach((w) => {
      const s = document.createElement('span');
      s.className = 'w wait';
      s.textContent = w.ch;
      w.el = s;
      div.appendChild(s);
    });
    l.el = div;
    lyricsInner.appendChild(div);
  });
  curLine = -1;
}

let lrcRaw = '';

async function loadLyrics() {
  try {
    const res = await fetch(LYRICS_URL);
    if (!res.ok) throw new Error(res.status);
    lrcRaw = await res.text();
    lines = parseLRC(lrcRaw);
    if (!lines.length) throw new Error('empty');
    buildLyrics();
  } catch (e) {
    lyricsInner.innerHTML = '<div class="lyrics-idle">♪ 纯音乐 · 随旋律旋转 ♪</div>';
  }
}
loadLyrics();
audio.addEventListener('loadedmetadata', () => {
  if (lrcRaw) {
    lines = parseLRC(lrcRaw);   // 用真实时长重算（影响最后一行时长）
    buildLyrics();
  }
});

function updateLyrics(t) {
  if (!lines.length) return;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (t >= lines[i].t) idx = i;
    else break;
  }
  if (idx !== curLine) {
    const prevEl = curLine >= 0 ? lines[curLine].el : null;
    if (prevEl) prevEl.classList.remove('current');
    curLine = idx;
    if (idx >= 0) {
      lines[idx].el.classList.add('current');
      lyricsInner.style.translate = '0 ' + (-(idx * LINE_H + LINE_H / 2)) + 'px';
      // 邻近行的明暗
      for (let i = 0; i < lines.length; i++) {
        if (i === idx) continue;
        lines[i].el.classList.toggle('near', Math.abs(i - idx) <= 2);
      }
    } else {
      lyricsInner.style.translate = '0 ' + (-(LINE_H / 2)) + 'px';
      lines.forEach((l) => l.el.classList.remove('near'));
    }
  }
  if (idx < 0) return;
  const line = lines[idx];
  for (const w of line.words) {
    const st = t >= w.t1 ? 'pass' : (t >= w.t0 ? 'active' : 'wait');
    if (st !== w.state) {
      w.el.className = 'w ' + st;
      w.state = st;
    }
  }
}

/* ---------- 底部波形（Folia monet AudioOverlay 风格） ---------- */
function drawWave(now) {
  wctx.clearRect(0, 0, W, H);
  if (W < 10 || H < 10) return;

  const midY = H * 0.52;
  const amp = H * 0.4;

  wctx.beginPath();
  const N = 128;
  for (let i = 0; i <= N; i++) {
    let v;
    if (analyser && playing) {
      const idx = Math.floor(i / N * (wave.length - 1));
      v = (wave[idx] - 128) / 128;
    } else {
      v = Math.sin(now / 700 + i * 0.18) * 0.05;  // 待机微澜
    }
    const x = (i / N) * W;
    const y = midY + v * amp * (playing ? 1 : 0.6);
    if (i === 0) wctx.moveTo(x, y);
    else wctx.lineTo(x, y);
  }

  // 柔光（宽线低透明度，代替昂贵的 shadowBlur）
  const soft = wctx.createLinearGradient(0, 0, W, 0);
  soft.addColorStop(0, withAlpha(waveC1, 0.14));
  soft.addColorStop(1, withAlpha(waveC2, 0.14));
  wctx.strokeStyle = soft;
  wctx.lineWidth = 7;
  wctx.stroke();

  const grad = wctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, withAlpha(waveC1, 0.6));
  grad.addColorStop(1, withAlpha(waveC2, 0.6));
  wctx.strokeStyle = grad;
  wctx.lineWidth = 1.6;
  wctx.stroke();

  // 镜像填充，形成色带
  wctx.lineTo(W, midY);
  wctx.lineTo(0, midY);
  wctx.closePath();
  const fill = wctx.createLinearGradient(0, midY - amp, 0, midY + amp);
  fill.addColorStop(0, withAlpha(waveC1, 0.14));
  fill.addColorStop(0.5, withAlpha(waveC2, 0.05));
  fill.addColorStop(1, withAlpha(waveC2, 0.14));
  wctx.fillStyle = fill;
  wctx.fill();
}

/* hsl(...) / #hex 统一转成带透明度的颜色 */
function withAlpha(c, a) {
  if (c.startsWith('hsl(')) {
    const inner = c.slice(4, -1).trim();
    return 'hsl(' + inner + ' / ' + a + ')';
  }
  if (c.startsWith('#')) {
    const n = c.length === 4
      ? c.slice(1).split('').map((x) => parseInt(x + x, 16))
      : [0, 2, 4].map((i) => parseInt(c.slice(1 + i, 3 + i), 16));
    return 'rgba(' + n[0] + ',' + n[1] + ',' + n[2] + ',' + a + ')';
  }
  return c;
}
