// ============================================================
// Saad Mahmud — Interactive Portfolio
// Fixed single-screen retro platformer. Original character/block
// art (no third-party or copyrighted assets used).
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const WORLD_W = 960;
const WORLD_H = 540;
const GROUND_H = 90;
const groundY = WORLD_H - GROUND_H;

// ---------- Responsive scaling (fixed internal resolution, scaled via CSS) ----------
function resize() {
  const scale = Math.min(window.innerWidth / WORLD_W, window.innerHeight / WORLD_H);
  canvas.style.width = (WORLD_W * scale) + 'px';
  canvas.style.height = (WORLD_H * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();

// ---------- Procedural audio (no external sound files needed) ----------
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } else if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
function beep(freq, duration, type, vol) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}
const sfx = {
  jump:  () => beep(660, 0.14, 'square', 0.12),
  bump:  () => beep(220, 0.10, 'square', 0.16),
  land:  () => beep(150, 0.08, 'square', 0.10),
  step:  () => beep(320, 0.045, 'square', 0.055),
};

// ---------- Input ----------
const keys = { a: false, d: false, w: false };
window.addEventListener('keydown', (e) => {
  ensureAudio();
  const k = e.key.toLowerCase();
  if (k in keys) { keys[k] = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) { keys[k] = false; }
});

// ---------- Game state ----------
let gameState = 'playing'; // 'playing' | 'paused'

const GRAVITY = 0.55;
const MOVE_SPEED = 3.2;
const JUMP_V = -12;

const player = {
  x: 120, y: groundY - 56,
  w: 30, h: 56,
  vx: 0, vy: 0,
  grounded: true,
  facing: 1,
  animTimer: 0,
  animFrame: 0,
  stepTimer: 0,
};

// ---------- Blocks: Q - b - b - Q - b - b - Q, always reopenable ----------
const blockSize = 46;
const blockGap = 8;
const blockY = groundY - 190; // high enough that the player's jump apex never clears the top
const order = ['q', 'b', 'b', 'q', 'b', 'b', 'q'];
const totalW = order.length * blockSize + (order.length - 1) * blockGap;
const startX = (WORLD_W - totalW) / 2;

const qContent = ['about', 'projects', 'experience'];
let qi = 0;
const blocks = order.map((type, i) => ({
  x: startX + i * (blockSize + blockGap),
  y: blockY,
  w: blockSize,
  h: blockSize,
  type,
  bump: 0,
  content: type === 'q' ? qContent[qi++] : null,
}));

// ---------- Modal handling ----------
const modals = {
  about: document.getElementById('modal-about'),
  projects: document.getElementById('modal-projects'),
  experience: document.getElementById('modal-experience'),
};
document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', closeModal);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

function openModal(key) {
  gameState = 'paused';
  modals[key].hidden = false;
  modals[key].querySelector('.modal-close').focus();
}
function closeModal() {
  const open = Object.values(modals).find((m) => !m.hidden);
  if (!open) return;
  open.hidden = true;
  gameState = 'playing';
}

// ---------- Update ----------
function update() {
  if (gameState !== 'playing') return;

  const prevTop = player.y;

  if (keys.a) { player.vx = -MOVE_SPEED; player.facing = -1; }
  else if (keys.d) { player.vx = MOVE_SPEED; player.facing = 1; }
  else { player.vx = 0; }

  if (keys.w && player.grounded) {
    player.vy = JUMP_V;
    player.grounded = false;
    sfx.jump();
  }

  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;

  // invisible walls (left & right)
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > WORLD_W) player.x = WORLD_W - player.w;

  // ground collision
  if (player.y + player.h >= groundY) {
    const wasFalling = player.vy > 0;
    player.y = groundY - player.h;
    if (wasFalling && !player.grounded) sfx.land();
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  // block collision — only registers when moving upward and crossing the
  // block's bottom edge from below (never lands on top; never "used up")
  if (player.vy < 0) {
    blocks.forEach((block) => {
      const overlapX = player.x + player.w > block.x && player.x < block.x + block.w;
      const blockBottom = block.y + block.h;
      if (overlapX && prevTop >= blockBottom && player.y < blockBottom) {
        block.bump = 8;
        sfx.bump();
        player.y = blockBottom;
        player.vy = 2;
        if (block.type === 'q') openModal(block.content);
      }
    });
  }

  // footstep sfx while walking
  if (player.grounded && player.vx !== 0) {
    player.stepTimer++;
    if (player.stepTimer > 14) { sfx.step(); player.stepTimer = 0; }
  } else {
    player.stepTimer = 0;
  }

  // walk animation
  player.animTimer++;
  if (player.animTimer > 8) {
    player.animFrame = (player.animFrame + 1) % 2;
    player.animTimer = 0;
  }

  blocks.forEach((b) => { if (b.bump > 0) b.bump--; });
}

