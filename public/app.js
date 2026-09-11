/* =========================
   NEXUS APP
========================= */

const $ = id =>
  document.getElementById(id);

let currentUser = null;
let currentTab = "web";
let currentQuery = "";
let currentResults = [];
let currentView = "search";
let searchRequestId = 0;

/* =========================
   API
========================= */

async function api(
  url,
  options = {}
) {
  const response =
    await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: {
        "Content-Type":
          "application/json",
        ...(options.headers || {})
      }
    });

  let data = {};

  try {
    data =
      await response.json();
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

/* =========================
   HTML SAFETY
========================= */

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

/* =========================
   AUTH
========================= */

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

function enterApp(user) {
  currentUser = user;

  $("authScreen")?.classList.add(
    "hidden"
  );

  $("app")?.classList.remove(
    "hidden"
  );

  updateAccountUI();

  if (
    user?.isAdmin &&
    $("adminNav")
  ) {
    $("adminNav").classList.remove(
      "hidden"
    );
  }

  if (
    !user?.isAdmin &&
    $("adminNav")
  ) {
    $("adminNav").classList.add(
      "hidden"
    );
  }

  switchView("search");
}

function updateAccountUI() {
  if (!currentUser) {
    return;
  }

  const initial =
    currentUser.username
      .charAt(0)
      .toUpperCase();

  if ($("profileInitial")) {
    $("profileInitial").textContent =
      initial;
  }

  if ($("accountInitial")) {
    $("accountInitial").textContent =
      initial;
  }

  if ($("accountAvatar")) {
    $("accountAvatar").textContent =
      initial;
  }

  if ($("accountName")) {
    $("accountName").textContent =
      currentUser.username;
  }

  if ($("accountName2")) {
    $("accountName2").textContent =
      currentUser.username;
  }

  if ($("accountMenuName")) {
    $("accountMenuName").textContent =
      currentUser.username;
  }

  if ($("settingsAccount")) {
    $("settingsAccount").textContent =
      currentUser.username;
  }
}

/* =========================
   LOGIN
========================= */

$("loginForm")?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const username =
      $("loginUsername")?.value.trim();

    const password =
      $("loginPassword")?.value || "";

    const errorBox =
      $("loginError");

    if (errorBox) {
      errorBox.textContent = "";
    }

    if ($("loginBtn")) {
      $("loginBtn").disabled = true;
    }

    try {
      const data =
        await api(
          "/api/login",
          {
            method: "POST",
            body: JSON.stringify({
              username,
              password
            })
          }
        );

      enterApp(data.user);
    } catch (error) {
      if (errorBox) {
        errorBox.textContent =
          error.message;
      }
    } finally {
      if ($("loginBtn")) {
        $("loginBtn").disabled =
          false;
      }
    }
  }
);

/* =========================
   REGISTER
========================= */

$("registerForm")?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const username =
      $("registerUsername")?.value.trim();

    const password =
      $("registerPassword")?.value || "";

    const confirm =
      $("confirmPassword")?.value || "";

    const errorBox =
      $("registerError");

    if (errorBox) {
      errorBox.textContent = "";
    }

    if (
      password !== confirm
    ) {
      if (errorBox) {
        errorBox.textContent =
          "Passwords do not match.";
      }

      return;
    }

    if ($("registerBtn")) {
      $("registerBtn").disabled =
        true;
    }

    try {
      const data =
        await api(
          "/api/register",
          {
            method: "POST",
            body: JSON.stringify({
              username,
              password
            })
          }
        );

      enterApp(data.user);
    } catch (error) {
      if (errorBox) {
        errorBox.textContent =
          error.message;
      }
    } finally {
      if ($("registerBtn")) {
        $("registerBtn").disabled =
          false;
      }
    }
  }
);

