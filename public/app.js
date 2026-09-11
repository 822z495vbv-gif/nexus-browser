import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import OpenAI from "openai";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const SESSION_COOKIE = "nexus_session";
const SESSION_DAYS = 30;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   DATABASE
========================================================= */

function defaultDB() {
  return {
    users: [],
    sessions: [],
    history: [],
    saved: [],
    settings: {
      maintenance: false,
      maintenanceTitle: "NEXUS is temporarily unavailable",
      maintenanceMessage:
        "The website is currently undergoing maintenance."
    }
  };
}

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(defaultDB(), null, 2)
    );
  }
}

function loadDB() {
  ensureDB();

  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);

    return {
      ...defaultDB(),
      ...parsed,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      settings: {
        ...defaultDB().settings,
        ...(parsed.settings || {})
      }
    };
  } catch {
    return defaultDB();
  }
}

let db = loadDB();

function saveDB() {
  ensureDB();

  const tempFile = DB_FILE + ".tmp";

  fs.writeFileSync(
    tempFile,
    JSON.stringify(db, null, 2),
    "utf8"
  );

  fs.renameSync(tempFile, DB_FILE);
}

/* =========================================================
   PASSWORDS
========================================================= */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    if (!stored || !stored.includes(":")) {
      return false;
    }

    const [salt, originalHash] = stored.split(":");

    const derivedHash = crypto
      .scryptSync(password, salt, 64)
      .toString("hex");

    const a = Buffer.from(originalHash, "hex");
    const b = Buffer.from(derivedHash, "hex");

    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/* =========================================================
   USERS
========================================================= */

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase();
}

function findUser(username) {
  const normalized = normalizeUsername(username);

  return db.users.find(
    user =>
      String(user.username || "").toLowerCase() === normalized
  );
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    isAdmin:
      String(user.username || "").toLowerCase() === "calsgc"
  };
}

/* =========================================================
   SESSIONS
========================================================= */

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function createSession(userId) {
  const token = crypto.randomBytes(48).toString("hex");

  const expiresAt =
    Date.now() +
    SESSION_DAYS * 24 * 60 * 60 * 1000;

  db.sessions.push({
    id: crypto.randomUUID(),
    userId,
    tokenHash: hashToken(token),
    createdAt: Date.now(),
    expiresAt
  });

  saveDB();

  return token;
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);

  const session = db.sessions.find(
    item => item.tokenHash === tokenHash
  );

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    db.sessions = db.sessions.filter(
      item => item.id !== session.id
    );

    saveDB();

    return null;
  }

  return session;
}

function getCurrentUser(req) {
  const session = getSession(req);

  if (!session) {
    return null;
  }

  return db.users.find(
    user => user.id === session.userId
  ) || null;
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      error: "You must be logged in."
    });
  }

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      error: "You must be logged in."
    });
  }

  if (
    String(user.username || "").toLowerCase() !==
    "calsgc"
  ) {
    return res.status(403).json({
      error: "Admin access required."
    });
  }

  req.user = user;
  next();
}

/* =========================================================
   COOKIES
========================================================= */

function parseCookies(header) {
  const result = {};

  header.split(";").forEach(part => {
    const index = part.indexOf("=");

    if (index === -1) return;

    const key = part
      .slice(0, index)
      .trim();

    const value = part
      .slice(index + 1)
      .trim();

    result[key] = decodeURIComponent(value);
  });

  return result;
}

