// --- POPUP OPEN/CLOSE LOGIC ---
document.getElementById("writeBtn").addEventListener("click", () => {
  document.getElementById("popup").style.display = "flex";
});

document.getElementById("closePopup").addEventListener("click", () => {
  document.getElementById("popup").style.display = "none";
});

let prompts = [];

fetch("data.json")
  .then(response => response.json())
  .then(data => {
    prompts = data.prompts || [];
    console.log("Prompts loaded:", prompts);
  })
  .catch(error => console.error("Error loading prompts:", error));

document.getElementById("promptBtn").addEventListener("click", () => {
  if (prompts.length > 0) {
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    document.getElementById("promptText").textContent = randomPrompt;
  } else {
    document.getElementById("promptText").textContent =
      "Loading prompts... please try again.";
  }
});

// --- MATTER.JS SETUP ---
const { Engine, Render, World, Bodies, Events, Mouse, MouseConstraint, Query, Runner, Composite } = Matter;

const engine = Engine.create();
const world = engine.world;

const canvas = document.getElementById("jar-canvas");
const render = Render.create({
  canvas: canvas,
  engine: engine,
  options: {
    width: canvas.width,
    height: canvas.height,
    wireframes: false,
    background: "transparent"
  }
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// --- JAR WALLS ---
const leftWall = Bodies.rectangle(94, 200, 10, 350, { isStatic: true, render: {visible: false} });
const rightWall = Bodies.rectangle(355, 200, 10, 350, { isStatic: true, render: {visible: false}});
World.add(world, [leftWall, rightWall]);

// --- CURVED BOTTOM (approximation using small static circles) ---
const curveSegments = 30;
const curveRadius = 160;
const centerX = 226;
const bottomY = 358;

const curveBodies = [];
for (let i = 0; i <= curveSegments; i++) {
  const angle = Math.PI * (i / curveSegments);
  const x = centerX + Math.cos(angle) * curveRadius * 0.8;
  const y = bottomY + Math.sin(angle) * 40;
  const circle = Bodies.circle(x, y, 8, { isStatic: true, render: {visible: false} });
  curveBodies.push(circle);
}

World.add(world, curveBodies);

// --- MOUSE HANDLING ---
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse: mouse,
  constraint: {
    stiffness: 0.2,
    render: { visible: false }
  }
});
World.add(world, mouseConstraint);

// Keep a simple list of created tokens for quick lookup
const tokens = [];

// --- TOKEN CREATION ---
function createToken(dateStr, reflectionData) {
  const xPos = 230 + (Math.random() - 0.5) * 100;
  const token = Bodies.circle(xPos, 0, 20, {
    restitution: 0.5,
    friction: 0.1,
    render: { fillStyle: "#FFD700" },
  });

  token.plugin = { reflection: reflectionData };
  token.label = dateStr;

  World.add(world, token);
  tokens.push(token);

  playDropSound();
}

// --- CLICK EVENT (shared for all tokens) ---
Events.on(mouseConstraint, "mousedown", (event) => {
  const mousePosition = event.mouse.position;
  const clicked = Query.point(tokens, mousePosition);

  if (clicked.length > 0) {
    const token = clicked[0];
    const data = token.plugin?.reflection;

    if (data) {
      alert(
        `🪞 Reflection (${token.label})\n\n` +
        (data.prompt ? `Prompt: ${data.prompt}\n` : "") +
        `${data.text}`
      );
    }
  }
});

// --- DROP SOUND ---
function playDropSound() {
  const audio = new Audio("assets/drop.mp3");
  audio.play();
}

// --- SUBMIT HANDLER ---
document.getElementById("submitBtn").addEventListener("click", () => {
  const reflectionText = document.getElementById("reflectionText").value.trim();
  if (!reflectionText) return;

  const dateStr = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
  const reflectionData = { prompt: "Free write", text: reflectionText };

  createToken(dateStr, reflectionData);

  // Save reflection to localStorage
  const reflections = JSON.parse(localStorage.getItem("reflections") || "[]");
  reflections.push({ date: dateStr, text: reflectionText });
  localStorage.setItem("reflections", JSON.stringify(reflections));

  document.getElementById("reflectionText").value = "";
  document.getElementById("popup").style.display = "none";
});

// === TOKEN + SHOP SUPPORT (ADDED) ===

// Shared keys
const RJ_TOKEN_KEY = "rj_tokens";
const RJ_INVENTORY_KEY = "rj_inventory";

// How many reflections exist (drives initial tokens)
function rjGetReflectionCount() {
  try {
    const arr = JSON.parse(localStorage.getItem("reflections") || "[]");
    return Array.isArray(arr) ? arr.length : 0;
  } catch (e) {
    return 0;
  }
}

function rjGetTokens() {
  const stored = parseInt(localStorage.getItem(RJ_TOKEN_KEY), 10);
  if (Number.isNaN(stored)) {
    const initial = rjGetReflectionCount();
    localStorage.setItem(RJ_TOKEN_KEY, String(initial));
    return initial;
  }
  return stored;
}

function rjSetTokens(val) {
  const safe = Math.max(0, val | 0);
  localStorage.setItem(RJ_TOKEN_KEY, String(safe));
  return safe;
}

// Run once on main page load
window.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem(RJ_TOKEN_KEY) === null) {
    rjSetTokens(rjGetReflectionCount());
  }
});

// Hook up existing Shop button -> Shop scene
const shopBtnEl = document.getElementById("shopBtn");
if (shopBtnEl) {
  shopBtnEl.addEventListener("click", () => {
    window.location.href = "shop.html";
  });
}

// === TOKEN UPDATE ON REFLECTION SUBMIT ===
if (localStorage.getItem(RJ_TOKEN_KEY) === null) {
  localStorage.setItem(RJ_TOKEN_KEY, "0");
}

const submitBtn = document.getElementById("submitBtn");
if (submitBtn) {
  submitBtn.addEventListener("click", () => {
    setTimeout(() => {
      let tokens = parseInt(localStorage.getItem(RJ_TOKEN_KEY), 10) || 0;
      tokens += 1;
      localStorage.setItem(RJ_TOKEN_KEY, tokens);

      const tokenDisplay = document.getElementById("tokenDisplayMain");
      if (tokenDisplay) {
        tokenDisplay.textContent = `Tokens: ${tokens}`;
      }
    }, 100);
  });
}
