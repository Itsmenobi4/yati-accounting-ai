
/* ==========================================
   YATI AI 2.0 — FRONTEND ENGINE
========================================== */

const API_URL = "https://yati-accounting-api.fadhilmusyaffa999.workers.dev/api/chat";

const STORAGE_KEY = "yati_ai_v2_chats";
const ACTIVE_CHAT_KEY = "yati_ai_v2_active_chat";

// ==========================================
// DOM
// ==========================================

const $ = (selector) => document.querySelector(selector);

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

let chats = loadChats();
let activeChatId = localStorage.getItem(ACTIVE_CHAT_KEY);

let isGenerating = false;
let contextChatId = null;

let toastTimeout = null;

// ==========================================
// STORAGE
// ==========================================

function loadChats() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveChats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch (error) {
    console.error("Failed saving chats:", error);
    showToast("Penyimpanan browser penuh.");
  }
}

function saveActiveChat() {
  if (activeChatId) {
    localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId);
  } else {
    localStorage.removeItem(ACTIVE_CHAT_KEY);
  }
}

// ==========================================
// HELPERS
// ==========================================

function createId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function getActiveChat() {
  return chats.find(chat => chat.id === activeChatId) || null;
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
  toastElement.textContent = message;
  toastElement.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toastElement.classList.remove("show");
  }, 2200);
}

function closeContextMenu() {
  contextMenu.classList.add("hidden");
  contextChatId = null;
}

// ==========================================
// CHAT CREATION
// ==========================================

function createChat() {
  const chat = {
    id: createId(),
    title: "New conversation",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  chats.unshift(chat);

  activeChatId = chat.id;

  saveChats();
  saveActiveChat();

  renderHistory();
  renderChat();

  promptInput.value = "";
  resizeInput();

  promptInput.focus();

  closeMobileSidebar();

  return chat;
}

function startNewChat() {
  if (isGenerating) {
    showToast("Tunggu respons selesai dulu.");
    return;
  }

  createChat();
}

// ==========================================
// CHAT TITLE
// ==========================================

function generateTitle(text) {
  const cleaned = text
    .replace(/\n/g, " ")
    .trim();

  if (!cleaned) return "New conversation";

  return cleaned.length > 40
    ? cleaned.slice(0, 40).trim() + "…"
    : cleaned;
}

// ==========================================
// HISTORY
// ==========================================

function renderHistory() {
  historyList.innerHTML = "";

  emptyHistory.classList.toggle(
    "hidden",
    chats.length > 0
  );

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

    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openContextMenu(chat.id, menuButton);
    });

    row.append(chatButton, menuButton);
    historyList.appendChild(row);
  });
}

// ==========================================
// SWITCH CHAT
// ==========================================

function switchChat(id) {
  if (isGenerating) return;

  activeChatId = id;

  saveActiveChat();

  renderHistory();
  renderChat();

  closeContextMenu();
  closeMobileSidebar();
}

// ==========================================
// RENDER CHAT
// ==========================================

function renderChat() {
  const chat = getActiveChat();

  if (!chat || !chat.messages.length) {
    welcome.classList.remove("hidden");
    chatArea.classList.add("hidden");
    return;
  }

  welcome.classList.add("hidden");
  chatArea.classList.remove("hidden");

  messagesContainer.innerHTML = "";

  chat.messages.forEach(message => {
    addMessageToDOM(message.role, message.content, false);
  });

  scrollToBottom(false);
}

// ==========================================
// MESSAGE ELEMENT
// ==========================================

