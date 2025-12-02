// ChatGPT API configuration
const USE_BACKEND_FOR_SUMMARY = true; // Set to true to use ChatGPT for summaries, testing purposes
const BACKEND_URL = ''; // Backend server URL
const SUMMARY_THRESHOLD = 2; // Generate summary after this many entries from user

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

// Apply theme
const activeTheme = localStorage.getItem("rj_active_theme") || "blue";
applyTheme(activeTheme);

// --- Prompt UI & basic popup handling ---
let prompts = [];
let currentPrompt = null;

if ($("writeBtn")) {
  $("writeBtn").addEventListener("click", () => { $("popup").style.display = "flex"; });
}
if ($("closePopup")) {
  $("closePopup").addEventListener("click", () => { $("popup").style.display = "none"; });
}
$("popup").addEventListener("click", (e) => {
  if (e.target === $("popup")) {
    $("popup").style.display = "none";
  }
});

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

  // If history token -> give tiny nudge so it "settles" naturally
  if (isHistory) {
    Body.setVelocity(token, { x: (Math.random() - 0.5) * 0.2, y: (Math.random() - 0.5) * 0.2 });
  } else {
    // New token: play sound and let it fall naturally
    playDropSound();
  }

  return token;
}

// Utility to remove all added token bodies
function clearAllTokenBodies() {
  const allBodies = Composite.allBodies(world);
  for (let b of allBodies) {
    if (b.isToken) {
      try { World.remove(world, b); } catch (e) { /* ignore */ }
    }
  }
}

// --- Persistence & canonical state keys ---
const REFLECTIONS_KEY = "reflections";
const TOTAL_TOKENS_KEY = "totalTokens";   // GOLD tokens (shop currency)
const STREAK_KEY = "streak";
const LASTDATE_KEY = "lastDate";
const BONUS_KEY = "bonusTokens";

// Local cached values
let streak = parseInt(localStorage.getItem(STREAK_KEY), 10) || 0;
let lastDate = localStorage.getItem(LASTDATE_KEY) || null;
let bonusTokens = parseInt(localStorage.getItem(BONUS_KEY), 10) || 0;
let totalTokens = parseInt(localStorage.getItem(TOTAL_TOKENS_KEY), 10) || 0; // gold tokens

// UI updates
function updateStreakDisplay() {
  if ($("streakText"))
    $("streakText").textContent = `🔥 Streak: ${streak} day${streak !== 1 ? "s" : ""}`;

  // Old bonusText (if still in DOM); safe no-op if missing
  if ($("bonusText"))
    $("bonusText").textContent = `Bonus Tokens: ${bonusTokens}`;

  // Fire emoji streak bar
  const fireContainer = $("streakFires");
  if (fireContainer) {
    if (streak <= 0) {
      fireContainer.textContent = "";
    } else {
      const fires = "🔥".repeat(streak);
      fireContainer.textContent = `${fires} (${streak})`;
    }
  }
}

// NEW: Gold Tokens, Bonus Tokens, Total Tokens (Silver+Gold)
function updateTotalTokensDisplay() {
  const goldTokens = totalTokens;

  // Compute silver tokens from reflections (type === "silver")
  let silverCount = 0;
  try {
    const reflections = JSON.parse(localStorage.getItem(REFLECTIONS_KEY) || "[]");
    silverCount = reflections.filter(r => r && r.type === "silver").length;
  } catch (e) {
    silverCount = 0;
  }

  const totalAllTokens = goldTokens + silverCount;

  // Main display on index.html
  if ($("goldTokens")) $("goldTokens").textContent = goldTokens;
  // 👇 Bonus Tokens now ALWAYS matches silver tokens in the jar
  if ($("bonusTokensDisplay")) $("bonusTokensDisplay").textContent = silverCount;
  if ($("totalTokens")) $("totalTokens").textContent = totalAllTokens;

  // Shop header still uses "Tokens" = gold currency
  if ($("tokenDisplay")) $("tokenDisplay").textContent = `Tokens: ${goldTokens}`;
}

updateStreakDisplay();
updateTotalTokensDisplay();

