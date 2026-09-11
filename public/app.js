/* =========================================================
   NEXUS APP — STABLE FRONTEND
   ========================================================= */

const $ = id => document.getElementById(id);

let currentUser = null;
let currentTab = "web";
let currentQuery = "";
let currentResults = [];
let currentView = "search";

let searchRequestId = 0;
let aiRequestId = 0;
let booting = false;

/* =========================================================
   API
   ========================================================= */

async function api(url, options = {}) {
  const config = {
    credentials: "same-origin",
    cache: "no-store",
    ...options
  };

  config.headers = {
    Accept: "application/json",
    ...(options.headers || {})
  };

  if (
    options.body &&
    typeof options.body === "string" &&
    !Object.keys(config.headers)
      .some(key => key.toLowerCase() === "content-type")
  ) {
    config.headers["Content-Type"] =
      "application/json";
  }

  let response;

  try {
    response = await fetch(
      url,
      config
    );
  } catch {
    const error =
      new Error(
        "Unable to connect to NEXUS."
      );

    error.network = true;
    throw error;
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error =
      new Error(
        data.error ||
        `Request failed (${response.status})`
      );

    error.status =
      response.status;

    throw error;
  }

  return data;
}

/* =========================================================
   HTML / URL SAFETY
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeURL(value) {
  try {
    const url =
      new URL(
        String(value)
      );

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

/* =========================================================
   AUTH UI
   ========================================================= */

function showLogin() {
  $("loginBox")?.classList.remove(
    "hidden"
  );

  $("registerBox")?.classList.add(
    "hidden"
  );
}

function showRegister() {
  $("loginBox")?.classList.add(
    "hidden"
  );

  $("registerBox")?.classList.remove(
    "hidden"
  );
}

function updateAccountUI() {
  if (!currentUser) {
    return;
  }

  const username =
    String(
      currentUser.username || "U"
    );

  const initial =
    username
      .charAt(0)
      .toUpperCase();

  [
    "profileInitial",
    "accountInitial",
    "accountAvatar"
  ].forEach(id => {
    if ($(id)) {
      $(id).textContent =
        initial;
    }
  });

  [
    "accountName",
    "accountName2",
    "accountMenuName",
    "settingsAccount"
  ].forEach(id => {
    if ($(id)) {
      $(id).textContent =
        username;
    }
  });
}

function enterApp(user) {
  currentUser =
    user || null;

  $("authScreen")?.classList.add(
    "hidden"
  );

  $("app")?.classList.remove(
    "hidden"
  );

  updateAccountUI();

  if (
    currentUser?.isAdmin
  ) {
    $("adminNav")?.classList.remove(
      "hidden"
    );
  } else {
    $("adminNav")?.classList.add(
      "hidden"
    );
  }
}

/* =========================================================
   LOGIN
   ========================================================= */

$("loginForm")?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const username =
      $("loginUsername")
        ?.value
        .trim() || "";

    const password =
      $("loginPassword")
        ?.value || "";

    const errorBox =
      $("loginError");

    if (errorBox) {
      errorBox.textContent =
        "";
    }

    if (!username) {
      if (errorBox) {
        errorBox.textContent =
          "Enter your username.";
      }
      return;
    }

    if (!password) {
      if (errorBox) {
        errorBox.textContent =
          "Enter your password.";
      }
      return;
    }

    const button =
      $("loginBtn");

    if (button) {
      button.disabled =
        true;
    }

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

      if ($("loginPassword")) {
        $("loginPassword").value =
          "";
      }

      await restoreURLState();
    } catch (error) {
      if (errorBox) {
        errorBox.textContent =
          error.message;
      }
    } finally {
      if (button) {
        button.disabled =
          false;
      }
    }
  }
);

/* =========================================================
   REGISTER
   ========================================================= */