/* =========================
   PASSWORD STRENGTH
========================= */

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

    if (/[^A-Za-z0-9]/.test(password)) {
      score++;
    }

    const labels = [
      "Too weak",
      "Weak",
      "Fair",
      "Good",
      "Strong",
      "Very strong",
      "Excellent"
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

/* =========================
   AUTH TOGGLES
========================= */

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

/* =========================
   VIEW SYSTEM
========================= */

function switchView(view) {
  currentView = view;

  const views = {
    search: "searchView",
    history: "historyView",
    saved: "savedView",
    settings: "settingsView",
    admin: "adminView"
  };

  Object.entries(views)
    .forEach(
      ([key, id]) => {
        const element =
          $(id);

        if (!element) {
          return;
        }

        element.classList.toggle(
          "hidden",
          key !== view
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

$("adminNav")?.addEventListener(
  "click",
  () => switchView("admin")
);

/* =========================
   SIDEBAR
========================= */

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

/* =========================
   ACCOUNT MENU
========================= */

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
    if (
      !$("accountMenu")?.contains(
        event.target
      ) &&
      event.target !==
        $("profileBtn")
    ) {
      closeAccountMenu();
    }
  }
);

/* =========================
   NAV BUTTONS
========================= */

$("historyList")?.addEventListener(
  "click",
  event => {
    const button =
      event.target.closest(
        "[data-history-query]"
      );

    if (!button) {
      return;
    }

    const query =
      button.dataset.historyQuery;

    if (!query) {
      return;
    }

    switchView("search");

    $("searchInput").value =
      query;

    performSearch(query);
  }
);

document.querySelectorAll(
  "[data-view]"
).forEach(
  element => {
    element.addEventListener(
      "click",
      () => {
        const view =
          element.dataset.view;

        if (view) {
          switchView(view);
        }
      }
    );
  }
);

/* =========================
   SEARCH TABS
========================= */

function activateTab(tabElement) {
  if (!tabElement) {
    return;
  }

  const tab =
    tabElement.dataset.tab;

  if (!tab) {
    return;
  }

  currentTab = tab;

  document
    .querySelectorAll(
      "#searchTabs .tab"
    )
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.tab ===
          currentTab
      );
    });

  const query =
    $("searchInput")?.value.trim();

  if (currentTab === "ai") {
    if (query) {
      renderAI(query);
    } else {
      renderAIWelcome();
    }

    return;
  }

  if (query) {
    performSearch(query);
  } else {
    renderSearchStart();
  }
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
    event.stopPropagation();

    activateTab(tab);
  },
  true
);

/* =========================
   SEARCH FORM
========================= */

$("searchForm")?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const query =
      $("searchInput")?.value.trim();

    if (!query) {
      return;
    }

    await performSearch(query);
  }
);

$("clearBtn")?.addEventListener(
  "click",
  () => {
    if ($("searchInput")) {
      $("searchInput").value = "";
      $("searchInput").focus();
    }

    if ($("suggestions")) {
      $("suggestions").innerHTML = "";
      $("suggestions").classList.add(
        "hidden"
      );
    }

    renderSearchStart();
  }
);

/* =========================
   SUGGESTIONS
========================= */

$("searchInput")?.addEventListener(
  "input",
  () => {
    const value =
      $("searchInput").value.trim();

    if ($("clearBtn")) {
      $("clearBtn").classList.toggle(
        "hidden",
        !value
      );
    }

    if (!value) {
      $("suggestions")?.classList.add(
        "hidden"
      );

      return;
    }

    showSuggestions(value);
  }
);

async function showSuggestions(
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
            ${escapeHTML(item)}
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

    const value =
      button.dataset.suggestion;

    if ($("searchInput")) {
      $("searchInput").value =
        value;
    }

    $("suggestions")?.classList.add(
      "hidden"
    );

    performSearch(value);
  }
);

/* =========================
   SEARCH ROUTER
========================= */

