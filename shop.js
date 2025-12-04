/****************************************************
 * SHOP INVENTORY + THEME HANDLING
 ****************************************************/

const RJ_INVENTORY_KEY = "rj_inventory";

/* Make Blue theme owned by default */
(function ensureDefaultBlueTheme() {
  const inv = JSON.parse(localStorage.getItem(RJ_INVENTORY_KEY) || "[]");
  if (!inv.includes("theme-blue")) {
    inv.push("theme-blue");
    localStorage.setItem(RJ_INVENTORY_KEY, JSON.stringify(inv));
  }
})();

/* ------------------------------
   Helpers
------------------------------ */

function getInventory() {
  try {
    return JSON.parse(localStorage.getItem(RJ_INVENTORY_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function setInventory(inv) {
  localStorage.setItem(RJ_INVENTORY_KEY, JSON.stringify(inv));
}

function getTokens() {
  return parseInt(localStorage.getItem("totalTokens") || "0");
}

function setTokens(amount) {
  localStorage.setItem("totalTokens", amount);
}

function updateTokenDisplay() {
  const el = document.getElementById("tokenDisplay");
  if (el) el.textContent = `Tokens: ${getTokens()}`;
}

/* ----------------------------------------
   Theme application (copied from script.js)
---------------------------------------- */

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

/* ----------------------------------------
   Apply theme on shop load
---------------------------------------- */
function loadActiveTheme() {
  const theme = localStorage.getItem("rj_active_theme") || "blue";
  applyTheme(theme);
}

/* ----------------------------------------
   Initialize shop item UI based on inventory
---------------------------------------- */
function markOwnedItems() {
  const inventory = getInventory();

  document.querySelectorAll(".shop-item").forEach(card => {
    const name = card.dataset.name;
    const buyBtn = card.querySelector(".buy-btn");
    const equipBtn = card.querySelector(".equip-btn");

    if (inventory.includes(name)) {
      buyBtn.textContent = "OWNED";
      buyBtn.disabled = true;
      equipBtn.disabled = false;
    } else {
      buyBtn.textContent = "BUY";
      buyBtn.disabled = false;
      equipBtn.disabled = true;
    }
  });
}

/* ----------------------------------------
   Purchase + Equip Handlers
---------------------------------------- */

function attachButtonHandlers() {
  document.querySelectorAll(".shop-item").forEach(card => {
    const name = card.dataset.name;
    const theme = card.dataset.theme;
    const cost = parseInt(card.dataset.cost);

    const buyBtn = card.querySelector(".buy-btn");
    const equipBtn = card.querySelector(".equip-btn");

    /* --- BUY BUTTON --- */
    buyBtn.addEventListener("click", () => {
      const tokens = getTokens();
      const inv = getInventory();

      if (tokens < cost) {
        alert("Not enough tokens.");
        return;
      }

      // Charge token + add to inventory
      setTokens(tokens - cost);
      inv.push(name);
      setInventory(inv);

      updateTokenDisplay();

      // Update UI
      buyBtn.textContent = "OWNED";
      buyBtn.disabled = true;
      equipBtn.disabled = false;
    });

    /* --- EQUIP BUTTON --- */
    equipBtn.addEventListener("click", () => {
      if (equipBtn.disabled) return;
      if (!theme) return;

      // Save active theme for all pages
      localStorage.setItem("rj_active_theme", theme);

      // Immediately apply to the shop page
      applyTheme(theme);

      alert(`Theme set to ${theme}!`);
    });
  });
}

/* ----------------------------------------
   Back Button
---------------------------------------- */

const backBtn = document.getElementById("backBtn");
if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

/* ----------------------------------------
   Initialize Shop Page
---------------------------------------- */

loadActiveTheme();
updateTokenDisplay();
attachButtonHandlers();
markOwnedItems();