$("registerForm")?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const username =
      $("registerUsername")
        ?.value
        .trim() || "";

    const password =
      $("registerPassword")
        ?.value || "";

    const confirm =
      $("confirmPassword")
        ?.value || "";

    const errorBox =
      $("registerError");

    if (errorBox) {
      errorBox.textContent =
        "";
    }

    if (password !== confirm) {
      if (errorBox) {
        errorBox.textContent =
          "Passwords do not match.";
      }

      return;
    }

    const button =
      $("registerBtn");

    if (button) {
      button.disabled =
        true;
    }

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

      if ($("registerPassword")) {
        $("registerPassword").value =
          "";
      }

      if ($("confirmPassword")) {
        $("confirmPassword").value =
          "";
      }
    } catch (error) {
      if (errorBox) {
        errorBox.textContent =
          error.message;
      }
    } finally {
      if (button) {
        button.disabled =
          false;
      }
    }
  }
);

/* =========================================================
   PASSWORD STRENGTH
   ========================================================= */

$("registerPassword")?.addEventListener(
  "input",
  event => {
    const password =
      event.target.value;

    let score = 0;

    if (password.length >= 8) {
      score++;
    }

    if (password.length >= 12) {
      score++;
    }

    if (/[A-Z]/.test(password)) {
      score++;
    }

    if (/[a-z]/.test(password)) {
      score++;
    }

    if (/[0-9]/.test(password)) {
      score++;
    }

    if (
      /[^A-Za-z0-9]/.test(
        password
      )
    ) {
      score++;
    }

    const labels = [
      "",
      "Too weak",
      "Weak",
      "Fair",
      "Good",
      "Strong",
      "Very strong"
    ];

    if ($("strengthText")) {
      $("strengthText").textContent =
        password
          ? labels[score]
          : "";
    }

    if ($("strengthBar")) {
      $("strengthBar").style.width =
        password
          ? `${Math.min(
              100,
              score * 16.66
            )}%`
          : "0%";
    }
  }
);

/* =========================================================
   AUTH TOGGLES
   ========================================================= */

$("showRegister")?.addEventListener(
  "click",
  event => {
    event.preventDefault();
    showRegister();
  }
);

$("showLogin")?.addEventListener(
  "click",
  event => {
    event.preventDefault();
    showLogin();
  }
);

/* =========================================================
   VIEW SYSTEM
   ========================================================= */

function switchView(view) {
  const allowed = [
    "search",
    "history",
    "saved",
    "settings",
    "admin"
  ];

  if (!allowed.includes(view)) {
    view = "search";
  }

  if (
    view === "admin" &&
    !currentUser?.isAdmin
  ) {
    view = "search";
  }

  currentView =
    view;

  const views = {
    search: "searchView",
    history: "historyView",
    saved: "savedView",
    settings: "settingsView",
    admin: "adminView"
  };

  Object.entries(
    views
  ).forEach(
    ([name, id]) => {
      const element =
        $(id);

      if (!element) {
        return;
      }

      element.classList.toggle(
        "hidden",
        name !== view
      );
    }
  );

  if (view === "history") {
    loadHistory();
  }

  if (view === "saved") {
    loadSaved();
  }

  if (view === "admin") {
    loadAdmin();
  }

  closeSidebar();
  closeAccountMenu();
}

/* =========================================================
   NAVIGATION
   ========================================================= */

$("adminNav")?.addEventListener(
  "click",
  () => {
    switchView("admin");
  }
);

document.addEventListener(
  "click",
  event => {
    const button =
      event.target.closest(
        "[data-view]"
      );

    if (!button) {
      return;
    }

    const view =
      button.dataset.view;

    if (!view) {
      return;
    }

    event.preventDefault();

    switchView(
      view
    );
  }
);

/* =========================================================
   SIDEBAR
   ========================================================= */

function openSidebar() {
  $("sidebar")?.classList.add(
    "open"
  );

  $("overlay")?.classList.add(
    "show"
  );
}

function closeSidebar() {
  $("sidebar")?.classList.remove(
    "open"
  );

  $("overlay")?.classList.remove(
    "show"
  );
}

$("menuBtn")?.addEventListener(
  "click",
  openSidebar
);

$("overlay")?.addEventListener(
  "click",
  closeSidebar
);

/* =========================================================
   ACCOUNT MENU
   ========================================================= */

function closeAccountMenu() {
  $("accountMenu")?.classList.remove(
    "show"
  );
}

