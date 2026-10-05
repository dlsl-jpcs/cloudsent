import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.dirname(fileURLToPath(import.meta.url));
const bundled = 'C:/Users/Aryl Ross A. Manalo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const require = createRequire(path.join(root, 'package.json'));
const { createCanvas, loadImage, GlobalFonts } = require(path.join(bundled, '@napi-rs/canvas'));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { QRCodeSVG } = require('qrcode.react');
const tools = 'C:/Users/Aryl Ross A. Manalo/AppData/Local/Temp/cloudsent-trailer-tools/imageio_ffmpeg/binaries';
const ffmpeg = path.join(tools, fs.readdirSync(tools).find(name => name.endsWith('.exe')));
const originalLogo = 'C:/Users/ARYLRO~1.MAN/AppData/Local/Temp/codex-clipboard-1b91e9df-55c5-4790-bd75-37e23ce51ad6.png';
const assets = path.join(out, 'assets');
fs.mkdirSync(assets, { recursive: true });
fs.mkdirSync(path.join(out, 'preview'), { recursive: true });
if (!fs.existsSync(path.join(assets, 'jpcs-dlsl-logo.png'))) fs.copyFileSync(originalLogo, path.join(assets, 'jpcs-dlsl-logo.png'));
for (const weight of [400, 600]) GlobalFonts.registerFromPath(path.join(root, `node_modules/@fontsource/spectral/files/spectral-latin-${weight}-normal.woff`), `Spectral${weight}`);
for (const weight of [400, 700]) GlobalFonts.registerFromPath(path.join(root, `node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-${weight}-normal.woff`), `Atkinson${weight}`);
const logo = await loadImage(path.join(assets, 'jpcs-dlsl-logo.png'));
const url = 'https://cloudsent.vercel.app/';
const qrSvg = renderToStaticMarkup(React.createElement(QRCodeSVG, { value: url, size: 600, level: 'M', marginSize: 4, bgColor: '#ffffff', fgColor: '#12283f' }));
fs.writeFileSync(path.join(assets, 'website-qr.svg'), qrSvg);
const qr = await loadImage(Buffer.from(qrSvg));
const W = 1920, H = 1080, FPS = 30, DURATION = 30;
const ink = '#25364a', muted = '#596d83', blue = '#5e83ae', gold = '#e7b84b';
const colors = ['#DCEEFF', '#E9E2FF', '#FFF0BF', '#FFE2E9', '#DFF0E3', '#EEF2F5'];
const samples = [
  ['A little courage', 'Lord, give me courage to ask questions, try again, and keep learning even when I feel unsure.', 'Prayer Intention'],
  ['For our teachers', 'Thank you for the teachers who notice our progress and remind us that we can grow.', 'Thanksgiving'],
  ['Before the exams', 'May we find calm as we prepare. Help us remember what we have learned.', 'Prayer Intention'],
  ['You belong here', 'May anyone who feels left out find a welcoming seat, a friendly voice, and a reason to smile.', 'Encouragement'],
  ['Small beginnings', 'A small step still moves us forward. Today, I am grateful for progress no one else can see.', 'Reflection'],
  ['A peaceful home', 'Bless our families with patience, understanding, and enough time to listen to one another.', 'Prayer Intention'],
  ['Room for kindness', 'May our words leave people feeling lighter. Help us choose kindness.', 'Reflection'],
  ['Keep going gently', 'You do not have to do everything perfectly today. Keep going at your own pace.', 'Encouragement'],
  ['For our school community', 'Bless everyone who makes this campus a place to learn, from the classrooms to the gates.', 'Prayer Intention'],
];
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const ease = n => 1 - Math.pow(1 - clamp(n), 3);
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
function rr(c, x, y, w, h, r, fill, stroke) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
}
function txt(c, value, x, y, size = 32, color = ink, family = 'Atkinson400', align = 'left') {
  c.fillStyle = color; c.font = `${size}px ${family}`; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillText(value, x, y);
}
function wrap(c, value, x, y, width, size, color = ink, family = 'Atkinson400', line = 1.35) {
  c.font = `${size}px ${family}`; const words = value.split(' '); let row = '', n = 0;
  for (const word of words) {
    if (row && c.measureText(row + ' ' + word).width > width) { txt(c, row, x, y + n * size * line, size, color, family); n++; row = word; }
    else row += (row ? ' ' : '') + word;
  }
  if (row) txt(c, row, x, y + n * size * line, size, color, family);
  return (n + 1) * size * line;
}
function cloud(c, x, y, s, color = blue) {
  c.save(); c.translate(x, y); c.scale(s / 72, s / 72); c.fillStyle = color;
  c.beginPath(); c.moveTo(16, 52); c.bezierCurveTo(-3, 51, -1, 28, 16, 28); c.bezierCurveTo(18, 7, 47, 3, 54, 24); c.bezierCurveTo(73, 22, 81, 52, 59, 52); c.closePath(); c.fill(); c.restore();
}
function check(c, x, y, size, color = '#fff') {
  c.save(); c.strokeStyle = color; c.lineWidth = size * .13; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x - size * .42, y); c.lineTo(x - size * .1, y + size * .3); c.lineTo(x + size * .45, y - size * .38); c.stroke(); c.restore();
}
function brand(c, x, y, size = 46, centered = false) {
  c.font = `${size}px Spectral600`; const word = c.measureText('CloudSent').width;
  const width = word + size * 1.7; if (centered) x -= width / 2;
  cloud(c, x, y - size * .8, size * .8);
  txt(c, 'CloudSent', x + size * 1.05, y, size, ink, 'Spectral600');
  txt(c, '()', x + size * 1.05 + word + 3, y, size, '#b48b36', 'Spectral400');
}
function reveal(c, progress, draw, dy = 32) {
  const p = ease(progress); c.save(); c.globalAlpha *= p; c.translate(0, (1 - p) * dy); draw(); c.restore();
}
function background(c, t, deep = false) {
  const grad = c.createLinearGradient(0, 0, W, H); grad.addColorStop(0, '#f8fbff'); grad.addColorStop(.54, '#e8f2ff'); grad.addColorStop(1, deep ? '#bfd8f2' : '#d7e8fa');
  c.fillStyle = grad; c.fillRect(0, 0, W, H);
  const halo = c.createRadialGradient(1410 + Math.sin(t * .13) * 120, 380, 30, 1400, 380, 800);
  halo.addColorStop(0, '#ffffffbd'); halo.addColorStop(1, '#ffffff00'); c.fillStyle = halo; c.fillRect(0, 0, W, H);
  c.save(); c.globalAlpha = .6;
  const shift = Math.sin(t * .2) * 25;
  cloud(c, -240 + shift, 735, 680, '#ffffff'); cloud(c, 1350 - shift, 820, 740, '#ffffff'); c.restore();
}
function logoMark(c, x, y, size, shadow = false) {
  c.save(); if (shadow) { c.shadowColor = '#25364a18'; c.shadowBlur = 22; c.shadowOffsetY = 6; }
  rr(c, x, y, size, size, size * .12, '#ffffff'); c.shadowColor = 'transparent';
  c.drawImage(logo, x + size * .04, y + size * .04, size * .92, size * .92); c.restore();
}
function chrome(c, t, dark = false) {
  brand(c, 92, 99, 38);
  logoMark(c, 1725, 50, 104);
  txt(c, 'JPCS DLSL', 1777, 179, 19, muted, 'Atkinson700', 'center');
  txt(c, 'Illustrative prayers', 94, 1028, 19, muted);
}
const cardCache = samples.map((data, index) => {
  const v = createCanvas(430, 354), c = v.getContext('2d');
  rr(c, 0, 0, 430, 354, 23, colors[index % colors.length], '#ffffff');
  const g = c.createLinearGradient(0, 0, 400, 350); g.addColorStop(0, '#ffffff58'); g.addColorStop(1, '#ffffff00'); rr(c, 0, 0, 430, 354, 23, g);
  cloud(c, 367, 23, 29, '#7b96b4');
  const titleH = wrap(c, data[0], 30, 61, 325, 29, ink, 'Spectral600', 1.14);
  wrap(c, data[1], 30, 61 + titleH + 25, 368, 25, ink, 'Spectral400', 1.28);
  c.strokeStyle = '#6d91b333'; c.beginPath(); c.moveTo(30, 291); c.lineTo(398, 291); c.stroke();
  txt(c, 'Anonymous · ' + data[2], 30, 324, 18, muted);
  return v;
});
function card(c, index, x, y, scale = 1, angle = 0, alpha = 1) {
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
  c.shadowColor = '#466a8d22'; c.shadowBlur = 38; c.shadowOffsetY = 16;
  c.drawImage(cardCache[index % cardCache.length], 0, 0); c.restore();
}
function wall(c, t, x = 0, y = 0, scale = 1, columns = 5, rows = 5) {
  c.save(); c.translate(x, y); c.rotate(-.052); c.transform(1, 0, .025, .985, 0, 0); c.scale(scale, scale);
  for (let col = 0; col < columns; col++) for (let row = -1; row < rows; row++) {
    const drift = (t * (col % 2 ? 18 : 24)) % 378;
    card(c, ((col * 3 + row + 30) % samples.length), col * 454, row * 378 - drift + (col % 2) * 155);
  }
  c.restore();
}
function sceneOpening(c, t) {
  background(c, t); chrome(c, t);
  card(c, 0, 1250 + (1 - ease(t / 2)) * 150, 267 + Math.sin(t) * 8, .94, .07, ease(t / 1.6));
  card(c, 3, 1170 + (1 - ease(t / 2.2)) * 100, 650 - t * 8, .77, -.085, ease(t / 2));
  reveal(c, (t - .15) / 1.2, () => {
    txt(c, 'Some prayers', 140, 383, 107, ink, 'Spectral400');
    txt(c, 'are lighter', 140, 506, 107, ink, 'Spectral400');
    txt(c, 'together.', 140, 629, 107, ink, 'Spectral400');
  }, 44);
  reveal(c, (t - 1.15) / 1.1, () => { txt(c, 'A little room for what’s on your heart.', 145, 745, 34, muted); });
}
function sceneReveal(c, t) {
  background(c, t + 5, true);
  card(c, 4, -175 - t * 7, 50, .85, -.12, .52); card(c, 6, 1560 + t * 9, 185, .91, .11, .5);
  card(c, 2, 1340 + t * 3, 827, .8, -.05, .55); card(c, 7, 80 - t * 5, 850, .65, .035, .4);
  logoMark(c, 1725, 50, 104);
  reveal(c, t / .8, () => { cloud(c, 904, 150, 112); });
  reveal(c, (t - .15) / .85, () => { brand(c, 960, 437, 140, true); });
  reveal(c, (t - .65) / .9, () => {
    txt(c, 'A shared sky for quiet intentions.', 960, 561, 48, muted, 'Spectral400', 'center');
    rr(c, 680, 630, 560, 2, 0, '#97b5d066');
    txt(c, 'Faith. Hope. Reflection. Community.', 960, 696, 29, muted, 'Atkinson400', 'center');
  });
  txt(c, 'A project by JPCS DLSL', 960, 1008, 24, muted, 'Atkinson400', 'center');
}
function stepper(c, x, y, active) {
  const names = ['Write', 'Personalize', 'Review'];
  names.forEach((name, i) => {
    const nx = x + i * 247;
    if (i < 2) { c.strokeStyle = '#d4e1ef'; c.lineWidth = 2; c.beginPath(); c.moveTo(nx + 34, y); c.lineTo(nx + 213, y); c.stroke(); }
    c.beginPath(); c.arc(nx, y, 22, 0, Math.PI * 2); c.fillStyle = i <= active ? '#5e83ae' : '#e7eff8'; c.fill();
    if (i < active) check(c, nx, y, 19);
    else txt(c, String(i + 1), nx, y + 7, 21, i <= active ? '#fff' : blue, 'Atkinson700', 'center');
    txt(c, name, nx, y + 54, 21, muted, 'Atkinson400', 'center');
  });
}
function sceneWrite(c, t) {
  background(c, t + 8); chrome(c, t);
  reveal(c, t / .8, () => {
    txt(c, 'A few words.', 128, 379, 87, ink, 'Spectral400');
    txt(c, 'A little hope.', 128, 482, 87, ink, 'Spectral400');
    wrap(c, 'Write a prayer. Make it yours.', 134, 584, 590, 33, muted, 'Atkinson400', 1.5);
    rr(c, 134, 658, 342, 58, 29, '#ffffffb8', '#cddfee');
    txt(c, 'No account needed', 305, 696, 25, muted, 'Atkinson400', 'center');
  });
  const py = 211 + (1 - ease(t / 1)) * 45;
  c.save(); c.shadowColor = '#37587e20'; c.shadowBlur = 45; c.shadowOffsetY = 22;
  rr(c, 820, py, 906, 697, 30, '#fff', '#d4e1ef'); c.restore();
  const phase = t < 3.2 ? 0 : t < 4.65 ? 1 : 2;
  stepper(c, 1018, py + 72, phase);
  txt(c, phase === 2 ? 'One last look.' : 'What’s on your heart?', 880, py + 197, 43, ink, 'Spectral400');
  const content = 'May our school be a place where everyone feels welcome, supported, and brave enough to begin again.';
  if (phase < 2) {
    txt(c, 'Your prayer', 882, py + 253, 23, muted);
    rr(c, 881, py + 277, 784, 224, 17, phase === 1 ? colors[0] : '#f8fbff', '#c9dceb');
    const length = Math.floor(clamp((t - 1) / 2.1) * content.length);
    wrap(c, content.slice(0, length), 909, py + 323, 724, 29, ink, 'Spectral400', 1.43);
    if (phase === 1) {
      colors.forEach((color, i) => { c.beginPath(); c.arc(923 + i * 65, py + 550, 19, 0, Math.PI * 2); c.fillStyle = color; c.fill(); if (i === 0) { c.strokeStyle = blue; c.lineWidth = 3; c.stroke(); } });
      txt(c, 'Anonymous', 1430, py + 558, 22, muted);
    } else txt(c, 'A few honest words are enough.', 884, py + 551, 22, muted);
    rr(c, 1418, py + 599, 247, 57, 28, gold); txt(c, 'Continue', 1541, py + 636, 23, ink, 'Atkinson700', 'center');
  } else {
    rr(c, 881, py + 242, 784, 284, 23, colors[0], '#c9dceb');
    txt(c, 'Prayer Intention', 912, py + 286, 22, muted);
    wrap(c, content, 912, py + 341, 720, 31, ink, 'Spectral400', 1.3);
    txt(c, 'Anonymous', 912, py + 494, 22, muted);
    txt(c, 'Reviewed before appearing on the wall.', 883, py + 568, 22, muted);
    const sent = t > 5.55;
    rr(c, 1298, py + 599, 367, 57, 28, sent ? '#dff0e3' : gold);
    txt(c, sent ? 'Sent for review' : 'Send your prayer', sent ? 1497 : 1481, py + 636, 23, ink, 'Atkinson700', 'center');
    if (sent) check(c, 1395, py + 628, 18, '#497b60');
  }
}
function sceneWall(c, t) {
  background(c, t + 15, true); wall(c, t + 6, 740 - t * 9, -190, .91, 4, 5);
  const veil = c.createLinearGradient(0, 0, 1190, 0); veil.addColorStop(0, '#f2f8ff'); veil.addColorStop(.6, '#f2f8fff8'); veil.addColorStop(1, '#f2f8ff00'); c.fillStyle = veil; c.fillRect(0, 0, 1200, H);
  brand(c, 92, 99, 38); logoMark(c, 1725, 50, 104);
  reveal(c, t / .85, () => {
    txt(c, 'Your words,', 126, 400, 88, ink, 'Spectral400');
    txt(c, 'held with care.', 126, 505, 88, ink, 'Spectral400');
    txt(c, 'Anonymous by default.', 132, 613, 33, muted);
    txt(c, 'Reviewed before sharing.', 132, 665, 33, muted);
  });
  reveal(c, (t - 2.2) / 1, () => {
    cloud(c, 132, 767, 43);
    txt(c, 'A wall of faith, hope, and community.', 194, 803, 29, muted);
  });
  txt(c, 'Illustrative prayers', 94, 1028, 19, muted);
}
function schoolScreen(c, t) {
  const x = 335, y = 344, w = 1250, h = 584;
  c.save(); c.shadowColor = '#2242642b'; c.shadowBlur = 45; c.shadowOffsetY = 23; rr(c, x, y, w, h, 28, '#fff', '#c0d7ef'); c.restore();
  c.save(); c.beginPath(); c.roundRect(x + 14, y + 14, 894, h - 28, 19); c.clip();
  c.fillStyle = '#d9eafb'; c.fillRect(x + 14, y + 14, 894, h - 28); wall(c, t, x - 20, y - 45, .49, 5, 5); c.restore();
  rr(c, x + 925, y + 14, 311, h - 28, 20, '#eef6ff');
  brand(c, x + 952, y + 78, 29);
  txt(c, 'Leave a little hope.', x + 1080, y + 143, 29, ink, 'Spectral400', 'center');
  c.drawImage(qr, x + 969, y + 168, 224, 224);
  txt(c, 'Scan to join', x + 1080, y + 426, 24, ink, 'Atkinson700', 'center');
  txt(c, 'cloudsent.vercel.app', x + 1080, y + 473, 19, muted, 'Atkinson400', 'center');
  txt(c, '© 2026 JPCS DLSL', x + 1080, y + 526, 16, muted, 'Atkinson400', 'center');
}
function sceneSchool(c, t) {
  background(c, t + 23); brand(c, 92, 99, 38); logoMark(c, 1725, 50, 104);
  reveal(c, t / .7, () => {
    txt(c, 'A shared moment. Across our school.', 960, 247, 67, ink, 'Spectral400', 'center');
  });
  reveal(c, (t - .2) / .8, () => schoolScreen(c, t), 45);
  txt(c, 'Read. Reflect. Leave a little hope.', 960, 1018, 29, muted, 'Atkinson400', 'center');
}
function sceneEnd(c, t) {
  background(c, t + 25, true);
  logoMark(c, 130, 100, 166, true);
  txt(c, 'JPCS DLSL', 332, 171, 31, ink, 'Atkinson700');
  txt(c, 'De La Salle Lipa Chapter', 332, 216, 25, muted);
  reveal(c, t / .7, () => {
    brand(c, 124, 454, 116);
    txt(c, 'Leave a little hope.', 136, 603, 84, ink, 'Spectral400');
    txt(c, 'Read the wall. Send a prayer.', 144, 691, 33, muted);
    rr(c, 139, 760, 727, 78, 39, '#ffffffbc', '#bfd3e8');
    txt(c, 'cloudsent.vercel.app', 500, 811, 37, ink, 'Atkinson700', 'center');
  });
  c.save(); c.shadowColor = '#2e557c1a'; c.shadowBlur = 50; c.shadowOffsetY = 22;
  rr(c, 1250, 212, 508, 644, 43, '#fff', '#d7e4f1'); c.restore();
  txt(c, 'Your words belong here.', 1504, 287, 31, ink, 'Spectral400', 'center');
  c.drawImage(qr, 1289, 317, 430, 430);
  txt(c, 'Scan to send a prayer', 1504, 804, 28, ink, 'Atkinson700', 'center');
  txt(c, '© 2026 JPCS DLSL. All rights reserved.', 960, 1013, 24, muted, 'Atkinson400', 'center');
}
const scenes = [
  { start: 0, end: 4.5, draw: sceneOpening },
  { start: 4.5, end: 8, draw: sceneReveal },
  { start: 8, end: 14.5, draw: sceneWrite },
  { start: 14.5, end: 21.5, draw: sceneWall },
  { start: 21.5, end: 25, draw: sceneSchool },
  { start: 25, end: 30, draw: sceneEnd },
];
const main = createCanvas(W, H), mc = main.getContext('2d');
const next = createCanvas(W, H), nc = next.getContext('2d');
function frame(t) {
  const i = scenes.findIndex(s => t >= s.start && t < s.end), scene = scenes[Math.max(0, i)];
  mc.resetTransform(); mc.globalAlpha = 1; scene.draw(mc, t - scene.start);
  const blend = .48;
  if (i >= 0 && i < scenes.length - 1 && t > scene.end - blend) {
    nc.resetTransform(); nc.globalAlpha = 1; scenes[i + 1].draw(nc, 0);
    mc.save(); mc.globalAlpha = smooth((t - scene.end + blend) / blend); mc.drawImage(next, 0, 0); mc.restore();
  }
  if (t < .4) { mc.fillStyle = `rgba(246,250,255,${1 - smooth(t / .4)})`; mc.fillRect(0, 0, W, H); }
}