function setSessionCookie(res, token) {
  const secure =
    process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(
      token
    )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
      SESSION_DAYS * 24 * 60 * 60
    }${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

/* =========================================================
   MAINTENANCE
========================================================= */

function maintenanceAllows(req) {
  const allowed = [
    "/api/login",
    "/api/register",
    "/api/me",
    "/api/logout",
    "/api/maintenance",
    "/api/admin/status",
    "/api/admin/reset-password",
    "/api/health"
  ];

  return allowed.includes(req.path);
}

app.use((req, res, next) => {
  if (!db.settings.maintenance) {
    return next();
  }

  if (maintenanceAllows(req)) {
    return next();
  }

  const user = getCurrentUser(req);

  if (
    user &&
    String(user.username || "").toLowerCase() === "calsgc"
  ) {
    return next();
  }

  if (req.path.startsWith("/api/")) {
    return res.status(503).json({
      error:
        db.settings.maintenanceMessage ||
        "NEXUS is currently under maintenance."
    });
  }

  return res
    .status(503)
    .sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================================================
   AUTH
========================================================= */

app.post("/api/register", (req, res) => {
  const username = String(
    req.body?.username || ""
  ).trim();

  const password = String(
    req.body?.password || ""
  );

  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
    return res.status(400).json({
      error:
        "Username must be 3-32 characters and use only letters, numbers, and underscores."
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error:
        "Password must be at least 8 characters."
    });
  }

  if (findUser(username)) {
    return res.status(409).json({
      error: "That username is already registered."
    });
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    passwordHash: hashPassword(password),
    createdAt: Date.now()
  };

  db.users.push(user);

  saveDB();

  const token = createSession(user.id);

  setSessionCookie(res, token);

  return res.json({
    success: true,
    user: publicUser(user)
  });
});

app.post("/api/login", (req, res) => {
  const username = String(
    req.body?.username || ""
  ).trim();

  const password = String(
    req.body?.password || ""
  );

  if (!username || !password) {
    return res.status(400).json({
      error: "Enter your username and password."
    });
  }

  const user = findUser(username);

  /*
    IMPORTANT:
    We deliberately use the stored hash from the
    database instead of assuming anything about the
    password format.
  */

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({
      error: "Invalid username or password."
    });
  }

  /*
    Remove old sessions for this user before creating
    a fresh one. This prevents stale/broken sessions.
  */

  db.sessions = db.sessions.filter(
    session => session.userId !== user.id
  );

  const token = createSession(user.id);

  setSessionCookie(res, token);

  return res.json({
    success: true,
    user: publicUser(user)
  });
});

app.post("/api/logout", (req, res) => {
  const session = getSession(req);

  if (session) {
    db.sessions = db.sessions.filter(
      item => item.id !== session.id
    );

    saveDB();
  }

  clearSessionCookie(res);

  return res.json({
    success: true
  });
});

app.get("/api/me", (req, res) => {
  const user = getCurrentUser(req);

  return res.json({
    loggedIn: Boolean(user),
    user: publicUser(user)
  });
});

/* =========================================================
   ADMIN PASSWORD RESET
========================================================= */

app.post("/api/admin/reset-password", (req, res) => {
  const currentUser = getCurrentUser(req);

  const suppliedKey = String(
    req.headers["x-nexus-reset-key"] ||
    req.body?.resetKey ||
    ""
  );

  const configuredKey =
    process.env.NEXUS_ADMIN_RESET_KEY || "";

  const isAdmin =
    currentUser &&
    String(currentUser.username || "").toLowerCase() ===
      "calsgc";

  const validEmergencyKey =
    configuredKey &&
    suppliedKey &&
    suppliedKey === configuredKey;

  if (!isAdmin && !validEmergencyKey) {
    return res.status(403).json({
      error: "Not authorized."
    });
  }

  const username = String(
    req.body?.username || ""
  ).trim();

  const newPassword = String(
    req.body?.newPassword || ""
  );

  if (!username) {
    return res.status(400).json({
      error: "Username is required."
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      error:
        "New password must be at least 8 characters."
    });
  }

  const user = findUser(username);

  if (!user) {
    return res.status(404).json({
      error: "User not found."
    });
  }

  user.passwordHash = hashPassword(newPassword);

  /*
    Kill every active session for the reset account.
    They must log in again with the new password.
  */

  db.sessions = db.sessions.filter(
    session => session.userId !== user.id
  );

  saveDB();

  return res.json({
    success: true,
    message: "Password reset successfully."
  });
});

/* =========================================================
   SEARCH HELPERS
========================================================= */

function cleanQuery(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTerms(query) {
  return normalizeText(query)
    .split(" ")
    .filter(word => word.length >= 2);
}

function relevanceScore(query, item) {
  const q = normalizeText(query);

  const title = normalizeText(item.title);
  const description = normalizeText(
    item.description || item.snippet || ""
  );

  const url = normalizeText(item.url || "");

  let score = 0;

  /*
    Exact title match = huge boost
  */

  if (title === q) {
    score += 1000;
  }

  /*
    Exact phrase in title
  */

  if (title.includes(q)) {
    score += 500;
  }

  /*
    Exact phrase in description
  */

  if (description.includes(q)) {
    score += 200;
  }

  const terms = queryTerms(query);

  for (const term of terms) {
    if (title.includes(term)) {
      score += 100;
    }

    if (description.includes(term)) {
      score += 25;
    }

    if (url.includes(term)) {
      score += 10;
    }
  }

  /*
    Require actual query relevance.
  */

  const matchingTerms = terms.filter(
    term =>
      title.includes(term) ||
      description.includes(term)
  );

  if (terms.length > 0) {
    const coverage =
      matchingTerms.length / terms.length;

    score += coverage * 150;

    if (coverage < 0.34) {
      score -= 500;
    }
  }

  return score;
}

function dedupeResults(results) {
  const seen = new Set();

  return results.filter(result => {
    const key =
      String(result.url || "")
        .toLowerCase()
        .replace(/\/$/, "");

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

/* =========================================================
   WIKIPEDIA SEARCH
========================================================= */

async function wikipediaSearch(query, limit = 20) {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      srnamespace: "0",
      srlimit: String(limit),
      srprop: "snippet|timestamp|size",
      srsort: "relevance",
      format: "json",
      formatversion: "2"
    });

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "NEXUS/1.0 search application"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Wikipedia returned ${response.status}`
    );
  }

  const data = await response.json();

  const results =
    data?.query?.search || [];

  return results.map(item => ({
    title: item.title,
    description: String(
      item.snippet || ""
    )
      .replace(/<[^>]*>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, "&"),
    url:
      `https://en.wikipedia.org/wiki/` +
      encodeURIComponent(
        item.title.replace(/ /g, "_")
      ),
    source: "Wikipedia",
    type: "web"
  }));
}

