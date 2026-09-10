"use strict";

const $ = id => document.getElementById(id);

let currentUser = null;
let historyData = [];
let savedData = [];

const authScreen = $("authScreen");
const app = $("app");

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

function showApp(user) {
  currentUser = user;

  authScreen.classList.add("hidden");
  app.classList.remove("hidden");

  $("profileInitial").textContent = initial(user.username);
  $("accountInitial").textContent = initial(user.username);
  $("accountAvatar").textContent = initial(user.username);
  $("accountName").textContent = user.username;
  $("accountName2").textContent = user.username;
  $("settingsAccount").textContent = `Signed in as ${user.username}`;

  loadMe();
}

function showAuth() {
  app.classList.add("hidden");
  authScreen.classList.remove("hidden");
}

async function loadMe() {
  try {
    const res = await fetch("/api/me");

    if (!res.ok) {
      showAuth();
      return;
    }

    const data = await res.json();

    historyData = data.history || [];
    savedData = data.saved || [];

    renderHistory();
    renderSaved();
  } catch {
    showAuth();
  }
}

$("showRegister").onclick = () => {
  $("loginBox").classList.add("hidden");
  $("registerBox").classList.remove("hidden");
};

$("showLogin").onclick = () => {
  $("registerBox").classList.add("hidden");
  $("loginBox").classList.remove("hidden");
};

$("loginBtn").onclick = async () => {
  const username = $("loginUsername").value.trim();
  const password = $("loginPassword").value;

  $("loginError").textContent = "";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      $("loginError").textContent = data.error;
      return;
    }

    showApp(data.user);
  } catch {
    $("loginError").textContent = "Connection error.";
  }
};

function passwordStrength(password) {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (!password) return ["NONE", 0];
  if (score <= 1) return ["WEAK", 20];
  if (score === 2) return ["MEDIUM", 45];
  if (score === 3) return ["STRONG", 70];
  return ["VERY STRONG", 100];
}

$("registerPassword").addEventListener("input", e => {
  const [text, width] = passwordStrength(e.target.value);

  $("strengthText").textContent = text;
  $("strengthBar").style.width = `${width}%`;
});

$("registerBtn").onclick = async () => {
  const username = $("registerUsername").value.trim();
  const password = $("registerPassword").value;
  const confirm = $("confirmPassword").value;

  $("registerError").textContent = "";

  if (password !== confirm) {
    $("registerError").textContent = "Passwords do not match.";
    return;
  }

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      $("registerError").textContent = data.error;
      return;
    }

    showApp(data.user);
  } catch {
    $("registerError").textContent = "Connection error.";
  }
};

async function logout() {
  await fetch("/api/logout", { method: "POST" });

  currentUser = null;
  historyData = [];
  savedData = [];

  $("accountMenu").classList.add("hidden");

  $("loginUsername").value = "";
  $("loginPassword").value = "";

  showAuth();
}

$("accountLogout").onclick = logout;
$("settingsLogout").onclick = logout;

$("addAccount").onclick = () => {
  logout();
  $("showRegister").click();
};

$("profileBtn").onclick = e => {
  e.stopPropagation();
  $("accountMenu").classList.toggle("hidden");
};

document.addEventListener("click", e => {
  if (
    !$("accountMenu").contains(e.target) &&
    e.target !== $("profileBtn") &&
    !$("profileBtn").contains(e.target)
  ) {
    $("accountMenu").classList.add("hidden");
  }
});

async function saveHistory(query) {
  const res = await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });

  if (res.ok) await loadMe();
}

async function saveResult(result) {
  const res = await fetch("/api/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result)
  });

  if (res.ok) {
    await loadMe();
    alert("Saved to your NEXUS account.");
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
        <a href="${data.googleURL}"
           target="_blank"
           rel="noopener noreferrer">
          Open Google results →
        </a>
      </div>
    `;

    return;
  }

  results.innerHTML = `
    <div class="answer">
      <div class="answer-label">NEXUS RESULTS</div>
      <h3>Results for "${escapeHTML(data.query)}"</h3>
      <p>Information discovered through NEXUS search.</p>
    </div>

    ${data.results.map((r, i) => `
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
              WIKIPEDIA · RESULT ${i + 1}
            </div>
          </div>

          <button
            class="save-btn"
            data-save="${i}"
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

  document.querySelectorAll("[data-save]").forEach(button => {
    button.onclick = () => {
      saveResult(data.results[Number(button.dataset.save)]);
    };
  });
}

$("searchForm").onsubmit = async e => {
  e.preventDefault();

  const query = $("searchInput").value.trim();

  if (!query) return;

  $("spinner").classList.remove("hidden");
  $("searchText").classList.add("hidden");

  try {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(query)}`
    );

    const data = await res.json();

    if (!res.ok) {
      $("results").innerHTML = `
        <div class="answer">
          <h3>${escapeHTML(data.error || "Search failed.")}</h3>
        </div>
      `;
      return;
    }

    renderResults(data);
    await saveHistory(query);

  } catch {
    $("results").innerHTML = `
      <div class="answer">
        <h3>NEXUS could not connect.</h3>
      </div>
    `;
  } finally {
    $("spinner").classList.add("hidden");
    $("searchText").classList.remove("hidden");
  }
};

