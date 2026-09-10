const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = "CALSGC";

const PUBLIC_DIR = path.join(
  __dirname,
  "public"
);

const DATA_DIR = path.join(
  __dirname,
  "data"
);

const DB_FILE = path.join(
  DATA_DIR,
  "nexus.json"
);

fs.mkdirSync(
  DATA_DIR,
  { recursive: true }
);

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_USERNAME = "CALSGC";

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "nexus.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

function freshDB() {
  return {
    users: [],
    sessions: [],
    history: {},
    saved: {},
    maintenance: {
      locked: false,
      title: "NEXUS is under maintenance",
      message: "We're making improvements. Please check back soon."
    }
  };
}

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return freshDB();
    }

    const data = JSON.parse(
      fs.readFileSync(DB_FILE, "utf8")
    );

    const base = freshDB();

    return {
      ...base,
      ...data,
      history: data.history || {},
      saved: data.saved || {},
      maintenance: {
        ...base.maintenance,
        ...(data.maintenance || {})
      }
    };
  } catch {
    return freshDB();
  }
}

let db = loadDB();

function saveDB() {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2)
  );
}

function cleanText(value, max = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function stripHTML(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function passwordHash(password, salt) {
  return crypto
    .scryptSync(password, salt, 64)
    .toString("hex");
}

function createPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  return {
    salt,
    hash: passwordHash(password, salt)
  };
}

function verifyPassword(password, salt, hash) {
  const actual = passwordHash(password, salt);

  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(hash, "hex");

  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function tokenHash(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getToken(req) {
  const cookies = req.headers.cookie || "";

  const match = cookies
    .split(";")
    .map(x => x.trim())
    .find(x => x.startsWith("nexus_session="));

  return match
    ? decodeURIComponent(
        match.split("=").slice(1).join("=")
      )
    : null;
}

function getUser(req) {
  const token = getToken(req);

  if (!token) return null;

  const hashed = tokenHash(token);

  const session = db.sessions.find(
    s => s.token === hashed
  );

  if (!session) return null;

  return db.users.find(
    u => u.id === session.userId
  ) || null;
}

function isAdmin(user) {
  return !!(
    user &&
    user.username.toLowerCase() ===
      ADMIN_USERNAME.toLowerCase()
  );
}

function requireAuth(req, res, next) {
  const user = getUser(req);

  if (!user) {
    return res.status(401).json({
      error: "You must be logged in."
    });
  }

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getUser(req);

  if (!user || !isAdmin(user)) {
    return res.status(403).json({
      error: "Admin access denied."
    });
  }

  req.user = user;
  next();
}

function setSessionCookie(res, token) {
  const secure =
    process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  res.setHeader(
    "Set-Cookie",
    `nexus_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "nexus_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax"
  );
}

app.use(express.json({ limit: "1mb" }));

/* =========================
   AUTH
========================= */

app.post("/api/register", (req, res) => {
  const username = cleanText(
    req.body.username,
    24
  );

  const password = String(
    req.body.password || ""
  );

  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
    return res.status(400).json({
      error:
        "Username must be 3-24 characters and use letters, numbers, _, ., or -."
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error:
        "Password must be at least 8 characters."
    });
  }

  const exists = db.users.some(
    u =>
      u.username.toLowerCase() ===
      username.toLowerCase()
  );

  if (exists) {
    return res.status(409).json({
      error: "That username already exists."
    });
  }

  const { salt, hash } =
    createPassword(password);

  const user = {
    id: crypto.randomUUID(),
    username,
    salt,
    passwordHash: hash,
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  db.history[user.id] = [];
  db.saved[user.id] = [];

  const token = createToken();

  db.sessions.push({
    token: tokenHash(token),
    userId: user.id,
    createdAt: new Date().toISOString()
  });

  saveDB();

  setSessionCookie(res, token);

  res.json({
    user: {
      ...publicUser(user)
    }
  });
});

app.post("/api/login", (req, res) => {
  const username = cleanText(
    req.body.username,
    24
  );

  const password = String(
    req.body.password || ""
  );

  const user = db.users.find(
    u =>
      u.username.toLowerCase() ===
      username.toLowerCase()
  );

  if (
    !user ||
    !verifyPassword(
      password,
      user.salt,
      user.passwordHash
    )
  ) {
    return res.status(401).json({
      error: "Invalid username or password."
    });
  }

  const token = createToken();

  db.sessions.push({
    token: tokenHash(token),
    userId: user.id,
    createdAt: new Date().toISOString()
  });

  saveDB();

  setSessionCookie(res, token);

  res.json({
    user: publicUser(user)
  });
});

app.post("/api/logout", (req, res) => {
  const token = getToken(req);

  if (token) {
    const hashed = tokenHash(token);

    db.sessions =
      db.sessions.filter(
        s => s.token !== hashed
      );

    saveDB();
  }

  clearSessionCookie(res);

  res.json({
    ok: true
  });
});

app.get("/api/me", (req, res) => {
  const user = getUser(req);

  if (!user) {
    return res.status(401).json({
      error: "Not logged in."
    });
  }

  res.json({
    user: publicUser(user)
  });
});

/* =========================
   SEARCH
========================= */

app.get("/api/search", async (req, res) => {
  const query = cleanText(
    req.query.q,
    200
  );

  if (!query) {
    return res.status(400).json({
      error: "Search query is empty."
    });
  }

  try {
    const url =
      "https://en.wikipedia.org/api/rest_v1/page/summary/" +
      encodeURIComponent(query);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "NEXUS-Search/3.0"
      }
    });

    if (response.ok) {
      const data = await response.json();

      if (
        data.type !== "https://mediawiki.org/wiki/HyperSwitch/errors/not_found" &&
        data.title
      ) {
        const result = {
          title: stripHTML(data.title),
          description: stripHTML(
            data.extract ||
              "No description available."
          ),
          url:
            data.content_urls?.desktop?.page ||
            `https://en.wikipedia.org/wiki/${encodeURIComponent(
              data.title.replace(/ /g, "_")
            )}`,
          source: "Wikipedia",
          image:
            data.thumbnail?.source || null
        };

        const user = getUser(req);

        if (user) {
          const list =
            db.history[user.id] || [];

          list.unshift({
            id: crypto.randomUUID(),
            query,
            title: result.title,
            url: result.url,
            createdAt:
              new Date().toISOString()
          });

          db.history[user.id] =
            list.slice(0, 50);

          saveDB();
        }

        return res.json({
          mode: "result",
          result
        });
      }
    }

    return res.json({
      mode: "fallback",
      query,
      message:
        "NEXUS couldn't find a direct result for this search.",
      fallback:
        `https://www.google.com/search?q=${encodeURIComponent(query)}`
    });
  } catch (error) {
    return res.status(500).json({
      error: "Search service temporarily unavailable."
    });
  }
});