/* =========================================================
   BRAVE SEARCH
   Optional:
   BRAVE_SEARCH_API_KEY
========================================================= */

async function braveSearch(query, limit = 20) {
  const key =
    process.env.BRAVE_SEARCH_API_KEY;

  if (!key) {
    return [];
  }

  const url =
    "https://api.search.brave.com/res/v1/web/search?" +
    new URLSearchParams({
      q: query,
      count: String(limit),
      safesearch: "strict",
      search_lang: "en"
    });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key
    }
  });

  if (!response.ok) {
    throw new Error(
      `Brave Search returned ${response.status}`
    );
  }

  const data = await response.json();

  return (data?.web?.results || []).map(
    item => ({
      title: item.title || "",
      description:
        item.description ||
        item.snippet ||
        "",
      url: item.url || "",
      source: "Web",
      type: "web"
    })
  );
}

/* =========================================================
   MAIN SEARCH
========================================================= */

app.get("/api/search", requireAuth, async (req, res) => {
  const query = cleanQuery(req.query.q);

  if (!query) {
    return res.status(400).json({
      error: "Search query is required."
    });
  }

  try {
    let results = [];

    /*
      If BRAVE_SEARCH_API_KEY exists, use real web
      search first.
    */

    const braveResults =
      await braveSearch(query, 20);

    results.push(...braveResults);

    /*
      Wikipedia provides a strong educational fallback
      and additional knowledge results.
    */

    const wikiResults =
      await wikipediaSearch(query, 15);

    results.push(...wikiResults);

    /*
      Remove duplicates.
    */

    results = dedupeResults(results);

    /*
      Score everything ourselves.
      This prevents low-quality matches from floating
      to the top simply because an external API returned
      them early.
    */

    results = results
      .map(result => ({
        ...result,
        _score: relevanceScore(
          query,
          result
        )
      }))
      .filter(result => result._score > -100)
      .sort(
        (a, b) =>
          b._score - a._score
      )
      .slice(0, 20)
      .map(
        ({
          _score,
          ...result
        }) => result
      );

    /*
      Save search history.
    */

    db.history.push({
      id: crypto.randomUUID(),
      userId: req.user.id,
      query,
      tab: "web",
      createdAt: Date.now()
    });

    /*
      Keep history manageable.
    */

    db.history = db.history
      .filter(
        item => item.userId === req.user.id
      )
      .length > 100
      ? [
          ...db.history.filter(
            item =>
              item.userId !== req.user.id
          ),
          ...db.history
            .filter(
              item =>
                item.userId === req.user.id
            )
            .slice(-100)
        ]
      : db.history;

    saveDB();

    return res.json({
      query,
      results
    });
  } catch (error) {
    console.error(
      "Search error:",
      error
    );

    return res.status(500).json({
      error:
        "Search temporarily failed."
    });
  }
});

/* =========================================================
   NEWS
========================================================= */