// --- Rebuild the jar to match the canonical state ---
//  - Render silver reflections as silver tokens
//  - Render exactly `totalTokens` gold tokens
function rebuildTokensFromStorage() {
  clearAllTokenBodies();

  const reflections = JSON.parse(localStorage.getItem(REFLECTIONS_KEY) || "[]");
  const goldCount = parseInt(localStorage.getItem(TOTAL_TOKENS_KEY) || "0", 10) || 0;

  // Silver tokens from reflections
  for (let i = 0; i < reflections.length; i++) {
    const ref = reflections[i];
    if (ref.type === "silver") {
      const displayDate =
        ref.displayDate ||
        (new Date(ref.dateISO || Date.now()).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit"
        }));
      createTokenVisual(displayDate, { prompt: ref.prompt, text: ref.text }, "silver", true);
    }
  }

  // Gold tokens = totalTokens
  for (let i = 0; i < goldCount; i++) {
    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit"
    });
    createTokenVisual(dateStr, { prompt: null, text: "Token" }, "gold", true);
  }

  Engine.update(engine, 50);
}

// ===== SUMMARY POPUP LOGIC =====

const summaryBtn = $("summaryBtn");
const summaryPopup = $("summaryPopup");
const summaryList = $("summaryList");
const summaryDetails = $("summaryDetailsInner");
const summaryEmpty = $("summaryEmptyMessage");

const summaryDate = $("summaryDate");
const summaryPrompt = $("summaryPrompt");
const summaryText = $("summaryText");

if (summaryBtn) {
  summaryBtn.addEventListener("click", () => {
    populateSummaryList();
    summaryPopup.style.display = "flex";
  });
}

if ($("closeSummaryPopup")) {
  $("closeSummaryPopup").addEventListener("click", () => {
    summaryPopup.style.display = "none";
  });
}

// Build the left column listing reflections
function populateSummaryList() {
  summaryList.innerHTML = "";
  summaryDetails.style.display = "none";
  summaryEmpty.style.display = "block";

  const reflections = JSON.parse(localStorage.getItem("reflections") || "[]");

  if (reflections.length === 0) {
    summaryList.innerHTML = `<p style="text-align:center;color:#777;">No reflections yet.</p>`;
    return;
  }

  reflections
    .sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO))
    .forEach(ref => {

      const display =
        ref.displayDate ||
        ref.dateISO ||
        ref.date ||
        "Unknown";

      let preview = "";
      if (ref.prompt && ref.prompt.trim() !== "") preview = ref.prompt;
      else preview = ref.text || "";

      const item = document.createElement("div");
      item.className = "summary-list-item";

      item.innerHTML = `
        <div class="summary-list-item-date">${display}</div>
        <div class="summary-list-item-preview">${preview}</div>
      `;

      item.addEventListener("click", () => {
        document.querySelectorAll(".summary-list-item").forEach(el => el.classList.remove("active"));
        item.classList.add("active");
        showReflectionDetails(ref);
      });

      summaryList.appendChild(item);
    });
}

function showReflectionDetails(ref) {
  summaryEmpty.style.display = "none";
  summaryDetails.style.display = "block";

  summaryDate.textContent = ref.displayDate || ref.dateISO;
  summaryPrompt.textContent = ref.prompt ? `Prompt: ${ref.prompt}` : "";
  summaryText.textContent = ref.text;
}

$("closeSummaryPopup").addEventListener("click", () => {
  summaryPopup.style.display = "none";
});

summaryPopup.addEventListener("click", (e) => {
  if (e.target === summaryPopup) {
    summaryPopup.style.display = "none";
  }
});

function applyTheme(themeName) {
  const themes = {
    blue: {
      primary: "#516ea0",
      hover: "#7199dd",
      accent: "#f5f7ff",
      gradientStart: "#a0c4ff",
      gradientEnd:   "#bde0fe"
    },
    pink: {
      primary: "#ffb7d2",
      hover: "#ff9fc4",
      accent: "#fff0f5",
      gradientStart: "#ffd1e8",
      gradientEnd:   "#ffe4f2"
    },
    green: {
      primary: "#77d098ff",
      hover: "#a4dabb",
      accent: "#f2fbf5",
      gradientStart: "#c5f5d6",
      gradientEnd:   "#d7ffe8"
    },
    purple: {
      primary: "#d6c8ff",
      hover: "#c4b2ff",
      accent: "#f6f2ff",
      gradientStart: "#e5d8ff",
      gradientEnd:   "#f0e6ff"
    },

    red: {
      primary: "#ff6b6b",
      hover: "#ff8787",
      accent: "#fff1f1",
      gradientStart: "#ffb3b3",
      gradientEnd: "#ffd6d6"
    },
    orange: {
      primary: "#ff9f43",
      hover: "#ffb56b",
      accent: "#fff3e6",
      gradientStart: "#ffd7b3",
      gradientEnd: "#ffe8cc"
    },
    teal: {
      primary: "#2bbbad",
      hover: "#5adfcc",
      accent: "#e6f9f7",
      gradientStart: "#b3f0e9",
      gradientEnd: "#d6faf5"
    }

  };

  const t = themes[themeName];
  if (!t) return;

  document.documentElement.style.setProperty("--primary-color", t.primary);
  document.documentElement.style.setProperty("--primary-hover", t.hover);
  document.documentElement.style.setProperty("--bg-accent", t.accent);

  document.documentElement.style.setProperty("--gradient-start", t.gradientStart);
  document.documentElement.style.setProperty("--gradient-end", t.gradientEnd);

  localStorage.setItem("rj_active_theme", themeName);
}