/* =========================
   HISTORY
========================= */

app.get(
  "/api/history",
  requireAuth,
  (req, res) => {
    res.json({
      history:
        db.history[req.user.id] || []
    });
  }
);

app.delete(
  "/api/history",
  requireAuth,
  (req, res) => {
    db.history[req.user.id] = [];
    saveDB();

    res.json({
      ok: true
    });
  }
);

/* =========================
   SAVED
========================= */

app.get(
  "/api/saved",
  requireAuth,
  (req, res) => {
    res.json({
      saved:
        db.saved[req.user.id] || []
    });
  }
);

app.post(
  "/api/saved",
  requireAuth,
  (req, res) => {
    const title = cleanText(
      req.body.title,
      200
    );

    const url = cleanText(
      req.body.url,
      1000
    );

    if (!title || !url) {
      return res.status(400).json({
        error: "Invalid saved item."
      });
    }

    const list =
      db.saved[req.user.id] || [];

    const exists = list.some(
      item => item.url === url
    );

    if (!exists) {
      list.unshift({
        id: crypto.randomUUID(),
        title,
        url,
        createdAt:
          new Date().toISOString()
      });
    }

    db.saved[req.user.id] =
      list.slice(0, 100);

    saveDB();

    res.json({
      ok: true
    });
  }
);

