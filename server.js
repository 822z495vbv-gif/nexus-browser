"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "nexus.json");

const ADMIN_USERNAME = "CALSGC";
const SESSION_DAYS = 7;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* =========================
   DATABASE
========================= */

function defaultDB() {
  return {
    users: [],
    sessions: [],
    settings: {
      maintenance: false,
      maintenanceTitle: "NEXUS is upgrading",
      maintenanceMessage:
        "We're making some improvements. We'll be back shortly."
    }
  };
}

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const fresh = defaultDB();
      saveDB(fresh);
      return fresh;
    }

    const raw = fs.readFileSync(DB_FILE, "utf8");
    const data = JSON.parse(raw);

    data.users ||= [];
    data.sessions ||= [];
    data.settings ||= {};

    data.settings.maintenance ??= false;
    data.settings.maintenanceTitle ??= "NEXUS is upgrading";
    data.settings.maintenanceMessage ??=
      "We're making some improvements. We'll be back shortly.";

    return data;
  } catch (err) {
    console.error("DATABASE ERROR:", err);

    const fresh = defaultDB();
    saveDB(fresh);

    return fresh;
  }
}

function saveDB(data) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function clean(value) {
  return String(value || "").trim();
}

/* =========================
   HTML CLEANER
========================= */

function stripHTML(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      try {
        return String.fromCodePoint(
          parseInt(n, 16)
        );
      } catch {
        return "";
      }
    })
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   PASSWORD SECURITY
========================= */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto.scryptSync(
    password,
    salt,
    64
  ).toString("hex");

  return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
  try {
    const [salt, originalHash] =
      String(stored).split(":");

    if (!salt || !originalHash) {
      return false;
    }

    const hash = crypto.scryptSync(
      password,
      salt,
      64
    );

    const original =
      Buffer.from(originalHash, "hex");

    if (hash.length !== original.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      hash,
      original
    );
  } catch {
    return false;
  }
}

/* =========================
   SESSIONS
========================= */

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function createSession(userId) {
  const db = loadDB();

  const token =
    crypto.randomBytes(32).toString("hex");

  db.sessions.push({
    token: hashToken(token),
    userId,
    expires:
      Date.now() +
      SESSION_DAYS * 24 * 60 * 60 * 1000
  });

  db.sessions =
    db.sessions.filter(
      session =>
        session.expires > Date.now()
    );

  saveDB(db);

  return token;
}

function setSessionCookie(res, token) {
  const secure =
    process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  res.setHeader(
    "Set-Cookie",
    `nexus_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`
  );
}

function getCookie(req, name) {
  const cookies =
    req.headers.cookie || "";

  const parts = cookies.split(";");

  for (const part of parts) {
    const [key, ...value] =
      part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(
        value.join("=")
      );
    }
  }

  return null;
}

function getUser(req) {
  const token =
    getCookie(req, "nexus_session");

  if (!token) return null;

  const db = loadDB();

  const session =
    db.sessions.find(
      s =>
        s.token === hashToken(token) &&
        s.expires > Date.now()
    );

  if (!session) return null;

  return (
    db.users.find(
      user => user.id === session.userId
    ) || null
  );
}

function requireAuth(req, res, next) {
  const user = getUser(req);

  if (!user) {
    return res.status(401).json({
      ok: false,
      error: "You are not signed in."
    });
  }

  req.user = user;
  next();
}

function isAdmin(user) {
  return (
    user &&
    user.username.toLowerCase() ===
      ADMIN_USERNAME.toLowerCase()
  );
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({
      ok: false,
      error: "Administrator access required."
    });
  }

  next();
}

/* =========================
   REGISTER
========================= */

app.post("/api/register", (req, res) => {
  const username = clean(req.body.username);
  const password =
    String(req.body.password || "");

  if (!username || !password) {
    return res.status(400).json({
      ok: false,
      error: "Username and password are required."
    });
  }

  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
    return res.status(400).json({
      ok: false,
      error:
        "Username must be 3-24 characters and use letters, numbers, dots, hyphens or underscores."
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      ok: false,
      error:
        "Password must be at least 8 characters."
    });
  }

  const db = loadDB();

  const exists =
    db.users.some(
      user =>
        user.username.toLowerCase() ===
        username.toLowerCase()
    );

  if (exists) {
    return res.status(409).json({
      ok: false,
      error: "That username already exists."
    });
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    password: hashPassword(password),
    history: [],
    saved: [],
    createdAt: Date.now()
  };

  db.users.push(user);

  saveDB(db);

  const token =
    createSession(user.id);

  setSessionCookie(res, token);

  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      admin: isAdmin(user)
    }
  });
});

