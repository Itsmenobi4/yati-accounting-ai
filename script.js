
/* =========================================================
   YATI AI 2.0 — FRONTEND ENGINE
   GOOGLE AUTH + MULTI-ROOM + D1 MEMORY + IMAGE UPLOAD
========================================================= */

const API_BASE = "https://yati-accounting-api.fadhilmusyaffa999.workers.dev";
const API_URL = `${API_BASE}/api/chat`;

const GOOGLE_CLIENT_ID =
  "16934799287-u0st2gk9enbvu6amuilcbcjetdlad1gt.apps.googleusercontent.com";

const STORAGE_KEY = "yati_ai_v2_chats";
const ACTIVE_CHAT_KEY = "yati_ai_v2_active_chat";
const DELETED_CHATS_KEY = "yati_ai_v2_deleted_chats";

const AUTH_TOKEN_KEY = "yati_ai_google_session";
const AUTH_USER_KEY = "yati_ai_google_user";

const MAX_STORED_CHATS = 200;
const MAX_HISTORY = 20;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp"
];

// ==========================================
// DOM
// ==========================================

const $ = selector => document.querySelector(selector);

const app = $("#app");
const sidebar = $("#sidebar");
const sidebarOverlay = $("#sidebarOverlay");

const newChatButton = $("#newChat");
const openSidebarButton = $("#openSidebar");
const collapseSidebarButton = $("#collapseSidebar");

const welcome = $("#welcome");
const chatArea = $("#chatArea");
const chatScroll = $("#chatScroll");
const messagesContainer = $("#messages");

const promptInput = $("#promptInput");
const sendButton = $("#sendBtn");

const historyList = $("#historyList");
const emptyHistory = $("#emptyHistory");

const searchButton = $("#searchButton");
const searchModal = $("#searchModal");
const searchInput = $("#searchInput");
const searchResults = $("#searchResults");
const closeSearchButton = $("#closeSearch");

const contextMenu = $("#contextMenu");
const renameButton = $("#renameChat");
const deleteButton = $("#deleteChat");

const toastElement = $("#toast");

// Image Upload DOM
const uploadImageButton = $("#uploadImageBtn");
const imageUploadInput = $("#imageUploadInput");

// ==========================================
// STATE
// ==========================================

let chats = [];
let activeChatId = null;

let contextChatId = null;
let toastTimeout = null;

let authenticated = false;
let currentUser = null;
let authLoading = true;

const pendingRequests = new Map();
const requestTokens = new Map();

// Selected image (testing stage)
let selectedImage = null;

// ==========================================
// AUTH STORAGE
// ==========================================

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null");
  } catch {
    return null;
  }
}

function saveAuth(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

  currentUser = user;
  authenticated = true;

  renderAccountUI();
  hideLoginOverlay();
}

function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);

  currentUser = null;
  authenticated = false;

  renderAccountUI();
  showLoginOverlay();
}

function authHeaders() {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    ...(token
      ? { "Authorization": `Bearer ${token}` }
      : {})
  };
}

// ==========================================
// AUTH UI
// ==========================================

