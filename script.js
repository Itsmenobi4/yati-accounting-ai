
/* ==========================================
   YATI AI 2.0 — FRONTEND ENGINE
   MULTI-ROOM ISOLATION REBUILD
========================================== */

const API_URL = "https://yati-accounting-api.fadhilmusyaffa999.workers.dev/api/chat";

const STORAGE_KEY = "yati_ai_v2_chats";
const ACTIVE_CHAT_KEY = "yati_ai_v2_active_chat";
const DELETED_CHATS_KEY = "yati_ai_v2_deleted_chats";
const MEMORY_USER_KEY = "yati_ai_memory_user_id";

const MAX_STORED_CHATS = 200;
const MAX_HISTORY = 20;

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

// ==========================================
// STATE
// ==========================================

let chats = [];
let activeChatId = null;

let contextChatId = null;
let toastTimeout = null;

// Request tracking: room-specific, not global.
const pendingRequests = new Map();
const requestTokens = new Map();

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
    localStorage.setItem(DELETED_CHATS_KEY, JSON.stringify([...ids]));
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
// MEMORY USER ID
// ==========================================

function getMemoryUserID() {
  let id = localStorage.getItem(MEMORY_USER_KEY);

  if (id && /^[a-zA-Z0-9-]{10,100}$/.test(id)) {
    return id;
  }

  try {
    id = crypto.randomUUID();
  } catch {
    id = createId();
  }

  localStorage.setItem(MEMORY_USER_KEY, id);
  return id;
}

const memoryUserID = getMemoryUserID();

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

  // Switch room immediately, even if another room is generating.
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
  // Never render a room that isn't currently active.
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
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
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
// ROOM-SPECIFIC TYPING INDICATOR
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
// SEND MESSAGE — ROOM ISOLATED
// ==========================================

async function sendMessage(customText = null) {
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

  // Prevent duplicate requests in the same room only.
  if (isRoomGenerating(roomID)) {
    showToast("Respons room ini sedang diproses.");
    return;
  }

  // Create immutable request history.
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

  // Only update visible DOM for the room that owns this message.
  if (activeChatId === roomID) {
    welcome.classList.add("hidden");
    chatArea.classList.remove("hidden");
    addMessageToDOM("user", text);
  }

  promptInput.value = "";
  resizeInput();

  // Room-specific request token.
  const token = createId();

  requestTokens.set(roomID, token);
  pendingRequests.set(roomID, true);

  updateSendButton();

  if (activeChatId === roomID) {
    showTypingIndicator(roomID);
  }

  // Snapshot history. This array will not change during the request.
  const historySnapshot = chat.messages
    .slice(-MAX_HISTORY)
    .map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      content: message.content
    }));

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        history: historySnapshot,
        memoryUserId: memoryUserID
      })
    });

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

    // Reject stale requests.
    if (requestTokens.get(roomID) !== token) {
      return;
    }

    // Locate original room by ID. Never use currently active room.
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

    // Only render if the original room is still open.
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
    // Only clear this room's request state.
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
// SEND BUTTON STATE
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

  // Permanently mark the room as deleted locally.
  const deletedIDs = getDeletedChatIDs();
  deletedIDs.add(chatID);
  saveDeletedChatIDs(deletedIDs);

  // Invalidate any pending request for this room.
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
  if (!contextMenu.contains(event.target)) {
    closeContextMenu();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeSearch();
    closeContextMenu();
    closeMobileSidebar();
  }

  // CTRL/CMD + K
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "k"
  ) {
    event.preventDefault();
    openSearch();
  }

  // CTRL/CMD + SHIFT + O -> New chat
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

$("#learningBtn").addEventListener("click", () => {
  promptInput.value =
    "Aku ingin belajar akuntansi. Tolong buatkan materi pembelajaran yang terstruktur dari dasar dan ajari aku secara bertahap.";

  resizeInput();
  promptInput.focus();
});

// ==========================================
// INITIALIZATION
// ==========================================

function initialize() {
  chats = loadChats();

  const savedActiveID = localStorage.getItem(ACTIVE_CHAT_KEY);
  const savedChat = getChatByID(savedActiveID);

  activeChatId = savedChat ? savedChat.id : null;

  renderHistory();
  renderChat();

  saveActiveChat();
  resizeInput();

  console.log("Yati AI 2.0 initialized.");
  console.log("Rooms:", chats.length);
}

initialize();
