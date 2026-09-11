"use strict";


/* =========================
   HELPERS
========================= */

const $ = id =>
  document.getElementById(id);

let currentUser = null;
let currentTab = "web";


function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


async function api(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      {
        credentials:
          "same-origin",

        cache:
          "no-store",

        ...options,

        headers: {
          ...(options.body
            ? {
                "Content-Type":
                  "application/json"
              }
            : {}),

          ...(options.headers || {})
        }
      }
    );

  let data = {};

  try {
    data =
      await response.json();
  } catch {}

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Something went wrong."
    );
  }

  return data;
}


/* =========================
   AUTH SWITCHING
========================= */

function showLogin() {

  $("loginBox")
    .classList.remove(
      "hidden"
    );

  $("registerBox")
    .classList.add(
      "hidden"
    );

  $("loginError")
    .textContent = "";
}


function showRegister() {

  $("loginBox")
    .classList.add(
      "hidden"
    );

  $("registerBox")
    .classList.remove(
      "hidden"
    );

  $("registerError")
    .textContent = "";
}


/* =========================
   PASSWORD STRENGTH
========================= */

function passwordStrength(
  password
) {

  let score = 0;

  if (
    password.length >= 8
  )
    score++;

  if (
    password.length >= 12
  )
    score++;

  if (
    /[A-Z]/.test(password)
  )
    score++;

  if (
    /[0-9]/.test(password)
  )
    score++;

  if (
    /[^A-Za-z0-9]/.test(password)
  )
    score++;

  let width = "0%";
  let text =
    "Password strength";

  if (score === 1) {
    width = "20%";
    text = "Weak";
  }

  if (score === 2) {
    width = "40%";
    text = "Fair";
  }

  if (score === 3) {
    width = "60%";
    text = "Medium";
  }

  if (score === 4) {
    width = "80%";
    text = "Strong";
  }

  if (score >= 5) {
    width = "100%";
    text = "Very strong";
  }

  $("strengthBar")
    .style.width = width;

  $("strengthText")
    .textContent = text;
}


/* =========================
   AUTH
========================= */

$("showRegister")
  .addEventListener(
    "click",
    showRegister
  );


$("showLogin")
  .addEventListener(
    "click",
    showLogin
  );


$("registerPassword")
  .addEventListener(
    "input",
    e => {
      passwordStrength(
        e.target.value
      );
    }
  );


$("loginForm")
  .addEventListener(
    "submit",
    async e => {

      e.preventDefault();

      const username =
        $("loginUsername")
          .value
          .trim();

      const password =
        $("loginPassword")
          .value;

      $("loginError")
        .textContent = "";

      $("loginBtn")
        .disabled = true;

      $("loginBtn")
        .textContent =
        "Signing in...";

      try {

        const data =
          await api(
            "/api/login",
            {
              method: "POST",

              body:
                JSON.stringify({
                  username,
                  password
                })
            }
          );

        enterApp(
          data.user
        );

      } catch (error) {

        $("loginError")
          .textContent =
          error.message;

      } finally {

        $("loginBtn")
          .disabled = false;

        $("loginBtn")
          .textContent =
          "Sign in";
      }
    }
  );


$("registerForm")
  .addEventListener(
    "submit",
    async e => {

      e.preventDefault();

      const username =
        $("registerUsername")
          .value
          .trim();

      const password =
        $("registerPassword")
          .value;

      const confirm =
        $("confirmPassword")
          .value;

      $("registerError")
        .textContent = "";

      if (
        password !==
        confirm
      ) {

        $("registerError")
          .textContent =
          "Passwords do not match.";

        return;
      }

      if (
        password.length < 8
      ) {

        $("registerError")
          .textContent =
          "Password must be at least 8 characters.";

        return;
      }

      $("registerBtn")
        .disabled = true;

      $("registerBtn")
        .textContent =
        "Creating account...";

      try {

        const data =
          await api(
            "/api/register",
            {
              method: "POST",

              body:
                JSON.stringify({
                  username,
                  password
                })
            }
          );

        enterApp(
          data.user
        );

      } catch (error) {

        $("registerError")
          .textContent =
          error.message;

      } finally {

        $("registerBtn")
          .disabled = false;

        $("registerBtn")
          .textContent =
          "Create account";
      }
    }
  );


/* =========================
   ENTER APP
========================= */

function enterApp(
  user
) {

  currentUser =
    user;

  $("authScreen")
    .classList.add(
      "hidden"
    );

  $("app")
    .classList.remove(
      "hidden"
    );

  updateAccountUI();

  setupAdmin();

  switchView(
    "search"
  );
}