function injectAuthUI() {
  if ($("#yatiAccountBar")) return;

  const style = document.createElement("style");

  style.textContent = `
    #yatiAccountBar {
      position: fixed;
      top: 14px;
      right: 16px;
      z-index: 5000;
      display: flex;
      align-items: center;
      gap: 9px;
      font-family: inherit;
    }

    #yatiAccountButton {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(32,32,35,.92);
      color: #fff;
      border: 1px solid rgba(255,255,255,.1);
      padding: 7px 12px;
      border-radius: 100px;
      cursor: pointer;
      backdrop-filter: blur(16px);
      font-size: 12px;
    }

    #yatiAccountButton img {
      width: 25px;
      height: 25px;
      border-radius: 50%;
      object-fit: cover;
    }

    #yatiAccountButton .yati-account-avatar {
      width: 25px;
      height: 25px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: #444;
    }

    #yatiLoginOverlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(8,8,10,.76);
      backdrop-filter: blur(22px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    #yatiLoginOverlay.hidden {
      display: none;
    }

    .yati-login-card {
      width: min(420px, 100%);
      background: #1c1c1f;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 24px;
      padding: 32px 24px;
      color: #fff;
      text-align: center;
      box-shadow: 0 24px 80px rgba(0,0,0,.4);
    }

    .yati-login-logo {
      width: 58px;
      height: 58px;
      border-radius: 18px;
      margin: 0 auto 20px;
      display: grid;
      place-items: center;
      background: #303034;
      font-size: 26px;
    }

    .yati-login-card h2 {
      margin: 0 0 9px;
      font-size: 22px;
    }

    .yati-login-card p {
      color: #aaa;
      font-size: 13px;
      line-height: 1.65;
      margin: 0 0 24px;
    }

    #yatiGoogleButton {
      display: flex;
      justify-content: center;
      min-height: 44px;
    }

    #yatiLoginStatus {
      font-size: 12px;
      color: #aaa;
      margin-top: 15px;
      min-height: 18px;
    }

    #yatiLogoutMenu {
      position: fixed;
      top: 62px;
      right: 16px;
      z-index: 5001;
      background: #222225;
      color: white;
      border: 1px solid rgba(255,255,255,.1);
      padding: 8px;
      border-radius: 12px;
      min-width: 180px;
      box-shadow: 0 12px 40px rgba(0,0,0,.4);
    }

    #yatiLogoutMenu.hidden {
      display: none;
    }

    #yatiLogoutMenu button {
      width: 100%;
      background: transparent;
      border: 0;
      color: white;
      padding: 10px;
      border-radius: 8px;
      text-align: left;
      cursor: pointer;
    }

    #yatiLogoutMenu button:hover {
      background: rgba(255,255,255,.08);
    }

    @media(max-width:760px) {
      #yatiAccountBar {
        top: 10px;
        right: 10px;
      }

      #yatiAccountButton {
        padding: 5px 9px;
      }
    }
  `;

  document.head.appendChild(style);

  const accountBar = document.createElement("div");
  accountBar.id = "yatiAccountBar";

  const accountButton = document.createElement("button");
  accountButton.id = "yatiAccountButton";
  accountButton.type = "button";

  accountBar.appendChild(accountButton);
  document.body.appendChild(accountBar);

  const logoutMenu = document.createElement("div");
  logoutMenu.id = "yatiLogoutMenu";
  logoutMenu.className = "hidden";
  logoutMenu.innerHTML = `
    <button id="yatiLogoutButton" type="button">
      Log out
    </button>
  `;

  document.body.appendChild(logoutMenu);

  const overlay = document.createElement("div");
  overlay.id = "yatiLoginOverlay";

  overlay.innerHTML = `
    <div class="yati-login-card">
      <div class="yati-login-logo">✦</div>
      <h2>Welcome to Yati AI</h2>
      <p>
        Login dengan Google untuk menggunakan Yati AI
        dan menyimpan memory pribadi pada akun kamu.
      </p>
      <div id="yatiGoogleButton"></div>
      <div id="yatiLoginStatus">Memuat Google Login...</div>
    </div>
  `;

  document.body.appendChild(overlay);

  accountButton.addEventListener("click", () => {
    logoutMenu.classList.toggle("hidden");
  });

  logoutMenu.addEventListener("click", event => {
    if (event.target.closest("#yatiLogoutButton")) {
      logout();
    }
  });

  document.addEventListener("click", event => {
    if (
      !accountBar.contains(event.target) &&
      !logoutMenu.contains(event.target)
    ) {
      logoutMenu.classList.add("hidden");
    }
  });
}

function renderAccountUI() {
  const button = $("#yatiAccountButton");
  if (!button) return;

  if (authenticated && currentUser) {
    const picture = currentUser.picture
      ? `<img src="${escapeHTML(currentUser.picture)}" alt="">`
      : `<span class="yati-account-avatar">👤</span>`;

    button.innerHTML = `
      ${picture}
      <span>${escapeHTML(currentUser.name || currentUser.email || "Account")}</span>
      <span>⌄</span>
    `;
  } else {
    button.innerHTML = `
      <span class="yati-account-avatar">👤</span>
      <span>Login</span>
    `;
  }
}

