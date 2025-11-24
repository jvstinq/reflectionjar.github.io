/****************************************************
 * SHOP INVENTORY + THEME HANDLING
 ****************************************************/

const RJ_INVENTORY_KEY = "rj_inventory";

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
   Apply theme on shop load
---------------------------------------- */
function loadActiveTheme() {
  const theme = localStorage.getItem("rj_active_theme") || "blue";

  if (typeof applyTheme === "function") {
    applyTheme(theme);
  }
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

      localStorage.setItem("rj_active_theme", theme);

      if (typeof applyTheme === "function") {
        applyTheme(theme);
      }

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