app.delete(
  "/api/saved/:id",
  requireAuth,
  (req, res) => {
    db.saved[req.user.id] =
      (db.saved[req.user.id] || [])
        .filter(
          item => item.id !== req.params.id
        );

    saveDB();

    res.json({
      ok: true
    });
  }
);

app.delete(
  "/api/saved",
  requireAuth,
  (req, res) => {
    db.saved[req.user.id] = [];

    saveDB();

    res.json({
      ok: true
    });
  }
);

/* =========================
   ADMIN
========================= */

app.get(
  "/api/admin/status",
  requireAdmin,
  (req, res) => {
    res.json({
      maintenance:
        db.maintenance.locked,

      title:
        db.maintenance.title,

      message:
        db.maintenance.message,

      users: db.users.length,

      sessions: db.sessions.length,

      administrator:
        ADMIN_USERNAME
    });
  }
);

app.post(
  "/api/admin/lock",
  requireAdmin,
  (req, res) => {
    const title =
      cleanText(
        req.body.title,
        120
      ) ||
      "NEXUS is under maintenance";

    const message =
      cleanText(
        req.body.message,
        500
      ) ||
      "We're making improvements. Please check back soon.";

    db.maintenance = {
      locked: true,
      title,
      message
    };

    saveDB();

    res.json({
      ok: true,
      maintenance: true
    });
  }
);

app.post(
  "/api/admin/unlock",
  requireAdmin,
  (req, res) => {
    db.maintenance.locked = false;

    saveDB();

    res.json({
      ok: true,
      maintenance: false
    });
  }
);

app.get(
  "/api/admin/users",
  requireAdmin,
  (req, res) => {
    res.json({
      users: db.users.map(
        publicUser
      )
    });
  }
);

/* =========================
   MAINTENANCE PAGE
========================= */

function maintenancePage() {
  const title =
    cleanText(
      db.maintenance.title,
      120
    );

  const message =
    cleanText(
      db.maintenance.message,
      500
    );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} • NEXUS</title>
<style>
*{box-sizing:border-box}
body{
margin:0;
min-height:100vh;
display:flex;
align-items:center;
justify-content:center;
padding:24px;
font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
background:#07090d;
color:#fff
}
.card{
width:min(620px,100%);
padding:42px;
border:1px solid #252a35;
border-radius:28px;
background:#0e1118;
box-shadow:0 30px 100px rgba(0,0,0,.45)
}
.logo{
font-size:14px;
font-weight:900;
letter-spacing:.2em;
margin-bottom:40px
}
.badge{
display:inline-block;
padding:8px 12px;
border-radius:999px;
background:#1b202b;
color:#aeb7c8;
font-size:12px;
font-weight:800;
letter-spacing:.08em
}
h1{
font-size:clamp(32px,7vw,56px);
line-height:1;
margin:22px 0 16px
}
p{
color:#9ca5b5;
font-size:16px;
line-height:1.7
}
</style>
</head>
<body>
<div class="card">
<div class="logo">NEXUS</div>
<div class="badge">● MAINTENANCE</div>
<h1>${title}</h1>
<p>${message}</p>
</div>
</body>
</html>`;
}

/* =========================
   STATIC APP
========================= */

app.use(express.static(PUBLIC_DIR));

app.get("*splat", (req, res) => {
  const user = getUser(req);

  if (
    db.maintenance.locked &&
    !isAdmin(user)
  ) {
    return res
      .status(503)
      .send(maintenancePage());
  }

  res.sendFile(
    path.join(PUBLIC_DIR, "index.html")
  );
});

app.listen(PORT, () => {
  console.log(
    `NEXUS running on port ${PORT}`
  );
});
