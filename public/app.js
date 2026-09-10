"use strict";

const $ = id => document.getElementById(id);

let currentUser = null;
let historyData = [];
let savedData = [];

/* =========================
   HELPERS
========================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initial(name) {
  return (name || "N").charAt(0).toUpperCase();
}

function showError(id, message) {
  const el = $(id);
  if (el) el.textContent = message || "";
}

/* =========================
   AUTH UI
========================= */

function showApp(user) {
  currentUser = user;

  $("authScreen").classList.add("hidden");
  $("app").classList.remove("hidden");

  const letter = initial(user.username);

  $("profileInitial").textContent = letter;
  $("accountInitial").textContent = letter;
  $("accountAvatar").textContent = letter;

  $("accountName").textContent = user.username;
  $("accountName2").textContent = user.username;
  $("settingsAccount").textContent =
    `Signed in as ${user.username}`;

  loadMe();
}

function showAuth() {
  currentUser = null;

  $("app").classList.add("hidden");
  $("authScreen").classList.remove("hidden");
}

/* =========================
   LOGIN
========================= */

async function login() {
  const username = $("loginUsername").value.trim();
  const password = $("loginPassword").value;

  showError("loginError", "");

  if (!username || !password) {
    showError(
      "loginError",
      "Enter your username and password."
    );
    return;
  }

  const button = $("loginBtn");

  button.disabled = true;
  button.textContent = "Signing in...";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        username,
        password
      })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Server returned an invalid response.");
    }

    if (!response.ok || !data.ok) {
      showError(
        "loginError",
        data.error || "Unable to sign in."
      );
      return;
    }

    showApp(data.user);

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    showError(
      "loginError",
      "NEXUS couldn't connect to the server."
    );

  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
}

/* =========================
   REGISTER
========================= */

function passwordStrength(password) {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (!password) {
    return ["NONE", 0];
  }

  if (score <= 2) {
    return ["WEAK", 25];
  }

  if (score === 3) {
    return ["MEDIUM", 50];
  }

  if (score === 4) {
    return ["STRONG", 75];
  }

  return ["VERY STRONG", 100];
}

async function register() {
  const username = $("registerUsername").value.trim();
  const password = $("registerPassword").value;
  const confirm = $("confirmPassword").value;

  showError("registerError", "");

  if (!username || !password || !confirm) {
    showError(
      "registerError",
      "Fill in all fields."
    );
    return;
  }

  if (password !== confirm) {
    showError(
      "registerError",
      "Passwords do not match."
    );
    return;
  }

  if (password.length < 8) {
    showError(
      "registerError",
      "Password must be at least 8 characters."
    );
    return;
  }

  const button = $("registerBtn");

  button.disabled = true;
  button.textContent = "Creating account...";

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        username,
        password
      })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid server response.");
    }

    if (!response.ok || !data.ok) {
      showError(
        "registerError",
        data.error || "Unable to create account."
      );
      return;
    }

    showApp(data.user);

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    showError(
      "registerError",
      "NEXUS couldn't connect to the server."
    );

  } finally {
    button.disabled = false;
    button.textContent = "Create account";
  }
}

/* =========================
   LOAD ACCOUNT
========================= */

async function loadMe() {
  try {
    const response = await fetch("/api/me", {
      credentials: "same-origin"
    });

    if (!response.ok) {
      showAuth();
      return;
    }

    const data = await response.json();

    currentUser = data.user;
    historyData = data.history || [];
    savedData = data.saved || [];

    renderHistory();
    renderSaved();

  } catch (error) {
    console.error("ME ERROR:", error);
  }
}

/* =========================
   LOGOUT
========================= */

async function logout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "same-origin"
    });
  } catch {}

  currentUser = null;
  historyData = [];
  savedData = [];

  $("accountMenu").classList.add("hidden");

  $("loginUsername").value = "";
  $("loginPassword").value = "";

  showAuth();
}

/* =========================
   PASSWORD STRENGTH
========================= */

$("registerPassword").addEventListener(
  "input",
  event => {
    const [text, width] =
      passwordStrength(event.target.value);

    $("strengthText").textContent = text;
    $("strengthBar").style.width = `${width}%`;
  }
);

/* =========================
   AUTH BUTTONS
========================= */

$("loginBtn").addEventListener(
  "click",
  event => {
    event.preventDefault();
    login();
  }
);

$("registerBtn").addEventListener(
  "click",
  event => {
    event.preventDefault();
    register();
  }
);

$("showRegister").addEventListener(
  "click",
  event => {
    event.preventDefault();

    $("loginBox").classList.add("hidden");
    $("registerBox").classList.remove("hidden");

    showError("loginError", "");
  }
);

