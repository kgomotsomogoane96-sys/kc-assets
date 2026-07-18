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

// State
let currentUser = null;
let allImages = [];
let selected = new Set();
let bulkMode = false;
let currentSnippetUrl = "";
let currentSnippetName = "";
let currentViewerUrl = "";

// DOM
const loginView = document.getElementById("loginView");
const dashView  = document.getElementById("dashView");
const loginErr  = document.getElementById("loginErr");
const navUser   = document.getElementById("navUser");
const navUserEmail = document.getElementById("navUserEmail");
const logoutBtn = document.getElementById("logoutBtn");

const grid      = document.getElementById("grid");
const search    = document.getElementById("search");
const showCount = document.getElementById("showCount");
const totalCount= document.getElementById("totalCount");
const statCount = document.getElementById("statCount");
const statSize  = document.getElementById("statSize");

const drop = document.getElementById("drop");
const file = document.getElementById("file");
const log  = document.getElementById("log");

const bulkToggle = document.getElementById("bulkToggle");
const bulkBar    = document.getElementById("bulkBar");
const bulkCount  = document.getElementById("bulkCount");

const snippetEmpty   = document.getElementById("snippetEmpty");
const snippetContent = document.getElementById("snippetContent");
const snippetName    = document.getElementById("snippetName");
const snippetUrl     = document.getElementById("snippetUrl");
const snippetOpen    = document.getElementById("snippetOpen");

const viewer      = document.getElementById("viewer");
const viewerTitle = document.getElementById("viewerTitle");
const viewerBody  = document.getElementById("viewerBody");
const viewerOpen  = document.getElementById("viewerOpen");

// ---------- Auth ----------
window.doSignIn = async function() {
  loginErr.style.display = "none";
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    loginErr.textContent = "Sign-in failed: " + e.message;
    loginErr.style.display = "block";
  }
};
window.doSignOut = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    loginView.style.display = "flex";
    dashView.style.display  = "none";
    navUser.style.display   = "none";
    logoutBtn.style.display = "none";
    return;
  }
  if (user.email !== ADMIN_EMAIL) {
    await signOut(auth);
    loginErr.textContent = `Access denied for ${user.email}. Admin only.`;
    loginErr.style.display = "block";
    return;
  }
  currentUser = user;
  navUserEmail.textContent = user.email;
  navUser.style.display    = "inline-flex";
  logoutBtn.style.display  = "inline-flex";
  loginView.style.display  = "none";
  dashView.style.display   = "block";
  initReveal();
  await loadImages();
});

// ---------- Helpers ----------
async function authHeaders() {
  const token = await currentUser.getIdToken(true);
  return { Authorization: "Bearer " + token };
}
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes/1024).toFixed(1) + " KB";
  return (bytes/1024/1024).toFixed(2) + " MB";
}
function fmtTotal(bytes) {
  if (bytes < 1024 * 1024) return { v: (bytes/1024).toFixed(0), u: "KB" };
  if (bytes < 1024 * 1024 * 1024) return { v: (bytes/1024/1024).toFixed(1), u: "MB" };
  return { v: (bytes/1024/1024/1024).toFixed(2), u: "GB" };
}
function toastOk(msg) {
  const line = document.createElement("div");
  line.className = "log-line ok";
  line.textContent = "✓ " + msg;
  log.prepend(line);
  setTimeout(() => line.remove(), 5000);
}
function toastErr(msg) {
  const line = document.createElement("div");
  line.className = "log-line err";
  line.textContent = "× " + msg;
  log.prepend(line);
  setTimeout(() => line.remove(), 8000);
}

// ---------- Load / render ----------
window.loadImages = async function() {
  if (!currentUser) return;
  try {
    const res = await fetch("/api/list", { headers: await authHeaders() });
    if (!res.ok) throw new Error("List failed (HTTP " + res.status + ")");
    const data = await res.json();
    allImages = data.images || [];
    render();
  } catch (e) { toastErr(e.message); }
};

function render() {
  const q = (search.value || "").trim().toLowerCase();
  const items = q ? allImages.filter(x => x.key.toLowerCase().includes(q)) : allImages;

  totalCount.textContent = allImages.length;
  showCount.textContent  = items.length;
  statCount.textContent  = String(allImages.length).padStart(2, "0");

  const totalBytes = allImages.reduce((s, i) => s + (i.size || 0), 0);
  const f = fmtTotal(totalBytes);
  statSize.innerHTML = `${f.v}<em> ${f.u}</em>`;

  grid.innerHTML = "";
  if (!items.length) {
    grid.innerHTML = `
      <div class="empty">
        <div class="empty-mark">⬒</div>
        <div class="empty-title">${q ? 'No matches' : 'Nothing here'} <em>yet.</em></div>
        <div class="empty-msg">${q ? 'Try a different search term.' : 'Drop your first image below to get started.'}</div>
      </div>`;
    return;
  }

  const now = Date.now();
  for (const it of items) {
    const url = `${location.origin}/api/img/${encodeURIComponent(it.key)}`;
    const isNew = now - new Date(it.uploaded).getTime() < 5 * 60 * 1000;
    const isSel = selected.has(it.key);
    const tile = document.createElement("div");
    tile.className = "tile" + (isSel ? " selected" : "");
    tile.innerHTML = `
      ${isNew ? '<span class="tile-badge">New</span>' : ''}
      <div class="tile-check">${isSel ? '✓' : ''}</div>
      <div class="tile-browser">
        <div class="tile-bar">
          <div class="tile-dots"><span></span><span></span><span></span></div>
          <span class="tile-url">kc-assets <em>· ${it.key}</em></span>
        </div>
      </div>
      <div class="tile-thumb"><img loading="lazy" src="${url}" alt=""></div>
      <div class="tile-info">
        <div class="tile-name" title="${it.key}">${it.key}</div>
        <div class="tile-meta">
          <span>${fmtSize(it.size)}</span>
          <span>${new Date(it.uploaded).toLocaleDateString()}</span>
        </div>
      </div>
      <div class="tile-actions">
        <button class="btn ghost" data-copy="${url}" data-name="${it.key}">Copy</button>
        <button class="btn danger" data-del="${it.key}">Delete</button>
      </div>
    `;
    tile.addEventListener("click", (e) => {
      if (e.target.closest("[data-copy]") || e.target.closest("[data-del]")) return;
      if (bulkMode) toggleSel(it.key);
      else openViewer(it.key, url);
      setSnippet(it.key, url);
    });
    tile.querySelector("[data-copy]").addEventListener("click", async (e) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(url);
      setSnippet(it.key, url);
      toastOk("URL copied · " + it.key);
    });
    tile.querySelector("[data-del]").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${it.key}"?`)) return;
      try {
        const res = await fetch("/api/delete?key=" + encodeURIComponent(it.key), {
          method: "DELETE",
          headers: await authHeaders(),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        toastOk("Deleted · " + it.key);
        selected.delete(it.key);
        updateBulkBar();
        await loadImages();
      } catch (err) { toastErr("Delete failed: " + err.message); }
    });
    grid.appendChild(tile);
  }
}