$("profileBtn")?.addEventListener(
  "click",
  event => {
    event.stopPropagation();

    $("accountMenu")?.classList.toggle(
      "show"
    );
  }
);

document.addEventListener(
  "click",
  event => {
    const menu =
      $("accountMenu");

    const button =
      $("profileBtn");

    if (
      !menu ||
      !button
    ) {
      return;
    }

    if (
      !menu.contains(
        event.target
      ) &&
      !button.contains(
        event.target
      )
    ) {
      closeAccountMenu();
    }
  }
);

/* =========================================================
   SEARCH TABS
   ========================================================= */

function setActiveTab(
  tab
) {
  const validTabs = [
    "web",
    "news",
    "images",
    "videos",
    "ai"
  ];

  if (
    !validTabs.includes(
      tab
    )
  ) {
    tab = "web";
  }

  currentTab =
    tab;

  document
    .querySelectorAll(
      "#searchTabs .tab"
    )
    .forEach(
      button => {
        button.classList.toggle(
          "active",
          button.dataset.tab ===
            currentTab
        );
      }
    );
}

document.addEventListener(
  "click",
  event => {
    const tab =
      event.target.closest(
        "#searchTabs .tab"
      );

    if (!tab) {
      return;
    }

    event.preventDefault();

    const selected =
      tab.dataset.tab;

    setActiveTab(
      selected
    );

    const query =
      $("searchInput")
        ?.value
        .trim() || "";

    if (!query) {
      if (
        currentTab ===
        "ai"
      ) {
        renderAIWelcome();
      } else {
        renderSearchStart();
      }

      return;
    }

    performSearch(
      query
    );
  }
);

/* =========================================================
   SEARCH FORM
   ========================================================= */

$("searchForm")?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const query =
      $("searchInput")
        ?.value
        .trim() || "";

    if (!query) {
      return;
    }

    await performSearch(
      query
    );
  }
);

$("clearBtn")?.addEventListener(
  "click",
  () => {
    if ($("searchInput")) {
      $("searchInput").value =
        "";

      $("searchInput").focus();
    }

    $("suggestions")
      ?.classList.add(
        "hidden"
      );

    searchRequestId++;
    aiRequestId++;

    currentQuery =
      "";

    currentResults =
      [];

    renderSearchStart();

    replaceBrowserState(
      "/"
    );
  }
);

/* =========================================================
   SUGGESTIONS
   ========================================================= */

let suggestionTimer =
  null;

$("searchInput")?.addEventListener(
  "input",
  () => {
    const value =
      $("searchInput")
        .value
        .trim();

    $("clearBtn")
      ?.classList.toggle(
        "hidden",
        !value
      );

    if (!value) {
      $("suggestions")
        ?.classList.add(
          "hidden"
        );

      return;
    }

    clearTimeout(
      suggestionTimer
    );

    suggestionTimer =
      setTimeout(
        () => {
          showSuggestions(
            value
          );
        },
        100
      );
  }
);

function showSuggestions(
  query
) {
  const box =
    $("suggestions");

  if (!box) {
    return;
  }

  const suggestions = [
    query,
    `${query} news`,
    `${query} images`,
    `${query} videos`
  ];

  box.innerHTML =
    suggestions
      .map(
        item => `
          <button
            type="button"
            class="suggestion-item"
            data-suggestion="${escapeHTML(
              item
            )}"
          >
            ${escapeHTML(
              item
            )}
          </button>
        `
      )
      .join("");

  box.classList.remove(
    "hidden"
  );
}

document.addEventListener(
  "click",
  event => {
    const button =
      event.target.closest(
        "[data-suggestion]"
      );

    if (!button) {
      return;
    }

    event.preventDefault();

    const value =
      button.dataset
        .suggestion || "";

    if ($("searchInput")) {
      $("searchInput").value =
        value;
    }

    $("suggestions")
      ?.classList.add(
        "hidden"
      );

    performSearch(
      value
    );
  }
);

/* =========================================================
   SEARCH
   ========================================================= */

