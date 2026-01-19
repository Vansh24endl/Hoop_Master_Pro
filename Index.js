const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score-val');
const missEl = document.getElementById('miss-val');
const toastEl = document.getElementById('toast');
const restartBtn = document.getElementById('restart-btn');
const aiBtn = document.getElementById('ai-tip-btn');
const ballSelectBtn = document.getElementById('ball-select-btn');
const aiBubble = document.getElementById('ai-bubble');
const modalOverlay = document.getElementById('modal-overlay');
const ballGrid = document.getElementById('ball-grid');
const closeModalBtn = document.getElementById('close-modal-btn');

// Gemini API Setup
const apiKey = ""; 

// Expanded Ball Themes
const ballThemes = [
    { name: 'Classic', primary: '#fb923c', secondary: '#c2410c' },
    { name: 'Deep Sea', primary: '#38bdf8', secondary: '#1e40af' },
    { name: 'Toxic', primary: '#bef264', secondary: '#3f6212' },
    { name: 'Golden', primary: '#fde047', secondary: '#a16207' },
    { name: 'Void', primary: '#94a3b8', secondary: '#0f172a' },
    { name: 'Gemini', primary: '#8ab4f8', secondary: '#4285f4' },
    { name: 'Neon City', primary: '#ff00ff', secondary: '#7000ff' },
    { name: 'Mars', primary: '#ef4444', secondary: '#7f1d1d' },
    { name: 'Ice', primary: '#e0f2fe', secondary: '#3b82f6' },
    { name: 'Magma', primary: '#f87171', secondary: '#450a0a' },
    { name: 'Forest', primary: '#4ade80', secondary: '#064e3b' },
    { name: 'Candy', primary: '#f472b6', secondary: '#9d174d' }
];
let currentThemeIndex = 0;

function populateBallGrid() {
    ballGrid.innerHTML = '';
    ballThemes.forEach((theme, index) => {
        const div = document.createElement('div');
        div.className = `ball-option ${index === currentThemeIndex ? 'active' : ''}`;
        div.onclick = () => {
            currentThemeIndex = index;
            populateBallGrid();
        };
        
        const preview = document.createElement('div');
        preview.className = 'ball-preview';
        preview.style.background = `radial-gradient(circle at 30% 30%, ${theme.primary}, ${theme.secondary})`;
        
        const name = document.createElement('div');
        name.className = 'ball-name';
        name.innerText = theme.name;

        div.appendChild(preview);
        div.appendChild(name);
        ballGrid.appendChild(div);
    });
}

async function getAITip() {
    aiBtn.disabled = true;
    const originalText = aiBtn.innerHTML;
    aiBtn.innerHTML = "Coach Thinking<span class='loading-dots'></span>";
    
    const systemPrompt = `You are an expert basketball coach and a witty commentator for a 2D physics game.
Current Stats: Score: ${score}, Misses: ${misses}.
Current Ball Skin: ${ballThemes[currentThemeIndex].name}.
Rules:
1. Keep it short (max 2 sentences).
2. Give a specific comment about their choice of ball skin if appropriate.
3. If misses > score, give a 'pro tip' about aiming or arcs.
4. Tone: Energetic, encouraging, and smart.`;

    const userQuery = "Hey coach, how am I doing with this " + ballThemes[currentThemeIndex].name + " ball?";

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: userQuery }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] }
            })
        });

        if (!response.ok) throw new Error('API error');
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "Looking good on the court!";
        showAIBubble(text);
    } catch (error) {
        showAIBubble("Keep practicing! Every shot counts.");
    } finally {
        aiBtn.innerHTML = originalText;
        aiBtn.disabled = false;
    }
}

function showAIBubble(text) {
    aiBubble.innerText = text;
    aiBubble.style.opacity = '1';
    setTimeout(() => { aiBubble.style.opacity = '0'; }, 6000);
}

// Game Physics constants
const GRAVITY = 0.35;
const BOUNCE = 0.75; 
const AIR_RESISTANCE = 0.995;

let score = 0;
let misses = 0;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragCurrent = { x: 0, y: 0 };

const ball = {
    x: 0,
    y: 0,
    radius: 24,
    vx: 0,
    vy: 0,
    angle: 0,
    rotationSpeed: 0,
    isFlying: false,
    reset: function(isManualReset = false) {
        if (!isManualReset && this.isFlying && !hoop.hasScoredThisTurn) {
            incrementMiss();
        }
        this.x = 100;
        this.y = canvas.height - 150;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.rotationSpeed = 0;
        this.isFlying = false;
        hoop.hasScoredThisTurn = false;
    }
};

const hoop = {
    x: 0, y: 0, width: 85,
    rimThickness: 10,
    backboardX: 0, backboardY: 0,
    backboardW: 12, backboardH: 140,
    hasScoredThisTurn: false,
    init: function() {
        this.backboardX = canvas.width - this.backboardW;
        this.y = canvas.height * 0.35;
        this.x = this.backboardX - (this.width / 2) - 5;
        this.backboardY = this.y - 110;
    }
};

function incrementMiss() {
    misses++;
    missEl.innerText = misses;
}

function init() {
    resize();
    ball.reset(true);
    populateBallGrid();
    
    window.addEventListener('resize', resize);
    
    restartBtn.addEventListener('click', () => {
        score = 0;
        misses = 0;
        scoreEl.innerText = 0;
        missEl.innerText = 0;
        ball.reset(true);
        showToast("RESTARTED");
    });

    aiBtn.addEventListener('click', getAITip);
    
    ballSelectBtn.addEventListener('click', () => {
        modalOverlay.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', () => {
        modalOverlay.style.display = 'none';
    });

    canvas.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', endDrag);

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startDrag(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => moveDrag(e.touches[0]));
    window.addEventListener('touchend', endDrag);

    requestAnimationFrame(gameLoop);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    hoop.init();
    if (!ball.isFlying) ball.reset(true);
}