async function performSearch(
  query
) {
  query =
    String(query || "").trim();

  if (!query) {
    return;
  }

  currentQuery = query;

  if ($("searchInput")) {
    $("searchInput").value =
      query;
  }

  if ($("suggestions")) {
    $("suggestions").classList.add(
      "hidden"
    );
  }

  if ($("clearBtn")) {
    $("clearBtn").classList.remove(
      "hidden"
    );
  }

  const requestId =
    ++searchRequestId;

  setLoading(true);

  try {
    if (currentTab === "ai") {
      await renderAI(query);
      return;
    }

    let endpoint =
      "/api/search";

    if (currentTab === "news") {
      endpoint =
        "/api/news";
    }

    if (currentTab === "images") {
      endpoint =
        "/api/images";
    }

    if (currentTab === "videos") {
      endpoint =
        "/api/videos";
    }

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
      data.results || [];

    renderResults(
      currentResults,
      query
    );

    updateBrowserState(
      query,
      currentTab,
      currentResults
    );
  } catch (error) {
    if (
      error.status === 401
    ) {
      await boot();
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
      setLoading(false);
    }
  }
}

/* =========================
   LOADING
========================= */

function setLoading(
  loading
) {
  $("spinner")?.classList.toggle(
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
    "web"
  ) {
    return currentQuery
      ? `Results for "${currentQuery}"`
      : "Search the web";
  }

  return currentQuery
    ? `${
        currentTab
          .charAt(0)
          .toUpperCase() +
        currentTab.slice(1)
      } results for "${currentQuery}"`
    : `${
        currentTab
          .charAt(0)
          .toUpperCase() +
        currentTab.slice(1)
      } search`;
}

/* =========================
   SEARCH START
========================= */

