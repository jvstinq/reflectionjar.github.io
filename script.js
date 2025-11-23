// --- Matter.js imports ---
const {
  Engine, Render, World, Bodies, Events, Mouse, MouseConstraint,
  Query, Runner, Composite, Body
} = Matter;

function $(id) { return document.getElementById(id); }

// --- Audio helper ---
function playDropSound() {
  try {
    const audio = new Audio("assets/drop.mp3");
    audio.volume = 0.6;
    audio.play().catch(() => { /* browser autoplay restrictions - ignore */ });
  } catch (e) {
    // If asset missing or audio fails, ignore to avoid noisy console errors.
  }
}

// --- Prompt UI & basic popup handling ---
let prompts = [];
let currentPrompt = null;

if ($("writeBtn")) {
  $("writeBtn").addEventListener("click", () => { $("popup").style.display = "flex"; });
}
if ($("closePopup")) {
  $("closePopup").addEventListener("click", () => { $("popup").style.display = "none"; });
}

// Load prompts (data.json expected)
fetch("data.json")
  .then(r => r.json())
  .then(data => {
    prompts = data.prompts || [];
  })
  .catch(() => { /* ok if missing for now */ });

if ($("promptBtn")) {
  $("promptBtn").addEventListener("click", () => {
    if (prompts.length > 0) {
      currentPrompt = prompts[Math.floor(Math.random() * prompts.length)];
      $("promptText").textContent = currentPrompt;
      if ($("clearPromptBtn")) $("clearPromptBtn").style.display = "inline-block";
    } else {
      $("promptText").textContent = "Loading prompts... please try again.";
      if ($("clearPromptBtn")) $("clearPromptBtn").style.display = "none";
    }
  });
}
if ($("clearPromptBtn")) {
  $("clearPromptBtn").addEventListener("click", () => {
    currentPrompt = null;
    $("promptText").textContent = "";
    $("clearPromptBtn").style.display = "none";
  });
}

// Tutorial wiring (if present in DOM)
async function loadTutorial() {
  try {
    const r = await fetch("data.json");
    const data = await r.json();
    const tutorial = data.tutorial;
    if ($("tutorialTitle")) $("tutorialTitle").textContent = tutorial.title;
    if ($("tutorialBody")) {
      const body = $("tutorialBody");
      body.innerHTML = "";
      tutorial.sections.forEach(section => {
        const h3 = document.createElement("h3");
        h3.textContent = section.heading;
        body.appendChild(h3);
        const ul = document.createElement("ul");
        section.items.forEach(item => {
          const li = document.createElement("li");
          li.textContent = item;
          ul.appendChild(li);
        });
        body.appendChild(ul);
      });
    }
  } catch (e) {
    // ignore
  }
}
if ($("tutorialBtn")) {
  $("tutorialBtn").addEventListener("click", async () => {
    await loadTutorial();
    if ($("tutorialPopup")) $("tutorialPopup").style.display = "flex";
  });
}
if ($("closeTutorial")) {
  $("closeTutorial").addEventListener("click", () => {
    $("tutorialPopup").style.display = "none";
  });
}

// --- Matter.js setup ---
const engine = Engine.create();
const world = engine.world;

const canvas = $("jar-canvas");
const render = Render.create({
  canvas: canvas,
  engine: engine,
  options: {
    width: canvas ? canvas.width : 400,
    height: canvas ? canvas.height : 450,
    wireframes: false,
    background: "transparent"
  }
});
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// Jar walls & curved bottom (approx)
const leftWall = Bodies.rectangle(94, 200, 10, 350, { isStatic: true, render: { visible: false } });
const rightWall = Bodies.rectangle(355, 200, 10, 350, { isStatic: true, render: { visible: false } });
World.add(world, [leftWall, rightWall]);

const curveSegments = 30;
const curveRadius = 160;
const centerX = 226;
const bottomY = 358;
const curveBodies = [];
for (let i = 0; i <= curveSegments; i++) {
  const angle = Math.PI * (i / curveSegments);
  const x = centerX + Math.cos(angle) * curveRadius * 0.8;
  const y = bottomY + Math.sin(angle) * 40;
  const c = Bodies.circle(x, y, 8, { isStatic: true, render: { visible: false } });
  curveBodies.push(c);
}
World.add(world, curveBodies);

// Mouse interaction
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  constraint: { stiffness: 0.2, render: { visible: false } }
});
World.add(world, mouseConstraint);

// Keep track of tokens we add, set body.isToken = true
function markAsToken(body, type) {
  body.isToken = true;
  body.tokenType = type || "gold";
}