function startDrag(e) {
    if (ball.isFlying || modalOverlay.style.display === 'flex') return;
    const dist = Math.hypot(e.clientX - ball.x, e.clientY - ball.y);
    if (dist < 100) {
        isDragging = true;
        dragStart = { x: ball.x, y: ball.y };
        dragCurrent = { x: e.clientX, y: e.clientY };
    }
}

function moveDrag(e) {
    if (!isDragging) return;
    dragCurrent = { x: e.clientX, y: e.clientY };
}

function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    const dx = dragCurrent.x - dragStart.x;
    const dy = dragCurrent.y - dragStart.y;
    ball.vx = dx * 0.14;
    ball.vy = dy * 0.14;
    ball.rotationSpeed = ball.vx * 0.05;
    if (Math.abs(ball.vx) + Math.abs(ball.vy) > 2) ball.isFlying = true;
}

function showToast(text) {
    toastEl.innerText = text;
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translate(-50%, -50%) scale(1.1)';
    setTimeout(() => {
        toastEl.style.opacity = '0';
        toastEl.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 1000);
}

function resolveRimCollision(px, py) {
    const dist = Math.hypot(ball.x - px, ball.y - py);
    if (dist < ball.radius + hoop.rimThickness / 2) {
        const nx = (ball.x - px) / dist;
        const ny = (ball.y - py) / dist;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
            ball.vx = (ball.vx - 2 * dot * nx) * BOUNCE;
            ball.vy = (ball.vy - 2 * dot * ny) * BOUNCE;
            ball.vx += nx * 1.5; ball.vy += ny * 1.5;
            ball.x = px + nx * (ball.radius + hoop.rimThickness / 2 + 2);
            ball.y = py + ny * (ball.radius + hoop.rimThickness / 2 + 2);
        }
    }
}

function update() {
    if (!ball.isFlying) return;

    ball.vy += GRAVITY;
    ball.vx *= AIR_RESISTANCE;
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.angle += ball.rotationSpeed;

    if (ball.x + ball.radius > hoop.backboardX && 
        ball.y > hoop.backboardY && ball.y < hoop.backboardY + hoop.backboardH) {
        ball.vx = -Math.abs(ball.vx) * BOUNCE;
        ball.x = hoop.backboardX - ball.radius - 2;
    }

    resolveRimCollision(hoop.x - hoop.width / 2, hoop.y);
    resolveRimCollision(hoop.x + hoop.width / 2, hoop.y);

    if (!hoop.hasScoredThisTurn && ball.vy > 0) {
        if (ball.x > hoop.x - hoop.width/2 && ball.x < hoop.x + hoop.width/2 && 
            ball.y > hoop.y - 15 && ball.y < hoop.y + 15) {
            hoop.hasScoredThisTurn = true;
            score++;
            scoreEl.innerText = score;
            showToast("SWISH!");
        }
    }

    if (ball.y > canvas.height + 100 || ball.x > canvas.width + 100 || ball.x < -100) {
        ball.reset();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Floor line
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 80); ctx.lineTo(canvas.width, canvas.height - 80);
    ctx.stroke();

    // Hoop
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillRect(hoop.backboardX, hoop.backboardY, hoop.backboardW, hoop.backboardH);
    ctx.strokeRect(hoop.backboardX, hoop.backboardY, hoop.backboardW, hoop.backboardH);
    ctx.strokeRect(hoop.backboardX - 2, hoop.y - 45, 5, 60);

    // Net
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    const rimL = hoop.x - hoop.width/2;
    for(let i=0; i<=5; i++) {
        ctx.moveTo(rimL + (i * (hoop.width/5)), hoop.y);
        ctx.lineTo(hoop.x - 15 + (i*6), hoop.y + 55);
    }
    ctx.stroke();

    // Rim
    ctx.beginPath();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = hoop.rimThickness;
    ctx.moveTo(hoop.x - hoop.width/2, hoop.y);
    ctx.lineTo(hoop.x + hoop.width/2, hoop.y);
    ctx.stroke();

    // Prediction path
    if (isDragging) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.setLineDash([4, 12]);
        let tx = ball.x, ty = ball.y;
        let tvx = (dragCurrent.x - dragStart.x) * 0.14, tvy = (dragCurrent.y - dragStart.y) * 0.14;
        ctx.moveTo(tx, ty);
        for(let i=0; i<25; i++) {
            tvy += GRAVITY; tx += tvx; ty += tvy;
            ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    const theme = ballThemes[currentThemeIndex];
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.angle);
    
    // Inner Glow / Theme Gradient
    const grad = ctx.createRadialGradient(-5,-5, 5, 0, 0, ball.radius);
    grad.addColorStop(0, theme.primary); 
    grad.addColorStop(1, theme.secondary);
    
    ctx.beginPath(); ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();
    
    // Ball Pattern (Basketball lines)
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    if (theme.name === 'Void') ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-ball.radius, 0); ctx.lineTo(ball.radius, 0);
    ctx.moveTo(0, -ball.radius); ctx.lineTo(0, ball.radius);
    ctx.ellipse(0, 0, ball.radius, ball.radius * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

init();