app.get("/api/news", requireAuth, async (req, res) => {
  const query = cleanQuery(req.query.q);

  if (!query) {
    return res.status(400).json({
      error: "Search query is required."
    });
  }

  try {
    const url =
      "https://api.gdeltproject.org/api/v2/doc/doc?" +
      new URLSearchParams({
        query,
        mode: "artlist",
        format: "json",
        maxrecords: "20",
        sort: "HybridRel"
      });

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `GDELT returned ${response.status}`
      );
    }

    const data = await response.json();

    const results =
      (data?.articles || [])
        .map(article => ({
          title:
            article.title ||
            "Untitled",
          description:
            article.seendate
              ? `Published ${article.seendate}`
              : "",
          url:
            article.url ||
            "",
          source:
            article.domain ||
            "News",
          type: "news",
          image:
            article.socialimage ||
            null
        }))
        .filter(item => item.url);

    return res.json({
      query,
      results
    });
  } catch (error) {
    console.error(
      "News error:",
      error
    );

    return res.status(500).json({
      error:
        "News search temporarily failed."
    });
  }
});

/* =========================================================
   IMAGES
========================================================= */

app.get("/api/images", requireAuth, async (req, res) => {
  const query = cleanQuery(req.query.q);

  if (!query) {
    return res.status(400).json({
      error: "Search query is required."
    });
  }

  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrnamespace: "6",
        gsrlimit: "30",
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        iiurlwidth: "600",
        format: "json",
        origin: "*"
      });

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Wikimedia returned ${response.status}`
      );
    }

    const data = await response.json();

    const pages =
      Object.values(
        data?.query?.pages || {}
      );

    const results = pages
      .map(page => {
        const info =
          page.imageinfo?.[0];

        if (!info) return null;

        return {
          title:
            page.title
              ?.replace(/^File:/, "") ||
            "Image",
          description:
            info.extmetadata?.ImageDescription
              ?.value ||
            "",
          url:
            info.descriptionurl ||
            `https://commons.wikimedia.org/wiki/${encodeURIComponent(
              page.title
            )}`,
          image:
            info.thumburl ||
            info.url ||
            "",
          source: "Wikimedia Commons",
          type: "image"
        };
      })
      .filter(Boolean);

    return res.json({
      query,
      results
    });
  } catch (error) {
    console.error(
      "Image error:",
      error
    );

    return res.status(500).json({
      error:
        "Image search temporarily failed."
    });
  }
});

/* =========================================================
   VIDEOS
========================================================= */

app.get("/api/videos", requireAuth, async (req, res) => {
  const query = cleanQuery(req.query.q);

  if (!query) {
    return res.status(400).json({
      error: "Search query is required."
    });
  }

  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch:
          `${query} filetype:video`,
        gsrnamespace: "6",
        gsrlimit: "20",
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        format: "json",
        origin: "*"
      });

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Wikimedia returned ${response.status}`
      );
    }

    const data = await response.json();

    const pages =
      Object.values(
        data?.query?.pages || {}
      );

    const results = pages
      .map(page => {
        const info =
          page.imageinfo?.[0];

        if (!info) return null;

        const title =
          page.title
            ?.replace(/^File:/, "") ||
          "Video";

        const lower =
          title.toLowerCase();

        if (
          !lower.endsWith(".mp4") &&
          !lower.endsWith(".webm") &&
          !lower.endsWith(".ogv") &&
          !lower.endsWith(".ogg")
        ) {
          return null;
        }

        return {
          title,
          description:
            info.extmetadata
              ?.ImageDescription
              ?.value ||
            "",
          url:
            info.descriptionurl ||
            info.url ||
            "",
          video:
            info.url ||
            "",
          source: "Wikimedia Commons",
          type: "video"
        };
      })
      .filter(Boolean);

    return res.json({
      query,
      results
    });
  } catch (error) {
    console.error(
      "Video error:",
      error
    );

    return res.status(500).json({
      error:
        "Video search temporarily failed."
    });
  }
});

/* =========================================================
   AI
========================================================= */

app.post("/api/ai", requireAuth, async (req, res) => {
  const prompt = String(
    req.body?.prompt || ""
  ).trim();

  if (!prompt) {
    return res.status(400).json({
      error: "Prompt is required."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error:
        "AI is not configured yet."
    });
  }

  try {
    const client = new OpenAI({
      apiKey:
        process.env.OPENAI_API_KEY
    });

    const response =
      await client.responses.create({
        model:
          process.env.OPENAI_MODEL ||
          "gpt-5.6-luna",
        input: prompt
      });

    return res.json({
      answer:
        response.output_text ||
        "No response generated."
    });
  } catch (error) {
    console.error(
      "AI error:",
      error
    );

    return res.status(500).json({
      error:
        "AI request failed."
    });
  }
});

/* =========================================================
   HISTORY
========================================================= */