// --- Token creation helpers ---
// create a token; if isHistory true, spawn near bottom and silent
function createTokenVisual(displayDate, reflectionData, colorType = "gold", isHistory = false) {
  const xPos = 230 + (Math.random() - 0.5) * 100;
  const colorMap = { gold: "#FFD700", silver: "#C0C0C0" };

  const radius = 18;
  const yPos = isHistory ? (300 + Math.random() * 40) : -40; // off-top for new tokens, bottom area for history
  const props = {
    restitution: isHistory ? 0.05 : 0.5,
    friction: 0.08,
    frictionAir: isHistory ? 0.08 : 0.02,
    density: 0.0018,
    render: { fillStyle: colorMap[colorType] || colorMap.gold }
  };

  const token = Bodies.circle(xPos, yPos, radius, props);
  token.label = displayDate;
  token.plugin = { reflection: reflectionData };
  markAsToken(token, colorType);
  World.add(world, token);

  // If history token -> give tiny nudge so it "settles" naturally (Option B)
  if (isHistory) {
    Body.setVelocity(token, { x: (Math.random() - 0.5) * 0.2, y: (Math.random() - 0.5) * 0.2 });
  } else {
    // New token: play sound and let it fall naturally
    playDropSound();
  }

  return token;
}

// Utility to remove all token bodies we added
function clearAllTokenBodies() {
  // We use Composite.allBodies(world) to find bodies that have isToken flag
  const allBodies = Composite.allBodies(world);
  for (let b of allBodies) {
    if (b.isToken) {
      try { World.remove(world, b); } catch (e) { /* ignore */ }
    }
  }
}

// --- Persistence & canonical state keys ---
const REFLECTIONS_KEY = "reflections";
const TOTAL_TOKENS_KEY = "totalTokens";
const STREAK_KEY = "streak";
const LASTDATE_KEY = "lastDate";
const BONUS_KEY = "bonusTokens";

// Local cached values
let streak = parseInt(localStorage.getItem(STREAK_KEY), 10) || 0;
let lastDate = localStorage.getItem(LASTDATE_KEY) || null;
let bonusTokens = parseInt(localStorage.getItem(BONUS_KEY), 10) || 0;
let totalTokens = parseInt(localStorage.getItem(TOTAL_TOKENS_KEY), 10) || 0;

// UI updates
function updateStreakDisplay() {
  if ($("streakText")) $("streakText").textContent = `🔥 Streak: ${streak} day${streak !== 1 ? "s" : ""}`;
  if ($("bonusText")) $("bonusText").textContent = `Bonus Tokens: ${bonusTokens}`;
}
function updateTotalTokensDisplay() {
  if ($("totalTokens")) $("totalTokens").textContent = totalTokens;
  if ($("tokenDisplay")) $("tokenDisplay").textContent = `Tokens: ${totalTokens}`;
}
updateStreakDisplay();
updateTotalTokensDisplay();