async function performSearch(
  query
) {
  query =
    String(
      query || ""
    ).trim();

  if (!query) {
    return;
  }

  currentQuery =
    query;

  if ($("searchInput")) {
    $("searchInput").value =
      query;
  }

  $("suggestions")
    ?.classList.add(
      "hidden"
    );

  $("clearBtn")
    ?.classList.remove(
      "hidden"
    );

  if (
    currentTab ===
    "ai"
  ) {
    await renderAI(
      query
    );

    return;
  }

  const requestId =
    ++searchRequestId;

  setLoading(
    true
  );

  let endpoint =
    "/api/search";

  if (
    currentTab ===
    "news"
  ) {
    endpoint =
      "/api/news";
  }

  if (
    currentTab ===
    "images"
  ) {
    endpoint =
      "/api/images";
  }

  if (
    currentTab ===
    "videos"
  ) {
    endpoint =
      "/api/videos";
  }

  try {
    const data =
      await api(
        `${endpoint}?q=${encodeURIComponent(
          query
        )}`
      );

    if (
      requestId !==
      searchRequestId
    ) {
      return;
    }

    currentResults =
      Array.isArray(
        data.results
      )
        ? data.results
        : [];

    renderResults(
      currentResults,
      query
    );

    replaceBrowserState(
      `?q=${encodeURIComponent(
        query
      )}&tab=${encodeURIComponent(
        currentTab
      )}`
    );
  } catch (error) {
    if (
      requestId !==
      searchRequestId
    ) {
      return;
    }

    if (
      error.status ===
      401
    ) {
      await handleSessionExpired();
      return;
    }

    renderError(
      error.message
    );
  } finally {
    if (
      requestId ===
      searchRequestId
    ) {
      setLoading(
        false
      );
    }
  }
}

/* =========================================================
   LOADING
   ========================================================= */

function setLoading(
  loading
) {
  $("spinner")
    ?.classList.toggle(
      "hidden",
      !loading
    );

  if ($("searchText")) {
    $("searchText").textContent =
      loading
        ? "Searching NEXUS..."
        : getSearchLabel();
  }
}

function getSearchLabel() {
  if (
    currentTab ===
    "ai"
  ) {
    return "NEXUS AI";
  }

  if (!currentQuery) {
    if (
      currentTab ===
      "web"
    ) {
      return "Search the web";
    }

    return `${
      currentTab
        .charAt(0)
        .toUpperCase() +
      currentTab.slice(1)
    } search`;
  }

  if (
    currentTab ===
    "web"
  ) {
    return `Results for "${currentQuery}"`;
  }

  return `${
    currentTab
      .charAt(0)
      .toUpperCase() +
    currentTab.slice(1)
  } results for "${currentQuery}"`;
}

/* =========================================================
   START STATES
   ========================================================= */

function renderSearchStart() {
  if ($("searchText")) {
    $("searchText").textContent =
      "Search the web";
  }

  if ($("results")) {
    $("results").innerHTML = `
      <div class="empty-state">
        <h2>Search with NEXUS</h2>
        <p>
          Search the web, discover news,
          browse images, watch supported
          videos, or ask NEXUS AI.
        </p>
      </div>
    `;
  }
}

function renderAIWelcome() {
  if ($("searchText")) {
    $("searchText").textContent =
      "NEXUS AI";
  }

  if ($("results")) {
    $("results").innerHTML = `
      <div class="empty-state ai-welcome">
        <h2>✦ NEXUS AI</h2>
        <p>
          Ask a question and NEXUS AI
          will answer directly inside
          the search experience.
        </p>
      </div>
    `;
  }
}

/* =========================================================
   RESULT RENDERING
   ========================================================= */

function renderResults(
  results,
  query
) {
  currentQuery =
    query;

  if ($("searchText")) {
    $("searchText").textContent =
      getSearchLabel();
  }

  if (!$("results")) {
    return;
  }

  if (!results.length) {
    $("results").innerHTML = `
      <div class="empty-state">
        <h2>No results found</h2>
        <p>
          NEXUS couldn't find anything
          for "${escapeHTML(
            query
          )}".
        </p>
      </div>
    `;

    return;
  }

  if (
    currentTab ===
    "images"
  ) {
    renderImages(
      results
    );

    return;
  }

  if (
    currentTab ===
    "videos"
  ) {
    renderVideos(
      results
    );

    return;
  }

  if (
    currentTab ===
    "news"
  ) {
    renderNews(
      results
    );

    return;
  }

  renderWeb(
    results
  );
}

