(function () {
  "use strict";

  var STORAGE_KEY = "futureMe.messages";
  var THEME_KEY = "futureMe.theme";

  var QUOTES = [
    { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
    { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
    { text: "Your present circumstances don't determine where you can go; they merely determine where you start.", author: "Nido Qubein" },
    { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
    { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
    { text: "The only limit to our realization of tomorrow is our doubts of today.", author: "Franklin D. Roosevelt" }
  ];

  // ---- Elements ----
  var form = document.getElementById("messageForm");
  var nameInput = document.getElementById("name");
  var messageInput = document.getElementById("message");
  var dateInput = document.getElementById("unlockDate");
  var formError = document.getElementById("formError");
  var listEl = document.getElementById("messageList");
  var emptyState = document.getElementById("emptyState");
  var countEl = document.getElementById("messageCount");
  var themeToggle = document.getElementById("themeToggle");
  var themeIcon = themeToggle.querySelector(".theme-icon");
  var quoteText = document.getElementById("quoteText");
  var quoteAuthor = document.getElementById("quoteAuthor");

  var tickHandle = null;

  // ---- Storage helpers ----
  function loadMessages() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveMessages(messages) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      /* storage full or unavailable — ignore */
    }
  }

  // ---- Theme ----
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
  }

  function initTheme() {
    var stored;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch (e) {}
    if (!stored) {
      stored =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }
    applyTheme(stored);
  }

  themeToggle.addEventListener("click", function () {
    var current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  // ---- Quotes ----
  function showRandomQuote() {
    var q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    quoteText.textContent = "“" + q.text + "”";
    quoteAuthor.textContent = "— " + q.author;
  }

  // ---- Date / countdown formatting ----
  function formatDate(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function formatRemaining(ms) {
    if (ms <= 0) return "Unlocked";
    var totalSeconds = Math.floor(ms / 1000);
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    var parts = [];
    if (days > 0) parts.push(days + (days === 1 ? " day" : " days"));
    parts.push(pad(hours) + "h");
    parts.push(pad(minutes) + "m");
    parts.push(pad(seconds) + "s");
    return parts.join(" ");
  }

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  // ---- Rendering ----
  function render() {
    var messages = loadMessages().slice().sort(function (a, b) {
      return a.unlockAt - b.unlockAt;
    });

    countEl.textContent = messages.length;
    listEl.innerHTML = "";

    if (messages.length === 0) {
      emptyState.style.display = "";
      return;
    }
    emptyState.style.display = "none";

    messages.forEach(function (msg) {
      listEl.appendChild(buildCard(msg));
    });

    updateCountdowns();
  }

  function buildCard(msg) {
    var now = Date.now();
    var unlocked = now >= msg.unlockAt;

    var li = document.createElement("li");
    li.className = "message-card" + (unlocked ? " unlocked" : "");
    li.dataset.id = msg.id;
    li.dataset.createdAt = msg.createdAt;
    li.dataset.unlockAt = msg.unlockAt;

    var top = document.createElement("div");
    top.className = "card-top";
    var who = document.createElement("span");
    who.className = "who";
    who.textContent = "To " + msg.name;
    var when = document.createElement("span");
    when.className = "when";
    when.textContent = formatDate(msg.unlockAt);
    top.appendChild(who);
    top.appendChild(when);
    li.appendChild(top);

    if (unlocked) {
      var badge = document.createElement("span");
      badge.className = "badge-unlocked";
      badge.textContent = "Unlocked";
      li.appendChild(badge);

      var body = document.createElement("p");
      body.className = "revealed-body reveal";
      body.textContent = msg.message;
      li.appendChild(body);
    } else {
      var countdown = document.createElement("p");
      countdown.className = "countdown";
      countdown.innerHTML = "Unlocks in <strong>--</strong>";
      li.appendChild(countdown);

      var progress = document.createElement("div");
      progress.className = "progress";
      var bar = document.createElement("div");
      bar.className = "progress-bar";
      progress.appendChild(bar);
      li.appendChild(progress);

      var locked = document.createElement("p");
      locked.className = "locked-body";
      locked.textContent = "🔒 Sealed until the reveal date.";
      li.appendChild(locked);
    }

    var del = document.createElement("button");
    del.className = "delete-btn";
    del.type = "button";
    del.textContent = "Delete";
    del.addEventListener("click", function () {
      deleteMessage(msg.id);
    });
    li.appendChild(del);

    return li;
  }

  function updateCountdowns() {
    var now = Date.now();
    var cards = listEl.querySelectorAll(".message-card");
    var needsRerender = false;

    cards.forEach(function (card) {
      var unlockAt = Number(card.dataset.unlockAt);
      var createdAt = Number(card.dataset.createdAt);
      var wasUnlocked = card.classList.contains("unlocked");
      var isUnlocked = now >= unlockAt;

      if (isUnlocked && !wasUnlocked) {
        needsRerender = true;
        return;
      }

      if (!isUnlocked) {
        var remaining = unlockAt - now;
        var strong = card.querySelector(".countdown strong");
        if (strong) strong.textContent = formatRemaining(remaining);

        var span = unlockAt - createdAt;
        var pct = span > 0 ? Math.min(100, Math.max(0, ((now - createdAt) / span) * 100)) : 0;
        var bar = card.querySelector(".progress-bar");
        if (bar) bar.style.width = pct.toFixed(1) + "%";
      }
    });

    if (needsRerender) render();
  }

  // ---- Actions ----
  function addMessage(data) {
    var messages = loadMessages();
    messages.push(data);
    saveMessages(messages);
    render();
  }

  function deleteMessage(id) {
    var messages = loadMessages().filter(function (m) {
      return m.id !== id;
    });
    saveMessages(messages);
    render();
  }

  function startOfDay(dateStr) {
    // dateStr is "YYYY-MM-DD" from <input type=date>; unlock at local midnight
    var parts = dateStr.split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
    return d.getTime();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formError.textContent = "";

    var name = nameInput.value.trim();
    var message = messageInput.value.trim();
    var dateStr = dateInput.value;

    if (!name) {
      formError.textContent = "Please enter your name.";
      return;
    }
    if (!message) {
      formError.textContent = "Please write a message to your future self.";
      return;
    }
    if (!dateStr) {
      formError.textContent = "Please choose a reveal date.";
      return;
    }

    var unlockAt = startOfDay(dateStr);
    var todayStart = startOfDay(new Date().toISOString().slice(0, 10));
    if (unlockAt <= todayStart) {
      formError.textContent = "Pick a date in the future — at least tomorrow.";
      return;
    }

    addMessage({
      id: "m_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      name: name,
      message: message,
      createdAt: Date.now(),
      unlockAt: unlockAt
    });

    form.reset();
    showRandomQuote();
  });

  // ---- Init ----
  function setMinDate() {
    var t = new Date();
    t.setDate(t.getDate() + 1);
    dateInput.min = t.toISOString().slice(0, 10);
  }

  initTheme();
  setMinDate();
  showRandomQuote();
  render();

  tickHandle = setInterval(updateCountdowns, 1000);

  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) render();
  });
})();