// --- Rebuild the jar to match the canonical state ---
// New robust logic:
//  - Always render ALL silver reflections from storage as silver tokens
//  - Render exactly `totalTokens` gold tokens (independent of reflections)
//  - Place history tokens near bottom, silent, gentle nudge
function rebuildTokensFromStorage() {
  // remove previous token bodies
  clearAllTokenBodies();

  const reflections = JSON.parse(localStorage.getItem(REFLECTIONS_KEY) || "[]");
  const goldCount = parseInt(localStorage.getItem(TOTAL_TOKENS_KEY) || "0", 10) || 0;

  // Spawn silver tokens from reflections where type === 'silver'
  // We iterate oldest->newest so stacking looks natural
  for (let i = 0; i < reflections.length; i++) {
    const ref = reflections[i];
    if (ref.type === "silver") {
      const displayDate = ref.displayDate || (new Date(ref.dateISO || Date.now()).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" }));
      createTokenVisual(displayDate, { prompt: ref.prompt, text: ref.text }, "silver", true);
    }
  }

  // Spawn gold tokens to exactly match goldCount
  // We spawn them after silver so they can appear mixed in naturally
  for (let i = 0; i < goldCount; i++) {
    const dateStr = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
    createTokenVisual(dateStr, { prompt: null, text: "Token" }, "gold", true);
  }

  // One engine update to let tokens settle a little
  Engine.update(engine, 50);
}

// --- DOM ready: ensure defaults and rebuild jar ---
window.addEventListener("DOMContentLoaded", () => {
  // ensure keys exist and are numeric
  if (isNaN(totalTokens)) {
    totalTokens = 0;
    localStorage.setItem(TOTAL_TOKENS_KEY, "0");
  }
  if (!Array.isArray(JSON.parse(localStorage.getItem(REFLECTIONS_KEY) || "[]"))) {
    localStorage.setItem(REFLECTIONS_KEY, JSON.stringify([]));
  }

  // Rebuild visuals
  rebuildTokensFromStorage();
  updateStreakDisplay();
  updateTotalTokensDisplay();
});

// --- Submit handler (unified logic, Option A) ---
if ($("submitBtn")) {
  $("submitBtn").addEventListener("click", () => {
    const reflectionTextEl = $("reflectionText");
    if (!reflectionTextEl) return;
    const text = reflectionTextEl.value.trim();
    if (!text) return;

    const todayISO = new Date().toISOString().split("T")[0];
    const lastDateStored = localStorage.getItem(LASTDATE_KEY);
    const isFirstToday = (lastDateStored !== todayISO);

    // Streak handling only on first daily submission
    if (isFirstToday) {
      if (!lastDateStored) {
        streak = 1;
      } else {
        const last = new Date(lastDateStored);
        const now = new Date(todayISO);
        const diffDays = (now - last) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) streak++;
        else streak = 1;
      }
    } // else streak unchanged

    // Token awarding
    let tokenColor = "silver";
    let earnedTokens = 0;
    if (isFirstToday) {
      bonusTokens = Math.floor(streak / 2);
      earnedTokens = 1 + bonusTokens;
      totalTokens += earnedTokens;
      tokenColor = "gold";
    } else {
      tokenColor = "silver";
    }

    // Build reflection object and save
    const dateDisplay = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
    const reflectionObj = {
      id: Date.now().toString(),
      dateISO: todayISO,
      displayDate: dateDisplay,
      text,
      prompt: currentPrompt,
      type: tokenColor
    };

    const reflections = JSON.parse(localStorage.getItem(REFLECTIONS_KEY) || "[]");
    reflections.push(reflectionObj);
    localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(reflections));

    // Persist canonical values
    localStorage.setItem(STREAK_KEY, String(streak));
    localStorage.setItem(LASTDATE_KEY, todayISO);
    localStorage.setItem(BONUS_KEY, String(bonusTokens));
    localStorage.setItem(TOTAL_TOKENS_KEY, String(totalTokens));

    // Create a visible token for this submission (new token path)
    createTokenVisual(dateDisplay, { prompt: currentPrompt, text }, tokenColor, false);

    // Update UI and teardown popup
    updateStreakDisplay();
    updateTotalTokensDisplay();
    reflectionTextEl.value = "";
    currentPrompt = null;
    if ($("promptText")) $("promptText").textContent = "";
    if ($("clearPromptBtn")) $("clearPromptBtn").style.display = "none";
    if ($("popup")) $("popup").style.display = "none";
  });
}

// --- Shop button wiring ---
if ($("shopBtn")) {
  $("shopBtn").addEventListener("click", () => {
    window.location.href = "shop.html";
  });
}

// --- Storage event: react to external changes (e.g., purchases in shop) ---
window.addEventListener("storage", (e) => {
  if (!e) return;
  if (e.key === TOTAL_TOKENS_KEY) {
    totalTokens = parseInt(e.newValue || "0", 10) || 0;
    updateTotalTokensDisplay();
    rebuildTokensFromStorage();
  } else if (e.key === REFLECTIONS_KEY) {
    // Separated reflections changed externally (unlikely) -> rebuild
    rebuildTokensFromStorage();
  }
});

// --- Click on tokens shows the reflection (if any) ---
Events.on(mouseConstraint, "mousedown", (event) => {
  const mousePos = event.mouse.position;
  const clicked = Query.point(Composite.allBodies(world).filter(b => b.isToken), mousePos);
  if (clicked && clicked.length > 0) {
    const token = clicked[0];
    const data = token.plugin?.reflection;
    const label = token.label || "";
    if (data) {
      alert(`🪞 Reflection (${label})\n\n` + (data.prompt ? `Prompt: ${data.prompt}\n\n` : "") + data.text);
    }
  }
});

// --- Debug shortcut: Shift+T to add tokens (remove later) ---
document.addEventListener("keydown", (ev) => {
  if (ev.shiftKey && (ev.key === "T" || ev.key === "t")) {
    totalTokens += 20;
    localStorage.setItem(TOTAL_TOKENS_KEY, String(totalTokens));
    updateTotalTokensDisplay();
    rebuildTokensFromStorage();
    console.log("[DEBUG] Added 20 tokens. New total:", totalTokens);
  }
});

// --- Utility: clear all reflections & tokens (dev only) ---
// Uncomment below to enable a debug clear button in-page.
// function devClearAll() {
//   localStorage.removeItem(REFLECTIONS_KEY);
//   localStorage.setItem(TOTAL_TOKENS_KEY, "0");
//   rebuildTokensFromStorage();
//}
// (call devClearAll() from console if needed)