// --- DOM ready: ensure defaults and rebuild jar ---
window.addEventListener("DOMContentLoaded", () => {
  if (isNaN(totalTokens)) {
    totalTokens = 0;
    localStorage.setItem(TOTAL_TOKENS_KEY, "0");
  }
  if (!Array.isArray(JSON.parse(localStorage.getItem(REFLECTIONS_KEY) || "[]"))) {
    localStorage.setItem(REFLECTIONS_KEY, JSON.stringify([]));
  }

  rebuildTokensFromStorage();
  updateStreakDisplay();
  updateTotalTokensDisplay();
});

// --- Submit handler (unified logic) ---
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
    }

    // Token awarding
    let tokenColor = "silver";
    if (isFirstToday) {
      bonusTokens = Math.floor(streak / 2);
      const earnedTokens = 1 + bonusTokens;
      totalTokens += earnedTokens;   // gold tokens
      tokenColor = "gold";
    } else {
      bonusTokens += 1;
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

    // Create a visible token for this submission
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
    rebuildTokensFromStorage();
    updateTotalTokensDisplay();
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

// --- Debug shortcut: Shift+T to add tokens (dev only) ---
document.addEventListener("keydown", (ev) => {
  if (ev.shiftKey && (ev.key === "T" || ev.key === "t")) {
    totalTokens += 20;
    localStorage.setItem(TOTAL_TOKENS_KEY, String(totalTokens));
    updateTotalTokensDisplay();
    rebuildTokensFromStorage();
    console.log("[DEBUG] Added 20 tokens. New total:", totalTokens);
  }
});

// ------------- Generate Summary Button Handler -------------
const generateSummaryBtn = document.getElementById("generateSummaryBtn");

if (generateSummaryBtn) {
  generateSummaryBtn.addEventListener("click", async () => {
    const reflections = JSON.parse(localStorage.getItem(REFLECTIONS_KEY) || "[]");

    if (reflections.length === 0) {
      alert("You haven't made any reflections yet. Start writing to see your summary!");
      return;
    }

    const originalText = generateSummaryBtn.textContent;
    generateSummaryBtn.disabled = true;
    generateSummaryBtn.textContent = "Generating...";

    try {
      let summaryText;

      if (USE_BACKEND_FOR_SUMMARY) {
        // Call your Vercel function /api/summary (or custom BACKEND_URL if set)
        const endpoint = BACKEND_URL || "/api/summary";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ reflections })
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        summaryText =
          data.summary ||
          data.message ||
          JSON.stringify(data, null, 2);
      } else {
        // No backend? Use local summary instead
        summaryText = buildLocalSummary(reflections);
      }

      alert("🌟 Your reflection summary:\n\n" + summaryText);
    } catch (err) {
      console.error("Error generating summary:", err);

      // Fallback: local summary so the button still feels useful
      const fallback = buildLocalSummary(reflections);
      alert(
        "Couldn't reach the AI summary backend, but here's a quick summary instead:\n\n" +
        fallback
      );
    } finally {
      generateSummaryBtn.disabled = false;
      generateSummaryBtn.textContent = originalText;
    }
  });
}

// ------------- Local summary fallback -------------
function buildLocalSummary(reflections) {
  const count = reflections.length;
  const recent = reflections.slice(-3); // last up to 3 reflections

  const dateList = recent
    .map(r => r.displayDate || r.dateISO || r.date || "Unknown date")
    .join(", ");

  const snippets = recent
    .map(r => "- " + (r.text || "").slice(0, 140))
    .join("\n");

  return (
    `You have written ${count} reflection${count === 1 ? "" : "s"}.\n` +
    (dateList ? `Recent dates: ${dateList}\n\n` : "\n") +
    `Recent snippets:\n${snippets || "(no text found)"}`
  );
}