/* =========================
   ACCOUNT UI
========================= */

function updateAccountUI() {

  if (!currentUser)
    return;

  const username =
    currentUser.username;

  const initial =
    username
      .charAt(0)
      .toUpperCase();

  $("profileInitial")
    .textContent =
    initial;

  $("accountInitial")
    .textContent =
    initial;

  $("accountAvatar")
    .textContent =
    initial;

  $("accountName")
    .textContent =
    username;

  $("accountName2")
    .textContent =
    username;

  $("accountMenuName")
    .textContent =
    username;

  $("settingsAccount")
    .textContent =
    `Signed in as ${username}`;
}


/* =========================
   NAVIGATION
========================= */

function switchView(
  view
) {

  document
    .querySelectorAll(
      ".view"
    )
    .forEach(
      section => {
        section.classList.remove(
          "active-view"
        );
      }
    );

  const target =
    $(`${view}View`);

  if (target) {

    target.classList.add(
      "active-view"
    );
  }

  document
    .querySelectorAll(
      ".nav"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.view ===
            view
        );
      }
    );

  if (
    view === "history"
  ) {
    loadHistory();
  }

  if (
    view === "saved"
  ) {
    loadSaved();
  }

  if (
    view === "admin"
  ) {
    loadAdminStatus();
  }

  closeSidebar();
}


document
  .querySelectorAll(
    ".nav"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {
          switchView(
            button.dataset.view
          );
        }
      );

    }
  );


/* =========================
   MOBILE MENU
========================= */

$("menuBtn")
  .addEventListener(
    "click",
    () => {

      $("sidebar")
        .classList.add(
          "open"
        );

      $("overlay")
        .classList.add(
          "show"
        );
    }
  );


$("overlay")
  .addEventListener(
    "click",
    closeSidebar
  );


function closeSidebar() {

  $("sidebar")
    .classList.remove(
      "open"
    );

  $("overlay")
    .classList.remove(
      "show"
    );
}


/* =========================
   ACCOUNT MENU
========================= */

$("profileBtn")
  .addEventListener(
    "click",
    e => {

      e.stopPropagation();

      $("accountMenu")
        .classList.toggle(
          "hidden"
        );
    }
  );


document.addEventListener(
  "click",
  () => {

    $("accountMenu")
      .classList.add(
        "hidden"
      );
  }
);


$("accountMenu")
  .addEventListener(
    "click",
    e => {
      e.stopPropagation();
    }
  );


/* =========================
   LOGOUT
========================= */

async function logout() {

  try {

    await api(
      "/api/logout",
      {
        method: "POST"
      }
    );

  } catch {}

  currentUser =
    null;

  $("app")
    .classList.add(
      "hidden"
    );

  $("authScreen")
    .classList.remove(
      "hidden"
    );

  $("loginUsername")
    .value = "";

  $("loginPassword")
    .value = "";

  showLogin();
}


$("accountLogout")
  .addEventListener(
    "click",
    logout
  );


$("settingsLogout")
  .addEventListener(
    "click",
    logout
  );


$("addAccount")
  .addEventListener(
    "click",
    logout
  );


/* =========================
   SEARCH TABS
========================= */

function activateTab(
  tab
) {

  if (!tab)
    return;

  currentTab =
    tab.dataset.tab;

  document
    .querySelectorAll(
      ".tab"
    )
    .forEach(
      item => {

        item.classList.toggle(
          "active",
          item.dataset.tab ===
            currentTab
        );
      }
    );

  const query =
    $("searchInput")
      .value
      .trim();

  if (
    currentTab ===
    "ai"
  ) {

    if (query) {
      renderAI(query);
    } else {
      renderAIWelcome();
    }

    return;
  }

  $("searchText")
    .textContent =
    currentTab ===
      "web"
      ? "Search the web"
      : `${currentTab
          .charAt(0)
          .toUpperCase()}${currentTab.slice(
          1
        )} search`;

  if (
    query &&
    currentTab !==
      "web"
  ) {
    openExternalSearch(
      query,
      currentTab
    );
  }
}


document.addEventListener(
  "click",
  e => {

    const tab =
      e.target.closest(
        ".tab"
      );

    if (!tab)
      return;

    e.preventDefault();

    activateTab(
      tab
    );
  },
  true
);


/* =========================
   SEARCH
========================= */

$("searchForm")
  .addEventListener(
    "submit",
    async e => {

      e.preventDefault();

      const query =
        $("searchInput")
          .value
          .trim();

      if (!query)
        return;

      if (
        currentTab ===
        "ai"
      ) {

        await renderAI(
          query
        );

        return;
      }

      if (
        currentTab !==
        "web"
      ) {

        openExternalSearch(
          query,
          currentTab
        );

        return;
      }

      await search(
        query
      );
    }
  );