$("showLogin").addEventListener(
  "click",
  event => {
    event.preventDefault();

    $("registerBox").classList.add("hidden");
    $("loginBox").classList.remove("hidden");

    showError("registerError", "");
  }
);

/* Enter key login */

$("loginPassword").addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      event.preventDefault();
      login();
    }
  }
);

$("loginUsername").addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      event.preventDefault();
      login();
    }
  }
);

/* =========================
   ACCOUNT MENU
========================= */

$("profileBtn").addEventListener(
  "click",
  event => {
    event.stopPropagation();

    $("accountMenu").classList.toggle(
      "hidden"
    );
  }
);

document.addEventListener(
  "click",
  event => {
    const menu = $("accountMenu");
    const button = $("profileBtn");

    if (
      !menu.contains(event.target) &&
      !button.contains(event.target)
    ) {
      menu.classList.add("hidden");
    }
  }
);

$("accountLogout").addEventListener(
  "click",
  logout
);

$("settingsLogout").addEventListener(
  "click",
  logout
);

$("addAccount").addEventListener(
  "click",
  () => {
    logout();

    $("registerBox").classList.remove("hidden");
    $("loginBox").classList.add("hidden");
  }
);

/* =========================
   SEARCH
========================= */

async function saveHistory(query) {
  try {
    await fetch("/api/history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({ query })
    });
  } catch {}
}

async function saveResult(result) {
  try {
    const response = await fetch("/api/saved", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(result)
    });

    if (response.ok) {
      await loadMe();
      alert("Saved to your NEXUS account.");
    }

  } catch {
    alert("Couldn't save this result.");
  }
}

function renderResults(data) {
  const results = $("results");

  if (!data.found) {
    results.innerHTML = `
      <div class="answer">
        <div class="answer-label">NO DIRECT RESULT</div>
        <h3>No Wikipedia results found.</h3>
        <p>Try the wider web search below.</p>
      </div>

      <div class="fallback">
        Search the web for
        <strong>${escapeHTML(data.query)}</strong>
        <br><br>

        <a
          href="${data.googleURL}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Google results →
        </a>
      </div>
    `;

    return;
  }

  results.innerHTML = `
    <div class="answer">
      <div class="answer-label">
        NEXUS RESULTS
      </div>

      <h3>
        Results for "${escapeHTML(data.query)}"
      </h3>

      <p>
        Information discovered through NEXUS search.
      </p>
    </div>

    ${data.results.map((r, index) => `
      <article class="result-card">

        <div class="result-top">

          <div>
            <a
              class="result-title"
              href="${r.url}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${escapeHTML(r.title)}
            </a>

            <div class="result-source">
              WIKIPEDIA · RESULT ${index + 1}
            </div>
          </div>

          <button
            class="save-btn"
            data-save="${index}"
            type="button"
          >
            ☆ Save
          </button>

        </div>

        <div class="result-description">
          ${escapeHTML(r.description)}
        </div>

        <p class="result-excerpt">
          ${escapeHTML(r.excerpt)}
        </p>

        <a
          href="${r.url}"
          target="_blank"
          rel="noopener noreferrer"
          class="result-title"
        >
          Read more →
        </a>

      </article>
    `).join("")}

    <div class="fallback">
      Want more results?

      <a
        href="${data.googleURL}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Search the wider web →
      </a>
    </div>
  `;

  document
    .querySelectorAll("[data-save]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          const index =
            Number(button.dataset.save);

          saveResult(data.results[index]);
        }
      );

    });
}

$("searchForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const query =
      $("searchInput").value.trim();

    if (!query) return;

    $("spinner").classList.remove("hidden");
    $("searchText").classList.add("hidden");

    try {

      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Search failed."
        );
      }

      renderResults(data);

      await saveHistory(query);
      await loadMe();

    } catch (error) {

      console.error(error);

      $("results").innerHTML = `
        <div class="answer">
          <h3>
            NEXUS couldn't complete the search.
          </h3>

          <p>
            ${escapeHTML(error.message)}
          </p>
        </div>
      `;

    } finally {

      $("spinner").classList.add("hidden");
      $("searchText").classList.remove("hidden");

    }
  }
);

/* =========================
   AUTOCOMPLETE
========================= */

$("searchInput").addEventListener(
  "input",
  () => {

    const query =
      $("searchInput").value
        .trim()
        .toLowerCase();

    if (!query) {
      $("suggestions").innerHTML = "";
      return;
    }

    const items = [
      "Artificial Intelligence",
      "Space exploration",
      "Cybersecurity",
      "Quantum computing",
      "Machine learning",
      "Web development"
    ];

    const matches = items.filter(item =>
      item.toLowerCase().includes(query)
    );

    $("suggestions").innerHTML =
      matches.slice(0, 5).map(item => `
        <button
          type="button"
          class="suggestion"
          data-suggest="${escapeHTML(item)}"
        >
          ⌕ ${escapeHTML(item)}
        </button>
      `).join("");

    document
      .querySelectorAll("[data-suggest]")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            $("searchInput").value =
              button.dataset.suggest;

            $("suggestions").innerHTML = "";

            $("searchForm").requestSubmit();
          }
        );

      });
  }
);