search.addEventListener("input", render);

// ---------- Bulk ----------
bulkToggle.addEventListener("click", () => {
  bulkMode = !bulkMode;
  document.body.classList.toggle("bulk-mode", bulkMode);
  bulkToggle.textContent = bulkMode ? "Exit select" : "Select mode";
  if (!bulkMode) clearBulk();
});
function toggleSel(key) {
  if (selected.has(key)) selected.delete(key);
  else selected.add(key);
  render();
  updateBulkBar();
}
function updateBulkBar() {
  bulkCount.textContent = selected.size;
  bulkBar.classList.toggle("visible", selected.size > 0);
}
window.clearBulk = function() {
  selected.clear();
  updateBulkBar();
  render();
};
window.bulkCopy = async function() {
  const urls = [...selected].map(k => `${location.origin}/api/img/${encodeURIComponent(k)}`);
  await navigator.clipboard.writeText(urls.join("\n"));
  toastOk(`${urls.length} URL${urls.length===1?'':'s'} copied.`);
};
window.bulkDelete = async function() {
  if (!confirm(`Delete ${selected.size} image${selected.size===1?'':'s'}?`)) return;
  const keys = [...selected];
  let ok = 0, fail = 0;
  for (const k of keys) {
    try {
      const res = await fetch("/api/delete?key=" + encodeURIComponent(k), {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (res.ok) ok++; else fail++;
    } catch { fail++; }
  }
  toastOk(`Deleted ${ok}. ${fail ? 'Failed: ' + fail : ''}`);
  clearBulk();
  await loadImages();
};

// ---------- Upload ----------
drop.addEventListener("click", () => file.click());
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("drag");
  handleFiles(e.dataTransfer.files);
});
file.addEventListener("change", (e) => handleFiles(e.target.files));

async function handleFiles(list) {
  const files = Array.from(list || []);
  for (const f of files) {
    if (!f.type.startsWith("image/")) { toastErr(`Skipped ${f.name}: not image`); continue; }
    if (f.size > 25 * 1024 * 1024) { toastErr(`Skipped ${f.name}: > 25MB`); continue; }
    await uploadOne(f);
  }
  await loadImages();
}
async function uploadOne(f) {
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `… ${f.name}`;
  log.prepend(line);
  try {
    const headers = await authHeaders();
    headers["X-Filename"]   = encodeURIComponent(f.name);
    headers["Content-Type"] = f.type;
    const res = await fetch("/api/upload", { method: "POST", headers, body: f });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("HTTP " + res.status + " " + t);
    }
    const data = await res.json();
    line.className = "log-line ok";
    line.textContent = `✓ ${f.name} → ${data.key}`;
    const url = `${location.origin}/api/img/${encodeURIComponent(data.key)}`;
    setSnippet(data.key, url);
    setTimeout(() => line.remove(), 5000);
  } catch (e) {
    line.className = "log-line err";
    line.textContent = `× ${f.name}: ${e.message}`;
    setTimeout(() => line.remove(), 9000);
  }
}

// ---------- Snippet ----------
function setSnippet(name, url) {
  currentSnippetUrl = url;
  currentSnippetName = name;
  snippetEmpty.style.display = "none";
  snippetContent.style.display = "block";
  snippetName.textContent = name;
  snippetUrl.textContent = url;
  snippetOpen.href = url;
}
window.copySnippet = async function() {
  if (!currentSnippetUrl) return;
  await navigator.clipboard.writeText(currentSnippetUrl);
  toastOk("URL copied.");
};

// ---------- Viewer ----------
function openViewer(name, url) {
  currentViewerUrl = url;
  viewerTitle.textContent = name;
  viewerBody.innerHTML = `<img src="${url}" alt="">`;
  viewerOpen.href = url;
  viewer.classList.add("open");
  document.body.classList.add("viewer-open");
}
window.closeViewer = function() {
  viewer.classList.remove("open");
  document.body.classList.remove("viewer-open");
  viewerBody.innerHTML = "";
  currentViewerUrl = "";
};
window.viewerCopy = async function() {
  if (!currentViewerUrl) return;
  await navigator.clipboard.writeText(currentViewerUrl);
  toastOk("URL copied.");
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && viewer.classList.contains("open")) closeViewer();
});
viewer.addEventListener("click", (e) => {
  if (e.target === viewer) closeViewer();
});