$("searchInput")
  .addEventListener(
    "input",
    e => {

      const value =
        e.target.value
          .trim();

      $("clearBtn")
        .classList.toggle(
          "hidden",
          !value
        );

      showSuggestions(
        value
      );
    }
  );


$("clearBtn")
  .addEventListener(
    "click",
    () => {

      $("searchInput")
        .value = "";

      $("clearBtn")
        .classList.add(
          "hidden"
        );

      $("suggestions")
        .classList.add(
          "hidden"
        );

      if (
        currentTab ===
        "ai"
      ) {
        renderAIWelcome();
      }

      $("searchInput")
        .focus();
    }
  );


async function search(
  query
) {

  $("spinner")
    .classList.remove(
      "hidden"
    );

  $("results")
    .innerHTML = "";

  $("searchText")
    .textContent =
    `Searching for "${query}"...`;

  $("suggestions")
    .classList.add(
      "hidden"
    );

  try {

    const data =
      await api(
        `/api/search?q=${encodeURIComponent(
          query
        )}`
      );

    if (
      data.mode ===
      "result"
    ) {

      renderResult(
        data.result,
        query
      );

      $("searchText")
        .textContent =
        `Results for "${query}"`;

    } else {

      renderFallback(
        data
      );

      $("searchText")
        .textContent =
        `No direct result for "${query}"`;
    }

  } catch (error) {

    $("results")
      .innerHTML = `
        <div class="fallback-card">
          <h2>Something went wrong.</h2>
          <p>${escapeHTML(
            error.message
          )}</p>
        </div>
      `;

  } finally {

    $("spinner")
      .classList.add(
        "hidden"
      );
  }
}


/* =========================
   EXTERNAL SEARCH
========================= */

function openExternalSearch(
  query,
  type
) {

  const encoded =
    encodeURIComponent(
      query
    );

  let url =
    `https://www.google.com/search?q=${encoded}`;

  if (
    type === "news"
  ) {
    url =
      `https://www.google.com/search?tbm=nws&q=${encoded}`;
  }

  if (
    type === "images"
  ) {
    url =
      `https://www.google.com/search?tbm=isch&q=${encoded}`;
  }

  if (
    type === "videos"
  ) {
    url =
      `https://www.google.com/search?tbm=vid&q=${encoded}`;
  }

  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );
}


/* =========================
   RESULT
========================= */

function renderResult(
  result,
  query
) {

  const image =
    result.image
      ? `
        <img
          src="${escapeHTML(
            result.image
          )}"
          alt=""
          style="
            width:100%;
            max-height:260px;
            object-fit:cover;
            border-radius:14px;
            margin-bottom:16px;
          "
        >
      `
      : "";

  $("results")
    .innerHTML = `
      <article class="result-card">

        ${image}

        <div class="result-source">
          <span>◉</span>
          <span>${escapeHTML(
            result.source
          )}</span>
        </div>

        <h2>
          <a
            href="${escapeHTML(
              result.url
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${escapeHTML(
              result.title
            )}
          </a>
        </h2>

        <p>
          ${escapeHTML(
            result.description
          )}
        </p>

        <div class="result-actions">

          <a
            class="small-btn"
            href="${escapeHTML(
              result.url
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open source
          </a>

          <button
            class="small-btn"
            id="saveCurrent"
            type="button"
          >
            ☆ Save
          </button>

        </div>

      </article>
    `;


  $("saveCurrent")
    .addEventListener(
      "click",
      async () => {

        try {

          await api(
            "/api/saved",
            {
              method:
                "POST",

              body:
                JSON.stringify({
                  title:
                    result.title,

                  url:
                    result.url
                })
            }
          );

          $("saveCurrent")
            .textContent =
            "✓ Saved";

        } catch {

          $("saveCurrent")
            .textContent =
            "Couldn't save";
        }
      }
    );
}


/* =========================
   FALLBACK
========================= */

function renderFallback(
  data
) {

  $("results")
    .innerHTML = `
      <div class="fallback-card">

        <div class="eyebrow">
          WEB FALLBACK
        </div>

        <h2>
          NEXUS couldn't find a direct result.
        </h2>

        <p>
          You can continue your search on Google.
        </p>

        <a
          href="${escapeHTML(
            data.fallback
          )}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Search the web →
        </a>

      </div>
    `;
}


/* =========================
   AI
========================= */

