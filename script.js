window.addEventListener("storage", () => {
  updateTotalTokensDisplay();
});

// --- POPUP OPEN/CLOSE LOGIC ---
document.getElementById("writeBtn").addEventListener("click", () => {
  document.getElementById("popup").style.display = "flex";
});

document.getElementById("closePopup").addEventListener("click", () => {
  document.getElementById("popup").style.display = "none";
});

// --- PROMPTS ---
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

// ---Tutorial ---
async function loadTutorial() {
  const response = await fetch("data.json");
  const data = await response.json();

  const tutorial = data.tutorial;

  // Fill title
  document.getElementById("tutorialTitle").textContent = tutorial.title;

  // Build sections dynamically
  const body = document.getElementById("tutorialBody");
  body.innerHTML = ""; // clear old content

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

tutorialBtn.addEventListener("click", async () => {
  await loadTutorial();
  tutorialPopup.style.display = "flex";
});
closeTutorial.addEventListener("click", () => {
  tutorialPopup.style.display = "none";
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
//const bottom = Bodies.rectangle(230, 400, 340, 10, { isStatic: true });
World.add(world, [leftWall, rightWall]);

// --- CURVED BOTTOM (approximation using small static circles) ---
const curveSegments = 30;   // increase for smoother curve
const curveRadius = 160;    // how wide the curve is
const centerX = 226;        // align with jar center
const bottomY = 358;        // base Y near the bottom wall

const curveBodies = [];
for (let i = 0; i <= curveSegments; i++) {
  const angle = Math.PI * (i / curveSegments); // 180° arc
  const x = centerX + Math.cos(angle) * curveRadius * 0.8;
  const y = bottomY + Math.sin(angle) * 40; // scale Y to flatten curve
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
function createToken(dateStr, reflectionData, colorType = "gold") {
  const xPos = 230 + (Math.random() - 0.5) * 100;

  const colorMap = {
    gold: "#FFD700",
    silver: "#C0C0C0"
  };

  const token = Bodies.circle(xPos, 0, 20, {
    restitution: 0.5,
    friction: 0.1,
    render: { fillStyle: colorMap[colorType] || "#FFD700" }
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

  // Query all tokens to see if the mouse is clicking one
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

// --- RECREATE TOKENS FROM STORAGE ---
const savedReflections = JSON.parse(localStorage.getItem("reflections") || "[]");
savedReflections.forEach(ref => {
  createToken(ref.date, { prompt: "Free write", text: ref.text });
});

//---to reset (TESTING PURPOSE) ---
//localStorage.clear();

// --- setting up streak and tokens---
let streak = parseInt(localStorage.getItem("streak")) || 0;
let lastDate = localStorage.getItem("lastDate") || null;
let bonusTokens = parseInt(localStorage.getItem("bonusTokens")) || 0;
let totalTokens = parseInt(localStorage.getItem("totalTokens")) || 0;

//update streak
function updateStreakDisplay() {
  document.getElementById("streakText").textContent = `🔥 Streak: ${streak} day${streak !== 1 ? "s" : ""}`;
  document.getElementById("bonusText").textContent = `Bonus Tokens: ${bonusTokens}`;
}
updateStreakDisplay();

//update total tokens
function updateTotalTokensDisplay() {
  document.getElementById("totalTokens").textContent = totalTokens;
}
updateTotalTokensDisplay();

// --- SUBMIT HANDLER ---
document.getElementById("submitBtn").addEventListener("click", () => {
  const reflectionText = document.getElementById("reflectionText").value.trim();
  if (!reflectionText) return;

  const today = new Date().toISOString().split("T")[0];
  const lastDate = localStorage.getItem("lastDate");
  const isFirstToday = (lastDate !== today);

  // --- Handle streak ---
  if (isFirstToday) {
    if (!lastDate) {
      streak = 1;
    } else {
      const last = new Date(lastDate);
      const now = new Date(today);
      const diffDays = (now - last) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        streak++;
      } else {
        streak = 1;
      }
    }
  }

  // --- Token calculation ---
  let tokenColor;
  let earnedTokens = 0;

  if (isFirstToday) {
    bonusTokens = Math.floor(streak / 2);
    earnedTokens = 1 + bonusTokens;
    totalTokens += earnedTokens;
    tokenColor = "gold";
  } else {
    tokenColor = "silver";  // no currency
  }

  // --- Create token visually ---
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit"
  });

  const reflectionData = { prompt: "Free write", text: reflectionText };

  createToken(dateStr, reflectionData, tokenColor);

  // --- Save reflection ---
  const reflections = JSON.parse(localStorage.getItem("reflections") || "[]");
  reflections.push({ date: dateStr, text: reflectionText });
  localStorage.setItem("reflections", JSON.stringify(reflections));

  // --- Save tokens + streak ---
  localStorage.setItem("streak", streak);
  localStorage.setItem("lastDate", today);
  localStorage.setItem("bonusTokens", bonusTokens);
  localStorage.setItem("totalTokens", totalTokens);

  updateStreakDisplay();
  updateTotalTokensDisplay();

  document.getElementById("reflectionText").value = "";
  document.getElementById("popup").style.display = "none";
});

// Hook up existing Shop button -> Shop scene
const shopBtnEl = document.getElementById("shopBtn");
if (shopBtnEl) {
  shopBtnEl.addEventListener("click", () => {
    window.location.href = "shop.html";
  });
}