// Original instrumental: warm chords and bell-like piano tones, generated for this trailer.
function makeMusic() {
  const sr = 44100, count = DURATION * sr;
  const l = new Float32Array(count), r = new Float32Array(count);
  const freq = midi => 440 * Math.pow(2, (midi - 69) / 12);
  function note(start, duration, midi, amplitude, pan, pad = false) {
    const f = freq(midi), n = Math.floor(duration * sr), offset = Math.floor(start * sr);
    const lp = Math.sqrt((1 - pan) / 2), rp = Math.sqrt((1 + pan) / 2);
    for (let j = 0; j < n && offset + j < count; j++) {
      const t = j / sr;
      const env = pad ? Math.min(t / 1.2, 1) * Math.min((duration - t) / 1.8, 1) : (1 - Math.exp(-t * 80)) * Math.exp(-t * 1.45) * Math.min((duration - t) / .3, 1);
      const wave = pad ? Math.sin(2 * Math.PI * f * t) * .7 + Math.sin(2 * Math.PI * f * 1.0015 * t) * .3 : Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 2 * t) * .25 * Math.exp(-t * 2) + Math.sin(2 * Math.PI * f * 3 * t) * .06;
      const v = wave * env * amplitude;
      l[offset + j] += v * lp; r[offset + j] += v * rp;
    }
  }
  const chords = [[48,55,60,64],[45,52,57,60],[41,48,53,57],[43,50,55,59],[48,55,60,64]];
  chords.forEach((chord, ci) => {
    const start = ci * 6;
    chord.forEach((m, k) => note(start, Math.min(7.8, 30 - start), m, .033, (k - 1.5) / 2, true));
    for (let k = 0; k < 8; k++) note(start + .3 + k * .69, 3, chord[[0,2,1,3,2,1,3,2][k]] + 24, .1, Math.sin(k * 1.3) * .55);
    note(start + .2, 4.8, chord[0] - 12, .05, 0, true);
  });
  // Sparse upper melody, resolving on the end card.
  [[1.6,76],[3.1,79],[5,74],[7.2,72],[10,76],[12.2,79],[15,77],[17,76],[19,72],[22,74],[24,79],[25.7,76],[27.2,72]].forEach(([t,m]) => note(t, 2.6, m, .047, .15));
  for (const delay of [.21,.39,.61]) {
    const d = Math.floor(delay * sr), gain = .105;
    for (let i = count - 1; i >= d; i--) { l[i] += r[i-d] * gain; r[i] += l[i-d] * gain; }
  }
  let peak = 0;
  for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
  const pcm = Buffer.alloc(count * 4), gain = .52 / peak;
  for (let i = 0; i < count; i++) {
    const t = i / sr, envelope = Math.min(t / .7, 1) * Math.min((30 - t) / 1.3, 1);
    pcm.writeInt16LE(Math.round(clamp(l[i] * gain * envelope, -1, 1) * 32767), i * 4);
    pcm.writeInt16LE(Math.round(clamp(r[i] * gain * envelope, -1, 1) * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44); header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ',8); header.writeUInt32LE(16,16); header.writeUInt16LE(1,20); header.writeUInt16LE(2,22); header.writeUInt32LE(sr,24); header.writeUInt32LE(sr * 4,28); header.writeUInt16LE(4,32); header.writeUInt16LE(16,34); header.write('data',36); header.writeUInt32LE(pcm.length,40);
  fs.writeFileSync(path.join(assets, 'original-soundtrack.wav'), Buffer.concat([header, pcm]));
}
makeMusic();
const previewTimes = [1.7,6.4,10.8,13.8,18.2,23.3,28.3];
for (const t of previewTimes) { frame(t); fs.writeFileSync(path.join(out, 'preview', `frame-${t.toFixed(1)}.png`), await main.encode('png')); }
const board = createCanvas(1440, 1732), bc = board.getContext('2d'); bc.fillStyle = '#e4edf7'; bc.fillRect(0,0,1440,1732);
for (let i = 0; i < previewTimes.length; i++) {
  frame(previewTimes[i]); const x = 20 + (i % 2) * 710, y = 20 + Math.floor(i / 2) * 427;
  bc.drawImage(main, x, y, 690, 388); txt(bc, `${previewTimes[i].toFixed(1)} seconds`, x + 8, y + 414, 20, ink);
}
fs.writeFileSync(path.join(out, 'preview', 'storyboard.jpg'), await board.encode('jpeg', 92));
frame(28.3); fs.writeFileSync(path.join(out, 'cloudsent-trailer-poster.png'), await main.encode('png'));
if (process.argv.includes('--preview')) { console.log('Preview frames and original soundtrack ready.'); process.exit(0); }
const output = path.join(out, 'cloudsent-trailer-30s.mp4');
const args = ['-y','-hide_banner','-loglevel','warning','-f','rawvideo','-pix_fmt','rgba','-s',`${W}x${H}`,'-r',String(FPS),'-i','pipe:0','-i',path.join(assets,'original-soundtrack.wav'),'-t','30','-c:v','libx264','-preset','fast','-crf','18','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:a','aac','-b:a','192k','-movflags','+faststart','-metadata','title=CloudSent — Leave a little hope','-metadata','artist=JPCS DLSL',output];
const encoder = spawn(ffmpeg,args,{stdio:['pipe','ignore','pipe'],windowsHide:true});
let err = ''; encoder.stderr.on('data', b=>{err+=b.toString();});
const finished = new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('close',code=>code===0?resolve():reject(new Error(`Encoder failed (${code}): ${err}`)));});
encoder.stdin.on('error', ()=>{});
for (let i = 0; i < DURATION * FPS; i++) {
  frame(i / FPS);
  if (!encoder.stdin.write(main.data())) await once(encoder.stdin,'drain');
  if (i % 90 === 0) console.log(`Rendered ${i / FPS} / ${DURATION} seconds`);
}
encoder.stdin.end(); await finished;
console.log(`Saved ${output} (${(fs.statSync(output).size/1048576).toFixed(1)} MB)`);