function renderAIWelcome() {

  $("searchText")
    .textContent =
    "NEXUS AI";

  $("results")
    .innerHTML = `
      <div class="ai-card">

        <div class="ai-label">
          ✦ NEXUS AI
        </div>

        <h2>
          Ask NEXUS anything.
        </h2>

        <p>
          Search the web, explain a topic,
          brainstorm ideas, summarize text,
          or ask a question.
        </p>

        <div class="ai-status">
          <span>●</span>
          AI backend ready
        </div>

      </div>
    `;
}


async function renderAI(
  query
) {

  query =
    String(
      query || ""
    ).trim();

  if (!query) {
    renderAIWelcome();
    return;
  }

  $("searchText")
    .textContent =
    "NEXUS AI";

  $("results")
    .innerHTML = `
      <div class="ai-card">

        <div class="ai-label">
          ✦ NEXUS AI
        </div>

        <h2>
          Thinking...
        </h2>

        <p>
          NEXUS AI is generating your answer.
        </p>

      </div>
    `;

  try {

    const data =
      await api(
        "/api/ai",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              query
            })
        }
      );

    const answer =
      escapeHTML(
        data.answer ||
        "No answer returned."
      )
        .replace(
          /\n/g,
          "<br>"
        );

    $("results")
      .innerHTML = `
        <article class="ai-card">

          <div class="ai-label">
            ✦ NEXUS AI
          </div>

          <h2>
            ${escapeHTML(
              query
            )}
          </h2>

          <div
            class="ai-answer"
            style="
              line-height:1.75;
              margin-top:18px;
            "
          >
            ${answer}
          </div>

          <div
            class="ai-meta"
            style="
              margin-top:20px;
              opacity:.55;
              font-size:13px;
            "
          >
            Powered by NEXUS AI
          </div>

        </article>
      `;

  } catch (error) {

    $("results")
      .innerHTML = `
        <div class="fallback-card">

          <div class="eyebrow">
            NEXUS AI
          </div>

          <h2>
            AI couldn't respond.
          </h2>

          <p>
            ${escapeHTML(
              error.message
            )}
          </p>

        </div>
      `;
  }
}


/* =========================
   SUGGESTIONS
========================= */

function showSuggestions(
  value
) {

  if (!value) {

    $("suggestions")
      .classList.add(
        "hidden"
      );

    return;
  }

  const suggestions = [
    value,
    `${value} explained`,
    `${value} meaning`,
    `${value} news`
  ];

  $("suggestions")
    .innerHTML =
    suggestions
      .map(
        item => `
          <div
            class="suggestion"
            data-value="${escapeHTML(
              item
            )}"
          >
            ⌕ ${escapeHTML(
              item
            )}
          </div>
        `
      )
      .join("");


  $("suggestions")
    .classList.remove(
      "hidden"
    );


  document
    .querySelectorAll(
      ".suggestion"
    )
    .forEach(
      item => {

        item.addEventListener(
          "click",
          () => {

            const value =
              item.dataset
                .value;

            $("searchInput")
              .value =
              value;

            $("suggestions")
              .classList.add(
                "hidden"
              );

            if (
              currentTab ===
              "ai"
            ) {

              renderAI(
                value
              );

            } else if (
              currentTab ===
              "web"
            ) {

              search(
                value
              );

            } else {

              openExternalSearch(
                value,
                currentTab
              );
            }
          }
        );

      }
    );
}


/* =========================
   HISTORY
========================= */

async function loadHistory() {

  try {

    const data =
      await api(
        "/api/history"
      );

    const list =
      data.history ||
      [];

    if (!list.length) {

      $("historyList")
        .innerHTML = `
          <div class="empty">
            No searches yet.
          </div>
        `;

      return;
    }

    $("historyList")
      .innerHTML =
      list
        .map(
          item => `
            <div class="list-card">

              <div class="list-card-main">

                <strong>
                  ${escapeHTML(
                    item.query
                  )}
                </strong>

                <span>
                  ${escapeHTML(
                    item.title ||
                    item.url
                  )}
                </span>

              </div>

              <a
                class="small-btn"
                href="${escapeHTML(
                  item.url
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open
              </a>

            </div>
          `
        )
        .join("");

  } catch (error) {

    $("historyList")
      .innerHTML = `
        <div class="empty">
          ${escapeHTML(
            error.message
          )}
        </div>
      `;
  }
}


$("clearHistoryBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        await api(
          "/api/history",
          {
            method:
              "DELETE"
          }
        );

        loadHistory();

      } catch {}
    }
  );


/* =========================
   SAVED
========================= */