/* =========================================================
   WEB
   ========================================================= */

function renderWeb(
  results
) {
  const html =
    results
      .map(
        result => {
          const url =
            safeURL(
              result.url
            );

          if (!url) {
            return "";
          }

          return `
            <article class="search-result">
              <div class="result-source">
                ${escapeHTML(
                  result.source ||
                    "Web"
                )}
              </div>

              <a
                class="result-title"
                href="${escapeHTML(
                  url
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                ${escapeHTML(
                  result.title ||
                    "Untitled result"
                )}
              </a>

              <p class="result-description">
                ${escapeHTML(
                  result.description ||
                    "No description available."
                )}
              </p>

              <div class="result-actions">
                <a
                  class="result-open"
                  href="${escapeHTML(
                    url
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open source
                </a>

                <button
                  type="button"
                  class="save-result"
                  data-save-title="${escapeHTML(
                    result.title ||
                      "Untitled result"
                  )}"
                  data-save-url="${escapeHTML(
                    url
                  )}"
                >
                  Save
                </button>
              </div>
            </article>
          `;
        }
      )
      .join("");

  $("results").innerHTML = `
    <div class="results-list">
      ${html}
    </div>
  `;
}

/* =========================================================
   NEWS
   ========================================================= */

function renderNews(
  results
) {
  $("results").innerHTML = `
    <div class="results-list">
      ${results
        .map(
          result => {
            const url =
              safeURL(
                result.url
              );

            if (!url) {
              return "";
            }

            const image =
              safeURL(
                result.image
              );

            return `
              <article class="search-result news-result">
                ${
                  image
                    ? `
                      <img
                        class="news-image"
                        src="${escapeHTML(
                          image
                        )}"
                        alt=""
                        loading="lazy"
                      >
                    `
                    : ""
                }

                <div class="result-source">
                  ${escapeHTML(
                    result.source ||
                      "News"
                  )}
                </div>

                <a
                  class="result-title"
                  href="${escapeHTML(
                    url
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ${escapeHTML(
                    result.title ||
                      "News article"
                  )}
                </a>

                <p class="result-description">
                  ${escapeHTML(
                    result.description ||
                      "News article"
                  )}
                </p>

                <div class="result-actions">
                  <a
                    class="result-open"
                    href="${escapeHTML(
                      url
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read article
                  </a>

                  <button
                    type="button"
                    class="save-result"
                    data-save-title="${escapeHTML(
                      result.title ||
                        "News article"
                    )}"
                    data-save-url="${escapeHTML(
                      url
                    )}"
                  >
                    Save
                  </button>
                </div>
              </article>
            `;
          }
        )
        .join("")}
    </div>
  `;
}

/* =========================================================
   IMAGES
   ========================================================= */

function renderImages(
  results
) {
  $("results").innerHTML = `
    <div class="image-grid">
      ${results
        .map(
          result => {
            const image =
              safeURL(
                result.url
              );

            const source =
              safeURL(
                result.source
              );

            if (!image) {
              return "";
            }

            return `
              <article class="image-card">
                <a
                  href="${escapeHTML(
                    source ||
                      image
                  )}"
                  class="image-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src="${escapeHTML(
                      image
                    )}"
                    alt="${escapeHTML(
                      result.title ||
                        "Image"
                    )}"
                    loading="lazy"
                  >
                </a>

                <div class="image-card-info">
                  <div class="image-card-title">
                    ${escapeHTML(
                      result.title ||
                        "Image"
                    )}
                  </div>

                  ${
                    result.artist
                      ? `
                        <div class="image-card-artist">
                          ${escapeHTML(
                            result.artist
                          )}
                        </div>
                      `
                      : ""
                  }

                  <div class="result-actions">
                    ${
                      source
                        ? `
                          <a
                            class="result-open"
                            href="${escapeHTML(
                              source
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Source
                          </a>
                        `
                        : ""
                    }

                    <button
                      type="button"
                      class="save-result"
                      data-save-title="${escapeHTML(
                        result.title ||
                          "Image"
                      )}"
                      data-save-url="${escapeHTML(
                        source ||
                          image
                      )}"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </article>
            `;
          }
        )
        .join("")}
    </div>
  `;
}