function showLoginOverlay() {
  $("#yatiLoginOverlay")?.classList.remove("hidden");
}

function hideLoginOverlay() {
  $("#yatiLoginOverlay")?.classList.add("hidden");
  $("#yatiLogoutMenu")?.classList.add("hidden");
}

function setLoginStatus(text) {
  const element = $("#yatiLoginStatus");
  if (element) element.textContent = text;
}

// ==========================================
// GOOGLE LOGIN
// ==========================================

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");

    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = resolve;
    script.onerror = reject;

    document.head.appendChild(script);
  });
}

async function initializeGoogleLogin() {
  try {
    await loadGoogleScript();

    if (!window.google?.accounts?.id) {
      throw new Error("Google Identity Services tidak tersedia.");
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true
    });

    google.accounts.id.renderButton(
      $("#yatiGoogleButton"),
      {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: 280
      }
    );

    setLoginStatus("Silakan login dengan akun Google.");
  } catch (error) {
    console.error("Google initialization error:", error);
    setLoginStatus("Google Login gagal dimuat. Refresh halaman.");
  }
}

async function handleGoogleCredential(response) {
  try {
    setLoginStatus("Memverifikasi akun Google...");

    const result = await fetch(`${API_BASE}/api/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        credential: response.credential
      })
    });

    const data = await result.json();

    if (!result.ok || !data.success || !data.token) {
      throw new Error(data.error || "Login gagal.");
    }

    saveAuth(data.token, data.user);

    showToast("Login berhasil.");

    renderHistory();
    renderChat();

  } catch (error) {
    console.error("Google login error:", error);
    setLoginStatus(error.message || "Login gagal. Coba lagi.");
  }
}

// ==========================================
// SESSION CHECK
// ==========================================

async function checkSession() {
  const token = getAuthToken();

  if (!token) {
    authenticated = false;
    currentUser = null;
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      clearAuth();
      return false;
    }

    const data = await response.json();

    if (!data.authenticated || !data.user) {
      clearAuth();
      return false;
    }

    authenticated = true;
    currentUser = data.user;

    localStorage.setItem(
      AUTH_USER_KEY,
      JSON.stringify(data.user)
    );

    renderAccountUI();
    hideLoginOverlay();

    return true;

  } catch (error) {
    console.error("Session check error:", error);

    currentUser = getStoredUser();
    authenticated = Boolean(currentUser && token);

    renderAccountUI();

    if (authenticated) {
      hideLoginOverlay();
      showToast("Mode offline: koneksi auth tidak tersedia.");
      return true;
    }

    return false;
  }
}

async function logout() {
  const token = getAuthToken();

  try {
    if (token) {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
    }
  } catch (error) {
    console.warn("Logout request failed:", error);
  }

  clearAuth();
  showToast("Berhasil logout.");
}

async function initializeAuth() {
  injectAuthUI();

  currentUser = getStoredUser();

  const validSession = await checkSession();

  if (!validSession) {
    showLoginOverlay();
    await initializeGoogleLogin();
  }

  authLoading = false;
}

// ==========================================
// STORAGE
// ==========================================

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getDeletedChatIDs() {
  const data = readJSON(DELETED_CHATS_KEY, []);

  return new Set(
    Array.isArray(data)
      ? data.filter(id => typeof id === "string")
      : []
  );
}

function saveDeletedChatIDs(ids) {
  try {
    localStorage.setItem(
      DELETED_CHATS_KEY,
      JSON.stringify([...ids])
    );
  } catch (error) {
    console.error("Failed saving deleted chats:", error);
  }
}

function normalizeChat(chat) {
  if (!chat || typeof chat !== "object") return null;
  if (typeof chat.id !== "string" || !chat.id) return null;

  const messages = Array.isArray(chat.messages)
    ? chat.messages
        .filter(message =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string"
        )
        .map(message => ({
          role: message.role,
          content: message.content,
          timestamp: Number(message.timestamp) || Date.now()
        }))
    : [];

  return {
    id: chat.id,
    title:
      typeof chat.title === "string" && chat.title.trim()
        ? chat.title.trim()
        : "New conversation",
    messages,
    createdAt: Number(chat.createdAt) || Date.now(),
    updatedAt:
      Number(chat.updatedAt) ||
      Number(chat.createdAt) ||
      Date.now()
  };
}

function loadChats() {
  const stored = readJSON(STORAGE_KEY, []);
  const deletedIDs = getDeletedChatIDs();

  if (!Array.isArray(stored)) return [];

  chats = stored
    .map(normalizeChat)
    .filter(Boolean)
    .filter(chat => !deletedIDs.has(chat.id))
    .slice(0, MAX_STORED_CHATS);

  saveChats();
  return chats;
}

function saveChats() {
  const deletedIDs = getDeletedChatIDs();

  chats = chats
    .map(normalizeChat)
    .filter(Boolean)
    .filter(chat => !deletedIDs.has(chat.id))
    .slice(0, MAX_STORED_CHATS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch (error) {
    console.error("Failed saving chats:", error);
    showToast("Penyimpanan browser penuh.");
  }
}

function saveActiveChat() {
  if (activeChatId && chatExists(activeChatId)) {
    localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId);
  } else {
    activeChatId = null;
    localStorage.removeItem(ACTIVE_CHAT_KEY);
  }
}

// ==========================================
// HELPERS
// ==========================================

function createId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

function getActiveChat() {
  if (!activeChatId) return null;
  return chats.find(chat => chat.id === activeChatId) || null;
}

function getChatByID(id) {
  return chats.find(chat => chat.id === id) || null;
}

function chatExists(id) {
  return Boolean(getChatByID(id));
}

function isRoomGenerating(id) {
  return pendingRequests.has(id);
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();

  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short"
  });
}

function escapeHTML(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  if (!toastElement) return;

  toastElement.textContent = message;
  toastElement.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toastElement.classList.remove("show");
  }, 2200);
}

function closeContextMenu() {
  contextMenu?.classList.add("hidden");
  contextChatId = null;
}

// ==========================================
// CHAT CREATION
// ==========================================

function createChat() {
  const now = Date.now();

  const chat = {
    id: createId(),
    title: "New conversation",
    messages: [],
    createdAt: now,
    updatedAt: now
  };

  chats.unshift(chat);
  activeChatId = chat.id;

  saveChats();
  saveActiveChat();

  renderHistory();
  renderChatFor(chat.id);

  promptInput.value = "";
  resizeInput();
  promptInput.focus();

  closeMobileSidebar();

  return chat;
}

function startNewChat() {
  promptInput.value = "";
  resizeInput();
  createChat();
}

// ==========================================
// CHAT TITLE
// ==========================================

function generateTitle(text) {
  const cleaned = text.replace(/\n/g, " ").trim();

  if (!cleaned) return "New conversation";

  return cleaned.length > 40
    ? cleaned.slice(0, 40).trim() + "…"
    : cleaned;
}

// ==========================================
// HISTORY SIDEBAR
// ==========================================

function renderHistory() {
  historyList.innerHTML = "";

  emptyHistory.classList.toggle("hidden", chats.length > 0);

  chats.forEach(chat => {
    const row = document.createElement("div");
    row.className = "history-row";

    const chatButton = document.createElement("button");
    chatButton.className = "history-chat";

    if (chat.id === activeChatId) {
      chatButton.classList.add("active");
    }

    chatButton.textContent = chat.title || "Untitled";
    chatButton.title = chat.title || "Untitled";

    chatButton.addEventListener("click", () => {
      switchChat(chat.id);
    });

    const menuButton = document.createElement("button");
    menuButton.className = "history-menu-button";
    menuButton.innerHTML = "•••";
    menuButton.title = "Chat options";

    menuButton.addEventListener("click", event => {
      event.stopPropagation();
      openContextMenu(chat.id, menuButton);
    });

    row.append(chatButton, menuButton);
    historyList.appendChild(row);
  });
}

// ==========================================
// SWITCH ROOM
// ==========================================

function switchChat(id) {
  const target = getChatByID(id);

  if (!target) {
    showToast("Conversation tidak ditemukan.");
    return;
  }

  activeChatId = target.id;

  saveActiveChat();

  renderHistory();
  renderChatFor(target.id);

  closeContextMenu();
  closeMobileSidebar();

  promptInput.focus();
}

// ==========================================
// ROOM-LOCKED RENDER
// ==========================================

function renderChatFor(roomID) {
  if (roomID !== activeChatId) return;

  const chat = getChatByID(roomID);

  messagesContainer.replaceChildren();

  if (!chat || chat.messages.length === 0) {
    welcome.classList.remove("hidden");
    chatArea.classList.add("hidden");
    updateSendButton();
    return;
  }

  welcome.classList.add("hidden");
  chatArea.classList.remove("hidden");

  chat.messages.forEach(message => {
    addMessageToDOM(message.role, message.content, false);
  });

  if (isRoomGenerating(roomID)) {
    showTypingIndicator(roomID);
  }

  scrollToBottom(false);
  updateSendButton();
}

function renderChat() {
  if (!activeChatId) {
    messagesContainer.replaceChildren();
    welcome.classList.remove("hidden");
    chatArea.classList.add("hidden");
    updateSendButton();
    return;
  }

  renderChatFor(activeChatId);
}

// ==========================================
// MESSAGE ELEMENT
// ==========================================

function addMessageToDOM(role, content, shouldScroll = true) {
  const message = document.createElement("article");

  message.className =
    role === "user"
      ? "message user"
      : "message ai";

  const contentElement = document.createElement("div");
  contentElement.className = "message-content";

  if (role === "user") {
    contentElement.textContent = content;
  } else {
    contentElement.innerHTML = renderMarkdown(content);
  }

  message.appendChild(contentElement);

  if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copyButton = createActionButton(
      "Copy response",
      `<svg viewBox="0 0 24 24">
        <rect x="8" y="8" width="12" height="12" rx="2"/>
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 a2 2 0 0 0-2 2v9a2 2 0 0 a0 2 2 0 0 0 2 2h3"/>
      </svg>`
    );

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(content);
        showToast("Response copied.");
      } catch {
        showToast("Gagal menyalin response.");
      }
    });

    actions.appendChild(copyButton);
    message.appendChild(actions);
  }

  messagesContainer.appendChild(message);

  if (shouldScroll) scrollToBottom();

  return message;
}

function createActionButton(title, icon) {
  const button = document.createElement("button");

  button.className = "message-action";
  button.title = title;
  button.innerHTML = icon;

  return button;
}

// ==========================================
// MARKDOWN
// ==========================================

function renderMarkdown(text) {
  if (window.marked && window.DOMPurify) {
    const html = marked.parse(String(text), {
      breaks: true,
      gfm: true
    });

    return DOMPurify.sanitize(html);
  }

  return escapeHTML(text).replace(/\n/g, "<br>");
}

// ==========================================
// SCROLL
// ==========================================

function scrollToBottom(smooth = true) {
  requestAnimationFrame(() => {
    chatScroll.scrollTo({
      top: chatScroll.scrollHeight,
      behavior: smooth ? "smooth" : "instant"
    });
  });
}

// ==========================================
// TYPING INDICATOR
// ==========================================

function showTypingIndicator(roomID) {
  if (roomID !== activeChatId) return;

  removeTypingIndicator();

  const indicator = document.createElement("article");
  indicator.className = "message ai";
  indicator.id = "typingIndicator";

  indicator.innerHTML = `
    <div class="message-content">
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;

  messagesContainer.appendChild(indicator);
  scrollToBottom();

  return indicator;
}

function removeTypingIndicator(roomID = null) {
  if (roomID && roomID !== activeChatId) return;
  $("#typingIndicator")?.remove();
}

// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage(customText = null) {
  if (!authenticated || !getAuthToken()) {
    showLoginOverlay();
    showToast("Login terlebih dahulu.");
    return;
  }

  const text = (
    customText !== null
      ? customText
      : promptInput.value
  ).trim();

  if (!text) return;

  let chat = getActiveChat();

  if (!chat) {
    chat = createChat();
  }

  const roomID = chat.id;

  if (isRoomGenerating(roomID)) {
    showToast("Respons room ini sedang diproses.");
    return;
  }

  const userMessage = {
    role: "user",
    content: text,
    timestamp: Date.now()
  };

  chat.messages.push(userMessage);

  if (
    chat.title === "New conversation" &&
    chat.messages.filter(message => message.role === "user").length === 1
  ) {
    chat.title = generateTitle(text);
  }

  chat.updatedAt = Date.now();

  saveChats();
  renderHistory();

  if (activeChatId === roomID) {
    welcome.classList.add("hidden");
    chatArea.classList.remove("hidden");
    addMessageToDOM("user", text);
  }

  promptInput.value = "";
  resizeInput();

  const token = createId();

  requestTokens.set(roomID, token);
  pendingRequests.set(roomID, true);

  updateSendButton();

  if (activeChatId === roomID) {
    showTypingIndicator(roomID);
  }

  const historySnapshot = chat.messages
    .slice(0, -1)
    .slice(-MAX_HISTORY)
    .map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      content: message.content
    }));

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        message: text,
        history: historySnapshot
      })
    });

    if (response.status === 401) {
      clearAuth();
      showToast("Session berakhir. Login ulang.");
      return;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    const aiText =
      data.reply ??
      data.response ??
      data.text ??
      data.message;

    if (typeof aiText !== "string" || !aiText.trim()) {
      throw new Error("Empty AI response");
    }

    if (requestTokens.get(roomID) !== token) {
      return;
    }

    const originalRoom = getChatByID(roomID);

    if (!originalRoom) {
      return;
    }

    const assistantMessage = {
      role: "assistant",
      content: aiText,
      timestamp: Date.now()
    };

    originalRoom.messages.push(assistantMessage);
    originalRoom.updatedAt = Date.now();

    saveChats();

    if (activeChatId === roomID) {
      removeTypingIndicator(roomID);
      addMessageToDOM("assistant", aiText);
    }

    renderHistory();

  } catch (error) {
    console.error("Yati API error:", error);

    if (requestTokens.get(roomID) !== token) {
      return;
    }

    const originalRoom = getChatByID(roomID);

    if (originalRoom && activeChatId === roomID) {
      removeTypingIndicator(roomID);

      addMessageToDOM(
        "assistant",
        "Maaf, Yati belum bisa merespons saat ini. Coba periksa koneksi internet kamu dan kirim pesan lagi."
      );
    }

    showToast("Connection failed.");

  } finally {
    if (requestTokens.get(roomID) === token) {
      requestTokens.delete(roomID);
      pendingRequests.delete(roomID);
    }

    updateSendButton();

    if (activeChatId === roomID) {
      promptInput.focus();
    }
  }
}