async function loadSaved() {

  try {

    const data =
      await api(
        "/api/saved"
      );

    const list =
      data.saved ||
      [];

    if (!list.length) {

      $("savedList")
        .innerHTML = `
          <div class="empty">
            No saved pages yet.
          </div>
        `;

      return;
    }

    $("savedList")
      .innerHTML =
      list
        .map(
          item => `
            <div class="list-card">

              <div class="list-card-main">

                <strong>
                  ${escapeHTML(
                    item.title
                  )}
                </strong>

                <span>
                  ${escapeHTML(
                    item.url
                  )}
                </span>

              </div>

              <div
                style="
                  display:flex;
                  gap:7px;
                "
              >

                <a
                  class="small-btn"
                  href="${escapeHTML(
                    item.url
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open
                </a>

                <button
                  class="small-btn delete-saved"
                  data-id="${escapeHTML(
                    item.id
                  )}"
                  type="button"
                >
                  ×
                </button>

              </div>

            </div>
          `
        )
        .join("");


    document
      .querySelectorAll(
        ".delete-saved"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              try {

                await api(
                  `/api/saved/${button.dataset.id}`,
                  {
                    method:
                      "DELETE"
                  }
                );

                loadSaved();

              } catch {}
            }
          );

        }
      );

  } catch (error) {

    $("savedList")
      .innerHTML = `
        <div class="empty">
          ${escapeHTML(
            error.message
          )}
        </div>
      `;
  }
}


$("clearSavedBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        await api(
          "/api/saved",
          {
            method:
              "DELETE"
          }
        );

        loadSaved();

      } catch {}
    }
  );


/* =========================
   THEME
========================= */

function loadTheme() {

  const theme =
    localStorage.getItem(
      "nexus-theme"
    );

  if (
    theme === "light"
  ) {

    document.body
      .classList.add(
        "light"
      );
  }
}


function toggleTheme() {

  document.body
    .classList.toggle(
      "light"
    );

  localStorage.setItem(
    "nexus-theme",
    document.body.classList.contains(
      "light"
    )
      ? "light"
      : "dark"
  );
}


$("themeBtn")
  .addEventListener(
    "click",
    toggleTheme
  );


loadTheme();


/* =========================
   ADMIN
========================= */

function setupAdmin() {

  const adminNav =
    $("adminNav");

  if (!adminNav)
    return;

  if (
    currentUser &&
    currentUser.isAdmin
  ) {

    adminNav
      .classList.remove(
        "hidden"
      );

  } else {

    adminNav
      .classList.add(
        "hidden"
      );
  }
}


async function loadAdminStatus() {

  if (
    !currentUser ||
    !currentUser.isAdmin
  ) {
    return;
  }

  try {

    const data =
      await api(
        "/api/admin/status"
      );

    $("maintenanceTitle")
      .value =
      data.title ||
      "";

    $("maintenanceMessage")
      .value =
      data.message ||
      "";

    $("adminUsers")
      .textContent =
      data.users;

    $("adminSessions")
      .textContent =
      data.sessions;

    updateAdminStatus(
      data.maintenance
    );

  } catch (error) {

    $("adminMessage")
      .textContent =
      error.message;
  }
}


function updateAdminStatus(
  locked
) {

  $("adminStatusBadge")
    .textContent =
    locked
      ? "● MAINTENANCE"
      : "● ONLINE";

  $("adminStatusText")
    .textContent =
    locked
      ? "NEXUS is currently locked."
      : "NEXUS is online.";
}


$("lockWebsite")
  .addEventListener(
    "click",
    async () => {

      try {

        const title =
          $("maintenanceTitle")
            .value
            .trim();

        const message =
          $("maintenanceMessage")
            .value
            .trim();

        await api(
          "/api/admin/lock",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                title,
                message
              })
          }
        );

        updateAdminStatus(
          true
        );

        $("adminMessage")
          .textContent =
          "✓ NEXUS is now locked.";

      } catch (error) {

        $("adminMessage")
          .textContent =
          error.message;
      }
    }
  );


$("unlockWebsite")
  .addEventListener(
    "click",
    async () => {

      try {

        await api(
          "/api/admin/unlock",
          {
            method:
              "POST"
          }
        );

        updateAdminStatus(
          false
        );

        $("adminMessage")
          .textContent =
          "✓ NEXUS is back online.";

      } catch (error) {

        $("adminMessage")
          .textContent =
          error.message;
      }
    }
  );


/* =========================
   STARTUP
========================= */

async function startup() {

  try {

    const data =
      await api(
        "/api/me"
      );

    enterApp(
      data.user
    );

  } catch {

    $("authScreen")
      .classList.remove(
        "hidden"
      );

    $("app")
      .classList.add(
        "hidden"
      );
  }
}


startup();