/* =========================
   LOGIN
========================= */

app.post("/api/login", (req, res) => {
  const username = clean(req.body.username);
  const password =
    String(req.body.password || "");

  if (!username || !password) {
    return res.status(400).json({
      ok: false,
      error:
        "Enter your username and password."
    });
  }

  const db = loadDB();

  const user =
    db.users.find(
      u =>
        u.username.toLowerCase() ===
        username.toLowerCase()
    );

  if (!user || !checkPassword(
    password,
    user.password
  )) {
    return res.status(401).json({
      ok: false,
      error:
        "Incorrect username or password."
    });
  }

  const token =
    createSession(user.id);

  setSessionCookie(res, token);

  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      admin: isAdmin(user)
    }
  });
});

/* =========================
   LOGOUT
========================= */

app.post("/api/logout", (req, res) => {
  const token =
    getCookie(req, "nexus_session");

  if (token) {
    const db = loadDB();

    db.sessions =
      db.sessions.filter(
        session =>
          session.token !==
          hashToken(token)
      );

    saveDB(db);
  }

  res.setHeader(
    "Set-Cookie",
    "nexus_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
  );

  res.json({ ok: true });
});

/* =========================
   CURRENT USER
========================= */

app.get("/api/me", (req, res) => {
  const user = getUser(req);

  if (!user) {
    return res.status(401).json({
      ok: false
    });
  }

  const db = loadDB();

  res.json({
    ok: true,

    user: {
      id: user.id,
      username: user.username,
      admin: isAdmin(user)
    },

    history: user.history || [],
    saved: user.saved || [],

    maintenance: isAdmin(user)
      ? db.settings.maintenance
      : undefined
  });
});

/* =========================
   HISTORY
========================= */

app.post(
  "/api/history",
  requireAuth,
  (req, res) => {

    const query =
      clean(req.body.query);

    if (!query) {
      return res.status(400).json({
        ok: false
      });
    }

    const db = loadDB();

    const user =
      db.users.find(
        u => u.id === req.user.id
      );

    user.history =
      user.history || [];

    user.history = [
      {
        query,
        time: Date.now()
      },
      ...user.history.filter(
        item =>
          item.query.toLowerCase() !==
          query.toLowerCase()
      )
    ].slice(0, 100);

    saveDB(db);

    res.json({
      ok: true
    });
  }
);

app.delete(
  "/api/history",
  requireAuth,
  (req, res) => {

    const db = loadDB();

    const user =
      db.users.find(
        u => u.id === req.user.id
      );

    user.history = [];

    saveDB(db);

    res.json({
      ok: true
    });
  }
);

/* =========================
   SAVED
========================= */

app.post(
  "/api/saved",
  requireAuth,
  (req, res) => {

    const db = loadDB();

    const user =
      db.users.find(
        u => u.id === req.user.id
      );

    user.saved =
      user.saved || [];

    const item = {
      title: clean(req.body.title),
      url: clean(req.body.url),
      description:
        clean(req.body.description),
      excerpt:
        clean(req.body.excerpt),
      time: Date.now()
    };

    if (!item.title || !item.url) {
      return res.status(400).json({
        ok: false
      });
    }

    user.saved.unshift(item);

    user.saved =
      user.saved.slice(0, 100);

    saveDB(db);

    res.json({
      ok: true
    });
  }
);

app.delete(
  "/api/saved",
  requireAuth,
  (req, res) => {

    const db = loadDB();

    const user =
      db.users.find(
        u => u.id === req.user.id
      );

    user.saved = [];

    saveDB(db);

    res.json({
      ok: true
    });
  }
);

/* =========================
   MAINTENANCE CHECK
========================= */

app.get(
  "/api/system",
  (req, res) => {

    const db = loadDB();

    res.json({
      ok: true,
      maintenance:
        db.settings.maintenance,
      title:
        db.settings.maintenanceTitle,
      message:
        db.settings.maintenanceMessage
    });
  }
);

/* =========================
   ADMIN STATUS
========================= */