// ---------- Draw ----------
function drawBackground() {
  ctx.fillStyle = '#6ec6ff';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  drawCloud(90, 70);
  drawCloud(650, 50);
  drawCloud(430, 105);
  drawHill(150, groundY, '#3ea34d');
  drawHill(330, groundY, '#349645');
  drawHill(760, groundY, '#57c96b');
  drawGround();
}

function drawCloud(x, y) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.arc(x + 22, y - 8, 22, 0, Math.PI * 2);
  ctx.arc(x + 46, y, 18, 0, Math.PI * 2);
  ctx.arc(x + 22, y + 10, 20, 0, Math.PI * 2);
  ctx.fill();
}

function drawHill(x, baseY, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 60, baseY);
  ctx.quadraticCurveTo(x, baseY - 70, x + 60, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawGround() {
  const brickH = 30;
  ctx.fillStyle = '#c96a3b';
  ctx.fillRect(0, groundY, WORLD_W, GROUND_H);
  ctx.strokeStyle = '#8a4526';
  ctx.lineWidth = 2;
  let row = 0;
  for (let y = groundY; y < WORLD_H; y += brickH) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
    const offset = row % 2 === 0 ? 0 : 30;
    for (let x = -offset; x < WORLD_W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + brickH); ctx.stroke();
    }
    row++;
  }
}

function drawTitle() {
  ctx.save();
  ctx.translate(WORLD_W / 2, 68);
  const w = 430, h = 92;
  ctx.fillStyle = '#7a3b1e';
  ctx.strokeStyle = '#3d1c0e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f4e4c1';
  ctx.font = '26px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SAAD', 0, -16);
  ctx.fillText('MAHMUD', 0, 20);
  ctx.restore();
}

function drawBlocks() {
  blocks.forEach((block) => {
    const yOff = block.bump > 0 ? -Math.sin(((8 - block.bump) / 8) * Math.PI) * 8 : 0;
    const by = block.y + yOff;
    if (block.type === 'q') {
      ctx.fillStyle = '#f4c542';
      ctx.strokeStyle = '#8a6410';
    } else {
      ctx.fillStyle = '#b5651d';
      ctx.strokeStyle = '#6e3a10';
    }
    ctx.lineWidth = 3;
    ctx.fillRect(block.x, by, block.w, block.h);
    ctx.strokeRect(block.x, by, block.w, block.h);
    if (block.type === 'q') {
      ctx.fillStyle = '#8a6410';
      ctx.font = 'bold 22px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', block.x + block.w / 2, by + block.h / 2 + 2);
    }
  });
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.scale(player.facing, 1);
  ctx.translate(-player.w / 2, -player.h / 2);

  const walking = player.grounded && player.vx !== 0;
  const bob = walking && player.animFrame === 1 ? 2 : 0;

  ctx.fillStyle = '#2b3a67';
  ctx.fillRect(4, 40 - bob, 8, 16 + bob);
  ctx.fillRect(18, 40 + bob, 8, 16 - bob);

  ctx.fillStyle = '#2fa89a';
  ctx.fillRect(2, 20, 26, 22);
  ctx.fillRect(-2, 22, 6, 14);
  ctx.fillRect(26, 22, 6, 14);

  ctx.fillStyle = '#e8b98a';
  ctx.fillRect(4, 6, 22, 16);

  ctx.fillStyle = '#e8543a';
  ctx.fillRect(2, 0, 26, 8);
  ctx.fillRect(24, 6, 8, 5);

  ctx.restore();
}

function draw() {
  drawBackground();
  drawTitle();
  drawBlocks();
  drawPlayer();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