app.get(
  "/api/history",
  requireAuth,
  (req, res) => {
    const items = db.history
      .filter(
        item =>
          item.userId === req.user.id
      )
      .sort(
        (a, b) =>
          b.createdAt -
          a.createdAt
      );

    res.json({
      history: items
    });
  }
);

app.delete(
  "/api/history",
  requireAuth,
  (req, res) => {
    db.history = db.history.filter(
      item =>
        item.userId !== req.user.id
    );

    saveDB();

    res.json({
      success: true
    });
  }
);

/* =========================================================
   SAVED
========================================================= */

app.get(
  "/api/saved",
  requireAuth,
  (req, res) => {
    const items = db.saved
      .filter(
        item =>
          item.userId === req.user.id
      )
      .sort(
        (a, b) =>
          b.createdAt -
          a.createdAt
      );

    res.json({
      saved: items
    });
  }
);

app.post(
  "/api/saved",
  requireAuth,
  (req, res) => {
    const item =
      req.body?.item;

    if (!item || !item.url) {
      return res.status(400).json({
        error:
          "A valid result is required."
      });
    }

    const existing =
      db.saved.find(
        saved =>
          saved.userId ===
            req.user.id &&
          saved.url === item.url
      );

    if (existing) {
      return res.json({
        success: true,
        saved: existing
      });
    }

    const saved = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      title:
        String(item.title || "")
          .slice(0, 500),
      description:
        String(
          item.description || ""
        ).slice(0, 2000),
      url:
        String(item.url)
          .slice(0, 2000),
      source:
        String(item.source || "")
          .slice(0, 200),
      image:
        item.image
          ? String(item.image)
              .slice(0, 2000)
          : null,
      createdAt: Date.now()
    };

    db.saved.push(saved);

    saveDB();

    res.json({
      success: true,
      saved
    });
  }
);

app.delete(
  "/api/saved/:id",
  requireAuth,
  (req, res) => {
    const before =
      db.saved.length;

    db.saved = db.saved.filter(
      item =>
        !(
          item.id === req.params.id &&
          item.userId === req.user.id
        )
    );

    saveDB();

    res.json({
      success: true,
      deleted:
        db.saved.length !== before
    });
  }
);

app.delete(
  "/api/saved",
  requireAuth,
  (req, res) => {
    db.saved = db.saved.filter(
      item =>
        item.userId !== req.user.id
    );

    saveDB();

    res.json({
      success: true
    });
  }
);

/* =========================================================
   ADMIN
========================================================= */

app.get(
  "/api/admin/status",
  requireAdmin,
  (req, res) => {
    res.json({
      maintenance:
        Boolean(
          db.settings.maintenance
        ),
      title:
        db.settings.maintenanceTitle,
      message:
        db.settings.maintenanceMessage,
      users:
        db.users.length,
      sessions:
        db.sessions.length
    });
  }
);

app.post(
  "/api/admin/lock",
  requireAdmin,
  (req, res) => {
    db.settings.maintenance = true;

    if (req.body?.title) {
      db.settings.maintenanceTitle =
        String(
          req.body.title
        ).slice(0, 200);
    }

    if (req.body?.message) {
      db.settings.maintenanceMessage =
        String(
          req.body.message
        ).slice(0, 1000);
    }

    saveDB();

    res.json({
      success: true,
      maintenance: true
    });
  }
);

app.post(
  "/api/admin/unlock",
  requireAdmin,
  (req, res) => {
    db.settings.maintenance = false;

    saveDB();

    res.json({
      success: true,
      maintenance: false
    });
  }
);

/* =========================================================
   MAINTENANCE STATUS
========================================================= */

app.get(
  "/api/maintenance",
  (req, res) => {
    res.json({
      maintenance:
        Boolean(
          db.settings.maintenance
        ),
      title:
        db.settings.maintenanceTitle,
      message:
        db.settings.maintenanceMessage
    });
  }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service: "NEXUS",
      time: new Date().toISOString()
    });
  }
);

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/* =========================================================
   SPA FALLBACK
========================================================= */

app.get(
  "/{*splat}",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error:
        "Internal server error."
    });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `NEXUS running on port ${PORT}`
    );

    console.log(
      `Users: ${db.users.length}`
    );

    console.log(
      `Maintenance: ${
        db.settings.maintenance
      }`
    );

    console.log(
      `Real web search: ${
        process.env.BRAVE_SEARCH_API_KEY
          ? "enabled"
          : "Wikipedia fallback"
      }`
    );
  }
);
