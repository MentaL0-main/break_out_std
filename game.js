const STATE_MENU = 0;
const STATE_PLAYING = 1;
const STATE_GAMEOVER = 2;
const STATE_VICTORY = 3;

const BONUS_EXPAND = 1;
const BONUS_SPEED = 2;
const DEBUFF_BOMB = 3;

const PARTICLE_SPARK = 1;
const PARTICLE_DEBRIS = 2;

let canvas, ctx;
let gameState = STATE_MENU;
let score = 0;
let lives = 3;
let currentLevel = 1;

let paddleX = 0;
let paddleY = 0;
let paddleW = 120;
let paddleH = 15;
let paddleSpeed = 8;
const BASE_PADDLE_W = 120;
const BASE_PADDLE_SPEED = 8;

let ballX = 0;
let ballY = 0;
let ballRadius = 8;
let ballSpeedX = 0;
let ballSpeedY = 0;
let ballSpeedMax = 7;
let ballAttached = true;

let blocks = [];
const BLOCK_ROWS = 6;
const BLOCK_COLS = 12;
let blockW = 0;
let blockH = 25;
const BLOCK_PADDING = 4;
const BLOCK_TOP_OFFSET = 80;

let entities = [];
let particles = [];
let screenshake = 0;

const keys = { Left: false, Right: false };

window.onload = function() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    setupResize();
    initControls();
    resetGame();
    
    requestAnimationFrame(gameLoop);
};

function setupResize() {
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        blockW = Math.floor((canvas.width - (BLOCK_PADDING * (BLOCK_COLS + 1))) / BLOCK_COLS);
        if (!ballAttached) {
            paddleY = canvas.height - 40;
        } else {
            resetPaddleAndBall();
        }
    };
    window.addEventListener('resize', resize);
    resize();
}

function initControls() {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.Left = true;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.Right = true;
        
        if (e.key === ' ' || e.key === 'Spacebar') {
            if (gameState === STATE_MENU) {
                gameState = STATE_PLAYING;
            } else if (gameState === STATE_PLAYING && ballAttached) {
                ballAttached = false;
                ballSpeedX = (Math.random() - 0.5) * 4;
                ballSpeedY = -ballSpeedMax;
            } else if (gameState === STATE_GAMEOVER || gameState === STATE_VICTORY) {
                resetGame();
                gameState = STATE_PLAYING;
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.Left = false;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.Right = false;
    });
}

function resetGame() {
    score = 0;
    lives = 3;
    currentLevel = 1;
    entities = [];
    particles = [];
    screenshake = 0;
    generateLevel();
    resetPaddleAndBall();
}

function resetPaddleAndBall() {
    paddleW = BASE_PADDLE_W;
    paddleSpeed = BASE_PADDLE_SPEED;
    paddleX = (canvas.width - paddleW) / 2;
    paddleY = canvas.height - 40;
    
    ballAttached = true;
    ballX = paddleX + paddleW / 2;
    ballY = paddleY - ballRadius;
    ballSpeedX = 0;
    ballSpeedY = 0;
}

function generateLevel() {
    blocks = [];
    for (let r = 0; r < BLOCK_ROWS; r++) {
        for (let c = 0; c < BLOCK_COLS; c++) {
            blocks.push({
                x: c * (blockW + BLOCK_PADDING) + BLOCK_PADDING,
                y: r * (blockH + BLOCK_PADDING) + BLOCK_TOP_OFFSET,
                alive: true,
                row: r
            });
        }
    }
}

function spawnParticles(x, y, color, count, type = PARTICLE_SPARK) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (type === PARTICLE_DEBRIS ? 4 : 6) + 1;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: color,
            alpha: 1,
            size: Math.random() * 4 + 2,
            type: type
        });
    }
}