// ==========================================
// SEND BUTTON
// ==========================================

function updateSendButton() {
  const activeGenerating = activeChatId
    ? isRoomGenerating(activeChatId)
    : false;

  sendButton.disabled =
    activeGenerating || promptInput.value.trim().length === 0;

  sendButton.innerHTML = activeGenerating
    ? `
      <svg viewBox="0 0 24 24">
        <rect x="7" y="7" width="10" height="10" rx="2"/>
      </svg>
    `
    : `
      <svg viewBox="0 0 24 24">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
    `;
}

// ==========================================
// INPUT
// ==========================================

function resizeInput() {
  promptInput.style.height = "auto";

  promptInput.style.height =
    Math.min(promptInput.scrollHeight, 180) + "px";

  updateSendButton();
}

promptInput.addEventListener("input", resizeInput);

promptInput.addEventListener("keydown", event => {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing
  ) {
    event.preventDefault();
    sendMessage();
  }
});

sendButton.addEventListener("click", () => sendMessage());

// ==========================================
// QUICK PROMPTS
// ==========================================

document.querySelectorAll(".quick-prompt").forEach(button => {
  button.addEventListener("click", () => {
    sendMessage(button.dataset.prompt);
  });
});

// ==========================================
// NEW CHAT
// ==========================================