function renderSearchStart() {
  currentQuery = "";

  if ($("searchText")) {
    $("searchText").textContent =
      getSearchLabel();
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

/* =========================
   RESULT RENDERER
========================= */

function renderResults(
  results,
  query
) {
  currentQuery = query;

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
          for "${escapeHTML(query)}".
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

/* =========================
   WEB RESULTS
========================= */

function renderWeb(
  results
) {
  $("results").innerHTML =
    `
      <div class="results-list">
        ${results
          .map(result => {
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
                >
                  ${escapeHTML(
                    result.title
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
                  >
                    Open source
                  </a>

                  <button
                    type="button"
                    class="save-result"
                    data-save-title="${escapeHTML(
                      result.title
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
          })
          .join("")}
      </div>
    `;
}

/* =========================
   NEWS
========================= */

function renderNews(
  results
) {
  $("results").innerHTML =
    `
      <div class="results-list">
        ${results
          .map(result => {
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
                >
                  ${escapeHTML(
                    result.title
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
                  >
                    Read article
                  </a>

                  <button
                    type="button"
                    class="save-result"
                    data-save-title="${escapeHTML(
                      result.title
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
          })
          .join("")}
      </div>
    `;
}

/* =========================
   IMAGES
========================= */

function renderImages(
  results
) {
  $("results").innerHTML =
    `
      <div class="image-grid">
        ${results
          .map(result => {
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
                >
                  <img
                    src="${escapeHTML(
                      image
                    )}"
                    alt="${escapeHTML(
                      result.title
                    )}"
                    loading="lazy"
                  >
                </a>

                <div class="image-card-info">
                  <div class="image-card-title">
                    ${escapeHTML(
                      result.title
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
                        result.title
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
          })
          .join("")}
      </div>
    `;
}

/* =========================
   VIDEOS
========================= */

function renderVideos(
  results
) {
  $("results").innerHTML =
    `
      <div class="video-grid">
        ${results
          .map(result => {
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
                      type="${escapeHTML(
                        result.mime ||
                          ""
                      )}"
                    >
                    Your browser cannot play
                    this video.
                  </video>
                </div>

                <div class="video-info">
                  <h3>
                    ${escapeHTML(
                      result.title
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
                        result.title
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
          })
          .join("")}
      </div>

      <div class="video-note">
        NEXUS plays videos when the source
        provides a directly playable media file.
        Some websites don't allow embedded playback.
      </div>
    `;
}

/* =========================
   AI
========================= */

async function renderAI(
  query
) {
  currentQuery =
    String(query || "").trim();

  if (!currentQuery) {
    renderAIWelcome();
    return;
  }

  if ($("searchText")) {
    $("searchText").textContent =
      "NEXUS AI";
  }

  if ($("results")) {
    $("results").innerHTML = `
      <div class="ai-loading">
        <div class="ai-loading-icon">✦</div>
        <h2>Thinking...</h2>
        <p>NEXUS AI is generating a response.</p>
      </div>
    `;
  }

  try {
    const data =
      await api(
        "/api/ai",
        {
          method: "POST",
          body: JSON.stringify({
            query:
              currentQuery
          })
        }
      );

    const answer =
      data.answer ||
      "I couldn't generate an answer.";

    if ($("results")) {
      $("results").innerHTML = `
        <article class="ai-result">
          <div class="ai-result-header">
            <span class="ai-badge">✦ NEXUS AI</span>
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
    }

    updateBrowserState(
      currentQuery,
      "ai",
      []
    );
  } catch (error) {
    renderError(
      error.message
    );
  }
}

function formatAIAnswer(
  text
) {
  let html =
    escapeHTML(text);

  html =
    html.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    );

  html =
    html.replace(
      /^### (.*)$/gm,
      "<h3>$1</h3>"
    );

  html =
    html.replace(
      /^## (.*)$/gm,
      "<h2>$1</h2>"
    );

  html =
    html.replace(
      /^# (.*)$/gm,
      "<h2>$1</h2>"
    );

  html =
    html.replace(
      /^[-•] (.*)$/gm,
      "<li>$1</li>"
    );

  html =
    html.replace(
      /(<li>.*<\/li>)/gs,
      "<ul>$1</ul>"
    );

  html =
    html.replace(
      /\n\n/g,
      "</p><p>"
    );

  html =
    html.replace(
      /\n/g,
      "<br>"
    );

  return `<p>${html}</p>`;
}

/* =========================
   ERROR
========================= */

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
            "NEXUS couldn't complete the search."
        )}
      </p>

      <button
        type="button"
        id="retrySearch"
      >
        Try again
      </button>
    </div>
  `;

  $("retrySearch")?.addEventListener(
    "click",
    () => {
      if (currentQuery) {
        performSearch(
          currentQuery
        );
      }
    }
  );
}

/* =========================
   SAVE RESULTS
========================= */

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
      button.dataset.saveTitle;

    const url =
      safeURL(
        button.dataset.saveUrl
      );

    if (!title || !url) {
      return;
    }

    const original =
      button.textContent;

    button.disabled = true;
    button.textContent =
      "Saving...";

    try {
      const data =
        await api(
          "/api/saved",
          {
            method: "POST",
            body: JSON.stringify({
              title,
              url
            })
          }
        );

      button.textContent =
        data.alreadySaved
          ? "Already saved"
          : "Saved ✓";

      setTimeout(
        () => {
          button.textContent =
            original;
          button.disabled =
            false;
        },
        1500
      );
    } catch (error) {
      button.textContent =
        "Failed";

      setTimeout(
        () => {
          button.textContent =
            original;
          button.disabled =
            false;
        },
        1500
      );
    }
  }
);

/* =========================
   HISTORY
========================= */

async function loadHistory() {
  if (!$("historyList")) {
    return;
  }

  $("historyList").innerHTML = `
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
      data.history || [];

    if (!history.length) {
      $("historyList").innerHTML = `
        <div class="empty-state">
          <h2>No search history</h2>
          <p>Your searches will appear here.</p>
        </div>
      `;

      return;
    }

    $("historyList").innerHTML =
      history
        .map(item => {
          const url =
            safeURL(
              item.url
            );

          return `
            <div
              class="history-item"
              data-history-query="${escapeHTML(
                item.query
              )}"
            >
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
                data-history-query="${escapeHTML(
                  item.query
                )}"
              >
                Search again
              </button>

              ${
                url
                  ? `
                    <a
                      href="${escapeHTML(
                        url
                      )}"
                    >
                      Open
                    </a>
                  `
                  : ""
              }
            </div>
          `;
        })
        .join("");
  } catch (error) {
    $("historyList").innerHTML = `
      <div class="empty-state">
        ${escapeHTML(
          error.message
        )}
      </div>
    `;
  }
}

$("clearHistoryBtn")?.addEventListener(
  "click",
  async () => {
    try {
      await api(
        "/api/history",
        {
          method: "DELETE"
        }
      );

      loadHistory();
    } catch (error) {
      console.error(error);
    }
  }
);

/* =========================
   SAVED
========================= */

async function loadSaved() {
  if (!$("savedList")) {
    return;
  }

  $("savedList").innerHTML = `
    <div class="loading-state">
      Loading saved items...
    </div>
  `;

  try {
    const data =
      await api(
        "/api/saved"
      );

    const saved =
      data.saved || [];

    if (!saved.length) {
      $("savedList").innerHTML = `
        <div class="empty-state">
          <h2>Nothing saved yet</h2>
          <p>
            Save useful results and
            they'll appear here.
          </p>
        </div>
      `;

      return;
    }

    $("savedList").innerHTML =
      saved
        .map(item => {
          const url =
            safeURL(
              item.url
            );

          if (!url) {
            return "";
          }

          return `
            <article class="saved-item">
              <a
                href="${escapeHTML(
                  url
                )}"
              >
                ${escapeHTML(
                  item.title
                )}
              </a>

              <button
                type="button"
                data-delete-saved="${escapeHTML(
                  item.id
                )}"
              >
                Remove
              </button>
            </article>
          `;
        })
        .join("");
  } catch (error) {
    $("savedList").innerHTML = `
      <div class="empty-state">
        ${escapeHTML(
          error.message
        )}
      </div>
    `;
  }
}

document.addEventListener(
  "click",
  async event => {
    const button =
      event.target.closest(
        "[data-delete-saved]"
      );

    if (!button) {
      return;
    }

    try {
      await api(
        `/api/saved/${encodeURIComponent(
          button.dataset.deleteSaved
        )}`,
        {
          method: "DELETE"
        }
      );

      loadSaved();
    } catch (error) {
      console.error(error);
    }
  }
);

$("clearSavedBtn")?.addEventListener(
  "click",
  async () => {
    try {
      await api(
        "/api/saved",
        {
          method: "DELETE"
        }
      );

      loadSaved();
    } catch (error) {
      console.error(error);
    }
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

  currentUser = null;

  $("app")?.classList.add(
    "hidden"
  );

  $("authScreen")?.classList.remove(
    "hidden"
  );

  showLogin();
}

$("accountLogout")?.addEventListener(
  "click",
  logout
);

$("settingsLogout")?.addEventListener(
  "click",
  logout
);

/* =========================
   THEME
========================= */

$("themeBtn")?.addEventListener(
  "click",
  () => {
    document.body.classList.toggle(
      "light"
    );

    const light =
      document.body.classList.contains(
        "light"
      );

    localStorage.setItem(
      "nexus-theme",
      light
        ? "light"
        : "dark"
    );
  }
);

(function restoreTheme() {
  const theme =
    localStorage.getItem(
      "nexus-theme"
    );

  if (theme === "light") {
    document.body.classList.add(
      "light"
    );
  }
})();

/* =========================
   ADMIN
========================= */

async function loadAdmin() {
  if (
    !currentUser?.isAdmin
  ) {
    return;
  }

  try {
    const data =
      await api(
        "/api/admin/status"
      );

    updateAdminUI(
      data
    );
  } catch (error) {
    if ($("adminMessage")) {
      $("adminMessage").textContent =
        error.message;
    }
  }
}

function updateAdminUI(
  data
) {
  const locked =
    Boolean(
      data.maintenance
    );

  if ($("adminStatusText")) {
    $("adminStatusText").textContent =
      locked
        ? "Website locked"
        : "Website online";
  }

  if ($("adminStatusBadge")) {
    $("adminStatusBadge").textContent =
      locked
        ? "LOCKED"
        : "ONLINE";
  }

  if ($("maintenanceTitle")) {
    $("maintenanceTitle").value =
      data.title || "";
  }

  if ($("maintenanceMessage")) {
    $("maintenanceMessage").value =
      data.message || "";
  }

  if ($("adminUsers")) {
    $("adminUsers").textContent =
      data.users ?? 0;
  }

  if ($("adminSessions")) {
    $("adminSessions").textContent =
      data.sessions ?? 0;
  }
}

$("lockWebsite")?.addEventListener(
  "click",
  async () => {
    try {
      const title =
        $("maintenanceTitle")
          ?.value.trim() ||
        "NEXUS is temporarily offline";

      const message =
        $("maintenanceMessage")
          ?.value.trim() ||
        "The website is currently undergoing maintenance.";

      await api(
        "/api/admin/lock",
        {
          method: "POST",
          body: JSON.stringify({
            title,
            message
          })
        }
      );

      if ($("adminMessage")) {
        $("adminMessage").textContent =
          "NEXUS has been locked.";
      }

      loadAdmin();
    } catch (error) {
      if ($("adminMessage")) {
        $("adminMessage").textContent =
          error.message;
      }
    }
  }
);

$("unlockWebsite")?.addEventListener(
  "click",
  async () => {
    try {
      await api(
        "/api/admin/unlock",
        {
          method: "POST"
        }
      );

      if ($("adminMessage")) {
        $("adminMessage").textContent =
          "NEXUS has been unlocked.";
      }

      loadAdmin();
    } catch (error) {
      if ($("adminMessage")) {
        $("adminMessage").textContent =
          error.message;
      }
    }
  }
);

/* =========================
   BROWSER HISTORY
========================= */

function updateBrowserState(
  query,
  tab,
  results
) {
  try {
    const state = {
      nexus: true,
      query,
      tab,
      results
    };

    const params =
      new URLSearchParams();

    params.set(
      "q",
      query
    );

    params.set(
      "tab",
      tab
    );

    window.history.pushState(
      state,
      "",
      `?${params.toString()}`
    );
  } catch {
    // Ignore browser history errors.
  }
}

window.addEventListener(
  "popstate",
  event => {
    const state =
      event.state;

    if (
      state?.nexus &&
      state.query
    ) {
      currentTab =
        state.tab ||
        "web";

      document
        .querySelectorAll(
          "#searchTabs .tab"
        )
        .forEach(button => {
          button.classList.toggle(
            "active",
            button.dataset.tab ===
              currentTab
          );
        });

      if ($("searchInput")) {
        $("searchInput").value =
          state.query;
      }

      currentQuery =
        state.query;

      if (
        currentTab ===
        "ai"
      ) {
        renderAI(
          state.query
        );
      } else {
        renderResults(
          state.results || [],
          state.query
        );
      }

      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const query =
      params.get("q");

    const tab =
      params.get("tab");

    if (tab) {
      currentTab =
        tab;

      document
        .querySelectorAll(
          "#searchTabs .tab"
        )
        .forEach(button => {
          button.classList.toggle(
            "active",
            button.dataset.tab ===
              currentTab
          );
        });
    }

    if (query) {
      if ($("searchInput")) {
        $("searchInput").value =
          query;
      }

      performSearch(
        query
      );
    } else {
      renderSearchStart();
    }
  }
);

/* =========================
   STARTUP
========================= */

async function boot() {
  try {
    const data =
      await api(
        "/api/me"
      );

    enterApp(
      data.user
    );

    const params =
      new URLSearchParams(
        window.location.search
      );

    const query =
      params.get("q");

    const tab =
      params.get("tab");

    if (tab) {
      currentTab =
        tab;

      document
        .querySelectorAll(
          "#searchTabs .tab"
        )
        .forEach(button => {
          button.classList.toggle(
            "active",
            button.dataset.tab ===
              currentTab
          );
        });
    }

    if (query) {
      if ($("searchInput")) {
        $("searchInput").value =
          query;
      }

      performSearch(
        query
      );
    }
  } catch {
    $("authScreen")?.classList.remove(
      "hidden"
    );

    $("app")?.classList.add(
      "hidden"
    );
  }
}

/* =========================
   INITIAL UI
========================= */

renderSearchStart();
boot();