$("clearBtn").onclick = () => {
  $("searchInput").value = "";
  $("searchInput").focus();
  $("suggestions").innerHTML = "";
};

document.querySelectorAll(".suggestions-row button").forEach(btn => {
  btn.onclick = () => {
    $("searchInput").value = btn.dataset.query;
    $("searchForm").requestSubmit();
  };
});

$("searchInput").addEventListener("input", () => {
  const q = $("searchInput").value.trim().toLowerCase();

  if (!q) {
    $("suggestions").innerHTML = "";
    return;
  }

  const suggestions = [
    "Artificial Intelligence",
    "Space exploration",
    "Cybersecurity",
    "Quantum computing",
    "Machine learning",
    "Web development"
  ].filter(x => x.toLowerCase().includes(q));

  $("suggestions").innerHTML = suggestions.slice(0, 5)
    .map(x => `
      <button class="suggestion" data-suggest="${escapeHTML(x)}">
        ⌕ ${escapeHTML(x)}
      </button>
    `)
    .join("");

  document.querySelectorAll("[data-suggest]").forEach(btn => {
    btn.onclick = () => {
      $("searchInput").value = btn.dataset.suggest;
      $("suggestions").innerHTML = "";
      $("searchForm").requestSubmit();
    };
  });
});

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

  box.innerHTML = historyData.map(item => `
    <div class="list-item">
      <strong>◷ ${escapeHTML(item.query)}</strong>
      <button data-history="${escapeHTML(item.query)}">Search →</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-history]").forEach(btn => {
    btn.onclick = () => {
      $("searchInput").value = btn.dataset.history;
      switchView("search");
      $("searchForm").requestSubmit();
    };
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

  box.innerHTML = savedData.map(item => `
    <div class="list-item">
      <div>
        <strong>${escapeHTML(item.title)}</strong>
        <div class="result-source">SAVED RESULT</div>
      </div>

      <a
        href="${escapeHTML(item.url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open →
      </a>
    </div>
  `).join("");
}

$("clearHistoryBtn").onclick = async () => {
  await fetch("/api/history", { method: "DELETE" });
  await loadMe();
};

$("clearSavedBtn").onclick = async () => {
  await fetch("/api/saved", { method: "DELETE" });
  await loadMe();
};

function switchView(view) {
  document.querySelectorAll(".view").forEach(v => {
    v.classList.remove("active-view");
  });

  const target = $(`${view}View`);

  if (target) target.classList.add("active-view");

  document.querySelectorAll(".nav").forEach(n => {
    n.classList.toggle(
      "active",
      n.dataset.view === view
    );
  });

  $("sidebar").classList.remove("open");
  $("overlay").classList.remove("show");
}

document.querySelectorAll(".nav").forEach(nav => {
  nav.onclick = () => switchView(nav.dataset.view);
});

$("menuBtn").onclick = () => {
  $("sidebar").classList.add("open");
  $("overlay").classList.add("show");
};

$("overlay").onclick = () => {
  $("sidebar").classList.remove("open");
  $("overlay").classList.remove("show");
});

function toggleTheme() {
  document.body.classList.toggle("light");

  localStorage.setItem(
    "nexus_theme",
    document.body.classList.contains("light")
      ? "light"
      : "dark"
  );
}

if (localStorage.getItem("nexus_theme") === "light") {
  document.body.classList.add("light");
}

$("themeBtn").onclick = toggleTheme;
$("settingsTheme").onclick = toggleTheme;

document.addEventListener("keydown", e => {
  if (
    e.key === "/" &&
    document.activeElement.tagName !== "INPUT"
  ) {
    e.preventDefault();
    $("searchInput").focus();
  }

  if (e.key === "Escape") {
    $("accountMenu").classList.add("hidden");
    $("suggestions").innerHTML = "";
  }
});

(async function boot() {
  try {
    const res = await fetch("/api/me");

    if (!res.ok) {
      showAuth();
      return;
    }

    const data = await res.json();

    historyData = data.history || [];
    savedData = data.saved || [];

    showApp(data.user);
  } catch {
    showAuth();
  }
})();