newChatButton.addEventListener("click", startNewChat);

// ==========================================
// SIDEBAR
// ==========================================

function openMobileSidebar() {
  sidebar.classList.add("mobile-open");
  sidebarOverlay.classList.add("show");
}

function closeMobileSidebar() {
  sidebar.classList.remove("mobile-open");
  sidebarOverlay.classList.remove("show");
}

openSidebarButton.addEventListener("click", () => {
  if (window.innerWidth <= 760) {
    openMobileSidebar();
  } else {
    app.classList.remove("sidebar-collapsed");
  }
});

collapseSidebarButton.addEventListener("click", () => {
  if (window.innerWidth <= 760) {
    closeMobileSidebar();
  } else {
    app.classList.add("sidebar-collapsed");
  }
});

sidebarOverlay.addEventListener("click", closeMobileSidebar);

// ==========================================
// SEARCH
// ==========================================

function openSearch() {
  searchModal.classList.remove("hidden");
  searchInput.value = "";
  renderSearchResults("");

  setTimeout(() => searchInput.focus(), 50);
}

function closeSearch() {
  searchModal.classList.add("hidden");
}

searchButton.addEventListener("click", openSearch);
closeSearchButton.addEventListener("click", closeSearch);

searchModal.addEventListener("click", event => {
  if (event.target === searchModal) closeSearch();
});