$("clearBtn").addEventListener(
  "click",
  () => {

    $("searchInput").value = "";
    $("suggestions").innerHTML = "";
    $("searchInput").focus();

  }
);

document
  .querySelectorAll(".suggestions-row button")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        $("searchInput").value =
          button.dataset.query;

        $("searchForm").requestSubmit();

      }
    );

  });

/* =========================
   HISTORY
========================= */

function renderHistory() {

  const box = $("historyList");

  if (!historyData.length) {
    box.innerHTML = `
      <div class="list-item">
        <span>No searches yet.</span>
      </div>
    `;
    return;
  }

  box.innerHTML = historyData.map(
    item => `
      <div class="list-item">

        <strong>
          ◷ ${escapeHTML(item.query)}
        </strong>

        <button
          type="button"
          data-history="${escapeHTML(item.query)}"
        >
          Search →
        </button>

      </div>
    `
  ).join("");

  document
    .querySelectorAll("[data-history]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          $("searchInput").value =
            button.dataset.history;

          switchView("search");

          $("searchForm").requestSubmit();

        }
      );

    });
}

function renderSaved() {

  const box = $("savedList");

  if (!savedData.length) {
    box.innerHTML = `
      <div class="list-item">
        <span>No saved results yet.</span>
      </div>
    `;
    return;
  }

  box.innerHTML = savedData.map(
    item => `
      <div class="list-item">

        <div>
          <strong>
            ${escapeHTML(item.title)}
          </strong>

          <div class="result-source">
            SAVED RESULT
          </div>
        </div>

        <a
          href="${escapeHTML(item.url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open →
        </a>

      </div>
    `
  ).join("");
}

$("clearHistoryBtn").addEventListener(
  "click",
  async () => {

    await fetch("/api/history", {
      method: "DELETE"
    });

    await loadMe();

  }
);

$("clearSavedBtn").addEventListener(
  "click",
  async () => {

    await fetch("/api/saved", {
      method: "DELETE"
    });

    await loadMe();

  }
);

/* =========================
   NAVIGATION
========================= */

function switchView(view) {

  document
    .querySelectorAll(".view")
    .forEach(element => {
      element.classList.remove(
        "active-view"
      );
    });

  const target =
    $(`${view}View`);

  if (target) {
    target.classList.add(
      "active-view"
    );
  }

  document
    .querySelectorAll(".nav")
    .forEach(nav => {

      nav.classList.toggle(
        "active",
        nav.dataset.view === view
      );

    });

  $("sidebar").classList.remove("open");
  $("overlay").classList.remove("show");
}

document
  .querySelectorAll(".nav")
  .forEach(nav => {

    nav.addEventListener(
      "click",
      () => switchView(nav.dataset.view)
    );

  });

$("menuBtn").addEventListener(
  "click",
  () => {

    $("sidebar").classList.add("open");
    $("overlay").classList.add("show");

  }
);

$("overlay").addEventListener(
  "click",
  () => {

    $("sidebar").classList.remove("open");
    $("overlay").classList.remove("show");

  }
);

/* =========================
   THEME
========================= */

function toggleTheme() {

  document.body.classList.toggle("light");

  localStorage.setItem(
    "nexus_theme",
    document.body.classList.contains("light")
      ? "light"
      : "dark"
  );
}

if (
  localStorage.getItem("nexus_theme")
  === "light"
) {
  document.body.classList.add("light");
}

$("themeBtn").addEventListener(
  "click",
  toggleTheme
);

$("settingsTheme").addEventListener(
  "click",
  toggleTheme
);

/* =========================
   KEYBOARD
========================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "/" &&
      document.activeElement.tagName !== "INPUT"
    ) {
      event.preventDefault();
      $("searchInput").focus();
    }

    if (event.key === "Escape") {
      $("accountMenu").classList.add("hidden");
      $("suggestions").innerHTML = "";
    }

  }
);

/* =========================
   START NEXUS
========================= */

(async function boot() {

  try {

    const response =
      await fetch("/api/me", {
        credentials: "same-origin"
      });

    if (!response.ok) {
      showAuth();
      return;
    }

    const data =
      await response.json();

    historyData = data.history || [];
    savedData = data.saved || [];

    showApp(data.user);

  } catch (error) {

    console.error(
      "NEXUS BOOT ERROR:",
      error
    );

    showAuth();

  }

})();