/* =========================================================
   VIDEOS
   ========================================================= */

function renderVideos(
  results
) {
  $("results").innerHTML = `
    <div class="video-grid">
      ${results
        .map(
          result => {
            const video =
              safeURL(
                result.url
              );

            const poster =
              safeURL(
                result.poster
              );

            const source =
              safeURL(
                result.source
              );

            if (!video) {
              return "";
            }

            return `
              <article class="video-card">
                <div class="video-player-wrap">
                  <video
                    class="nexus-video"
                    controls
                    playsinline
                    preload="metadata"
                    ${
                      poster
                        ? `poster="${escapeHTML(
                            poster
                          )}"`
                        : ""
                    }
                  >
                    <source
                      src="${escapeHTML(
                        video
                      )}"
                      ${
                        result.mime
                          ? `type="${escapeHTML(
                              result.mime
                            )}"`
                          : ""
                      }
                    >
                    Your browser cannot play
                    this video.
                  </video>
                </div>

                <div class="video-info">
                  <h3>
                    ${escapeHTML(
                      result.title ||
                        "Video"
                    )}
                  </h3>

                  <div class="result-actions">
                    ${
                      source
                        ? `
                          <a
                            class="result-open"
                            href="${escapeHTML(
                              source
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Source
                          </a>
                        `
                        : ""
                    }

                    <button
                      type="button"
                      class="save-result"
                      data-save-title="${escapeHTML(
                        result.title ||
                          "Video"
                      )}"
                      data-save-url="${escapeHTML(
                        source ||
                          video
                      )}"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </article>
            `;
          }
        )
        .join("")}
    </div>

    <div class="video-note">
      Some websites do not allow direct
      embedded playback. NEXUS can play
      supported direct media files.
    </div>
  `;
}

/* =========================================================
   AI
   ========================================================= */

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

  currentQuery =
    query;

  const requestId =
    ++aiRequestId;

  $("searchText").textContent =
    "NEXUS AI";

  $("results").innerHTML = `
    <div class="ai-loading">
      <div class="ai-loading-icon">✦</div>
      <h2>Thinking...</h2>
      <p>
        NEXUS AI is generating a response.
      </p>
    </div>
  `;

  try {
    const data =
      await api(
        "/api/ai",
        {
          method: "POST",
          body:
            JSON.stringify({
              query
            })
        }
      );

    if (
      requestId !==
      aiRequestId
    ) {
      return;
    }

    /*
      If the user switched tabs
      while AI was thinking, don't
      overwrite the new tab.
    */

    if (
      currentTab !==
      "ai"
    ) {
      return;
    }

    const answer =
      data.answer ||
      "I couldn't generate an answer.";

    $("results").innerHTML = `
      <article class="ai-result">
        <div class="ai-result-header">
          <span class="ai-badge">
            ✦ NEXUS AI
          </span>
        </div>

        <div class="ai-answer">
          ${formatAIAnswer(
            answer
          )}
        </div>

        ${
          data.model
            ? `
              <div class="ai-model">
                ${escapeHTML(
                  data.model
                )}
              </div>
            `
            : ""
        }
      </article>
    `;

    replaceBrowserState(
      `?q=${encodeURIComponent(
        query
      )}&tab=ai`
    );
  } catch (error) {
    if (
      requestId !==
      aiRequestId
    ) {
      return;
    }

    if (
      error.status ===
      401
    ) {
      await handleSessionExpired();
      return;
    }

    renderError(
      error.message
    );
  }
}