searchInput.addEventListener("input", () => {
  renderSearchResults(searchInput.value);
});

function renderSearchResults(query) {
  const normalized = query.trim().toLowerCase();

  const filtered = chats.filter(chat => {
    if (!normalized) return true;

    const inTitle = chat.title.toLowerCase().includes(normalized);

    const inMessages = chat.messages.some(message =>
      message.content.toLowerCase().includes(normalized)
    );

    return inTitle || inMessages;
  });

  searchResults.innerHTML = "";

  if (!filtered.length) {
    searchResults.innerHTML = `
      <div class="search-empty">
        No conversations found.
      </div>
    `;
    return;
  }

  filtered.forEach(chat => {
    const result = document.createElement("button");
    result.className = "search-result";

    const title = document.createElement("strong");
    title.textContent = chat.title;

    const lastMessage =
      chat.messages.at(-1)?.content || "Empty conversation";

    const description = document.createElement("small");
    description.textContent = lastMessage.slice(0, 100);

    result.append(title, description);

    result.addEventListener("click", () => {
      switchChat(chat.id);
      closeSearch();
    });

    searchResults.appendChild(result);
  });
}

// ==========================================
// CHAT CONTEXT MENU
// ==========================================

function openContextMenu(chatID, button) {
  if (!chatExists(chatID)) return;

  contextChatId = chatID;

  const rect = button.getBoundingClientRect();

  contextMenu.style.left = Math.min(
    rect.left,
    window.innerWidth - 170
  ) + "px";

  contextMenu.style.top = Math.min(
    rect.bottom + 4,
    window.innerHeight - 100
  ) + "px";

  contextMenu.classList.remove("hidden");
}

