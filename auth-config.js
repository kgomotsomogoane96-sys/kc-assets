import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBHYbGBD67I2WxYXaL1OPTI5ZjVlOWbYOc",
  authDomain: "kc-portfolio-v3.firebaseapp.com",
  projectId: "kc-portfolio-v3",
  storageBucket: "kc-portfolio-v3.firebasestorage.app",
  messagingSenderId: "923837042699",
  appId: "1:923837042699:web:7a717ecb148e8c667bb70e"
};

const ADMIN_EMAIL = "kgomotsomogoane96@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// UI refs
const who = document.getElementById("who");
const loginBtn = document.getElementById("loginBtn");
const loginBtn2 = document.getElementById("loginBtn2");
const logoutBtn = document.getElementById("logoutBtn");
const loginView = document.getElementById("loginView");
const dashView = document.getElementById("dashView");
const loginErr = document.getElementById("loginErr");

const drop = document.getElementById("drop");
const file = document.getElementById("file");
const log = document.getElementById("log");

const baseUrlEl = document.getElementById("baseUrl");
const copyBase = document.getElementById("copyBase");

const countEl = document.getElementById("count");
const statsTop = document.getElementById("statsTop");
const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const refresh = document.getElementById("refresh");
const search = document.getElementById("search");

// Viewer
const viewer = document.getElementById("viewer");
const vframe = document.getElementById("vframe");
const vtitle = document.getElementById("vtitle");
const vClose = document.getElementById("vClose");
const vCopy = document.getElementById("vCopy");

let currentUser = null;
let allImages = [];
let lastViewerUrl = "";

// Base URL
const baseUrl = `${location.origin}/api/img/`;
baseUrlEl.textContent = baseUrl;

copyBase.addEventListener("click", async () => {
  await navigator.clipboard.writeText(baseUrl);
  toastOk("Base URL copied.");
});

// Auth actions
async function doLogin() {
  loginErr.style.display = "none";
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    loginErr.textContent = "Sign-in failed: " + e.message;
    loginErr.style.display = "block";
  }
}
loginBtn.addEventListener("click", doLogin);
loginBtn2?.addEventListener("click", doLogin);
logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    who.textContent = "Not signed in";
    loginBtn.style.display = "inline-flex";
    logoutBtn.style.display = "none";
    loginView.style.display = "block";
    dashView.style.display = "none";
    return;
  }

  // Front-end guard for nicer UX (backend still enforces)
  if (user.email !== ADMIN_EMAIL) {
    await signOut(auth);
    loginErr.textContent = `Access denied for ${user.email}. Admin only.`;
    loginErr.style.display = "block";
    loginView.style.display = "block";
    dashView.style.display = "none";
    return;
  }

  currentUser = user;
  who.textContent = user.email;
  loginBtn.style.display = "none";
  logoutBtn.style.display = "inline-flex";
  loginView.style.display = "none";
  dashView.style.display = "block";

  await loadImages();
});

// API helpers
async function authHeaders() {
  // force refresh helps avoid edge cases
  const token = await currentUser.getIdToken(true);
  return { Authorization: "Bearer " + token };
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function toastOk(msg) {
  const line = document.createElement("div");
  line.className = "ok";
  line.textContent = "✓ " + msg;
  log.appendChild(line);
  setTimeout(() => line.remove(), 4500);
}

function toastErr(msg) {
  const line = document.createElement("div");
  line.className = "err";
  line.textContent = "× " + msg;
  log.appendChild(line);
  setTimeout(() => line.remove(), 7000);
}

async function loadImages() {
  try {
    const res = await fetch("/api/list", { headers: await authHeaders() });
    if (!res.ok) throw new Error(`List failed (HTTP ${res.status})`);
    const data = await res.json();
    allImages = data.images || [];
    render();
  } catch (e) {
    toastErr(e.message);
  }
}

function render() {
  const q = (search.value || "").trim().toLowerCase();
  const items = q
    ? allImages.filter(x => x.key.toLowerCase().includes(q))
    : allImages;

  countEl.textContent = String(items.length);
  statsTop.textContent = `Library · ${items.length} images`;

  grid.innerHTML = "";
  empty.style.display = items.length ? "none" : "block";

  for (const it of items) {
    const url = `${location.origin}/api/img/${encodeURIComponent(it.key)}`;

    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `
      <div class="thumb"><img loading="lazy" src="${url}" alt=""></div>
      <div class="meta">
        <div class="name" title="${it.key}">${it.key}</div>
        <div class="sub">
          <span>${fmtSize(it.size)}</span>
          <span>${new Date(it.uploaded).toLocaleDateString()}</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn ghost" data-copy="${url}">Copy URL</button>
        <button class="btn danger" data-del="${it.key}">Delete</button>
      </div>
    `;

    // Open viewer when clicking the thumbnail/meta area
    tile.querySelector(".thumb").addEventListener("click", () => openViewer(it.key, url));
    tile.querySelector(".meta").addEventListener("click", () => openViewer(it.key, url));

    tile.querySelector("[data-copy]").addEventListener("click", async (e) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(url);
      toastOk("URL copied.");
    });

    tile.querySelector("[data-del]").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${it.key}"?`)) return;

      try {
        const res = await fetch("/api/delete?key=" + encodeURIComponent(it.key), {
          method: "DELETE",
          headers: await authHeaders(),
        });
        if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
        toastOk("Deleted.");
        await loadImages();
      } catch (err) {
        toastErr(err.message);
      }
    });

    grid.appendChild(tile);
  }
}

// Upload
drop.addEventListener("click", () => file.click());
drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("drag");
});
drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("drag");
  handleFiles(e.dataTransfer.files);
});
file.addEventListener("change", (e) => handleFiles(e.target.files));

async function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  for (const f of files) {
    if (!f.type.startsWith("image/")) {
      toastErr(`Skipped ${f.name}: not an image`);
      continue;
    }
    if (f.size > 25 * 1024 * 1024) {
      toastErr(`Skipped ${f.name}: over 25MB`);
      continue;
    }
    await uploadOne(f);
  }
  await loadImages();
}

async function uploadOne(f) {
  const line = document.createElement("div");
  line.textContent = `… Uploading ${f.name}`;
  log.appendChild(line);

  try {
    const headers = await authHeaders();
    headers["X-Filename"] = encodeURIComponent(f.name);
    headers["Content-Type"] = f.type;

    const res = await fetch("/api/upload", {
      method: "POST",
      headers,
      body: f,
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Upload failed (HTTP ${res.status}) — ${t}`);
    }

    const data = await res.json();
    line.className = "ok";
    line.textContent = `✓ ${f.name} → ${data.key}`;
    setTimeout(() => line.remove(), 5000);
  } catch (e) {
    line.className = "err";
    line.textContent = `× ${f.name} — ${e.message}`;
    setTimeout(() => line.remove(), 9000);
  }
}

refresh.addEventListener("click", loadImages);
search.addEventListener("input", render);

// Viewer
function openViewer(key, url) {
  lastViewerUrl = url;
  vtitle.textContent = key;
  vframe.innerHTML = `<img src="${url}" alt="">`;
  viewer.classList.add("open");
}
vClose.addEventListener("click", closeViewer);
viewer.addEventListener("click", (e) => {
  if (e.target === viewer) closeViewer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeViewer();
});
vCopy.addEventListener("click", async () => {
  if (!lastViewerUrl) return;
  await navigator.clipboard.writeText(lastViewerUrl);
  toastOk("URL copied.");
});
function closeViewer() {
  viewer.classList.remove("open");
  vframe.innerHTML = "";
  lastViewerUrl = "";
}
