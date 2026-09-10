const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "nexus.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: [],
    sessions: []
  }, null, 2));
}

function db() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function clean(value, max = 300) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function stripHTML(value) {
  let text = String(value || "");

  text = text.replace(/<[^>]*>/g, " ");

  const entities = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&quot;": '"',
    "&#039;": "'",
    "&#39;": "'",
    "&lt;": "<",
    "&gt;": ">"
  };

  text = text.replace(
    /&(?:nbsp|amp|quot|#039|#39|lt|gt);/gi,
    match => entities[match.toLowerCase()] || match
  );

  text = text.replace(/&#(\d+);/g, (_, n) =>
    String.fromCharCode(Number(n))
  );

  text = text.replace(/&#x([0-9a-f]+);/gi, (_, n) =>
    String.fromCharCode(parseInt(n, 16))
  );

  text = text.replace(/<[^>]*>/g, " ");

  return text.replace(/\s+/g, " ").trim();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
  const [salt, original] = stored.split(":");

  const hash = crypto.scryptSync(password, salt, 64).toString("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(original, "hex")
  );
}

function createSession(userId) {
  const data = db();

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  data.sessions = data.sessions.filter(
    s => s.userId !== userId
  );

  data.sessions.push({
    token: tokenHash,
    userId,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7
  });

  saveDB(data);

  return token;
}

function getSession(req) {
  const cookie = req.headers.cookie || "";

  const match = cookie.match(/nexus_session=([^;]+)/);

  if (!match) return null;

  const tokenHash = crypto
    .createHash("sha256")
    .update(match[1])
    .digest("hex");

  const data = db();

  const session = data.sessions.find(
    s => s.token === tokenHash && s.expires > Date.now()
  );

  if (!session) return null;

  const user = data.users.find(
    u => u.id === session.userId
  );

  return user || null;
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `nexus_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "nexus_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
  );
}

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/register", (req, res) => {
  const username = clean(req.body.username, 30);
  const password = String(req.body.password || "");

  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
    return res.status(400).json({
      ok: false,
      error: "Username must be 3–30 characters."
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      ok: false,
      error: "Password must be at least 8 characters."
    });
  }

  const data = db();

  if (
    data.users.some(
      u => u.username.toLowerCase() === username.toLowerCase()
    )
  ) {
    return res.status(409).json({
      ok: false,
      error: "That username is already taken."
    });
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    password: hashPassword(password),
    history: [],
    saved: [],
    created: Date.now()
  };

  data.users.push(user);
  saveDB(data);

  const token = createSession(user.id);
  setSessionCookie(res, token);

  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username
    }
  });
});

app.post("/api/login", (req, res) => {
  const username = clean(req.body.username, 30);
  const password = String(req.body.password || "");

  const data = db();

  const user = data.users.find(
    u => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user || !checkPassword(password, user.password)) {
    return res.status(401).json({
      ok: false,
      error: "Incorrect username or password."
    });
  }

  const token = createSession(user.id);
  setSessionCookie(res, token);

  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username
    }
  });
});

app.post("/api/logout", (req, res) => {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/nexus_session=([^;]+)/);

  if (match) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(match[1])
      .digest("hex");

    const data = db();

    data.sessions = data.sessions.filter(
      s => s.token !== tokenHash
    );

    saveDB(data);
  }

  clearSessionCookie(res);

  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const user = getSession(req);

  if (!user) {
    return res.status(401).json({ ok: false });
  }

  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username
    },
    history: user.history || [],
    saved: user.saved || []
  });
});

app.post("/api/history", (req, res) => {
  const user = getSession(req);

  if (!user) {
    return res.status(401).json({ ok: false });
  }

  const query = clean(req.body.query, 300);
  if (!query) return res.status(400).json({ ok: false });

  const data = db();
  const target = data.users.find(u => u.id === user.id);

  target.history = [
    {
      query,
      time: Date.now()
    },
    ...(target.history || []).filter(
      x => x.query.toLowerCase() !== query.toLowerCase()
    )
  ].slice(0, 50);

  saveDB(data);

  res.json({ ok: true });
});

app.delete("/api/history", (req, res) => {
  const user = getSession(req);

  if (!user) {
    return res.status(401).json({ ok: false });
  }

  const data = db();
  const target = data.users.find(u => u.id === user.id);

  target.history = [];

  saveDB(data);

  res.json({ ok: true });
});

app.post("/api/saved", (req, res) => {
  const user = getSession(req);

  if (!user) {
    return res.status(401).json({ ok: false });
  }

  const item = {
    title: clean(req.body.title, 300),
    url: String(req.body.url || "").slice(0, 1000),
    description: clean(req.body.description, 500)
  };

  if (!item.title || !item.url.startsWith("http")) {
    return res.status(400).json({ ok: false });
  }

  const data = db();
  const target = data.users.find(u => u.id === user.id);

  target.saved = [
    item,
    ...(target.saved || []).filter(x => x.url !== item.url)
  ].slice(0, 100);

  saveDB(data);

  res.json({ ok: true });
});

app.delete("/api/saved", (req, res) => {
  const user = getSession(req);

  if (!user) {
    return res.status(401).json({ ok: false });
  }

  const data = db();
  const target = data.users.find(u => u.id === user.id);

  target.saved = [];

  saveDB(data);

  res.json({ ok: true });
});

app.get("/api/search", async (req, res) => {
  const query = clean(req.query.q);

  if (!query) {
    return res.status(400).json({
      ok: false,
      error: "Please enter a search query."
    });
  }

  const googleURL =
    "https://www.google.com/search?q=" +
    encodeURIComponent(query);

  try {
    const url =
      "https://en.wikipedia.org/w/rest.php/v1/search/page?q=" +
      encodeURIComponent(query) +
      "&limit=8";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "NEXUS-Search/2.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Wikipedia returned ${response.status}`);
    }

    const data = await response.json();

    const pages = Array.isArray(data.pages)
      ? data.pages
      : [];

    const results = pages.map(page => {
      const title = stripHTML(page.title || "Untitled");
      const key = page.key || title;

      return {
        title,
        description: stripHTML(
          page.description || "No description available."
        ),
        excerpt: stripHTML(
          page.excerpt || "No additional information available."
        ),
        url:
          "https://en.wikipedia.org/wiki/" +
          encodeURIComponent(key)
      };
    });

    res.json({
      ok: true,
      found: results.length > 0,
      query,
      results,
      googleURL
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "NEXUS could not complete the search.",
      googleURL
    });
  }
});

app.get("*splat", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.listen(PORT, () => {
  console.log(`NEXUS running on port ${PORT}`);
});