// RENAME

renameButton.addEventListener("click", () => {
  const chat = getChatByID(contextChatId);

  if (!chat) {
    closeContextMenu();
    return;
  }

  const newTitle = prompt("Rename conversation:", chat.title);

  if (newTitle && newTitle.trim()) {
    chat.title = newTitle.trim().slice(0, 100);

    saveChats();
    renderHistory();

    showToast("Conversation renamed.");
  }

  closeContextMenu();
});

// DELETE

deleteButton.addEventListener("click", () => {
  const chatID = contextChatId;
  const chat = getChatByID(chatID);

  if (!chat) {
    closeContextMenu();
    return;
  }

  const confirmed = confirm(`Delete "${chat.title}"?`);

  if (!confirmed) {
    closeContextMenu();
    return;
  }

  const deletedIDs = getDeletedChatIDs();
  deletedIDs.add(chatID);
  saveDeletedChatIDs(deletedIDs);

  requestTokens.delete(chatID);
  pendingRequests.delete(chatID);

  chats = chats.filter(c => c.id !== chatID);

  if (activeChatId === chatID) {
    activeChatId = chats[0]?.id || null;
  }

  saveChats();
  saveActiveChat();

  renderHistory();
  renderChat();

  closeContextMenu();
  updateSendButton();

  showToast("Conversation deleted.");
});