function addMessageToDOM(role, content, scroll = true) {
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

  // AI ACTIONS
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

  if (scroll) scrollToBottom();

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
// LOADING
// ==========================================

function showTypingIndicator() {
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

function removeTypingIndicator() {
  $("#typingIndicator")?.remove();
}

// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage(customText = null) {
  if (isGenerating) return;

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

  const userMessage = {
    role: "user",
    content: text,
    timestamp: Date.now()
  };

  // SAVE USER MESSAGE
  chat.messages.push(userMessage);

  // AUTO TITLE
  if (
    chat.title === "New conversation" &&
    chat.messages.filter(m => m.role === "user").length === 1
  ) {
    chat.title = generateTitle(text);
  }

  chat.updatedAt = Date.now();

  saveChats();
  renderHistory();

  // SHOW CHAT
  welcome.classList.add("hidden");
  chatArea.classList.remove("hidden");

  addMessageToDOM("user", text);

  promptInput.value = "";
  resizeInput();

  setGenerating(true);

  const typing = showTypingIndicator();

  try {
    const conversationHistory = chat.messages
      .slice(-20)
      .map(message => ({
        role: message.role === "assistant" ? "model" : "user",
        content: message.content
      }));

    const response = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        message: text,
        history: conversationHistory
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
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

    removeTypingIndicator();

    const assistantMessage = {
      role: "assistant",
      content: aiText,
      timestamp: Date.now()
    };

    chat.messages.push(assistantMessage);
    chat.updatedAt = Date.now();

    saveChats();

    addMessageToDOM("assistant", aiText);

    renderHistory();

  } catch (error) {
    console.error("Yati API error:", error);

    removeTypingIndicator();

    const errorMessage =
      "Maaf, Yati belum bisa merespons saat ini. Coba periksa koneksi internet kamu dan kirim pesan lagi.";

    addMessageToDOM("assistant", errorMessage);

    showToast("Connection failed.");
  } finally {
    setGenerating(false);
    promptInput.focus();
  }
}

// ==========================================
// GENERATION STATE
// ==========================================

function setGenerating(state) {
  isGenerating = state;

  sendButton.disabled =
    state || promptInput.value.trim().length === 0;

  sendButton.innerHTML = state
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

  sendButton.disabled =
    isGenerating || promptInput.value.trim().length === 0;
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
    const prompt = button.dataset.prompt;
    sendMessage(prompt);
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
  if (event.target === searchModal) {
    closeSearch();
  }
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

    const lastMessage = chat.messages.at(-1)?.content || "Empty conversation";

    const description = document.createElement("small");
    description.textContent =
      lastMessage.slice(0, 100);

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

function openContextMenu(chatId, button) {
  contextChatId = chatId;

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

renameButton.addEventListener("click", () => {
  const chat = chats.find(c => c.id === contextChatId);

  if (!chat) return;

  const newTitle = prompt("Rename conversation:", chat.title);

  if (newTitle && newTitle.trim()) {
    chat.title = newTitle.trim().slice(0, 100);

    saveChats();
    renderHistory();

    showToast("Conversation renamed.");
  }

  closeContextMenu();
});

deleteButton.addEventListener("click", () => {
  const chat = chats.find(c => c.id === contextChatId);

  if (!chat) return;

  const confirmed = confirm(`Delete "${chat.title}"?`);

  if (!confirmed) {
    closeContextMenu();
    return;
  }

  chats = chats.filter(c => c.id !== contextChatId);

  if (activeChatId === contextChatId) {
    activeChatId = chats[0]?.id || null;
  }

  saveChats();
  saveActiveChat();

  renderHistory();
  renderChat();

  closeContextMenu();

  showToast("Conversation deleted.");
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
  // ESC
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
  promptInput.value = "Aku ingin belajar akuntansi. Tolong buatkan materi pembelajaran yang terstruktur dari dasar dan ajari aku secara bertahap.";
  resizeInput();
  promptInput.focus();
});

// ==========================================
// INITIALIZATION
// ==========================================

function initialize() {
  chats = loadChats();

  // Check saved active chat
  const savedChat = chats.find(chat => chat.id === activeChatId);

  if (!savedChat) {
    activeChatId = null;
  }

  renderHistory();

  if (activeChatId) {
    renderChat();
  } else {
    welcome.classList.remove("hidden");
    chatArea.classList.add("hidden");
  }

  saveActiveChat();
  resizeInput();

  console.log("Yati AI 2.0 initialized.");
}

initialize();
