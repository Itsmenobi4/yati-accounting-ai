
/* ==========================================
   YATI FARADILLAH — ACCOUNTING AI
   Cross-Device Diagnostic Version
========================================== */

const API_URL = "https://yati-accounting-api.fadhilmusyaffa999.workers.dev/api/chat";
const REQUEST_TIMEOUT = 45000;

// =========================
// ID GENERATOR
// =========================

function generateId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return (
    "chat-" +
    Date.now() +
    "-" +
    Math.random().toString(36).slice(2, 11)
  );
}

// =========================
// STATE
// =========================

function loadChats() {
  try {
    const data = JSON.parse(
      localStorage.getItem("yati_chats") || "[]"
    );

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to load chats:", error);
    return [];
  }
}

let chats = loadChats();
let currentChatId = null;
let isLoading = false;

// =========================
// ELEMENTS
// =========================

const input = document.getElementById("promptInput");
const sendBtn = document.getElementById("sendBtn");
const welcome = document.getElementById("welcome");
const chatArea = document.getElementById("chatArea");
const messages = document.getElementById("messages");
const historyList = document.getElementById("historyList");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

// =========================
// STORAGE
// =========================

function saveChats() {
  try {
    localStorage.setItem(
      "yati_chats",
      JSON.stringify(chats)
    );
  } catch (error) {
    console.error("Unable to save chat history:", error);
  }
}

function getCurrentChat() {
  return chats.find(
    chat => chat.id === currentChatId
  );
}

// =========================
// CHAT MANAGEMENT
// =========================

function newChat() {
  currentChatId = null;

  messages.innerHTML = "";

  welcome.classList.remove("hidden");
  chatArea.classList.add("hidden");

  input.value = "";
  resizeInput();

  renderHistory();
  closeSidebar();

  input.focus();
}

function createChat(firstMessage) {
  const chat = {
    id: generateId(),
    title: firstMessage.slice(0, 45),
    messages: [],
    createdAt: Date.now()
  };

  chats.unshift(chat);

  currentChatId = chat.id;

  saveChats();
  renderHistory();

  return chat;
}

function openChat(id) {
  const chat = chats.find(
    item => item.id === id
  );

  if (!chat) return;

  currentChatId = id;

  welcome.classList.add("hidden");
  chatArea.classList.remove("hidden");

  messages.innerHTML = "";

  chat.messages.forEach(message => {
    renderMessage(
      message.role,
      message.content
    );
  });

  renderHistory();
  closeSidebar();
  scrollToBottom();
}

// =========================
// HISTORY
// =========================

function renderHistory() {
  historyList.innerHTML = "";

  chats.forEach(chat => {
    const item = document.createElement("button");

    item.className = "history-item";
    item.type = "button";
    item.textContent = chat.title;
    item.title = chat.title;

    if (chat.id === currentChatId) {
      item.classList.add("active");
    }

    item.addEventListener("click", () => {
      openChat(chat.id);
    });

    historyList.appendChild(item);
  });
}

// =========================
// MARKDOWN
// =========================

function renderMarkdown(content) {
  if (!window.marked || !window.DOMPurify) {
    return null;
  }

  try {
    const html = window.marked.parse(content);

    return window.DOMPurify.sanitize(html);
  } catch (error) {
    console.error("Markdown rendering error:", error);
    return null;
  }
}

// =========================
// MESSAGE RENDER
// =========================

function renderMessage(role, content) {
  const wrapper = document.createElement("div");

  const normalizedRole =
    role === "user" ? "user" : "ai";

  wrapper.className = `message ${normalizedRole}`;

  const label = document.createElement("div");
  label.className = "message-label";

  if (normalizedRole === "user") {
    label.textContent = "You";
  } else {
    label.innerHTML =
      '<span class="ai-label-icon">✳</span> Yati';
  }

  const body = document.createElement("div");
  body.className = "message-content";

  if (normalizedRole === "ai") {
    const rendered = renderMarkdown(content);

    if (rendered !== null) {
      body.innerHTML = rendered;
    } else {
      body.textContent = content;
    }
  } else {
    body.textContent = content;
  }

  wrapper.appendChild(label);
  wrapper.appendChild(body);

  messages.appendChild(wrapper);

  scrollToBottom();

  return wrapper;
}

// =========================
// TYPING INDICATOR
// =========================