app.get(
  "/api/admin/status",
  requireAuth,
  requireAdmin,
  (req, res) => {

    const db = loadDB();

    res.json({
      ok: true,

      maintenance:
        db.settings.maintenance,

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

/* =========================
   ADMIN LOCK
========================= */

app.post(
  "/api/admin/lock",
  requireAuth,
  requireAdmin,
  (req, res) => {

    const db = loadDB();

    db.settings.maintenance = true;

    if (req.body.title) {
      db.settings.maintenanceTitle =
        clean(req.body.title);
    }

    if (req.body.message) {
      db.settings.maintenanceMessage =
        clean(req.body.message);
    }

    saveDB(db);

    res.json({
      ok: true,
      maintenance: true
    });
  }
);

/* =========================
   ADMIN UNLOCK
========================= */

app.post(
  "/api/admin/unlock",
  requireAuth,
  requireAdmin,
  (req, res) => {

    const db = loadDB();

    db.settings.maintenance = false;

    saveDB(db);

    res.json({
      ok: true,
      maintenance: false
    });
  }
);

/* =========================
   ADMIN INFO
========================= */

app.get(
  "/api/admin/users",
  requireAuth,
  requireAdmin,
  (req, res) => {

    const db = loadDB();

    res.json({
      ok: true,

      users: db.users.map(user => ({
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        historyCount:
          (user.history || []).length,
        savedCount:
          (user.saved || []).length
      }))
    });
  }
);

/* =========================
   SEARCH
========================= */

app.get(
  "/api/search",
  async (req, res) => {

    const query =
      clean(req.query.q);

    if (!query) {
      return res.status(400).json({
        ok: false,
        error: "Enter something to search."
      });
    }

    try {

      const url =
        `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=10`;

      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          "Wikipedia search failed."
        );
      }

      const data =
        await response.json();

      const results =
        (data.pages || []).map(page => ({
          title:
            stripHTML(page.title),

          description:
            stripHTML(page.description),

          excerpt:
            stripHTML(page.excerpt),

          url:
            page.content_urls?.desktop?.page ||
            `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key || page.title)}`
        }));

      res.json({
        ok: true,
        query,
        found: results.length > 0,
        results,

        googleURL:
          `https://www.google.com/search?q=${encodeURIComponent(query)}`
      });

    } catch (error) {

      console.error(
        "SEARCH ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "NEXUS search is temporarily unavailable."
      });
    }
  }
);

/* =========================
   WEBSITE LOCK
========================= */

app.get(
  "*splat",
  (req, res) => {

    const user = getUser(req);
    const db = loadDB();

    const allowedAdmin =
      isAdmin(user);

    if (
      db.settings.maintenance &&
      !allowedAdmin &&
      !req.path.startsWith("/api/")
    ) {

      return res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>NEXUS — Maintenance</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #07090d;
  color: white;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.card {
  width: min(520px, 90%);
  padding: 42px;
  border: 1px solid #202631;
  border-radius: 28px;
  background: #0d1118;
  text-align: center;
  box-shadow:
    0 30px 80px rgba(0,0,0,.45);
}

.logo {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -2px;
  margin-bottom: 35px;
}

.icon {
  width: 70px;
  height: 70px;
  margin: auto;
  display: grid;
  place-items: center;
  border-radius: 20px;
  background: #151b24;
  font-size: 30px;
}

h1 {
  margin: 25px 0 12px;
  font-size: 28px;
}

p {
  color: #9da7b6;
  line-height: 1.7;
}

.status {
  margin-top: 25px;
  padding: 12px;
  border-radius: 14px;
  background: #111821;
  color: #aeb8c7;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 7px;
  border-radius: 50%;
  background: #f5b83d;
}
</style>
</head>

<body>

<div class="card">

  <div class="logo">NEXUS</div>

  <div class="icon">⚙</div>

  <h1>
    ${escapeHTML(
      db.settings.maintenanceTitle
    )}
  </h1>

  <p>
    ${escapeHTML(
      db.settings.maintenanceMessage
    )}
  </p>

  <div class="status">
    <span class="dot"></span>
    Maintenance Mode
  </div>

</div>

</body>
</html>
      `);
    }

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log(
    `NEXUS running on port ${PORT}`
  );

  console.log(
    `ADMIN ACCOUNT: ${CALSGC}`
  );
});
