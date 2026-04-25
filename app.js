"use strict";
(() => {
  // src/utils/fetch.ts
  async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6e4);
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error;
        if (error.name === "AbortError" || attempt === maxRetries) {
          throw error;
        }
        const delay = Math.pow(2, attempt) * 1e3;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // src/utils/dom.ts
  function qs(sel, root2 = document) {
    return root2.querySelector(sel);
  }
  function qsa(sel, root2 = document) {
    return Array.from(root2.querySelectorAll(sel));
  }
  function on(el, ev, fn, opts) {
    el.addEventListener(ev, fn, opts);
  }
  function showLoader(onFlag) {
    const loader = qs("#loader");
    if (loader) {
      loader.classList.toggle("hidden", !onFlag);
    }
  }
  function ensureObscureOverlay() {
    let ov = document.getElementById("app-obscure-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "app-obscure-overlay";
      ov.className = "app-obscure-overlay hidden";
      document.body.appendChild(ov);
    }
    return ov;
  }
  function setPasswordMode(active, opts = { hide: false }) {
    const menubar = qs("#menubar");
    const main = qs("#main-content-outter");
    const html = document.documentElement;
    const ov = ensureObscureOverlay();
    if (active) {
      html.classList.add("password-mode");
      ov.classList.remove("hidden");
      if (opts.hide) {
        menubar?.classList.add("app-hidden");
        main?.classList.add("app-hidden");
        menubar?.classList.remove("app-masked");
        main?.classList.remove("app-masked");
      } else {
        menubar?.classList.add("app-masked");
        main?.classList.add("app-masked");
        menubar?.classList.remove("app-hidden");
        main?.classList.remove("app-hidden");
      }
    } else {
      html.classList.remove("password-mode");
      ov.classList.add("hidden");
      menubar?.classList.remove("app-masked", "app-hidden");
      main?.classList.remove("app-masked", "app-hidden");
    }
  }
  var showHint = (sel) => {
    qs(sel)?.classList.remove("hidden");
  };
  var hideHint = (sel) => {
    qs(sel)?.classList.add("hidden");
  };

  // src/ui/toast.ts
  var TOAST_ICONS = {
    success: "OK",
    error: "X",
    warning: "!",
    info: "i"
  };
  function toast(message, type = "info", duration = 4e3) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toastEl = document.createElement("div");
    toastEl.className = `toast ${type}`;
    const content = document.createElement("div");
    content.className = "toast-content";
    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = TOAST_ICONS[type];
    const text = document.createElement("span");
    text.className = "toast-message";
    text.textContent = message;
    const closeButton = document.createElement("button");
    closeButton.className = "toast-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Dismiss notification");
    closeButton.textContent = String.fromCharCode(215);
    content.append(icon, text, closeButton);
    toastEl.appendChild(content);
    const dismiss = () => {
      if (toastEl.classList.contains("toast--leaving")) return;
      toastEl.classList.add("toast--leaving");
      setTimeout(() => toastEl.remove(), 180);
    };
    closeButton?.addEventListener("click", dismiss);
    container.appendChild(toastEl);
    setTimeout(dismiss, duration);
  }

  // src/ui/dialogs.ts
  var openPasswordDialog = ({
    onOk,
    obscure = true,
    hideUI = false
  }) => {
    const dlg = qs("#dialog-password");
    const input = qs("#enterpassword");
    dlg.returnValue = "cancel";
    input.value = "";
    if (obscure) setPasswordMode(true, { hide: hideUI });
    dlg.dataset.lockClose = "true";
    dlg.showModal();
    queueMicrotask(() => input.focus());
    const btnOk = dlg.querySelector("button[value='ok']");
    const handleLockedCancel = (event) => {
      event.preventDefault();
      input.focus();
    };
    const handleEnterKey = (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (!btnOk.disabled) {
        void handleOk(event);
      }
    };
    const handleOk = async (ev) => {
      ev?.preventDefault?.();
      btnOk.disabled = true;
      try {
        const success = await onOk(input.value);
        if (success) {
          dlg.close("ok");
          setPasswordMode(false);
        } else {
          toast("Incorrect password.", "error");
          input.select();
          input.focus();
          return;
        }
      } finally {
        btnOk.disabled = false;
      }
    };
    btnOk.addEventListener("click", handleOk, { once: false });
    input.addEventListener("keydown", handleEnterKey);
    dlg.addEventListener("cancel", handleLockedCancel);
    const cleanup = () => {
      btnOk.removeEventListener("click", handleOk);
      input.removeEventListener("keydown", handleEnterKey);
      dlg.removeEventListener("cancel", handleLockedCancel);
      dlg.removeEventListener("close", cleanup);
      delete dlg.dataset.lockClose;
    };
    dlg.addEventListener("close", cleanup);
  };
  var openDeletePasswordDialog = ({ onOk }) => {
    const dlg = qs("#dialog-delete-password");
    const input = qs("#deletepassword");
    dlg.returnValue = "cancel";
    input.value = "";
    dlg.showModal();
    queueMicrotask(() => input.focus());
    const btnOk = dlg.querySelector("button[value='ok']");
    const handleEnterKey = (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (!btnOk.disabled) {
        void handleOk(event);
      }
    };
    const handleOk = async (ev) => {
      ev?.preventDefault?.();
      btnOk.disabled = true;
      try {
        const success = await onOk(input.value);
        if (success) {
          dlg.close("ok");
        } else {
          toast("Incorrect password.", "error");
          input.select();
          input.focus();
          return;
        }
      } finally {
        btnOk.disabled = false;
      }
    };
    btnOk.addEventListener("click", handleOk, { once: false });
    input.addEventListener("keydown", handleEnterKey);
    const cleanup = () => {
      btnOk.removeEventListener("click", handleOk);
      input.removeEventListener("keydown", handleEnterKey);
      dlg.removeEventListener("close", cleanup);
    };
    dlg.addEventListener("close", cleanup);
  };
  var openNewPasswordDialog = ({ title, onSave }) => {
    const dlg = qs("#dialog-new-password");
    const titleEl = qs("#dialog-new-password-title");
    const p1 = qs("#newpassword1");
    const p2 = qs("#newpassword2");
    const btnOk = dlg.querySelector("button[value='ok']");
    titleEl.textContent = title || "Create password";
    hideHint("#passwords-empty");
    hideHint("#passwords-dont-match");
    dlg.returnValue = "cancel";
    p1.value = "";
    p2.value = "";
    dlg.showModal();
    queueMicrotask(() => p1.focus());
    const handleEnterKey = (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (!btnOk.disabled) {
        void handleOk(event);
      }
    };
    const handleOk = async (ev) => {
      ev?.preventDefault?.();
      btnOk.disabled = true;
      try {
        const proceed = await onSave(p1.value, p2.value);
        if (proceed) {
          dlg.close("ok");
        }
      } finally {
        btnOk.disabled = false;
      }
    };
    btnOk.addEventListener("click", handleOk, { once: false });
    p1.addEventListener("keydown", handleEnterKey);
    p2.addEventListener("keydown", handleEnterKey);
    const cleanup = () => {
      btnOk.removeEventListener("click", handleOk);
      p1.removeEventListener("keydown", handleEnterKey);
      p2.removeEventListener("keydown", handleEnterKey);
      dlg.removeEventListener("close", cleanup);
    };
    dlg.addEventListener("close", cleanup);
  };
  var openConfirmDialog = (selector, cb) => {
    const dlg = qs(selector);
    dlg.returnValue = "cancel";
    dlg.showModal();
    const handler = () => {
      dlg.removeEventListener("close", handler);
      cb(dlg.returnValue === "ok");
    };
    dlg.addEventListener("close", handler);
  };

  // src/ui/themes.ts
  var STORAGE_KEY = "theme-preference";
  var root = document.documentElement;
  function getSystemPref() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function getStored() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
  function store(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
    }
  }
  function applyTheme(theme) {
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(theme === "light" ? "theme-light" : "theme-dark");
    updateToggle(theme);
  }
  function currentTheme() {
    const stored = getStored();
    if (stored === "dark" || stored === "light") return stored;
    if (root.classList.contains("theme-light")) return "light";
    if (root.classList.contains("theme-dark")) return "dark";
    return getSystemPref();
  }
  function updateToggle(theme) {
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    const label = button.querySelector(".label");
    const isDark = theme === "dark";
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
    if (label) {
      label.textContent = isDark ? "Dark" : "Light";
    }
  }
  function initTheme() {
    const initial = getStored() || "light";
    applyTheme(initial);
  }
  function wireThemeToggle() {
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    button.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      store(next);
    });
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => {
      if (getStored()) return;
      applyTheme(getSystemPref());
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else if ("addListener" in mediaQuery) {
      mediaQuery.addListener(handleChange);
    }
  }

  // src/utils/crypto-helpers.ts
  var textEncoder = new TextEncoder();
  var textDecoder = new TextDecoder();
  async function sha512Hex(input) {
    const data = typeof input === "string" ? textEncoder.encode(input) : input;
    const buf = await crypto.subtle.digest("SHA-512", data);
    return bufToHex(buf);
  }
  function bufToHex(buf) {
    const arr = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < arr.length; i++) {
      const byte = arr[i];
      s += byte !== void 0 ? byte.toString(16).padStart(2, "0") : "";
    }
    return s;
  }
  function hexToBuf(hex) {
    const len = hex.length / 2;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out.buffer;
  }
  function randomHex(bytes = 12) {
    const b = new Uint8Array(bytes);
    crypto.getRandomValues(b);
    return bufToHex(b.buffer);
  }
  var separatorHexCache = null;
  async function getSeparatorHex() {
    if (!separatorHexCache) {
      separatorHexCache = await sha512Hex("-- tab separator --");
    }
    return separatorHexCache;
  }
  function simpleWeakHash(str) {
    let h1 = 2166136261;
    let h2 = 16777619;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 16777619);
      h2 += c + (h2 << 1) + (h2 << 4) + (h2 << 7) + (h2 << 8) + (h2 << 24);
    }
    return (Math.abs(h1) + Math.abs(h2)).toString(16);
  }

  // src/ui/tabs.ts
  var tabCounter = 1;
  var currentTabTitle = null;
  var currentTextarea = null;
  var TAB_COLOR_METADATA_PREFIX = "__CRYPTEXA_COLOR__:";
  var DEFAULT_TAB_MARK_COLOR = "#d15f38";
  var MOBILE_METADATA_HINT = "Reload this website to hide mobile app metadata!";
  function getCurrentTabTitle() {
    return currentTabTitle;
  }
  function normalizeTabColor(color) {
    if (!color) return null;
    const normalized = color.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalized)) return null;
    return normalized === "#ffffff" ? null : normalized;
  }
  function hexToRgba(hex, alpha) {
    const normalized = normalizeTabColor(hex);
    const source = normalized || DEFAULT_TAB_MARK_COLOR;
    const r = parseInt(source.slice(1, 3), 16);
    const g = parseInt(source.slice(3, 5), 16);
    const b = parseInt(source.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  function parseTabPayload(content) {
    if (!content.startsWith(TAB_COLOR_METADATA_PREFIX)) {
      return { color: null, content };
    }
    const lineEndIndex = content.indexOf("\n");
    const colorLine = lineEndIndex === -1 ? content : content.substring(0, lineEndIndex);
    const color = normalizeTabColor(colorLine.substring(TAB_COLOR_METADATA_PREFIX.length));
    const cleanContent = lineEndIndex === -1 ? "" : content.substring(lineEndIndex + 1);
    return {
      color,
      content: cleanContent
    };
  }
  function applyTabColor(header, color) {
    const normalizedColor = normalizeTabColor(color);
    if (!normalizedColor) {
      header.removeAttribute("data-tab-color");
      header.classList.remove("has-mark");
      header.style.removeProperty("--tab-mark");
      header.style.removeProperty("--tab-mark-soft");
      return;
    }
    header.dataset.tabColor = normalizedColor;
    header.classList.add("has-mark");
    header.style.setProperty("--tab-mark", normalizedColor);
    header.style.setProperty("--tab-mark-soft", hexToRgba(normalizedColor, 0.14));
  }
  function syncTabColorControls() {
    const activeHeader = qs(".tab-header.active");
    const colorPicker = qs("#tab-color-picker");
    const clearButton = qs("#clear-tab-color");
    const markControl = qs(".tab-mark-control");
    const activeColor = normalizeTabColor(activeHeader?.dataset.tabColor);
    if (colorPicker) {
      colorPicker.value = activeColor || DEFAULT_TAB_MARK_COLOR;
    }
    if (clearButton) {
      clearButton.disabled = !activeColor;
    }
    if (markControl) {
      markControl.classList.toggle("is-marked", Boolean(activeColor));
    }
  }
  function updateGutterForTextarea(ta, gutter) {
    if (!ta || !gutter) return;
    const value = ta.value || "";
    const base = value.split("\n").length;
    const count = Math.max(1, base + (value.endsWith("\n") ? 1 : 0));
    let out = "1";
    for (let i = 2; i <= count; i++) out += "\n" + i;
    gutter.setAttribute("data-lines", out);
    const y = Math.round(ta.scrollTop || 0);
    gutter.style.setProperty("--gutter-scroll-y", String(-y));
    gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
    gutter.style.removeProperty("top");
    gutter.style.transform = "translateZ(0)";
  }
  function getLineNumberFromPosition(text, position) {
    if (position < 0) return 1;
    const textUpToPosition = text.substring(0, position);
    return textUpToPosition.split("\n").length;
  }
  function getLineHeight(ta) {
    const computedStyle = window.getComputedStyle(ta);
    return parseInt(computedStyle.lineHeight) || parseInt(computedStyle.fontSize) * 1.2;
  }
  function updateActiveLineHighlight(ta, editorWrap) {
    const existingHighlights = editorWrap.querySelectorAll(".active-line");
    existingHighlights.forEach((el) => el.remove());
    const cursorPos = ta.selectionStart;
    const text = ta.value;
    const lineNumber = getLineNumberFromPosition(text, cursorPos);
    const highlight = document.createElement("div");
    highlight.className = "active-line";
    const lineHeight = getLineHeight(ta);
    const top = (lineNumber - 1) * lineHeight + parseInt(window.getComputedStyle(ta).paddingTop);
    highlight.style.top = `${top}px`;
    highlight.style.height = `${lineHeight}px`;
    editorWrap.appendChild(highlight);
  }
  function updateSelectedLinesHighlight(ta, editorWrap) {
    const existingHighlights = editorWrap.querySelectorAll(".selected-line");
    existingHighlights.forEach((el) => el.remove());
    const selectionStart = ta.selectionStart;
    const selectionEnd = ta.selectionEnd;
    if (selectionStart === selectionEnd) return;
    const text = ta.value;
    const startLine = getLineNumberFromPosition(text, selectionStart);
    const endLine = getLineNumberFromPosition(text, selectionEnd);
    const lineHeight = getLineHeight(ta);
    const paddingTop = parseInt(window.getComputedStyle(ta).paddingTop);
    for (let i = startLine; i <= endLine; i++) {
      const highlight = document.createElement("div");
      highlight.className = "selected-line";
      const top = (i - 1) * lineHeight + paddingTop;
      highlight.style.top = `${top}px`;
      highlight.style.height = `${lineHeight}px`;
      editorWrap.appendChild(highlight);
    }
  }
  function getTabButton(header) {
    return header.querySelector('[role="tab"]');
  }
  function activateTab(headerLi) {
    const headers = qsa(".tab-header");
    const panels = qsa(".tab-panel");
    const id = headerLi.dataset.tabId;
    const panel = id ? qs(`#${id}`) : null;
    headers.forEach((h) => {
      h.classList.remove("active");
      const tabButton = getTabButton(h);
      tabButton?.setAttribute("aria-selected", "false");
      tabButton?.setAttribute("tabindex", "-1");
    });
    panels.forEach((p) => {
      p.classList.remove("active");
      if (p instanceof HTMLElement) p.hidden = true;
    });
    headerLi.classList.add("active");
    const activeTabButton = getTabButton(headerLi);
    activeTabButton?.setAttribute("aria-selected", "true");
    activeTabButton?.setAttribute("tabindex", "0");
    if (panel) {
      panel.classList.add("active");
      if (panel instanceof HTMLElement) panel.hidden = false;
    }
    syncTabColorControls();
    focusActiveTextarea();
    const ta = panel?.querySelector("textarea.textarea-contents");
    const gutter = panel?.querySelector(".line-gutter");
    if (!ta || !gutter) return;
    const y = Math.round(ta.scrollTop || 0);
    gutter.style.setProperty("--gutter-scroll-y", String(-y));
    gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
    gutter.style.removeProperty("top");
    gutter.style.transform = "translateZ(0)";
    const needsHeavyUpdate = ta.value.length > 5e4;
    if (needsHeavyUpdate) {
      setTimeout(() => updateGutterForTextarea(ta, gutter), 0);
      return;
    }
    updateGutterForTextarea(ta, gutter);
  }
  function getTitleFromContent(content) {
    let effectiveContent;
    if (content === void 0 && currentTextarea) {
      effectiveContent = currentTextarea.value.substring(0, 200);
    } else {
      effectiveContent = (content || "").substring(0, 200);
    }
    if (!effectiveContent) return "Empty Tab";
    let start = 0;
    while (start < effectiveContent.length) {
      const ch = effectiveContent[start];
      if (ch !== " " && ch !== "\n" && ch !== "	" && ch !== "\r" && ch !== "\v" && ch !== "\f") break;
      start++;
    }
    if (start >= effectiveContent.length) return "Empty Tab";
    const nlRel = effectiveContent.indexOf("\n", start);
    const end = nlRel === -1 ? effectiveContent.length : nlRel;
    let title = effectiveContent.substring(start, end);
    if (!title || title.length === 0) return "Empty Tab";
    if (title.length > 20) title = title.substr(0, 18) + "...";
    return title;
  }
  function focusActiveTextarea() {
    currentTabTitle = qs(".tab-header.active .tab-title");
    const panel = qs(".tab-panel.active");
    currentTextarea = panel ? panel.querySelector("textarea.textarea-contents") : null;
    currentTextarea?.focus();
  }
  function addTab(isExistingTab, contentIfAvailable = "", insertAfter = null, onModified = null) {
    const headersContainer = qs(".tab-headers-container");
    const id = `tab-${tabCounter++}`;
    const parsedPayload = parseTabPayload(contentIfAvailable);
    const actualContent = parsedPayload.content;
    const li = document.createElement("div");
    li.className = "tab-header";
    li.dataset.tabId = id;
    li.draggable = true;
    applyTabColor(li, parsedPayload.color);
    const a = document.createElement("button");
    a.type = "button";
    a.id = `tab-button-${id}`;
    a.className = "tab-title";
    a.setAttribute("role", "tab");
    a.setAttribute("aria-selected", "false");
    a.setAttribute("aria-controls", id);
    a.setAttribute("tabindex", "-1");
    a.textContent = "Empty Tab";
    const span = document.createElement("span");
    span.className = "close";
    span.title = "Double-click to close tab";
    span.textContent = String.fromCharCode(215);
    li.appendChild(a);
    li.appendChild(span);
    if (insertAfter && insertAfter.nextSibling) {
      headersContainer.insertBefore(li, insertAfter.nextSibling);
    } else {
      headersContainer.appendChild(li);
    }
    const panel = document.createElement("div");
    panel.id = id;
    panel.className = "tab-panel";
    panel.hidden = true;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", a.id);
    panel.innerHTML = `
    <div class="editor-wrap">
      <div class="line-gutter" aria-hidden="true"></div>
      <textarea rows="1" cols="1" class="textarea-contents" placeholder="Write here..." aria-label="Note contents"></textarea>
    </div>`;
    qs("#tabs").appendChild(panel);
    const ta = panel.querySelector("textarea.textarea-contents");
    const gutter = panel.querySelector(".line-gutter");
    const updateGutter = () => {
      updateGutterForTextarea(ta, gutter);
    };
    if (actualContent && actualContent.length > 0) {
      ta.value = actualContent;
      a.textContent = getTitleFromContent(actualContent.substring(0, 200));
    } else {
      a.textContent = getTitleFromContent("");
    }
    let rafId = 0;
    ta.addEventListener("input", () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        updateGutter();
      });
    });
    let lastScrollTs = 0;
    ta.addEventListener("scroll", () => {
      const now = performance.now ? performance.now() : Date.now();
      const isHuge2 = ta.value && ta.value.length > 5e4;
      if (isHuge2 && now - lastScrollTs < 16) return;
      lastScrollTs = now;
      const y = Math.round(ta.scrollTop || 0);
      gutter.style.setProperty("--gutter-scroll-y", String(-y));
      gutter.style.removeProperty("top");
      gutter.style.transform = "translateZ(0)";
      gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
    });
    const isHuge = ta.value && ta.value.length > 5e4;
    if (isHuge) {
      setTimeout(updateGutter, 0);
    } else {
      requestAnimationFrame(updateGutter);
    }
    const editorWrap = panel.querySelector(".editor-wrap");
    if (editorWrap) {
      setTimeout(() => {
        updateActiveLineHighlight(ta, editorWrap);
        updateSelectedLinesHighlight(ta, editorWrap);
      }, 0);
    }
    refreshTabs();
    onWindowResize();
    activateTab(li);
    if (!isExistingTab && onModified) {
      onModified(true);
    }
    return li;
  }
  function refreshTabs() {
    const headers = qsa(".tab-header");
    headers.forEach((h) => {
      const closer = h.querySelector(".close");
      if (!closer) return;
      const shouldShow = headers.length > 1 && !h.classList.contains("pinned");
      closer.style.display = shouldShow ? "" : "none";
    });
    syncTabColorControls();
    focusActiveTextarea();
  }
  function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll(".tab-header:not([style*='opacity'])")];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
  function initTabDragAndDrop(onModified = null) {
    let draggedTab = null;
    let draggedPanel = null;
    const container = qs(".tab-headers-container");
    container.addEventListener("dragstart", (e) => {
      const event = e;
      const tabHeader = event.target.closest(".tab-header");
      if (!tabHeader) return;
      draggedTab = tabHeader;
      draggedPanel = qs(`#${tabHeader.dataset.tabId}`);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/html", tabHeader.outerHTML);
      }
      setTimeout(() => {
        tabHeader.style.opacity = "0.5";
      }, 0);
    });
    container.addEventListener("dragend", (e) => {
      const tabHeader = e.target.closest(".tab-header");
      if (tabHeader) {
        tabHeader.style.opacity = "";
      }
      draggedTab = null;
      draggedPanel = null;
    });
    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      const event = e;
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      const afterElement = getDragAfterElement(container, event.clientX);
      const dragging = qs(".tab-header[style*='opacity']");
      if (!dragging) return;
      if (afterElement == null) {
        container.appendChild(dragging);
      } else {
        container.insertBefore(dragging, afterElement);
      }
    });
    container.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!draggedTab || !draggedPanel) return;
      const tabsContainer = qs("#tabs");
      const afterElement = getDragAfterElement(container, e.clientX);
      if (afterElement == null) {
        tabsContainer.appendChild(draggedPanel);
      } else {
        const afterPanelId = afterElement.dataset.tabId;
        const afterPanel = afterPanelId ? qs(`#${afterPanelId}`) : null;
        if (afterPanel) {
          tabsContainer.insertBefore(draggedPanel, afterPanel);
        }
      }
      if (onModified) onModified(true);
    });
  }
  function initTabsLayout(onModified = null) {
    const headersContainer = qs(".tab-headers-container");
    if (!headersContainer) return;
    on(headersContainer, "click", (e) => {
      const event = e;
      const li = event.target.closest(".tab-header");
      const close = event.target.closest(".close");
      if (close && li) {
        event.preventDefault();
        event.stopPropagation();
        activateTab(li);
        return;
      }
      if (li) activateTab(li);
    });
    on(headersContainer, "keydown", (e) => {
      const event = e;
      const tabButton = event.target.closest('[role="tab"]');
      if (!tabButton || !headersContainer.contains(tabButton)) return;
      const li = tabButton.closest(".tab-header");
      if (!li) return;
      const headers = qsa(".tab-header");
      const index = headers.indexOf(li);
      if (index === -1) return;
      let nextIndex = index;
      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % headers.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + headers.length) % headers.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = headers.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      const nextHeader = headers[nextIndex];
      if (!nextHeader) return;
      activateTab(nextHeader);
      getTabButton(nextHeader)?.focus();
    });
    on(headersContainer, "dblclick", (e) => {
      const event = e;
      const li = event.target.closest(".tab-header");
      const close = event.target.closest(".close");
      if (close && li) {
        const headers = qsa(".tab-header");
        if (headers.length <= 1) return;
        const idx = headers.indexOf(li);
        openConfirmDialog("#dialog-confirm-delete-tab", (ok) => {
          if (!ok) {
            focusActiveTextarea();
            return;
          }
          const tabId = li.dataset.tabId;
          li.remove();
          const panel = tabId ? qs(`#${tabId}`) : null;
          panel?.remove();
          const newHeaders = qsa(".tab-header");
          const toActivate = newHeaders[Math.max(0, idx - 1)];
          if (toActivate) activateTab(toActivate);
          if (onModified) onModified(true);
          refreshTabs();
        });
      }
    });
    const addTabBtn = qs("#add_tab");
    if (addTabBtn) {
      on(addTabBtn, "click", () => {
        const activeTab = qs(".tab-header.active");
        addTab(false, "", activeTab, onModified);
      });
    }
    const colorPicker = qs("#tab-color-picker");
    if (colorPicker) {
      on(colorPicker, "input", () => {
        const activeTab = qs(".tab-header.active");
        if (!activeTab) return;
        applyTabColor(activeTab, colorPicker.value);
        syncTabColorControls();
        if (onModified) onModified(true);
      });
    }
    const clearColorBtn = qs("#clear-tab-color");
    if (clearColorBtn) {
      on(clearColorBtn, "click", () => {
        const activeTab = qs(".tab-header.active");
        if (!activeTab) return;
        applyTabColor(activeTab, null);
        syncTabColorControls();
        if (onModified) onModified(true);
      });
    }
    initTabDragAndDrop(onModified);
    refreshTabs();
    onWindowResize();
    window.addEventListener("resize", onWindowResize);
  }
  function onWindowResize() {
    qsa(".tab-panel").forEach((panel) => {
      const ta = panel.querySelector("textarea.textarea-contents");
      const gutter = panel.querySelector(".line-gutter");
      if (ta && gutter) {
        const y = Math.round(ta.scrollTop || 0);
        gutter.style.setProperty("--gutter-scroll-y", String(-y));
        gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
        gutter.style.removeProperty("top");
        gutter.style.transform = "translateZ(0)";
      }
    });
  }
  async function setContentOfTabs(content, state2) {
    const sep = await getSeparatorHex();
    const parts = content ? content.split(sep) : [""];
    qsa(".tab-header").forEach((h) => h.remove());
    qsa(".tab-panel").forEach((p) => p.remove());
    tabCounter = 0;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? "";
      if (part.includes(MOBILE_METADATA_HINT)) {
        state2.setMobileAppMetadataTabContent(part);
      } else {
        addTab(true, part, null, () => state2.updateIsTextModified(true));
      }
    }
    if (qsa(".tab-header").length === 0) {
      addTab(true, "", null, () => state2.updateIsTextModified(true));
    }
    const first = qs(".tab-header");
    if (first) activateTab(first);
  }
  async function getContentFromTabs(state2) {
    const sep = await getSeparatorHex();
    let all = "";
    const headers = qsa(".tab-header");
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (!header) continue;
      const id = header.dataset.tabId;
      const ta = id ? qs(`#${id} textarea.textarea-contents`) : null;
      const tabColor = normalizeTabColor(header.dataset.tabColor);
      if (i > 0) all += sep;
      if (tabColor) {
        all += `${TAB_COLOR_METADATA_PREFIX}${tabColor}
`;
      }
      all += ta?.value || "";
    }
    const meta = state2.getMobileAppMetadataTabContent();
    if (typeof meta === "string" && meta.length > 0) {
      all += sep + meta;
    }
    return all;
  }

  // src/ui/search.ts
  var searchState = {
    isOpen: false,
    query: "",
    results: [],
    selectedIndex: -1
  };
  var searchDialog = null;
  var searchInput = null;
  var resultsContainer = null;
  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function highlightMatch(result) {
    const before = escapeHtml(result.lineContent.substring(0, result.matchStart));
    const match = escapeHtml(result.lineContent.substring(result.matchStart, result.matchEnd));
    const after = escapeHtml(result.lineContent.substring(result.matchEnd));
    const maxLen = 64;
    const head = before.length > maxLen / 2 ? `...${before.substring(before.length - maxLen / 2)}` : before;
    const tail = after.length > maxLen / 2 ? `${after.substring(0, maxLen / 2)}...` : after;
    return `${head}<mark>${match}</mark>${tail}`;
  }
  function searchAllTabs(query) {
    if (!query || query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    const results = [];
    for (const header of qsa(".tab-header")) {
      const tabId = header.dataset.tabId;
      if (!tabId) continue;
      const tabTitle = header.querySelector(".tab-title")?.textContent || "Untitled";
      const textarea = qs(`#${tabId} .textarea-contents`);
      if (!textarea) continue;
      const lines = textarea.value.split("\n");
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (!line) continue;
        const lowerLine = line.toLowerCase();
        let matchIndex = lowerLine.indexOf(lowerQuery);
        while (matchIndex !== -1) {
          results.push({
            tabId,
            tabTitle,
            lineNumber: lineIndex + 1,
            lineContent: line,
            matchStart: matchIndex,
            matchEnd: matchIndex + query.length
          });
          matchIndex = lowerLine.indexOf(lowerQuery, matchIndex + 1);
        }
      }
    }
    return results;
  }
  function renderResults() {
    if (!resultsContainer) return;
    if (searchState.results.length === 0) {
      if (searchState.query.length >= 2) {
        resultsContainer.innerHTML = `
                <div class="search-no-results">
                    <span>No matches for "${escapeHtml(searchState.query)}".</span>
                </div>
            `;
        return;
      }
      if (searchState.query.length > 0) {
        resultsContainer.innerHTML = `
                <div class="search-hint">Type at least 2 characters to search.</div>
            `;
        return;
      }
      resultsContainer.innerHTML = `
            <div class="search-hint">Search across all open tabs.</div>
        `;
      return;
    }
    resultsContainer.innerHTML = `
        <div class="search-results-header">
            ${searchState.results.length} result${searchState.results.length === 1 ? "" : "s"}
        </div>
        ${searchState.results.map((result, index) => `
            <div class="search-result${index === searchState.selectedIndex ? " selected" : ""}"
                 data-index="${index}"
                 data-tab-id="${result.tabId}"
                 data-line="${result.lineNumber}">
                <div class="search-result-header">
                    <span class="search-result-tab">${escapeHtml(result.tabTitle)}</span>
                    <span class="search-result-line">Line ${result.lineNumber}</span>
                </div>
                <div class="search-result-content">${highlightMatch(result)}</div>
            </div>
        `).join("")}
    `;
  }
  function scrollSelectedIntoView() {
    resultsContainer?.querySelector(".search-result.selected")?.scrollIntoView({
      block: "nearest",
      behavior: "smooth"
    });
  }
  function handleSearchInput() {
    if (!searchInput) return;
    searchState.query = searchInput.value;
    searchState.results = searchAllTabs(searchState.query);
    searchState.selectedIndex = searchState.results.length > 0 ? 0 : -1;
    renderResults();
  }
  function goToResult(result) {
    const tabHeader = qs(`.tab-header[data-tab-id="${result.tabId}"]`);
    if (!tabHeader) {
      closeSearch();
      return;
    }
    activateTab(tabHeader);
    setTimeout(() => {
      const textarea = qs(`#${result.tabId} .textarea-contents`);
      if (!textarea) return;
      const lines = textarea.value.split("\n");
      let charPosition = 0;
      for (let i = 0; i < result.lineNumber - 1; i++) {
        charPosition += (lines[i]?.length || 0) + 1;
      }
      charPosition += result.matchStart;
      textarea.focus();
      textarea.setSelectionRange(charPosition, charPosition + (result.matchEnd - result.matchStart));
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 24;
      textarea.scrollTop = Math.max(0, (result.lineNumber - 5) * lineHeight);
    }, 100);
    closeSearch();
  }
  function handleSearchKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (searchState.results.length === 0) return;
      searchState.selectedIndex = Math.min(searchState.selectedIndex + 1, searchState.results.length - 1);
      renderResults();
      scrollSelectedIntoView();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (searchState.results.length === 0) return;
      searchState.selectedIndex = Math.max(searchState.selectedIndex - 1, 0);
      renderResults();
      scrollSelectedIntoView();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = searchState.results[searchState.selectedIndex];
      if (selected) {
        goToResult(selected);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
    }
  }
  function handleResultClick(event) {
    const resultEl = event.target.closest(".search-result");
    if (!resultEl) return;
    const index = parseInt(resultEl.dataset.index || "-1", 10);
    if (index < 0) return;
    const result = searchState.results[index];
    if (result) {
      goToResult(result);
    }
  }
  function openSearch() {
    if (!searchDialog) initSearchDialog();
    searchState.isOpen = true;
    searchState.query = "";
    searchState.results = [];
    searchState.selectedIndex = -1;
    if (searchInput) {
      searchInput.value = "";
    }
    renderResults();
    searchDialog?.showModal();
    setTimeout(() => searchInput?.focus(), 30);
  }
  function closeSearch() {
    searchState.isOpen = false;
    searchDialog?.close();
  }
  function initSearchDialog() {
    searchDialog = qs("#search-dialog");
    if (searchDialog) {
      searchInput = qs("#search-input");
      resultsContainer = qs("#search-results");
      return;
    }
    const dialog = document.createElement("dialog");
    dialog.id = "search-dialog";
    dialog.className = "app-dialog search-dialog";
    dialog.setAttribute("aria-label", "Search open tabs");
    dialog.innerHTML = `
        <form method="dialog" class="search-shell">
            <div class="search-header">
                <div class="search-input-wrapper">
                    <input type="text"
                           id="search-input"
                           class="search-input"
                           aria-label="Search all open tabs"
                           placeholder="Search open tabs"
                           autocomplete="off"
                           spellcheck="false" />
                    <kbd class="search-kbd">Esc</kbd>
                </div>
            </div>
            <div id="search-results" class="search-results" aria-live="polite"></div>
            <div class="search-footer">
                <span>Arrow keys navigate</span>
                <span>Enter opens result</span>
            </div>
        </form>
    `;
    document.body.appendChild(dialog);
    searchDialog = dialog;
    searchInput = qs("#search-input");
    resultsContainer = qs("#search-results");
    if (searchInput) {
      on(searchInput, "input", handleSearchInput);
      on(searchInput, "keydown", handleSearchKeydown);
    }
    if (resultsContainer) {
      on(resultsContainer, "click", handleResultClick);
    }
    on(dialog, "click", (event) => {
      if (event.target === dialog) {
        closeSearch();
      }
    });
  }
  function initGlobalSearch() {
    initSearchDialog();
  }

  // src/ui/password-strength.ts
  function analyzePasswordStrength(password) {
    if (!password || password.length === 0) {
      return {
        level: "weak",
        score: 0,
        label: "Enter password",
        color: "var(--muted)",
        feedback: []
      };
    }
    let score = 0;
    const feedback = [];
    if (password.length >= 16) {
      score += 30;
    } else if (password.length >= 12) {
      score += 25;
    } else if (password.length >= 8) {
      score += 15;
    } else if (password.length >= 6) {
      score += 10;
    } else {
      feedback.push("Use at least 8 characters");
    }
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSymbols = /[!@#$%^&*()_+\-=[\]{}|;':",.<>?/`~\\]/.test(password);
    const hasSpaces = /\s/.test(password);
    if (hasLowercase) {
      score += 10;
    } else {
      feedback.push("Add lowercase letters");
    }
    if (hasUppercase) {
      score += 10;
    } else {
      feedback.push("Add uppercase letters");
    }
    if (hasNumbers) {
      score += 15;
    } else {
      feedback.push("Add numbers");
    }
    if (hasSymbols) {
      score += 20;
    } else {
      feedback.push("Add special characters (!@#$%...)");
    }
    if (hasSpaces && password.split(" ").length >= 3) {
      score += 5;
    }
    const commonPatterns = [
      /^12345/,
      /^password/i,
      /^qwerty/i,
      /^abc123/i,
      /(.)\1{3,}/,
      // Repeated characters (4+)
      /^[a-z]+$/i,
      // All letters only
      /^\d+$/
      // All numbers only
    ];
    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        score = Math.max(0, score - 20);
        if (!feedback.includes("Avoid common patterns")) {
          feedback.push("Avoid common patterns");
        }
      }
    }
    if (password.length >= 20 && hasSpaces) {
      score = Math.min(100, score + 10);
    }
    let level;
    let label;
    let color;
    if (score >= 85) {
      level = "very-strong";
      label = "Very Strong";
      color = "var(--accent)";
    } else if (score >= 70) {
      level = "strong";
      label = "Strong";
      color = "var(--success)";
    } else if (score >= 50) {
      level = "good";
      label = "Good";
      color = "var(--warning)";
    } else if (score >= 30) {
      level = "fair";
      label = "Fair";
      color = "var(--warning)";
    } else {
      level = "weak";
      label = "Weak";
      color = "var(--danger)";
    }
    return {
      level,
      score: Math.min(100, Math.max(0, score)),
      label,
      color,
      feedback: feedback.slice(0, 3)
      // Max 3 feedback items
    };
  }
  function createStrengthIndicator() {
    const container = document.createElement("div");
    container.className = "password-strength";
    container.innerHTML = `
        <div class="password-strength-bar">
            <div class="password-strength-fill"></div>
        </div>
        <div class="password-strength-info">
            <span class="password-strength-label"></span>
            <span class="password-strength-feedback"></span>
        </div>
    `;
    return container;
  }
  function updateStrengthIndicator(container, strength) {
    const fill = container.querySelector(".password-strength-fill");
    const label = container.querySelector(".password-strength-label");
    const feedback = container.querySelector(".password-strength-feedback");
    if (fill) {
      fill.style.width = `${strength.score}%`;
      fill.style.backgroundColor = strength.color;
      fill.setAttribute("data-level", strength.level);
    }
    if (label) {
      label.textContent = strength.label;
      label.style.color = strength.color;
    }
    if (feedback) {
      feedback.textContent = strength.feedback.join(" | ");
    }
  }
  function attachStrengthIndicator(inputSelector) {
    const input = qs(inputSelector);
    if (!input) return null;
    const existingIndicator = input.parentElement?.querySelector(".password-strength");
    if (existingIndicator) {
      return existingIndicator;
    }
    const indicator = createStrengthIndicator();
    input.parentNode?.insertBefore(indicator, input.nextSibling);
    input.addEventListener("input", () => {
      const strength = analyzePasswordStrength(input.value);
      updateStrengthIndicator(indicator, strength);
    });
    updateStrengthIndicator(indicator, analyzePasswordStrength(input.value));
    return indicator;
  }
  function initPasswordStrengthIndicators() {
    const newPasswordInput = qs("#newpassword1");
    if (newPasswordInput) {
      attachStrengthIndicator("#newpassword1");
    }
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "open") {
          const dialog = mutation.target;
          if (dialog.id === "dialog-new-password" && dialog.open) {
            const input = qs("#newpassword1");
            if (input) {
              const existing = dialog.querySelector(".password-strength");
              if (!existing) {
                attachStrengthIndicator("#newpassword1");
              }
              const indicator = dialog.querySelector(".password-strength");
              if (indicator) {
                updateStrengthIndicator(
                  indicator,
                  analyzePasswordStrength("")
                );
              }
            }
          }
        }
      }
    });
    const newPasswordDialog = qs("#dialog-new-password");
    if (newPasswordDialog) {
      observer.observe(newPasswordDialog, { attributes: true });
    }
  }

  // src/ui/tab-switcher.ts
  var switcherDialog = null;
  var isInitialized = false;
  function escapeHtml2(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fuzzyMatch(query, text) {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    if (textLower === queryLower) return 1e3;
    if (textLower.startsWith(queryLower)) return 500 + (100 - text.length);
    if (textLower.includes(queryLower)) return 200 + (100 - textLower.indexOf(queryLower));
    let queryIndex = 0;
    let score = 0;
    let lastMatchIndex = -1;
    for (let index = 0; index < textLower.length && queryIndex < queryLower.length; index++) {
      if (textLower[index] !== queryLower[queryIndex]) continue;
      score += lastMatchIndex === index - 1 ? 5 : 1;
      lastMatchIndex = index;
      queryIndex++;
    }
    return queryIndex === queryLower.length ? score : -1;
  }
  function highlightMatch2(query, text) {
    if (!query) return escapeHtml2(text);
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    let output = "";
    let queryIndex = 0;
    for (let index = 0; index < text.length; index++) {
      const character = text[index] || "";
      const queryCharacter = queryLower[queryIndex] || "";
      if (queryIndex < queryLower.length && textLower[index] === queryCharacter) {
        output += `<mark>${escapeHtml2(character)}</mark>`;
        queryIndex++;
      } else {
        output += escapeHtml2(character);
      }
    }
    return output;
  }
  function getAllTabs() {
    return qsa(".tab-header").map((header, index) => {
      const id = header.dataset.tabId || "";
      const title = header.querySelector(".tab-title")?.textContent || "Empty Tab";
      const textarea = id ? qs(`#${id} .textarea-contents`) : null;
      return {
        header,
        id,
        title,
        content: textarea?.value?.substring(0, 200) || "",
        isPinned: header.classList.contains("pinned"),
        isModified: header.classList.contains("modified"),
        index
      };
    });
  }
  function ensureSwitcherDialog() {
    if (switcherDialog) return switcherDialog;
    const dialog = document.createElement("dialog");
    dialog.id = "tab-switcher-dialog";
    dialog.className = "app-dialog tab-switcher-dialog";
    dialog.setAttribute("aria-label", "Find tab");
    dialog.innerHTML = `
        <div class="tab-switcher-container">
            <div class="tab-switcher-header">
                <input type="text"
                       id="tab-switcher-input"
                       class="tab-switcher-input"
                       aria-label="Find tab"
                       placeholder="Find tab"
                       autocomplete="off" />
                <kbd class="tab-switcher-hint">Esc</kbd>
            </div>
            <div class="tab-switcher-list" id="tab-switcher-list" role="listbox" aria-label="Open tabs"></div>
            <div class="tab-switcher-footer">
                <span class="tab-switcher-stat" id="tab-switcher-stat">0 tabs</span>
                <span class="tab-switcher-keys">Arrow keys navigate, Enter opens.</span>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    switcherDialog = dialog;
    const input = dialog.querySelector("#tab-switcher-input");
    const list = dialog.querySelector("#tab-switcher-list");
    input?.addEventListener("input", () => {
      renderTabList(input.value);
    });
    input?.addEventListener("keydown", (event) => {
      const items = list?.querySelectorAll(".tab-switcher-item") || [];
      const activeItem = list?.querySelector(".tab-switcher-item.active") || null;
      const activeIndex = activeItem ? Array.from(items).indexOf(activeItem) : -1;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (items.length === 0) return;
        const nextIndex = (activeIndex + 1) % items.length;
        items.forEach((item, index) => {
          const selected = index === nextIndex;
          item.classList.toggle("active", selected);
          item.setAttribute("aria-selected", String(selected));
        });
        items[nextIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (items.length === 0) return;
        const previousIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
        items.forEach((item, index) => {
          const selected = index === previousIndex;
          item.classList.toggle("active", selected);
          item.setAttribute("aria-selected", String(selected));
        });
        items[previousIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (!activeItem?.dataset.tabId) return;
        const header = qs(`.tab-header[data-tab-id="${activeItem.dataset.tabId}"]`);
        if (!header) return;
        activateTab(header);
        closeSwitcher();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeSwitcher();
      }
    });
    list?.addEventListener("click", (event) => {
      const pinButton = event.target.closest(".tab-switcher-pin");
      if (pinButton) {
        event.preventDefault();
        event.stopPropagation();
        const tabId = pinButton.dataset.tabId;
        if (!tabId) return;
        const header2 = qs(`.tab-header[data-tab-id="${tabId}"]`);
        if (!header2) return;
        togglePinTab(header2);
        renderTabList(input?.value || "");
        return;
      }
      const item = event.target.closest(".tab-switcher-item");
      if (!item?.dataset.tabId) return;
      const header = qs(`.tab-header[data-tab-id="${item.dataset.tabId}"]`);
      if (!header) return;
      activateTab(header);
      closeSwitcher();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        closeSwitcher();
      }
    });
    return dialog;
  }
  function renderTabList(query = "") {
    const list = qs("#tab-switcher-list");
    const stat = qs("#tab-switcher-stat");
    if (!list) return;
    let tabs = getAllTabs();
    if (query.trim()) {
      tabs = tabs.map((tab) => ({
        ...tab,
        score: Math.max(fuzzyMatch(query, tab.title), fuzzyMatch(query, tab.content) * 0.5)
      })).filter((tab) => tab.score > 0).sort((a, b) => b.score - a.score);
    }
    tabs.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return a.index - b.index;
    });
    list.innerHTML = tabs.map((tab, index) => `
        <div class="tab-switcher-item ${index === 0 ? "active" : ""} ${tab.isPinned ? "pinned" : ""}"
             role="option"
             aria-selected="${index === 0 ? "true" : "false"}"
             data-tab-id="${tab.id}">
            <div class="tab-switcher-item-main">
                <div class="tab-switcher-item-title">
                    ${highlightMatch2(query, tab.title)}
                    ${tab.isModified ? '<span class="modified-dot" aria-label="Unsaved changes"></span>' : ""}
                </div>
                <div class="tab-switcher-item-preview">
                    ${tab.content ? escapeHtml2(tab.content.substring(0, 96)) + (tab.content.length > 96 ? "..." : "") : "Empty"}
                </div>
            </div>
            <div class="tab-switcher-item-meta">
                <span class="tab-switcher-item-index">#${tab.index + 1}</span>
                <button type="button"
                        class="tab-switcher-pin"
                        data-tab-id="${tab.id}">
                    ${tab.isPinned ? "Unpin" : "Pin"}
                </button>
            </div>
        </div>
    `).join("");
    if (stat) {
      const totalTabs = getAllTabs().length;
      const pinnedCount = tabs.filter((tab) => tab.isPinned).length;
      stat.textContent = `${tabs.length}/${totalTabs} tabs${pinnedCount ? `, ${pinnedCount} pinned` : ""}`;
    }
  }
  function openTabSwitcher() {
    const dialog = ensureSwitcherDialog();
    const input = dialog.querySelector("#tab-switcher-input");
    if (input) input.value = "";
    renderTabList();
    dialog.showModal();
    input?.focus();
  }
  function closeSwitcher() {
    switcherDialog?.close();
  }
  function togglePinTab(header) {
    header.classList.toggle("pinned");
    let pinIndicator = header.querySelector(".pin-indicator");
    if (header.classList.contains("pinned")) {
      if (!pinIndicator) {
        pinIndicator = document.createElement("span");
        pinIndicator.className = "pin-indicator";
        pinIndicator.title = "Pinned";
        pinIndicator.setAttribute("aria-hidden", "true");
        header.insertBefore(pinIndicator, header.firstChild);
      }
      const container = qs(".tab-headers-container");
      const firstUnpinned = container?.querySelector(".tab-header:not(.pinned)");
      if (container && firstUnpinned && firstUnpinned !== header) {
        container.insertBefore(header, firstUnpinned);
      } else if (container) {
        container.insertBefore(header, container.firstChild);
      }
    } else {
      pinIndicator?.remove();
    }
    const closeButton = header.querySelector(".close");
    if (closeButton) {
      closeButton.style.display = header.classList.contains("pinned") ? "none" : "";
    }
  }
  function setTabModified(header, modified) {
    header.classList.toggle("modified", modified);
  }
  function clearAllModified() {
    qsa(".tab-header.modified").forEach((header) => header.classList.remove("modified"));
  }
  function initTabSwitcher() {
    if (isInitialized) return;
    isInitialized = true;
    document.addEventListener("dblclick", (event) => {
      const pinIndicator = event.target.closest(".pin-indicator");
      if (!pinIndicator) return;
      const header = pinIndicator.closest(".tab-header");
      if (!header) return;
      event.preventDefault();
      event.stopPropagation();
      togglePinTab(header);
    });
  }

  // src/crypto/pbkdf2.ts
  var DEFAULT_ITERATIONS = 15e4;
  async function pbkdf2KeyFromPassword(password, saltHex, iterations = DEFAULT_ITERATIONS) {
    const salt = hexToBuf(saltHex);
    const baseKey = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256"
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // src/crypto/aes-gcm.ts
  async function aesGcmEncryptHex(plainText, password, saltHex) {
    const ivHex = randomHex(12);
    const key = await pbkdf2KeyFromPassword(password, saltHex);
    const cipherBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: hexToBuf(ivHex) },
      key,
      textEncoder.encode(plainText)
    );
    return { ivHex, cipherHex: bufToHex(cipherBuf) };
  }
  async function aesGcmDecryptHex(ivHex, cipherHex, password, saltHex) {
    const key = await pbkdf2KeyFromPassword(password, saltHex);
    try {
      const plainBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: hexToBuf(ivHex) },
        key,
        hexToBuf(cipherHex)
      );
      return textDecoder.decode(plainBuf);
    } catch {
      return "";
    }
  }

  // src/state/ClientState.ts
  var _focusActiveTextarea = () => {
  };
  var _getContentFromTabs = async () => "";
  var _setContentOfTabs = async () => {
  };
  function setTabFunctions(funcs) {
    if (funcs.focusActiveTextarea) _focusActiveTextarea = funcs.focusActiveTextarea;
    if (funcs.getContentFromTabs) _getContentFromTabs = funcs.getContentFromTabs;
    if (funcs.setContentOfTabs) _setContentOfTabs = funcs.setContentOfTabs;
  }
  var ClientState = class {
    constructor(siteId, urlPassword = null) {
      this.site = siteId;
      this.urlPassword = urlPassword;
      this.currentDBVersion = 2;
      this.expectedDBVersion = 2;
      this.siteHash = null;
      this.isTextModified = false;
      this.initHashContent = null;
      this.content = "";
      this.password = "";
      this.initialIsNew = true;
      this.mobileAppMetadataTabContent = "";
      this.remote = {
        isNew: true,
        eContent: null,
        currentHashContent: null
      };
      this.onButtonEnablementChange = void 0;
      this.onStatusChange = void 0;
      this.onLastSavedUpdate = void 0;
      this.onFinishInitialization = void 0;
      this.onDecryptAndFinish = void 0;
    }
    getIsNew() {
      return !!this.remote.isNew;
    }
    getInitialIsNew() {
      return this.initialIsNew;
    }
    getIsTextModified() {
      return this.isTextModified;
    }
    getContent() {
      return this.content;
    }
    getPassword() {
      return this.password;
    }
    getMobileAppMetadataTabContent() {
      return this.mobileAppMetadataTabContent;
    }
    setMobileAppMetadataTabContent(m) {
      this.mobileAppMetadataTabContent = m || "";
    }
    updateIsTextModified(mod) {
      if (this.isTextModified === mod) return;
      this.isTextModified = mod;
      if (this.onButtonEnablementChange) {
        this.onButtonEnablementChange(this.isTextModified, this.getIsNew());
      }
    }
    async init() {
      this.siteHash = await sha512Hex(this.site);
      await this.reloadFromServer();
      this.initialIsNew = this.getIsNew();
    }
    /**
     * Concurrency token (non-crypto) for overwrite detection. 
     * AES-GCM ensures confidentiality/integrity.
     */
    computeHashContentForDBVersion(contentForHash, passwordForHash, dbVersion) {
      const weak = simpleWeakHash(`${contentForHash}::${passwordForHash}`);
      return weak + String(dbVersion);
    }
    setInitHashContent() {
      if (this.remote.currentHashContent) {
        this.initHashContent = this.remote.currentHashContent;
      } else {
        this.initHashContent = this.computeHashContentForDBVersion(
          this.content,
          this.password || "",
          this.currentDBVersion
        );
      }
    }
    async _getDecryptedContent(pass) {
      if (!this.remote.eContent) return null;
      try {
        const parts = this.remote.eContent.split(":");
        if (parts.length !== 3) return null;
        const saltHex = parts[0];
        const ivHex = parts[1];
        const cipherHex = parts[2];
        if (!saltHex || !ivHex || !cipherHex) return null;
        const plain = await aesGcmDecryptHex(ivHex, cipherHex, pass, saltHex);
        if (plain && this.siteHash && plain.endsWith(this.siteHash)) {
          return plain;
        }
        return null;
      } catch {
        return null;
      }
    }
    /**
     * Try to decrypt using provided pass; returns true/false
     */
    async setLoginPasswordAndContentIfCorrect(pass) {
      const plain = await this._getDecryptedContent(pass);
      if (plain !== null && this.siteHash) {
        this.content = plain.slice(0, plain.length - this.siteHash.length);
        this.password = pass;
        return true;
      }
      return false;
    }
    async saveSite(newPass) {
      const executeSaveSite = async (passwordToUse) => {
        this.content = await _getContentFromTabs(this);
        const newHashContent = this.computeHashContentForDBVersion(
          this.content,
          passwordToUse,
          this.expectedDBVersion
        );
        const saltHex = randomHex(16);
        const { ivHex, cipherHex } = await aesGcmEncryptHex(
          String(this.content + this.siteHash),
          passwordToUse,
          saltHex
        );
        const eContentPayload = `${saltHex}:${ivHex}:${cipherHex}`;
        showLoader(true);
        try {
          const res = await fetchWithRetry("/api/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              site: this.site,
              initHashContent: this.initHashContent || "",
              currentHashContent: newHashContent,
              encryptedContent: eContentPayload
            })
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const data = await res.json();
          if (data.status === "success") {
            toast("Saved.", "success", 1500);
            this.remote.isNew = false;
            this.remote.eContent = eContentPayload;
            this.remote.currentHashContent = data.currentHashContent || newHashContent;
            this.initHashContent = this.remote.currentHashContent;
            this.password = passwordToUse;
            this.currentDBVersion = this.expectedDBVersion;
            this.isTextModified = false;
            if (this.onStatusChange) this.onStatusChange("ready", "Ready");
            if (this.onLastSavedUpdate) this.onLastSavedUpdate();
            if (this.onFinishInitialization) this.onFinishInitialization(true);
          } else if (data.message) {
            if (data.message.includes("modified in the meantime")) {
              toast("Save failed. Another session updated this workspace. Reload and try again.", "error", 5e3);
            } else {
              toast(`Save failed. ${data.message}`, "error", 2500);
            }
            _focusActiveTextarea();
          } else {
            toast("Save failed.", "error", 2500);
            _focusActiveTextarea();
          }
        } catch (error) {
          console.error("Save operation failed:", error);
          let errorMessage = "Save failed.";
          const err = error;
          if (err.name === "AbortError") {
            errorMessage += " Request timed out.";
          } else if (err.message.includes("HTTP")) {
            errorMessage += ` ${err.message}.`;
          } else {
            errorMessage += " Connection issue.";
          }
          toast(errorMessage, "error", 2500);
          _focusActiveTextarea();
        } finally {
          showLoader(false);
        }
      };
      if (newPass === true) {
        openNewPasswordDialog({
          title: this.getIsNew() ? "Create password" : "Change password",
          onSave: async (pass1, pass2) => {
            if (pass1.length === 0) {
              showHint("#passwords-empty");
              hideHint("#passwords-dont-match");
              return false;
            }
            if (pass1 !== pass2) {
              showHint("#passwords-dont-match");
              hideHint("#passwords-empty");
              return false;
            }
            await executeSaveSite(pass1);
            return true;
          }
        });
      } else {
        await executeSaveSite(this.password);
      }
    }
    async deleteSite() {
      const runDelete = async () => {
        showLoader(true);
        try {
          const res = await fetchWithRetry("/api/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              site: this.site,
              initHashContent: this.initHashContent || ""
            })
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const data = await res.json();
          if (data.status === "success") {
            toast("Workspace deleted.", "success", 2e3);
            setTimeout(async () => {
              this.password = "";
              this.content = "";
              this.remote = { isNew: true, eContent: null, currentHashContent: null };
              await _setContentOfTabs("", this);
              this.initialIsNew = true;
              if (this.onFinishInitialization) this.onFinishInitialization();
            }, 2200);
          } else {
            toast("Delete failed. Reload first and try again.", "error", 5e3);
          }
        } catch (error) {
          console.error("Delete operation failed:", error);
          let errorMessage = "Delete failed.";
          const err = error;
          if (err.name === "AbortError") {
            errorMessage += " Request timed out.";
          } else if (err.message.includes("HTTP")) {
            errorMessage += ` ${err.message}.`;
          } else {
            errorMessage += " Connection issue.";
          }
          toast(errorMessage, "error", 2500);
          _focusActiveTextarea();
        } finally {
          showLoader(false);
        }
      };
      openConfirmDialog("#dialog-confirm-delete-site", async (ok) => {
        if (ok) {
          openDeletePasswordDialog({
            onOk: async (enteredPassword) => {
              if (!this.remote.eContent) {
                if (enteredPassword === this.password) {
                  await runDelete();
                  return true;
                }
                return false;
              }
              const isCorrect = await this._getDecryptedContent(enteredPassword) !== null;
              if (isCorrect) {
                await runDelete();
                return true;
              }
              return false;
            }
          });
        } else {
          _focusActiveTextarea();
        }
      });
    }
    async reloadFromServer() {
      const url = `/api/json?site=${encodeURIComponent(this.site)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== "success") throw new Error("Server error");
      this.remote.isNew = !!data.isNew;
      this.remote.eContent = data.isNew ? null : data.eContent || null;
      this.currentDBVersion = data.currentDBVersion || 2;
      this.expectedDBVersion = data.expectedDBVersion || 2;
      this.remote.currentHashContent = data.currentHashContent || null;
      this.initHashContent = this.remote.currentHashContent || null;
    }
    async reloadSite() {
      const executeReload = async () => {
        showLoader(true);
        try {
          await this.reloadFromServer();
          toast("Reloaded.", "success", 600);
          this.isTextModified = false;
          if (this.onStatusChange) this.onStatusChange("ready", "Ready");
          if (this.remote.isNew || !this.remote.eContent) {
            this.content = "";
            const pathSeg = (window.location.pathname || "/").replace(/^\/+|\/+$/g, "");
            const hasSiteFromPath = !!(pathSeg && pathSeg !== "api");
            const hasSiteFromQuery = !!new URL(window.location.href).searchParams.get("site");
            if (!hasSiteFromPath && !hasSiteFromQuery) {
              await _setContentOfTabs("", this);
              if (this.onFinishInitialization) this.onFinishInitialization();
              return;
            }
            if (this.onFinishInitialization) this.onFinishInitialization();
          } else {
            if (this.urlPassword) {
              const ok2 = await this.setLoginPasswordAndContentIfCorrect(this.urlPassword);
              if (ok2) {
                if (this.onFinishInitialization) this.onFinishInitialization();
                return;
              }
            }
            const ok = await this.setLoginPasswordAndContentIfCorrect(this.password);
            if (!ok) {
              if (this.onDecryptAndFinish) this.onDecryptAndFinish(false);
              return;
            }
            if (this.onDecryptAndFinish) this.onDecryptAndFinish(true);
          }
        } catch {
          toast("Reload failed. Connection issue.", "error", 2500);
          _focusActiveTextarea();
        } finally {
          showLoader(false);
        }
      };
      if (this.isTextModified) {
        openConfirmDialog("#dialog-confirm-reload", async (ok) => {
          if (ok) await executeReload();
          else _focusActiveTextarea();
        });
      } else {
        await executeReload();
      }
    }
  };

  // src/app.ts
  setTabFunctions({
    focusActiveTextarea,
    getContentFromTabs,
    setContentOfTabs
  });
  var SHORTCUTS = [
    { keys: "Ctrl/Cmd + S", description: "Save workspace" },
    { keys: "Ctrl/Cmd + Shift + S", description: "Save with new password" },
    { keys: "Ctrl/Cmd + R", description: "Reload encrypted content" },
    { keys: "Ctrl/Cmd + Shift + F", description: "Open search" },
    { keys: "Ctrl/Cmd + Shift + P", description: "Open tab switcher" },
    { keys: "Ctrl/Cmd + Alt + T", description: "Create new tab" },
    { keys: "Ctrl/Cmd + Tab", description: "Next tab" },
    { keys: "Ctrl/Cmd + Shift + Tab", description: "Previous tab" },
    { keys: "Ctrl/Cmd + 1-9", description: "Jump to tab by number" },
    { keys: "Ctrl/Cmd + E", description: "Export encrypted backup" },
    { keys: "Ctrl/Cmd + Shift + G", description: "Toggle theme" },
    { keys: "F1", description: "Open shortcuts help" },
    { keys: "Escape", description: "Close dialog or focus editor" }
  ];
  function getQueryParam(name) {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(name);
    return value && value.trim().length ? value.trim() : null;
  }
  function getSiteFromURL() {
    const path = window.location.pathname || "/";
    const segment = path.replace(/^\/+|\/+$/g, "");
    if (segment && segment !== "api") return segment;
    return getQueryParam("site");
  }
  var SITE_ID = getSiteFromURL();
  var URL_PASSWORD = (() => {
    const named = getQueryParam("password");
    if (named) return named;
    const query = window.location.search || "";
    if (query.startsWith("?") && query.length > 1 && !query.includes("=")) {
      return decodeURIComponent(query.substring(1));
    }
    return null;
  })();
  var state = null;
  var ignoreInputEvent = true;
  var healthCheckInterval = null;
  var landingInitialized = false;
  var workspaceEventsWired = false;
  function getState() {
    if (!state) {
      throw new Error("Workspace state is not initialized");
    }
    return state;
  }
  function setAppView(view) {
    document.body.classList.toggle("view-landing", view === "landing");
    document.body.classList.toggle("view-workspace", view === "workspace");
  }
  function renderShortcutHelp() {
    const container = qs("#help-shortcuts");
    if (!container) return;
    container.innerHTML = SHORTCUTS.map((shortcut) => `
        <div class="shortcut-item">
            <span class="shortcut-keys">${shortcut.keys}</span>
            <span class="shortcut-description">${shortcut.description}</span>
        </div>
    `).join("");
  }
  function openHelpDialog() {
    renderShortcutHelp();
    const dialog = qs("#dialog-help");
    if (!dialog) return;
    const blockingDialog = qsa("dialog[open]").find((openDialog) => openDialog !== dialog);
    if (blockingDialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
  }
  function closeTopmostDialog() {
    const openDialogs = qsa("dialog[open]");
    const dialog = openDialogs[openDialogs.length - 1];
    if (!dialog) return false;
    if (dialog.dataset.lockClose === "true") {
      dialog.querySelector("input, button, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
      return true;
    }
    dialog.close();
    return true;
  }
  function setSiteLabel(siteId) {
    const siteContext = qs("#site-context");
    const siteLabel = qs("#site-label");
    if (!siteContext || !siteLabel) return;
    if (!siteId) {
      siteContext.classList.add("hidden");
      siteLabel.textContent = "";
      return;
    }
    siteLabel.textContent = siteId;
    siteContext.classList.remove("hidden");
  }
  function navigateToWorkspace(siteId) {
    const password = getQueryParam("password");
    let destination = `${window.location.origin}/${encodeURIComponent(siteId)}`;
    if (password) {
      destination += `?password=${encodeURIComponent(password)}`;
    }
    window.location.href = destination;
  }
  function initLanding() {
    if (landingInitialized) return;
    landingInitialized = true;
    const form = qs("#landing-form");
    const input = qs("#landing-site");
    if (!form || !input) return;
    on(form, "submit", (event) => {
      event.preventDefault();
      const nextSite = (input.value || "").trim();
      if (!nextSite) {
        toast("Enter a workspace id.", "warning", 1800);
        input.focus();
        return;
      }
      navigateToWorkspace(nextSite);
    });
  }
  function updateButtonEnablement(isTextModified, isSiteNew) {
    const workspace = getState();
    const saveButton = qs("#button-save");
    const saveNewButton = qs("#button-savenew");
    const reloadButton = qs("#button-reload");
    const deleteButton = qs("#button-delete");
    if (!saveButton || !saveNewButton || !reloadButton || !deleteButton) return;
    saveButton.disabled = !isTextModified;
    saveNewButton.disabled = Boolean(isSiteNew);
    reloadButton.disabled = false;
    deleteButton.disabled = Boolean(isSiteNew);
    if (workspace.getInitialIsNew() === false && isTextModified) {
      window.onbeforeunload = () => "Unsaved changes will be lost.";
    } else {
      window.onbeforeunload = null;
    }
  }
  function updateStatusIndicator(status, text) {
    const indicator = qs("#status-indicator");
    const statusText = qs(".status-text");
    if (!indicator || !statusText) return;
    indicator.classList.remove("saving", "error", "modified");
    if (status && status !== "ready") {
      indicator.classList.add(status);
    }
    statusText.textContent = text || "Ready";
  }
  function updateLastSaved() {
    const lastSaved = qs("#last-saved");
    if (!lastSaved) return;
    const now = /* @__PURE__ */ new Date();
    lastSaved.textContent = `Saved ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    lastSaved.classList.remove("hidden");
  }
  function hideLastSaved() {
    const lastSaved = qs("#last-saved");
    lastSaved?.classList.add("hidden");
  }
  function setupStatusTracking() {
    document.addEventListener("input", (event) => {
      if (!(event.target instanceof HTMLTextAreaElement)) return;
      if (!event.target.classList.contains("textarea-contents")) return;
      updateStatusIndicator("modified", "Modified");
      hideLastSaved();
      const panel = event.target.closest(".tab-panel");
      if (!panel) return;
      const header = document.querySelector(`.tab-header[data-tab-id="${panel.id}"]`);
      if (header) {
        setTabModified(header, true);
      }
    });
  }
  async function checkServerHealth() {
    try {
      const response = await fetch("/health", { method: "GET" });
      return response.ok;
    } catch {
      return false;
    }
  }
  function startHealthMonitoring() {
    if (healthCheckInterval) return;
    healthCheckInterval = setInterval(async () => {
      const isHealthy = await checkServerHealth();
      if (!isHealthy) {
        toast("Connection check failed.", "warning", 2400);
      }
    }, 5 * 60 * 1e3);
  }
  function stopHealthMonitoring() {
    if (!healthCheckInterval) return;
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  function handleGlobalErrors() {
    window.addEventListener("error", (event) => {
      console.error("Global error:", event.error);
      toast("Unexpected error. Refresh the page if the workspace becomes unstable.", "error", 3200);
    });
    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason);
      toast("Request failed. Check the connection and try again.", "error", 3200);
      event.preventDefault();
    });
  }
  function exportEncryptedBackup(eContent) {
    const siteId = SITE_ID || "workspace";
    const title = `Cryptexa Encrypted Backup (${siteId})`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body>
<h3>${title}</h3>
<p>Enter password to decrypt this backup locally. No network is required.</p>
<input type="password" id="pw" placeholder="Password"/>
<button id="dec">Decrypt</button>
<pre id="out" style="white-space:pre-wrap;margin-top:12px;"></pre>
<script>
const textEncoder = new TextEncoder(); const textDecoder = new TextDecoder();
function hexToBuf(hex){const len=hex.length/2;const out=new Uint8Array(len);for(let i=0;i<len;i++)out[i]=parseInt(hex.substr(i*2,2),16);return out.buffer;}
async function pbkdf2KeyFromPassword(password, saltHex, iterations=150000){
  const salt=hexToBuf(saltHex);
  const baseKey=await crypto.subtle.importKey("raw", textEncoder.encode(password), {name:"PBKDF2"}, false, ["deriveKey"]);
  return await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations,hash:"SHA-256"}, baseKey, {name:"AES-GCM",length:256}, false, ["decrypt"]);
}
async function aesGcmDecryptHex(ivHex, cipherHex, password, saltHex){
  const key=await pbkdf2KeyFromPassword(password, saltHex);
  const plainBuf=await crypto.subtle.decrypt({name:"AES-GCM", iv:hexToBuf(ivHex)}, key, hexToBuf(cipherHex));
  return textDecoder.decode(plainBuf);
}
document.getElementById("dec").onclick=async()=>{
  const pw=document.getElementById("pw").value||"";
  const payload=${JSON.stringify(eContent)};
  const parts=payload.split(":");
  if(parts.length!==3){document.getElementById("out").textContent="Invalid payload";return;}
  const [saltHex,ivHex,cipherHex]=parts;
  try{
    const plain=await aesGcmDecryptHex(ivHex,cipherHex,pw,saltHex);
    document.getElementById("out").textContent=plain;
  }catch(e){
    document.getElementById("out").textContent="Decryption failed.";
  }
};
<${"/"}script>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cryptexa-backup-${siteId}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    URL.revokeObjectURL(url);
    anchor.remove();
  }
  function triggerExport() {
    const workspace = getState();
    const encrypted = workspace.remote.eContent;
    if (!encrypted) {
      toast("Nothing to export yet.", "warning", 1400);
      return;
    }
    exportEncryptedBackup(encrypted);
  }
  function cycleTabs(direction) {
    const headers = qsa(".tab-header");
    if (headers.length === 0) return;
    const activeIndex = headers.findIndex((tab) => tab.classList.contains("active"));
    const nextIndex = activeIndex === -1 ? 0 : (activeIndex + direction + headers.length) % headers.length;
    const target = headers[nextIndex];
    if (target) activateTab(target);
  }
  function jumpToTabByNumber(index) {
    const headers = qsa(".tab-header");
    const target = headers[index];
    if (target) activateTab(target);
  }
  function createNewTab() {
    addTab(false, "", qs(".tab-header.active"), () => getState().updateIsTextModified(true));
  }
  function triggerSave(forceNewPassword) {
    const workspace = getState();
    if (!forceNewPassword && !workspace.getIsNew()) {
      updateStatusIndicator("saving", "Saving");
    }
    void workspace.saveSite(forceNewPassword || workspace.getIsNew());
  }
  function isFormField(target) {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "TEXTAREA") return false;
    if (tag === "INPUT" || tag === "SELECT" || tag === "OPTION") return true;
    return target.isContentEditable;
  }
  function initKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      const key = event.key;
      const keyLower = key.toLowerCase();
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      if (key === "F1") {
        event.preventDefault();
        openHelpDialog();
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        if (!closeTopmostDialog()) {
          focusActiveTextarea();
        }
        return;
      }
      if (!document.body.classList.contains("view-workspace") || !state) {
        return;
      }
      const openDialogs = qsa("dialog[open]");
      const formField = isFormField(event.target);
      if (openDialogs.length > 0) {
        return;
      }
      if (formField && !isCtrlOrCmd) {
        return;
      }
      if (isCtrlOrCmd && event.shiftKey && keyLower === "s") {
        event.preventDefault();
        triggerSave(true);
        return;
      }
      if (isCtrlOrCmd && keyLower === "s") {
        event.preventDefault();
        triggerSave(false);
        return;
      }
      if (isCtrlOrCmd && keyLower === "r" && !event.shiftKey) {
        event.preventDefault();
        void getState().reloadSite();
        return;
      }
      if (isCtrlOrCmd && event.shiftKey && keyLower === "f") {
        event.preventDefault();
        openSearch();
        return;
      }
      if (isCtrlOrCmd && event.shiftKey && keyLower === "p") {
        event.preventDefault();
        openTabSwitcher();
        return;
      }
      if (isCtrlOrCmd && event.altKey && keyLower === "t") {
        event.preventDefault();
        createNewTab();
        return;
      }
      if (isCtrlOrCmd && keyLower === "e") {
        event.preventDefault();
        triggerExport();
        return;
      }
      if (isCtrlOrCmd && event.shiftKey && keyLower === "g") {
        event.preventDefault();
        qs("#theme-toggle")?.click();
        return;
      }
      if (isCtrlOrCmd && key >= "1" && key <= "9") {
        event.preventDefault();
        jumpToTabByNumber(parseInt(key, 10) - 1);
        return;
      }
      if (isCtrlOrCmd && key === "Tab" && !event.shiftKey) {
        event.preventDefault();
        cycleTabs(1);
        return;
      }
      if (isCtrlOrCmd && key === "Tab" && event.shiftKey) {
        event.preventDefault();
        cycleTabs(-1);
      }
    });
  }
  function wireWorkspaceButtons() {
    on(qs("#button-save"), "click", () => triggerSave(false));
    on(qs("#button-savenew"), "click", () => triggerSave(true));
    on(qs("#button-reload"), "click", () => {
      void getState().reloadSite();
    });
    on(qs("#button-delete"), "click", () => {
      void getState().deleteSite();
    });
    on(qs("#button-export"), "click", triggerExport);
    on(qs("#search-button"), "click", openSearch);
    on(qs("#help-button"), "click", openHelpDialog);
  }
  function wireWorkspaceEvents() {
    if (workspaceEventsWired) return;
    workspaceEventsWired = true;
    let pendingRaf = 0;
    document.addEventListener("input", (event) => {
      if (!(event.target instanceof HTMLTextAreaElement)) return;
      if (!event.target.classList.contains("textarea-contents")) return;
      if (ignoreInputEvent || !state) return;
      state.updateIsTextModified(true);
      const textarea = event.target;
      const activeTabTitle = getCurrentTabTitle();
      if (pendingRaf) cancelAnimationFrame(pendingRaf);
      pendingRaf = requestAnimationFrame(() => {
        pendingRaf = 0;
        try {
          const start = textarea.selectionStart;
          const isHuge = textarea.value.length > 5e4;
          if (!isHuge && start <= 201 && activeTabTitle) {
            activeTabTitle.textContent = getTitleFromContent(textarea.value.substring(0, 200));
          }
        } catch {
        }
        const panel = textarea.closest(".tab-panel");
        const gutter = panel?.querySelector(".line-gutter") || null;
        const editorWrap = panel?.querySelector(".editor-wrap") || null;
        if (gutter) {
          const isHuge = textarea.value.length > 5e4;
          if (isHuge) {
            const y = Math.round(textarea.scrollTop || 0);
            gutter.style.setProperty("--gutter-scroll-y", String(-y));
            gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
            gutter.style.removeProperty("top");
            gutter.style.transform = "translateZ(0)";
            if (!gutter._lnDebounce) {
              gutter._lnDebounce = debounce(() => updateGutterForTextarea(textarea, gutter), 120);
            }
            gutter._lnDebounce();
          } else {
            updateGutterForTextarea(textarea, gutter);
          }
        }
        if (editorWrap) {
          updateActiveLineHighlight(textarea, editorWrap);
          updateSelectedLinesHighlight(textarea, editorWrap);
        }
      });
    });
    document.addEventListener("selectionchange", () => {
      const textarea = document.activeElement;
      if (!(textarea instanceof HTMLTextAreaElement)) return;
      if (!textarea.classList.contains("textarea-contents")) return;
      const editorWrap = textarea.closest(".tab-panel")?.querySelector(".editor-wrap");
      if (!editorWrap) return;
      updateActiveLineHighlight(textarea, editorWrap);
      updateSelectedLinesHighlight(textarea, editorWrap);
    });
    document.addEventListener("mouseup", (event) => {
      if (!(event.target instanceof HTMLTextAreaElement)) return;
      if (!event.target.classList.contains("textarea-contents")) return;
      const textarea = event.target;
      const editorWrap = textarea.closest(".tab-panel")?.querySelector(".editor-wrap");
      if (!editorWrap) return;
      setTimeout(() => {
        updateActiveLineHighlight(textarea, editorWrap);
        updateSelectedLinesHighlight(textarea, editorWrap);
      }, 0);
    });
    document.addEventListener("paste", (event) => {
      if (!(event.target instanceof HTMLTextAreaElement)) return;
      if (!event.target.classList.contains("textarea-contents")) return;
      const activeTabTitle = getCurrentTabTitle();
      setTimeout(() => {
        const textarea = event.target;
        const isHuge = textarea.value.length > 5e4;
        if (!isHuge && activeTabTitle) {
          activeTabTitle.textContent = getTitleFromContent();
        }
        const gutter = textarea.closest(".tab-panel")?.querySelector(".line-gutter") || null;
        if (!gutter) return;
        if (isHuge) {
          if (!gutter._lnDebounce) {
            gutter._lnDebounce = debounce(() => updateGutterForTextarea(textarea, gutter), 120);
          }
          gutter._lnDebounce();
        } else {
          updateGutterForTextarea(textarea, gutter);
        }
      }, 50);
    });
    document.addEventListener("keydown", (event) => {
      const textarea = document.activeElement;
      if (!(textarea instanceof HTMLTextAreaElement)) return;
      if (!textarea.classList.contains("textarea-contents")) return;
      if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
      event.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      textarea.value = value.substring(0, start) + "    " + value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 4;
      getState().updateIsTextModified(true);
    });
  }
  async function initSite() {
    const workspace = getState();
    if (!workspace.getIsNew() && URL_PASSWORD) {
      const success = await workspace.setLoginPasswordAndContentIfCorrect(URL_PASSWORD);
      if (success) {
        await finishInitialization();
        return;
      }
    }
    if (workspace.getIsNew()) {
      await setContentOfTabs("", workspace);
      await finishInitialization();
      return;
    }
    decryptContentAndFinishInitialization(false);
  }
  async function finishInitialization(shouldSkipSettingContent) {
    const workspace = getState();
    workspace.setInitHashContent();
    updateButtonEnablement(workspace.getIsTextModified(), workspace.getIsNew());
    updateStatusIndicator("ready", "Ready");
    focusActiveTextarea();
    ignoreInputEvent = true;
    if (shouldSkipSettingContent !== true) {
      await setContentOfTabs(workspace.getContent(), workspace);
    } else {
      clearAllModified();
    }
    setTimeout(() => {
      ignoreInputEvent = false;
    }, 50);
  }
  function decryptContentAndFinishInitialization(isOld) {
    const workspace = getState();
    const openPrompt = () => {
      openPasswordDialog({
        obscure: true,
        hideUI: true,
        onOk: async (password) => {
          if (password == null) return false;
          const success = await workspace.setLoginPasswordAndContentIfCorrect(password);
          if (success) {
            await finishInitialization();
            return true;
          }
          return false;
        }
      });
    };
    if (isOld) {
      void workspace.setLoginPasswordAndContentIfCorrect(workspace.getPassword()).then(async (success) => {
        if (!success) {
          openPrompt();
          return;
        }
        await finishInitialization();
      });
      return;
    }
    openPrompt();
  }
  async function bootstrapWorkspace() {
    if (!SITE_ID) {
      setAppView("landing");
      setSiteLabel(null);
      initLanding();
      return;
    }
    setAppView("workspace");
    setSiteLabel(SITE_ID);
    state = new ClientState(SITE_ID, URL_PASSWORD);
    window.state = state;
    state.onButtonEnablementChange = updateButtonEnablement;
    state.onStatusChange = updateStatusIndicator;
    state.onLastSavedUpdate = updateLastSaved;
    state.onFinishInitialization = (shouldSkipSettingContent) => {
      void finishInitialization(shouldSkipSettingContent);
    };
    state.onDecryptAndFinish = decryptContentAndFinishInitialization;
    await state.init();
    initTabsLayout(() => state?.updateIsTextModified(true));
    onWindowResize();
    wireWorkspaceButtons();
    wireWorkspaceEvents();
    startHealthMonitoring();
    if (state.getIsNew() || !state.remote.eContent) {
      await setContentOfTabs("", state);
      await finishInitialization();
      return;
    }
    setPasswordMode(true, { hide: true });
    await initSite();
  }
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    wireThemeToggle();
    renderShortcutHelp();
    handleGlobalErrors();
    setupStatusTracking();
    initKeyboardShortcuts();
    initPasswordStrengthIndicators();
    initGlobalSearch();
    initTabSwitcher();
    initLanding();
    setSiteLabel(SITE_ID);
    requestAnimationFrame(() => {
      void bootstrapWorkspace();
    });
  });
})();
//# sourceMappingURL=app.js.map