// ==========================================
// CROSS-TAB SYNC
// ==========================================

window.addEventListener("storage", event => {
  if (
    event.key === STORAGE_KEY ||
    event.key === DELETED_CHATS_KEY
  ) {
    chats = loadChats();

    if (!chatExists(activeChatId)) {
      activeChatId = null;
    }

    renderHistory();
    renderChat();
    saveActiveChat();
  }

  if (event.key === ACTIVE_CHAT_KEY) {
    const nextID = localStorage.getItem(ACTIVE_CHAT_KEY);

    if (nextID && chatExists(nextID)) {
      activeChatId = nextID;
      renderHistory();
      renderChat();
    }
  }
});

// ==========================================
// GLOBAL EVENTS
// ==========================================

document.addEventListener("click", event => {
  if (contextMenu && !contextMenu.contains(event.target)) {
    closeContextMenu();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeSearch();
    closeContextMenu();
    closeMobileSidebar();
    $("#yatiLogoutMenu")?.classList.add("hidden");
  }

  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "k"
  ) {
    event.preventDefault();
    openSearch();
  }

  if (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    event.key.toLowerCase() === "o"
  ) {
    event.preventDefault();
    startNewChat();
  }
});

// ==========================================
// LEARNING BUTTON
// ==========================================

$("#learningBtn")?.addEventListener("click", () => {
  promptInput.value =
    "Aku ingin belajar akuntansi. Tolong buatkan materi pembelajaran yang terstruktur dari dasar dan ajari aku secara bertahap.";

  resizeInput();
  promptInput.focus();
});

// ==========================================
// IMAGE UPLOAD
// ==========================================

function initializeImageUpload() {
  if (!uploadImageButton || !imageUploadInput) {
    console.warn("[Yati Upload] Tombol/input upload belum ditemukan.");
    return;
  }

  uploadImageButton.addEventListener("click", () => {
    imageUploadInput.click();
  });

  imageUploadInput.addEventListener("change", event => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showToast("Format gambar tidak didukung.");
      imageUploadInput.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      showToast("Ukuran gambar maksimal 10 MB.");
      imageUploadInput.value = "";
      return;
    }

    selectedImage = file;

    console.log("[Yati Upload] Gambar terpilih:", {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2) + " MB"
    });

    showToast(`Gambar dipilih: ${file.name}`);

    // Reset supaya file yang sama bisa dipilih ulang.
    imageUploadInput.value = "";
  });
}

// ==========================================
// INITIALIZATION
// ==========================================

async function initialize() {
  chats = loadChats();

  const savedActiveID = localStorage.getItem(ACTIVE_CHAT_KEY);
  const savedChat = getChatByID(savedActiveID);

  activeChatId = savedChat ? savedChat.id : null;

  renderHistory();
  renderChat();

  saveActiveChat();
  resizeInput();

  initializeImageUpload();

  await initializeAuth();

  console.log("Yati AI 2.0 initialized.");
  console.log("Rooms:", chats.length);
  console.log("Authenticated:", authenticated);
  console.log("Image upload:", Boolean(uploadImageButton && imageUploadInput));
}

initialize();