function formatAIAnswer(
  text
) {
  const escaped =
    escapeHTML(
      text
    );

  const lines =
    escaped.split("\n");

  let html =
    "";

  let inList =
    false;

  for (
    const rawLine of lines
  ) {
    const line =
      rawLine.trim();

    if (!line) {
      if (inList) {
        html +=
          "</ul>";

        inList =
          false;
      }

      html +=
        "<br>";

      continue;
    }

    const heading =
      line.match(
        /^#{1,3}\s+(.+)$/
      );

    if (heading) {
      if (inList) {
        html +=
          "</ul>";

        inList =
          false;
      }

      html += `
        <h3>
          ${heading[1]}
        </h3>
      `;

      continue;
    }

    const bullet =
      line.match(
        /^[-•*]\s+(.+)$/
      );

    if (bullet) {
      if (!inList) {
        html +=
          "<ul>";

        inList =
          true;
      }

      html += `
        <li>
          ${bullet[1]}
        </li>
      `;

      continue;
    }

    if (inList) {
      html +=
        "</ul>";

      inList =
        false;
    }

    html += `
      <p>
        ${line}
      </p>
    `;
  }

  if (inList) {
    html +=
      "</ul>";
  }

  html =
    html.replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );

  html =
    html.replace(
      /`([^`]+)`/g,
      "<code>$1</code>"
    );

  return html;
}

/* =========================================================
   ERROR
   ========================================================= */

function renderError(
  message
) {
  if (!$("results")) {
    return;
  }

  $("results").innerHTML = `
    <div class="empty-state error-state">
      <h2>Something went wrong</h2>

      <p>
        ${escapeHTML(
          message ||
            "NEXUS couldn't complete the request."
        )}
      </p>

      ${
        currentQuery
          ? `
            <button
              type="button"
              id="retrySearch"
            >
              Try again
            </button>
          `
          : ""
      }
    </div>
  `;
}

document.addEventListener(
  "click",
  event => {
    if (
      !event.target.closest(
        "#retrySearch"
      )
    ) {
      return;
    }

    if (currentQuery) {
      performSearch(
        currentQuery
      );
    }
  }
);

/* =========================================================
   SAVE
   ========================================================= */

document.addEventListener(
  "click",
  async event => {
    const button =
      event.target.closest(
        ".save-result"
      );

    if (!button) {
      return;
    }

    const title =
      button.dataset
        .saveTitle || "";

    const url =
      safeURL(
        button.dataset
          .saveUrl
      );

    if (
      !title ||
      !url
    ) {
      return;
    }

    if (
      button.dataset.busy ===
      "true"
    ) {
      return;
    }

    button.dataset.busy =
      "true";

    const original =
      button.textContent;

    button.disabled =
      true;

    button.textContent =
      "Saving...";

    try {
      const data =
        await api(
          "/api/saved",
          {
            method: "POST",
            body:
              JSON.stringify({
                title,
                url
              })
          }
        );

      button.textContent =
        data.alreadySaved
          ? "Already saved"
          : "Saved ✓";
    } catch (error) {
      button.textContent =
        error.status === 401
          ? "Sign in"
          : "Failed";
    }

    setTimeout(
      () => {
        button.textContent =
          original;

        button.disabled =
          false;

        delete button.dataset.busy;
      },
      1500
    );
  }
);

/* =========================================================
   HISTORY
   ========================================================= */

async function loadHistory() {
  const list =
    $("historyList");

  if (!list) {
    return;
  }

  list.innerHTML = `
    <div class="loading-state">
      Loading history...
    </div>
  `;

  try {
    const data =
      await api(
        "/api/history"
      );

    const history =
      Array.isArray(
        data.history
      )
        ? data.history
        : [];

    if (!history.length) {
      list.innerHTML = `
        <div class="empty-state">
          <h2>No search history</h2>
          <p>
            Your searches will appear here.
          </p>
        </div>
      `;

      return;
    }

    list.innerHTML =
      history
        .map(
          item => `
            <div class="history-item">
              <div>
                <strong>
                  ${escapeHTML(
                    item.title ||
                      item.query
                  )}
                </strong>

                <span>
                  ${escapeHTML(
                    item.query
                  )}
                </span>
              </div>

              <button
                type="button"
                data