function showTyping() {
  const wrapper = document.createElement("div");

  wrapper.className = "message ai";
  wrapper.id = "typingIndicator";

  wrapper.innerHTML = `
    <div class="message-label">
      <span class="ai-label-icon">✳</span> Yati
    </div>

    <div class="typing">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

  messages.appendChild(wrapper);

  scrollToBottom();
}

function removeTyping() {
  document.getElementById("typingIndicator")?.remove();
}

// =========================
// SCROLL
// =========================

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

// =========================
// INPUT RESIZE
// =========================

function resizeInput() {
  input.style.height = "auto";

  input.style.height =
    Math.min(input.scrollHeight, 180) + "px";
}

// =========================
// INPUT EVENTS
// =========================

input.addEventListener("input", () => {
  resizeInput();

  sendBtn.disabled =
    !input.value.trim() || isLoading;
});

input.addEventListener("keydown", event => {
  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {
    event.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener("click", () => {
  sendMessage();
});

// =========================
// API REQUEST
// =========================

async function requestYati(messagesToSend) {
  const controller = new AbortController();

  let timeoutTriggered = false;

  const timeoutId = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, REQUEST_TIMEOUT);

  try {
    console.log("Yati request started:", {
      url: API_URL,
      origin: window.location.origin,
      timestamp: new Date().toISOString()
    });

    const response = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        messages: messagesToSend
      }),

      signal: controller.signal
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        error: responseText || "Server returned an empty response."
      };
    }

    console.log("Yati response received:", {
      status: response.status,
      ok: response.ok
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${
          data.error || data.message || responseText || "Request failed"
        }`
      );
    }

    if (!data.reply) {
      throw new Error(
        data.error || "AI tidak memberikan jawaban."
      );
    }

    return data;

  } catch (error) {
    if (timeoutTriggered) {
      throw new Error(
        `Request timeout setelah ${REQUEST_TIMEOUT / 1000} detik.`
      );
    }

    if (error.name === "AbortError") {
      throw new Error(
        "Request dibatalkan oleh browser."
      );
    }

    // Fetch TypeError is often a network, TLS,
    // CORS, DNS, or browser-level failure.
    if (error.name === "TypeError") {
      throw new Error(
        `Fetch gagal: ${error.message}. Kemungkinan koneksi, SSL/TLS, DNS, atau CORS.`
      );
    }

    throw error;

  } finally {
    clearTimeout(timeoutId);
  }
}

// =========================
// SEND MESSAGE
// =========================

async function sendMessage(customPrompt = null) {
  if (isLoading) return;

  const text = (
    customPrompt ?? input.value
  ).trim();

  if (!text) return;

  if (
    API_URL.includes("YOUR_CLOUDFLARE") ||
    !API_URL.startsWith("https://")
  ) {
    alert("URL backend belum dikonfigurasi.");
    return;
  }

  isLoading = true;
  sendBtn.disabled = true;

  input.value = "";
  resizeInput();

  welcome.classList.add("hidden");
  chatArea.classList.remove("hidden");

  // Get or create chat
  let chat = getCurrentChat();

  if (!chat) {
    chat = createChat(text);
  }

  // Save user message
  const userMessage = {
    role: "user",
    content: text
  };

  chat.messages.push(userMessage);

  saveChats();

  renderMessage("user", text);

  showTyping();

  try {
    const data = await requestYati(chat.messages);

    removeTyping();

    const assistantMessage = {
      role: "assistant",
      content: data.reply
    };

    chat.messages.push(assistantMessage);

    saveChats();

    renderMessage(
      "assistant",
      data.reply
    );

  } catch (error) {
    removeTyping();

    const errorName = error?.name || "UnknownError";
    const errorMessage =
      error?.message || String(error);

    console.error("Yati diagnostic error:", {
      name: errorName,
      message: errorMessage,
      endpoint: API_URL,
      origin: window.location.origin,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });

    renderMessage(
      "assistant",
      `⚠️ **Yati mengalami kendala koneksi**

**Jenis error:** \`${errorName}\`

**Detail:** \`${errorMessage}\`

**Endpoint:** \`${API_URL}\`

Silakan coba kembali. Jika error berlanjut, kirim screenshot pesan ini kepada pengembang Yati.`
    );

  } finally {
    isLoading = false;

    sendBtn.disabled =
      !input.value.trim();

    input.focus();
  }
}

// =========================
// QUICK PROMPTS
// =========================

document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    const prompt = button.dataset.prompt;

    sendMessage(prompt);
  });
});

// =========================
// NEW CHAT
// =========================

document
  .getElementById("newChat")
  .addEventListener("click", newChat);

// =========================
// SIDEBAR
// =========================

document
  .getElementById("menuBtn")
  .addEventListener("click", openSidebar);

document
  .getElementById("closeSidebar")
  .addEventListener("click", closeSidebar);

overlay.addEventListener("click", closeSidebar);

function openSidebar() {
  sidebar.classList.add("open");
  overlay.classList.add("show");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
}

// =========================
// LEARNING CENTER
// =========================

document
  .getElementById("learningBtn")
  .addEventListener("click", () => {
    sendMessage(
      "Buatkan aku daftar materi belajar akuntansi dari pemula hingga mahir, susun menjadi kurikulum bertahap."
    );
  });

// =========================
// INITIALIZATION
// =========================

renderHistory();

console.log("Yati Accounting AI initialized.");
console.log("Frontend origin:", window.location.origin);
console.log("API endpoint:", API_URL);