function spawnItem(x, y) {
    const rand = Math.random();
    let type = 0;
    if (rand < 0.08) type = BONUS_EXPAND;
    else if (rand < 0.16) type = BONUS_SPEED;
    else if (rand < 0.24) type = DEBUFF_BOMB;
    
    if (type !== 0) {
        entities.push({ x: x, y: y, type: type, speedY: 3, w: 20, h: 20 });
    }
}

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (gameState !== STATE_PLAYING) return;

    if (screenshake > 0) screenshake -= 0.1;

    if (keys.Left) paddleX -= paddleSpeed;
    if (keys.Right) paddleX += paddleSpeed;
    if (paddleX < 0) paddleX = 0;
    if (paddleX + paddleW > canvas.width) paddleX = canvas.width - paddleW;

    if (ballAttached) {
        ballX = paddleX + paddleW / 2;
        ballY = paddleY - ballRadius;
    } else {
        ballX += ballSpeedX;
        ballY += ballSpeedY;
        handleBallCollisions();
    }

    for (let i = entities.length - 1; i >= 0; i--) {
        let ent = entities[i];
        ent.y += ent.speedY;

        if (ent.x < paddleX + paddleW && ent.x + ent.w > paddleX &&
            ent.y < paddleY + paddleH && ent.y + ent.h > paddleY) {
            
            applyEffect(ent.type);
            spawnParticles(ent.x + ent.w / 2, ent.y + ent.h / 2, '#333', 8);
            entities.splice(i, 1);
            continue;
        }

        if (ent.y > canvas.height) {
            entities.splice(i, 1);
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.type === PARTICLE_DEBRIS) p.vy += 0.1;

        if (p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    if (blocks.every(b => !b.alive)) {
        gameState = STATE_VICTORY;
    }
}

function applyEffect(type) {
    if (type === BONUS_EXPAND) {
        paddleW = Math.min(paddleW + 40, 240);
        setTimeout(() => paddleW = Math.max(paddleW - 40, BASE_PADDLE_W), 8000);
    } else if (type === BONUS_SPEED) {
        paddleSpeed = Math.min(paddleSpeed + 4, 14);
        setTimeout(() => paddleSpeed = Math.max(paddleSpeed - 4, BASE_PADDLE_SPEED), 8000);
    } else if (type === DEBUFF_BOMB) {
        screenshake = 5;
        lives--;
        if (lives <= 0) gameState = STATE_GAMEOVER;
    }
}

function handleBallCollisions() {
    if (ballX - ballRadius < 0) { ballX = ballRadius; ballSpeedX = -ballSpeedX; screenshake = 1; }
    if (ballX + ballRadius > canvas.width) { ballX = canvas.width - ballRadius; ballSpeedX = -ballSpeedX; screenshake = 1; }
    if (ballY - ballRadius < 0) { ballY = ballRadius; ballSpeedY = -ballSpeedY; screenshake = 1; }

    if (ballY + ballRadius > canvas.height) {
        lives--;
        screenshake = 7;
        if (lives <= 0) {
            gameState = STATE_GAMEOVER;
        } else {
            resetPaddleAndBall();
        }
        return;
    }

    if (ballX > paddleX && ballX < paddleX + paddleW &&
        ballY + ballRadius > paddleY && ballY - ballRadius < paddleY + paddleH) {
        
        let hitPoint = (ballX - (paddleX + paddleW / 2)) / (paddleW / 2);
        ballSpeedX = hitPoint * ballSpeedMax;
        ballSpeedY = -Math.sqrt(ballSpeedMax * ballSpeedMax - ballSpeedX * ballSpeedX);
        ballY = paddleY - ballRadius;
        screenshake = 1.5;
        return;
    }

    for (let i = 0; i < blocks.length; i++) {
        let b = blocks[i];
        if (!b.alive) continue;

        if (ballX + ballRadius > b.x && ballX - ballRadius < b.x + blockW &&
            ballY + ballRadius > b.y && ballY - ballRadius < b.y + blockH) {
            
            b.alive = false;
            score += 10 + (BLOCK_ROWS - b.row) * 5;

            const hue = (b.row / BLOCK_ROWS) * 360;
            spawnParticles(ballX, ballY, `hsl(${hue}, 85%, 60%)`, 12, PARTICLE_DEBRIS);
            spawnItem(b.x + blockW / 2, b.y + blockH);

            let prevBallX = ballX - ballSpeedX;
            let prevBallY = ballY - ballSpeedY;

            if (prevBallX + ballRadius <= b.x) { ballSpeedX = -Math.abs(ballSpeedX); ballX = b.x - ballRadius; }
            else if (prevBallX - ballRadius >= b.x + blockW) { ballSpeedX = Math.abs(ballSpeedX); ballX = b.x + blockW + ballRadius; }
            else if (prevBallY + ballRadius <= b.y) { ballSpeedY = -Math.abs(ballSpeedY); ballY = b.y - ballRadius; }
            else { ballSpeedY = Math.abs(ballSpeedY); ballY = b.y + blockH + ballRadius; }
            
            screenshake = 2;
            break;
        }
    }
}

function render() {
    ctx.save();
    if (screenshake > 0) {
        let dx = (Math.random() - 0.5) * screenshake * 2;
        let dy = (Math.random() - 0.5) * screenshake * 2;
        ctx.translate(dx, dy);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    for (let i = 0; i < blocks.length; i++) {
        let b = blocks[i];
        if (!b.alive) continue;

        let hue = (b.row / BLOCK_ROWS) * 360;
        let gradient = ctx.createLinearGradient(b.x, b.y, b.x, b.y + blockH);
        gradient.addColorStop(0, `hsl(${hue}, 90%, 65%)`);
        gradient.addColorStop(1, `hsl(${(hue + 20) % 360}, 85%, 50%)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, blockW, blockH, 4);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    let paddleGrad = ctx.createLinearGradient(paddleX, paddleY, paddleX + paddleW, paddleY);
    paddleGrad.addColorStop(0, '#1e1e24');
    paddleGrad.addColorStop(0.5, '#3a3d40');
    paddleGrad.addColorStop(1, '#1e1e24');
    ctx.fillStyle = paddleGrad;
    ctx.beginPath();
    ctx.roundRect(paddleX, paddleY, paddleW, paddleH, 6);
 ctx.fill();
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(
    ballX, 
    ballY, 
    ballRadius, 
    0, 
    Math.PI * 2
  );
  ctx.fill();

  for (
    let i = 0; 
    i < entities.length; 
    i++
  ) {
    let ent = entities[i];
    ctx.beginPath();
    if (
      ent.type === BONUS_EXPAND
    ) {
      ctx.fillStyle = '#2ec4b6';
      ctx.roundRect(
        ent.x, 
        ent.y, 
        ent.w, 
        ent.h, 
        4
      );
      ctx.fill();
    } else if (
      ent.type === BONUS_SPEED
    ) {
      ctx.fillStyle = '#ff9f1c';
      ctx.roundRect(
        ent.x, 
        ent.y, 
        ent.w, 
        ent.h, 
        4
      );
      ctx.fill();
    } else if (
      ent.type === DEBUFF_BOMB
    ) {
      ctx.fillStyle = '#e71d36';
      ctx.arc(
        ent.x + ent.w / 2,
        ent.y + ent.h / 2,
        ent.w / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  for (
    let i = 0; 
    i < particles.length; 
    i++
  ) {
    let p = particles[i];
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(
      p.x, 
      p.y, 
      p.size, 
      p.size
    );
    ctx.restore();
  }

  renderHUD();

  if (gameState === STATE_MENU) {
    renderOverlay(
      'BREAKOUT CORE', 
      'Нажмите ПРОБЕЛ'
    );
  }
  if (gameState === STATE_GAMEOVER) {
    renderOverlay(
      'GAME OVER', 
      'Пробел для рестарта'
    );
  }
  if (gameState === STATE_VICTORY) {
    renderOverlay(
      'VICTORY!', 
      'Пробел для рестарта'
    );
  }
  ctx.restore();
}

function renderHUD() {
  ctx.font = '700 16px "Segoe UI"';
  ctx.fillStyle = '#222';
  ctx.textAlign = 'left';
  ctx.fillText(
    `SCORE: ${score}`, 
    30, 
    40
  );
  ctx.textAlign = 'right';
  ctx.fillText(
    `LIVES: ${'❤️ '.repeat(
      Math.max(0, lives)
    )}`, 
    canvas.width - 30, 
    40
  );
}

function renderOverlay(t, s) {
  ctx.fillStyle = 
    'rgba(255,255,255,0.85)';
  ctx.fillRect(
    0, 
    0, 
    canvas.width, 
    canvas.height
  );
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.font = '900 48px "Segoe UI"';
  ctx.fillText(
    t, 
    canvas.width / 2, 
    canvas.height / 2 - 20
  );
  ctx.fillStyle = '#666';
  ctx.font = '500 18px "Segoe UI"';
  ctx.fillText(
    s, 
    canvas.width / 2, 
    canvas.height / 2 + 20
  );
}
