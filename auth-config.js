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
const loginScreen = document.getElementById("login-screen");
const dashboard   = document.getElementById("dashboard");
const loginBtn    = document.getElementById("login-btn");
const logoutBtn   = document.getElementById("logout-btn");
const userEmail   = document.getElementById("user-email");
const loginError  = document.getElementById("login-error");
const dropZone    = document.getElementById("drop-zone");
const fileInput   = document.getElementById("file-input");
const uploadStatus= document.getElementById("upload-status");
const grid        = document.getElementById("grid");
const countEl     = document.getElementById("count");
const emptyMsg    = document.getElementById("empty-msg");
const refreshBtn  = document.getElementById("refresh-btn");

let currentUser = null;

loginBtn.addEventListener("click", async () => {
  loginError.classList.add("hidden");
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    loginError.textContent = "Sign-in failed: " + e.message;
    loginError.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user && user.email === ADMIN_EMAIL) {
    currentUser = user;
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");
    userEmail.textContent = user.email;
    logoutBtn.style.display = "inline-block";
    loadImages();
  } else if (user) {
    signOut(auth);
    loginError.textContent = `Access denied for ${user.email}. Only the admin account can log in.`;
    loginError.classList.remove("hidden");
  } else {
    currentUser = null;
    loginScreen.classList.remove("hidden");
    dashboard.classList.add("hidden");
    userEmail.textContent = "";
    logoutBtn.style.display = "none";
  }
});

// ---------- API helpers ----------
async function authHeaders() {
  const token = await currentUser.getIdToken();
  return { Authorization: "Bearer " + token };
}

async function loadImages() {
  grid.innerHTML = "";
  emptyMsg.classList.add("hidden");
  try {
    const res = await fetch("/api/list", { headers: await authHeaders() });
    if (!res.ok) throw new Error("List failed: " + res.status);
    const data = await res.json();
    renderGrid(data.images || []);
  } catch (e) {
    showStatus("Failed to load images: " + e.message, "err");
  }
}

function renderGrid(items) {
  grid.innerHTML = "";
  countEl.textContent = items.length;
  if (items.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }
  for (const it of items) {
    const url = `${location.origin}/api/img/${encodeURIComponent(it.key)}`;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="thumb" style="background-image:url('${url}')"></div>
      <div class="info">
        <div class="name" title="${it.key}">${it.key}</div>
        <div class="meta">${formatSize(it.size)} · ${new Date(it.uploaded).toLocaleDateString()}</div>
        <div class="actions">
          <button class="ghost copy-btn" data-url="${url}">Copy URL</button>
          <button class="danger del-btn" data-key="${it.key}">Delete</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  }

  grid.querySelectorAll(".copy-btn").forEach(b => {
    b.addEventListener("click", () => {
      navigator.clipboard.writeText(b.dataset.url);
      const old = b.textContent;
      b.textContent = "Copied!";
      setTimeout(() => (b.textContent = old), 1200);
    });
  });

  grid.querySelectorAll(".del-btn").forEach(b => {
    b.addEventListener("click", async () => {
      if (!confirm(`Delete "${b.dataset.key}"?`)) return;
      try {
        const res = await fetch("/api/delete?key=" + encodeURIComponent(b.dataset.key), {
          method: "DELETE",
          headers: await authHeaders(),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        showStatus("Deleted.", "ok");
        loadImages();
      } catch (e) {
        showStatus("Delete failed: " + e.message, "err");
      }
    });
  });
}

// ---------- Upload ----------
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag");
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", e => handleFiles(e.target.files));
refreshBtn.addEventListener("click", loadImages);

async function handleFiles(files) {
  const list = Array.from(files);
  for (const f of list) {
    if (!f.type.startsWith("image/")) {
      showStatus(`Skipped ${f.name}: not an image`, "err");
      continue;
    }
    if (f.size > 25 * 1024 * 1024) {
      showStatus(`Skipped ${f.name}: over 25MB`, "err");
      continue;
    }
    await uploadOne(f);
  }
  loadImages();
}

async function uploadOne(file) {
  const progId = "u" + Math.random().toString(36).slice(2, 8);
  const div = document.createElement("div");
  div.className = "upload-progress";
  div.id = progId;
  div.textContent = `Uploading ${file.name}...`;
  uploadStatus.appendChild(div);

  try {
    const headers = await authHeaders();
    headers["X-Filename"] = encodeURIComponent(file.name);
    headers["Content-Type"] = file.type;

    const res = await fetch("/api/upload", {
      method: "POST",
      headers,
      body: file,
    });
    if (!res.ok) throw new Error("HTTP " + res.status + " — " + await res.text());
    const data = await res.json();
    div.textContent = `✓ ${file.name} → ${data.key}`;
    div.style.color = "var(--ok)";
    setTimeout(() => div.remove(), 4000);
  } catch (e) {
    div.textContent = `✗ ${file.name}: ${e.message}`;
    div.style.color = "var(--danger)";
  }
}

function showStatus(msg, kind = "ok") {
  const div = document.createElement("div");
  div.className = "status " + kind;
  div.textContent = msg;
  uploadStatus.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes/1024).toFixed(1) + " KB";
  return (bytes/1024/1024).toFixed(2) + " MB";
}