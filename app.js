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
      loader.style.display = onFlag ? "flex" : "none";
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
    qs(sel)?.style.setProperty("display", "block");
  };
  var hideHint = (sel) => {
    qs(sel)?.style.setProperty("display", "none");
  };

  // src/ui/toast.ts
  var TOAST_ICONS = {
    success: "\u2713",
    error: "\u2715",
    warning: "\u26A0",
    info: "\u2139"
  };
  function toast(message, type = "info", duration = 4e3) {
    const container = document.getElementById("toast-container");
    if (!container) {
      const outer = qs("#outer-toast");
      const el = qs("#toast");
      if (outer && el) {
        el.innerHTML = message;
        outer.style.display = "block";
        outer.style.opacity = "1";
        setTimeout(() => outer.style.display = "none", duration);
      }
      return;
    }
    const toastEl = document.createElement("div");
    toastEl.className = `toast ${type}`;
    const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
    toastEl.innerHTML = `<div class="toast-content"><span class="toast-icon">${icon}</span><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button></div>`;
    container.appendChild(toastEl);
    setTimeout(() => toastEl.parentElement && toastEl.remove(), duration);
  }
  function showNotification(message, type = "info", duration = 5e3) {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add("show"), 10);
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, duration);
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
    dlg.showModal();
    queueMicrotask(() => input.focus());
    const btnOk = dlg.querySelector("button[value='ok']");
    const handleOk = async (ev) => {
      ev?.preventDefault?.();
      btnOk.disabled = true;
      try {
        const success = await onOk(input.value);
        if (success) {
          dlg.close("ok");
          setPasswordMode(false);
        } else {
          toast("Wrong password", "error");
          input.select();
          input.focus();
          return;
        }
      } finally {
        btnOk.disabled = false;
      }
    };
    btnOk.addEventListener("click", handleOk, { once: false });
    const cleanup = () => {
      btnOk.removeEventListener("click", handleOk);
      dlg.removeEventListener("close", cleanup);
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
    const handleOk = async (ev) => {
      ev?.preventDefault?.();
      btnOk.disabled = true;
      try {
        const success = await onOk(input.value);
        if (success) {
          dlg.close("ok");
        } else {
          toast("Wrong password", "error");
          input.select();
          input.focus();
          return;
        }
      } finally {
        btnOk.disabled = false;
      }
    };
    btnOk.addEventListener("click", handleOk, { once: false });
    const cleanup = () => {
      btnOk.removeEventListener("click", handleOk);
      dlg.removeEventListener("close", cleanup);
    };
    dlg.addEventListener("close", cleanup);
  };
  var openNewPasswordDialog = ({ title, onSave }) => {
    const dlg = qs("#dialog-new-password");
    const titleEl = qs("#dialog-new-password-title");
    const p1 = qs("#newpassword1");
    const p2 = qs("#newpassword2");
    titleEl.textContent = title || "Create password";
    hideHint("#passwords-empty");
    hideHint("#passwords-dont-match");
    dlg.returnValue = "cancel";
    dlg.showModal();
    setTimeout(() => {
      p1.value = "";
      p2.value = "";
      p1.focus();
    }, 0);
    const handler = async () => {
      const ok = dlg.returnValue === "ok";
      if (!ok) {
        dlg.removeEventListener("close", handler);
        return;
      }
      const proceed = await onSave(p1.value, p2.value);
      if (proceed) {
        dlg.removeEventListener("close", handler);
      } else {
        setTimeout(() => dlg.showModal(), 0);
      }
    };
    dlg.addEventListener("close", handler);
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
    if (theme === "light") {
      root.classList.add("theme-light");
    } else {
      root.classList.add("theme-dark");
    }
    updateToggle(theme);
  }
  function currentTheme() {
    const stored = getStored();
    if (stored === "dark" || stored === "light") return stored;
    if (root.classList.contains("theme-light")) return "light";
    if (root.classList.contains("theme-dark")) return "dark";
    const system = getSystemPref();
    return system === "light" ? "light" : "dark";
  }
  function updateToggle(theme) {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const label = btn.querySelector(".label");
    const icon = btn.querySelector(".icon");
    const isDark = theme === "dark";
    btn.setAttribute("aria-pressed", String(isDark));
    if (label) label.textContent = isDark ? "Dark" : "Light";
    if (icon) icon.textContent = isDark ? "\u{1F319}" : "\u{1F506}";
  }
  function initTheme() {
    const initial = getStored() || "light";
    applyTheme(initial);
  }
  function wireThemeToggle() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      store(next);
    });
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const handleChange = () => {
        if (getStored()) return;
        applyTheme(getSystemPref());
      };
      if (mq.addEventListener) {
        mq.addEventListener("change", handleChange);
      } else if ("addListener" in mq) {
        mq.addListener(handleChange);
      }
    }
  }

  // src/ui/kinetic.js
  var LissajousRenderer = class {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.particles = [];
      this.time = 0;
      this.animationId = null;
      this.curves = [
        { a: 3, b: 2, delta: Math.PI / 2, speed: 8e-3, size: 0.35 },
        { a: 5, b: 4, delta: Math.PI / 4, speed: 6e-3, size: 0.25 },
        { a: 3, b: 4, delta: Math.PI / 3, speed: 4e-3, size: 0.45 }
      ];
      this.resize();
      window.addEventListener("resize", () => this.resize());
    }
    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.centerX = this.canvas.width / 2;
      this.centerY = this.canvas.height / 2;
    }
    // Calculate point on Lissajous curve
    getPoint(curve, t) {
      const amplitude = Math.min(this.centerX, this.centerY) * curve.size;
      const x = amplitude * Math.sin(curve.a * t + curve.delta);
      const y = amplitude * Math.sin(curve.b * t);
      return { x: this.centerX + x, y: this.centerY + y };
    }
    draw() {
      this.ctx.fillStyle = "rgba(15, 17, 21, 0.03)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.curves.forEach((curve, i) => {
        const point = this.getPoint(curve, this.time * curve.speed);
        const gradient = this.ctx.createRadialGradient(
          point.x,
          point.y,
          0,
          point.x,
          point.y,
          8
        );
        gradient.addColorStop(0, `rgba(122, 162, 255, ${0.4 - i * 0.1})`);
        gradient.addColorStop(1, "transparent");
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(122, 162, 255, ${0.6 - i * 0.15})`;
        this.ctx.fill();
      });
      this.time += 1;
    }
    start() {
      const animate = () => {
        this.draw();
        this.animationId = requestAnimationFrame(animate);
      };
      animate();
    }
    stop() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    }
  };
  function createOrbitalSystem(container) {
    const system = document.createElement("div");
    system.className = "orbital-system";
    for (let i = 1; i <= 4; i++) {
      const ring = document.createElement("div");
      ring.className = `orbital-ring orbital-ring--${i}`;
      system.appendChild(ring);
    }
    const shapes = ["circle", "triangle", "square", "diamond"];
    for (let i = 1; i <= 4; i++) {
      const orbiter = document.createElement("div");
      orbiter.className = `orbiter orbiter--${i}`;
      const shape = document.createElement("div");
      shape.className = `orbiter__shape orbiter__shape--${shapes[i - 1]}`;
      orbiter.appendChild(shape);
      system.appendChild(orbiter);
    }
    container.appendChild(system);
    return system;
  }
  function createBreathingGrid(container) {
    const grid = document.createElement("div");
    grid.className = "breathing-grid";
    for (let i = 1; i <= 3; i++) {
      const layer = document.createElement("div");
      layer.className = `breathing-grid__layer breathing-grid__layer--${i}`;
      const hexagon = document.createElement("div");
      hexagon.className = "breathing-grid__hexagon";
      layer.appendChild(hexagon);
      grid.appendChild(layer);
    }
    container.appendChild(grid);
    return grid;
  }
  function createPendulumLoader(container, pendulumCount = 9) {
    const loader = document.createElement("div");
    loader.className = "pendulum-loader";
    for (let i = 0; i < pendulumCount; i++) {
      const pendulum = document.createElement("div");
      pendulum.className = "pendulum";
      loader.appendChild(pendulum);
    }
    container.appendChild(loader);
    return loader;
  }
  function createFloatingParticles(container, count = 15) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const particle = document.createElement("div");
      particle.className = "particle";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 20}s`;
      particle.style.animationDuration = `${15 + Math.random() * 10}s`;
      container.appendChild(particle);
      particles.push(particle);
    }
    return particles;
  }
  function addKineticRipple(element) {
    element.addEventListener("click", (e) => {
      const rect = element.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "kinetic-ripple";
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      element.style.position = "relative";
      element.style.overflow = "hidden";
      element.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    });
  }
  var lissajousRenderer = null;
  function initKineticBackground(isLanding = false) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return null;
    }
    let container = document.querySelector(".kinetic-bg");
    if (!container) {
      container = document.createElement("div");
      container.className = "kinetic-bg";
      if (isLanding) container.classList.add("kinetic-bg--landing");
      document.body.insertBefore(container, document.body.firstChild);
    }
    container.innerHTML = "";
    if (isLanding) {
      createOrbitalSystem(container);
      createBreathingGrid(container);
      createFloatingParticles(container, 12);
      const canvas = document.createElement("canvas");
      canvas.className = "lissajous-canvas";
      container.appendChild(canvas);
      lissajousRenderer = new LissajousRenderer(canvas);
      lissajousRenderer.start();
    } else {
      createFloatingParticles(container, 8);
    }
    return container;
  }
  function replaceLoaderWithKinetic() {
    const loader = document.querySelector(".loader");
    if (!loader) return;
    const spinner = loader.querySelector(".spinner");
    if (spinner) {
      spinner.remove();
      createPendulumLoader(loader);
    }
  }
  function initKineticButtons() {
    const buttons = document.querySelectorAll("#menubar-buttons button, .landing button");
    buttons.forEach((btn) => addKineticRipple(btn));
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
  function getCurrentTabTitle() {
    return currentTabTitle;
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
  function activateTab(headerLi) {
    const headers = qsa(".tab-header");
    const panels = qsa(".tab-panel");
    const id = headerLi.dataset.tabId;
    const panel = id ? qs(`#${id}`) : null;
    requestAnimationFrame(() => {
      headers.forEach((h) => h.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      headerLi.classList.add("active");
      if (panel) panel.classList.add("active");
      setTimeout(() => {
        focusActiveTextarea();
        const ta = panel?.querySelector("textarea.textarea-contents");
        const gutter = panel?.querySelector(".line-gutter");
        if (ta && gutter) {
          const y = Math.round(ta.scrollTop || 0);
          gutter.style.setProperty("--gutter-scroll-y", String(-y));
          gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
          gutter.style.removeProperty("top");
          gutter.style.transform = "translateZ(0)";
          const needsHeavyUpdate = ta.value && ta.value.length > 5e4;
          if (needsHeavyUpdate) {
            setTimeout(() => updateGutterForTextarea(ta, gutter), 0);
          } else {
            updateGutterForTextarea(ta, gutter);
          }
        }
      }, 0);
    });
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
    let actualContent = contentIfAvailable;
    let tabColor = null;
    if (contentIfAvailable && contentIfAvailable.startsWith("__CRYPTEXA_COLOR__:")) {
      const colorEndIndex = contentIfAvailable.indexOf("\n");
      if (colorEndIndex !== -1) {
        const colorLine = contentIfAvailable.substring(0, colorEndIndex);
        tabColor = colorLine.replace("__CRYPTEXA_COLOR__:", "").trim();
        actualContent = contentIfAvailable.substring(colorEndIndex + 1);
      }
    }
    const li = document.createElement("li");
    li.className = "tab-header";
    li.dataset.tabId = id;
    li.draggable = true;
    if (tabColor) {
      li.dataset.tabColor = tabColor;
      li.style.backgroundColor = tabColor;
    }
    const a = document.createElement("a");
    a.href = `#${id}`;
    a.className = "tab-title";
    a.textContent = "Empty Tab";
    const span = document.createElement("span");
    span.className = "close";
    span.title = "Remove Tab";
    span.textContent = "\xD7";
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
    panel.innerHTML = `
    <div class="editor-wrap">
      <div class="line-gutter" aria-hidden="true"></div>
      <textarea rows="1" cols="1" class="textarea-contents" placeholder="your text goes here..."></textarea>
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
      if (closer) closer.style.display = headers.length > 1 ? "" : "none";
    });
    focusActiveTextarea();
  }
  function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll(".tab-header:not([style*='opacity'])")];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
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
        return;
      }
    });
    const addTabBtn = qs("#add_tab");
    if (addTabBtn) {
      on(addTabBtn, "click", () => {
        const activeTab = qs(".tab-header.active");
        addTab(false, "", activeTab, onModified);
      });
    }
    initTabDragAndDrop(onModified);
    refreshTabs();
    onWindowResize();
    window.addEventListener("resize", onWindowResize);
  }
  function onWindowResize() {
    const menubar = qs("#menubar");
    const outter = qs("#main-content-outter");
    const headers = qs(".tab-headers");
    if (!menubar || !outter || !headers) return;
    const top = menubar.getBoundingClientRect().height;
    outter.style.top = `${top}px`;
    const h = window.innerHeight - top;
    outter.style.height = `${h}px`;
    const panels = qsa(".tab-panel");
    const headerH = headers.getBoundingClientRect().height;
    panels.forEach((p) => {
      p.style.height = `${Math.max(0, h - headerH)}px`;
    });
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
      if (part.startsWith("\u267B Reload this website to hide mobile app metadata! \u267B")) {
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
      const tabColor = header.dataset.tabColor;
      if (i > 0) all += sep;
      if (tabColor && tabColor !== "#ffffff") {
        all += `__CRYPTEXA_COLOR__:${tabColor}
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
  function searchAllTabs(query) {
    if (!query || query.length < 2) return [];
    const results = [];
    const headers = qsa(".tab-header");
    const lowerQuery = query.toLowerCase();
    for (const header of headers) {
      const tabId = header.dataset.tabId;
      if (!tabId) continue;
      const tabTitle = header.querySelector(".tab-title")?.textContent || "Untitled";
      const textarea = qs(`#${tabId} .textarea-contents`);
      if (!textarea) continue;
      const content = textarea.value;
      const lines = content.split("\n");
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        if (!line) continue;
        const lowerLine = line.toLowerCase();
        let matchIndex = lowerLine.indexOf(lowerQuery);
        while (matchIndex !== -1) {
          results.push({
            tabId,
            tabTitle,
            lineNumber: lineNum + 1,
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
  function highlightMatch(result) {
    const before = escapeHtml(result.lineContent.substring(0, result.matchStart));
    const match = escapeHtml(result.lineContent.substring(result.matchStart, result.matchEnd));
    const after = escapeHtml(result.lineContent.substring(result.matchEnd));
    const maxLen = 60;
    let displayBefore = before;
    let displayAfter = after;
    if (before.length > maxLen / 2) {
      displayBefore = "..." + before.substring(before.length - maxLen / 2);
    }
    if (after.length > maxLen / 2) {
      displayAfter = after.substring(0, maxLen / 2) + "...";
    }
    return `${displayBefore}<mark>${match}</mark>${displayAfter}`;
  }
  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function renderResults() {
    if (!resultsContainer) return;
    if (searchState.results.length === 0) {
      if (searchState.query.length >= 2) {
        resultsContainer.innerHTML = `
                <div class="search-no-results">
                    <span class="search-no-results-icon">\u{1F50D}</span>
                    <span>No matches found for "<strong>${escapeHtml(searchState.query)}</strong>"</span>
                </div>
            `;
      } else if (searchState.query.length > 0) {
        resultsContainer.innerHTML = `
                <div class="search-hint">Type at least 2 characters to search</div>
            `;
      } else {
        resultsContainer.innerHTML = `
                <div class="search-hint">Start typing to search across all tabs</div>
            `;
      }
      return;
    }
    const html = searchState.results.map((result, index) => `
        <div class="search-result${index === searchState.selectedIndex ? " selected" : ""}" 
             data-index="${index}"
             data-tab-id="${result.tabId}"
             data-line="${result.lineNumber}">
            <div class="search-result-header">
                <span class="search-result-tab">\u{1F4C4} ${escapeHtml(result.tabTitle)}</span>
                <span class="search-result-line">Line ${result.lineNumber}</span>
            </div>
            <div class="search-result-content">${highlightMatch(result)}</div>
        </div>
    `).join("");
    resultsContainer.innerHTML = `
        <div class="search-results-header">
            Found ${searchState.results.length} match${searchState.results.length === 1 ? "" : "es"}
        </div>
        ${html}
    `;
  }
  function goToResult(result) {
    const tabHeader = qs(`.tab-header[data-tab-id="${result.tabId}"]`);
    if (tabHeader) {
      activateTab(tabHeader);
      setTimeout(() => {
        const textarea = qs(`#${result.tabId} .textarea-contents`);
        if (!textarea) return;
        const lines = textarea.value.split("\n");
        let charPosition = 0;
        for (let i = 0; i < result.lineNumber - 1; i++) {
          const lineLength = lines[i]?.length ?? 0;
          charPosition += lineLength + 1;
        }
        charPosition += result.matchStart;
        textarea.focus();
        textarea.setSelectionRange(charPosition, charPosition + (result.matchEnd - result.matchStart));
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
        const scrollTop = (result.lineNumber - 5) * lineHeight;
        textarea.scrollTop = Math.max(0, scrollTop);
      }, 100);
    }
    closeSearch();
  }
  function handleSearchKeydown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (searchState.results.length > 0) {
        searchState.selectedIndex = Math.min(
          searchState.selectedIndex + 1,
          searchState.results.length - 1
        );
        renderResults();
        scrollSelectedIntoView();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (searchState.results.length > 0) {
        searchState.selectedIndex = Math.max(searchState.selectedIndex - 1, 0);
        renderResults();
        scrollSelectedIntoView();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selectedResult = searchState.results[searchState.selectedIndex];
      if (searchState.selectedIndex >= 0 && selectedResult) {
        goToResult(selectedResult);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
    }
  }
  function scrollSelectedIntoView() {
    const selected = resultsContainer?.querySelector(".search-result.selected");
    if (selected) {
      selected.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
  function handleSearchInput() {
    if (!searchInput) return;
    searchState.query = searchInput.value;
    searchState.results = searchAllTabs(searchState.query);
    searchState.selectedIndex = searchState.results.length > 0 ? 0 : -1;
    renderResults();
  }
  function handleResultClick(e) {
    const resultEl = e.target.closest(".search-result");
    if (!resultEl) return;
    const index = parseInt(resultEl.getAttribute("data-index") || "-1", 10);
    const result = searchState.results[index];
    if (index >= 0 && result) {
      goToResult(result);
    }
  }
  function openSearch() {
    if (!searchDialog) {
      initSearchDialog();
    }
    searchState = {
      isOpen: true,
      query: "",
      results: [],
      selectedIndex: -1
    };
    if (searchInput) {
      searchInput.value = "";
    }
    renderResults();
    searchDialog?.showModal();
    setTimeout(() => {
      searchInput?.focus();
    }, 50);
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
    dialog.innerHTML = `
        <form method="dialog">
            <div class="search-header">
                <div class="search-input-wrapper">
                    <span class="search-icon">\u{1F50D}</span>
                    <input type="text" 
                           id="search-input" 
                           class="search-input" 
                           placeholder="Search across all tabs..."
                           autocomplete="off"
                           spellcheck="false" />
                    <kbd class="search-kbd">Esc</kbd>
                </div>
            </div>
            <div id="search-results" class="search-results"></div>
            <div class="search-footer">
                <span>\u2191\u2193 Navigate</span>
                <span>\u21B5 Go to</span>
                <span>Esc Close</span>
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
    on(dialog, "click", (e) => {
      if (e.target === dialog) {
        closeSearch();
      }
    });
  }
  function initGlobalSearch() {
    initSearchDialog();
    on(document, "keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openSearch();
      }
    });
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
      color = "#22c55e";
    } else if (score >= 50) {
      level = "good";
      label = "Good";
      color = "#eab308";
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
      feedback.textContent = strength.feedback.join(" \u2022 ");
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
            toast("Saved!", "success", 1500);
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
              toast("Failed! Content was modified by another session. Use Ctrl+R to reload and see changes, then try saving again.", "error", 5e3);
            } else {
              toast("Failed! " + data.message, "error", 2500);
            }
            _focusActiveTextarea();
          } else {
            toast("Save failed!", "error", 2500);
            _focusActiveTextarea();
          }
        } catch (error) {
          console.error("Save operation failed:", error);
          let errorMessage = "Save failed!";
          const err = error;
          if (err.name === "AbortError") {
            errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(request timeout)</span>";
          } else if (err.message.includes("HTTP")) {
            errorMessage += ` <br/> <span style='font-size: 0.9em; font-weight: normal'>(${err.message})</span>`;
          } else {
            errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(connection issue)</span>";
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
            toast("Site was deleted!", "success", 2e3);
            setTimeout(async () => {
              this.password = "";
              this.content = "";
              this.remote = { isNew: true, eContent: null, currentHashContent: null };
              await _setContentOfTabs("", this);
              this.initialIsNew = true;
              if (this.onFinishInitialization) this.onFinishInitialization();
            }, 2200);
          } else {
            toast("Failed! Site was modified in the meantime. Reload first.", "error", 5e3);
          }
        } catch (error) {
          console.error("Delete operation failed:", error);
          let errorMessage = "Deleting failed!";
          const err = error;
          if (err.name === "AbortError") {
            errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(request timeout)</span>";
          } else if (err.message.includes("HTTP")) {
            errorMessage += ` <br/> <span style='font-size: 0.9em; font-weight: normal'>(${err.message})</span>`;
          } else {
            errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(connection issue)</span>";
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
          toast("Reloaded!", "success", 500);
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
          toast("Reloading failed! <br/> <span style='font-size: 0.9em; font-weight: normal'>(connection issue)</span>", "error", 2500);
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
  function getQueryParam(name) {
    const url = new URL(window.location.href);
    const v = url.searchParams.get(name);
    return v && v.trim().length ? v.trim() : null;
  }
  function getSiteFromURL() {
    const path = window.location.pathname || "/";
    const seg = path.replace(/^\/+|\/+$/g, "");
    if (seg && seg !== "api") return seg;
    const qp = getQueryParam("site");
    return qp || "local-notes";
  }
  var SITE_ID = getSiteFromURL();
  var URL_PASSWORD = function() {
    const named = getQueryParam("password");
    if (named) return named;
    const qs2 = window.location.search || "";
    if (qs2.startsWith("?") && qs2.length > 1 && !qs2.includes("=")) {
      return decodeURIComponent(qs2.substring(1));
    }
    return null;
  }();
  var state = new ClientState(SITE_ID, URL_PASSWORD);
  window.state = state;
  var ignoreInputEvent = true;
  var healthCheckInterval = null;
  function initKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      const target = e.target;
      if (target.tagName === "INPUT" && target.type !== "color") return;
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;
      if (isCtrl && e.key === "s") {
        e.preventDefault();
        document.getElementById("button-save")?.click();
        return;
      }
      if (isCtrl && isAlt && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        document.getElementById("add_tab")?.click();
        return;
      }
      if (isCtrl && e.key === "r") {
        e.preventDefault();
        document.getElementById("button-reload")?.click();
        return;
      }
      if (isCtrl && isShift && e.key === "P") {
        e.preventDefault();
        document.getElementById("button-savenew")?.click();
        return;
      }
      if (isCtrl && isShift && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        document.getElementById("theme-toggle")?.click();
        return;
      }
      if (isCtrl && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        const tabs = document.querySelectorAll(".tab-header");
        if (tabs[tabIndex]) {
          tabs[tabIndex].querySelector(".tab-title")?.click();
        }
        return;
      }
      if (isCtrl && e.key === "Tab" && !isShift) {
        e.preventDefault();
        const tabs = document.querySelectorAll(".tab-header");
        const activeIndex = Array.from(tabs).findIndex((tab) => tab.classList.contains("active"));
        const nextIndex = (activeIndex + 1) % tabs.length;
        tabs[nextIndex]?.querySelector(".tab-title")?.click();
        return;
      }
      if (isCtrl && e.key === "Tab" && isShift) {
        e.preventDefault();
        const tabs = document.querySelectorAll(".tab-header");
        const activeIndex = Array.from(tabs).findIndex((tab) => tab.classList.contains("active"));
        const prevIndex = activeIndex === 0 ? tabs.length - 1 : activeIndex - 1;
        tabs[prevIndex]?.querySelector(".tab-title")?.click();
        return;
      }
      if (e.key === "F1") {
        e.preventDefault();
        showKeyboardShortcutsHelp();
        return;
      }
      if (e.key === "Escape") {
        const openDialog = document.querySelector("dialog[open]");
        if (openDialog) {
          openDialog.close();
        } else {
          focusActiveTextarea();
        }
        return;
      }
    });
  }
  function showKeyboardShortcutsHelp() {
    const shortcuts = [
      { keys: "Ctrl+S", desc: "Save notes" },
      { keys: "Ctrl+Alt+T", desc: "New tab" },
      { keys: "Ctrl+R", desc: "Reload from server" },
      { keys: "Ctrl+Shift+F", desc: "Global search" },
      { keys: "Ctrl+1-9", desc: "Switch to tab by number" },
      { keys: "Ctrl+Tab", desc: "Next tab" },
      { keys: "Ctrl+Shift+Tab", desc: "Previous tab" },
      { keys: "Ctrl+Shift+P", desc: "Change password" },
      { keys: "Ctrl+Shift+G", desc: "Toggle theme" },
      { keys: "F1", desc: "Show this help" },
      { keys: "Escape", desc: "Close dialogs or focus editor" }
    ];
    const helpText = shortcuts.map((s) => `<strong>${s.keys}</strong>: ${s.desc}`).join("<br>");
    showNotification(`<div style="text-align: left; line-height: 1.6;"><strong>\u{1F680} Keyboard Shortcuts</strong><br><br>${helpText}</div>`, "info", 8e3);
  }
  window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);
    showNotification("An unexpected error occurred. Please refresh the page.", "error");
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    showNotification("A network or processing error occurred. Please try again.", "error");
    event.preventDefault();
  });
  if ("performance" in window) {
    window.addEventListener("load", () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType("navigation")[0];
        if (perfData) {
          console.log("Page load time:", Math.round(perfData.loadEventEnd - perfData.fetchStart), "ms");
        }
      }, 0);
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
    healthCheckInterval = setInterval(async () => {
      const isHealthy = await checkServerHealth();
      if (!isHealthy) {
        showNotification("Connection to server lost. Please check your internet connection.", "warning");
      }
    }, 5 * 60 * 1e3);
  }
  function stopHealthMonitoring() {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
  }
  function updateButtonEnablement(isTextModified, isSiteNew) {
    const bSave = qs("#button-save");
    const bSaveNew = qs("#button-savenew");
    const bReload = qs("#button-reload");
    const bDelete = qs("#button-delete");
    if (!bSave || !bSaveNew || !bReload || !bDelete) return;
    bSave.disabled = !isTextModified;
    if (state.getInitialIsNew() === false && isTextModified) {
      window.onbeforeunload = () => "If you don't 'Save', you'll lose your changes.";
    } else {
      window.onbeforeunload = null;
    }
    bSaveNew.disabled = !!isSiteNew === true;
    bReload.disabled = false;
    bDelete.disabled = !!isSiteNew === true;
  }
  var updateStatusIndicator = (status, text) => {
    const indicator = qs("#status-indicator");
    const statusText = qs(".status-text");
    if (!indicator || !statusText) return;
    indicator.classList.remove("saving", "error", "modified");
    if (status && status !== "ready") indicator.classList.add(status);
    statusText.textContent = text || "Ready";
  };
  var updateLastSaved = () => {
    const lastSavedElement = qs("#last-saved");
    if (!lastSavedElement) return;
    const now = /* @__PURE__ */ new Date();
    const timeString = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    lastSavedElement.textContent = `Last saved: ${timeString}`;
    lastSavedElement.style.display = "inline";
  };
  var hideLastSaved = () => {
    const lastSavedElement = qs("#last-saved");
    if (lastSavedElement) {
      lastSavedElement.style.display = "none";
    }
  };
  document.addEventListener("input", (e) => {
    if (e.target instanceof HTMLTextAreaElement && e.target.classList.contains("textarea-contents")) {
      updateStatusIndicator("modified", "Modified");
      hideLastSaved();
    }
  });
  async function initSite() {
    if (!state.getIsNew() && URL_PASSWORD) {
      const ok = await state.setLoginPasswordAndContentIfCorrect(URL_PASSWORD);
      if (ok) {
        finishInitialization();
        return;
      }
    }
    if (state.getIsNew()) {
      await setContentOfTabs("", state);
      finishInitialization();
    } else {
      decryptContentAndFinishInitialization(false);
    }
  }
  async function finishInitialization(shouldSkipSettingContent) {
    state.setInitHashContent();
    updateButtonEnablement(state.getIsTextModified(), state.getIsNew());
    focusActiveTextarea();
    ignoreInputEvent = true;
    if (shouldSkipSettingContent !== true) {
      setContentOfTabs(state.getContent(), state);
    }
    setTimeout(() => {
      ignoreInputEvent = false;
    }, 50);
    try {
      const panel = qs(".tab-panel.active");
      const ta = panel && panel.querySelector("textarea.textarea-contents");
      if (ta) {
        const isHuge = ta.value && ta.value.length > 5e4;
        if (panel) panel.dataset.huge = isHuge ? "1" : "";
      }
    } catch {
    }
  }
  function decryptContentAndFinishInitialization(isOld) {
    const openPrompt = () => {
      openPasswordDialog({
        obscure: true,
        hideUI: true,
        onOk: async (pass) => {
          if (pass == null) {
            focusActiveTextarea();
            return false;
          }
          const ok = await state.setLoginPasswordAndContentIfCorrect(pass);
          if (ok) {
            finishInitialization();
            return true;
          }
          return false;
        }
      });
    };
    if (isOld === true) {
      state.setLoginPasswordAndContentIfCorrect(state.getPassword()).then((ok) => {
        if (!ok) openPrompt();
        else finishInitialization();
      });
    } else {
      openPrompt();
    }
  }
  function exportEncryptedBackup(eContent) {
    const title = `Cryptexa Encrypted Backup (${SITE_ID})`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body>
<h3>${title}</h3>
<p>Enter password to decrypt this backup locally (no network):</p>
<input type="password" id="pw" placeholder="Password"/>
<button id="dec">Decrypt</button>
<pre id="out" style="white-space:pre-wrap;margin-top:12px;"></pre>
<script>
const textEncoder = new TextEncoder(); const textDecoder = new TextDecoder();
function hexToBuf(hex){const len=hex.length/2;const out=new Uint8Array(len);for(let i=0;i<len;i++)out[i]=parseInt(hex.substr(i*2,2),16);return out.buffer;}
function bufToHex(buf){const arr=new Uint8Array(buf);let s="";for(let i=0;i<arr.length;i++)s+=arr[i].toString(16).padStart(2,"0");return s;}
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
    document.getElementById("out").textContent="Decryption failed (wrong password?)";
  }
};
<\/script>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cryptexa-backup-${SITE_ID}.html`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }
  function wireEvents() {
    let pendingRaf = 0;
    document.addEventListener("input", (e) => {
      if (!(e.target instanceof HTMLTextAreaElement)) return;
      if (!e.target.classList.contains("textarea-contents")) return;
      if (ignoreInputEvent) {
        e.preventDefault();
        return;
      }
      state.updateIsTextModified(true);
      const ta = e.target;
      const currentTabTitle2 = getCurrentTabTitle();
      if (pendingRaf) cancelAnimationFrame(pendingRaf);
      pendingRaf = requestAnimationFrame(() => {
        pendingRaf = 0;
        try {
          const start = ta.selectionStart;
          const isHuge = ta.value && ta.value.length > 5e4;
          if (!isHuge && start <= 201 && currentTabTitle2) {
            currentTabTitle2.textContent = getTitleFromContent(ta.value.substring(0, 200));
          }
        } catch {
        }
        const panel = ta.closest(".tab-panel");
        const gutter = panel && panel.querySelector(".line-gutter");
        const editorWrap = panel && panel.querySelector(".editor-wrap");
        if (gutter) {
          const isHuge = ta.value && ta.value.length > 5e4;
          if (isHuge) {
            const y = Math.round(ta.scrollTop || 0);
            gutter.style.setProperty("--gutter-scroll-y", String(-y));
            gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
            gutter.style.removeProperty("top");
            gutter.style.transform = "translateZ(0)";
            if (!gutter._lnDebounce) {
              gutter._lnDebounce = debounce(() => updateGutterForTextarea(ta, gutter), 120);
            }
            gutter._lnDebounce();
          } else {
            updateGutterForTextarea(ta, gutter);
          }
        }
        if (editorWrap) {
          updateActiveLineHighlight(ta, editorWrap);
          updateSelectedLinesHighlight(ta, editorWrap);
        }
      });
    });
    document.addEventListener("selectionchange", () => {
      const ta = document.activeElement;
      if (!(ta instanceof HTMLTextAreaElement)) return;
      if (!ta.classList.contains("textarea-contents")) return;
      const panel = ta.closest(".tab-panel");
      const editorWrap = panel && panel.querySelector(".editor-wrap");
      if (editorWrap) {
        updateActiveLineHighlight(ta, editorWrap);
        updateSelectedLinesHighlight(ta, editorWrap);
      }
    });
    document.addEventListener("mouseup", (e) => {
      if (!(e.target instanceof HTMLTextAreaElement)) return;
      if (!e.target.classList.contains("textarea-contents")) return;
      const ta = e.target;
      const panel = ta.closest(".tab-panel");
      const editorWrap = panel && panel.querySelector(".editor-wrap");
      if (editorWrap) {
        setTimeout(() => {
          updateActiveLineHighlight(ta, editorWrap);
          updateSelectedLinesHighlight(ta, editorWrap);
        }, 0);
      }
    });
    document.addEventListener("paste", (e) => {
      if (!(e.target instanceof HTMLTextAreaElement)) return;
      if (!e.target.classList.contains("textarea-contents")) return;
      const currentTabTitle2 = getCurrentTabTitle();
      setTimeout(() => {
        const ta = e.target;
        const isHuge = ta.value && ta.value.length > 5e4;
        if (!isHuge && currentTabTitle2) {
          currentTabTitle2.textContent = getTitleFromContent();
        }
        const panel = ta.closest(".tab-panel");
        const gutter = panel && panel.querySelector(".line-gutter");
        if (gutter) {
          if (isHuge) {
            if (!gutter._lnDebounce) {
              gutter._lnDebounce = debounce(() => updateGutterForTextarea(ta, gutter), 120);
            }
            gutter._lnDebounce();
          } else {
            updateGutterForTextarea(ta, gutter);
          }
        }
      }, 50);
    });
    document.addEventListener("keydown", (e) => {
      const ta = document.activeElement;
      const isTextarea = ta && ta.classList && ta.classList.contains("textarea-contents");
      const key = e.key || e.code;
      if (isTextarea && key === "Tab" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = ta.value;
        ta.value = val.substring(0, start) + "    " + val.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 4;
        state.updateIsTextModified(true);
        return;
      }
    });
    on(qs("#enterpassword"), "keypress", (e) => {
      const event = e;
      if (event.which === 13 || event.key === "Enter") {
        event.preventDefault();
        const decryptButton = qs("#dialog-password button[value='ok']");
        if (decryptButton && !decryptButton.disabled) {
          decryptButton.click();
        }
      }
    });
    on(qs("#newpassword2"), "keypress", (e) => {
      const event = e;
      if (event.which === 13 || event.key === "Enter") {
        const saveButton = qs("#dialog-new-password button[value='ok']");
        if (saveButton) {
          saveButton.click();
        }
        event.preventDefault();
      }
    });
    on(qs("#button-save"), "click", () => state.saveSite(state.getIsNew()));
    on(qs("#button-savenew"), "click", () => state.saveSite(true));
    on(qs("#button-reload"), "click", () => state.reloadSite());
    on(qs("#button-delete"), "click", () => {
      openConfirmDialog("#dialog-confirm-delete-site", async (ok) => {
        if (ok) state.deleteSite();
        else focusActiveTextarea();
      });
    });
    on(qs("#help-button"), "click", () => {
      showKeyboardShortcutsHelp();
    });
    setupKeyboardShortcuts();
    if (!qs("#button-export")) {
      const backupBtn = document.createElement("button");
      backupBtn.id = "button-export";
      backupBtn.textContent = "Export Encrypted Backup";
      backupBtn.title = "Download encrypted backup (before decrypt)";
      backupBtn.className = "";
      qs("#menubar-buttons")?.appendChild(backupBtn);
      on(backupBtn, "click", () => {
        const eContent = state.remote.eContent;
        if (!eContent) {
          toast("Nothing to export yet", "warning", 1200);
          return;
        }
        exportEncryptedBackup(eContent);
      });
    }
  }
  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      const target = e.target;
      if (target.tagName === "INPUT" && target.type !== "textarea") return;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (isCtrlOrCmd && key === "r" && !e.shiftKey) {
        e.preventDefault();
        if (!qs("#button-reload").disabled) {
          state.reloadSite();
        }
        return;
      }
      if (isCtrlOrCmd && key === "t" && !e.altKey) {
        e.preventDefault();
        addTab(false, "", null, () => state.updateIsTextModified(true));
        return;
      }
      if (isCtrlOrCmd && key === "w") {
        const headers = qsa(".tab-header");
        if (headers.length > 1) {
          e.preventDefault();
          const activeHeader = qs(".tab-header.active");
          if (activeHeader) {
            const closeBtn = activeHeader.querySelector(".close");
            if (closeBtn) closeBtn.click();
          }
        }
        return;
      }
      if (isCtrlOrCmd && e.shiftKey && key === "s") {
        e.preventDefault();
        if (!qs("#button-savenew").disabled) {
          state.saveSite(true);
        }
        return;
      }
      if (isCtrlOrCmd && key === "e") {
        e.preventDefault();
        qs("#button-export")?.click();
        return;
      }
      if (isCtrlOrCmd && key >= "1" && key <= "9") {
        e.preventDefault();
        const tabIndex = parseInt(key) - 1;
        const headers = qsa(".tab-header");
        if (headers[tabIndex]) {
          activateTab(headers[tabIndex]);
        }
        return;
      }
      if (key === "escape") {
        focusActiveTextarea();
        return;
      }
    });
  }
  (async function bootstrap() {
    state.onButtonEnablementChange = updateButtonEnablement;
    state.onStatusChange = updateStatusIndicator;
    state.onLastSavedUpdate = updateLastSaved;
    state.onFinishInitialization = finishInitialization;
    state.onDecryptAndFinish = decryptContentAndFinishInitialization;
    requestAnimationFrame(async () => {
      const path = window.location.pathname || "/";
      const seg = path.replace(/^\/+|\/+$/g, "");
      const qp = getQueryParam("site");
      const hasSiteId = seg && seg !== "api" || qp;
      if (!hasSiteId) return;
      await state.init();
      initTabsLayout(() => state.updateIsTextModified(true));
      onWindowResize();
      wireEvents();
      startHealthMonitoring();
      if (state.getIsNew() || !state.remote.eContent) {
        await setContentOfTabs("", state);
        finishInitialization();
      } else {
        setPasswordMode(true, { hide: true });
        initSite();
      }
    });
  })();
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    wireThemeToggle();
    initKeyboardShortcuts();
    initGlobalSearch();
    initPasswordStrengthIndicators();
    const path = window.location.pathname || "/";
    const seg = path.replace(/^\/+|\/+$/g, "");
    const qp = new URL(window.location.href).searchParams.get("site");
    const isLanding = !(seg && seg !== "api" || qp);
    initKineticBackground(isLanding);
    initKineticButtons();
    replaceLoaderWithKinetic();
    const helpButton = qs("#help-button");
    if (helpButton && !qs("#search-button")) {
      const searchButton = document.createElement("button");
      searchButton.id = "search-button";
      searchButton.title = "Global Search (Ctrl+Shift+F)";
      searchButton.style.cssText = "padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--panel); color: var(--text); cursor: pointer; font-size: 14px;";
      searchButton.textContent = "\u{1F50D}";
      searchButton.addEventListener("click", openSearch);
      helpButton.parentNode?.insertBefore(searchButton, helpButton);
    }
    const globalColorPicker = document.getElementById("tab-color-picker");
    if (globalColorPicker) {
      globalColorPicker.addEventListener("input", (e) => {
        try {
          const activeTab = document.querySelector(".tab-header.active");
          if (activeTab) {
            const target = e.target;
            const newColor = target.value;
            activeTab.style.backgroundColor = newColor;
          }
        } catch (error) {
          console.error("Error updating tab color preview:", error);
        }
      });
      globalColorPicker.addEventListener("change", (e) => {
        try {
          const activeTab = document.querySelector(".tab-header.active");
          if (activeTab) {
            const target = e.target;
            const newColor = target.value;
            if (!/^#[0-9A-F]{6}$/i.test(newColor)) {
              console.warn("Invalid color format:", newColor);
              return;
            }
            activeTab.dataset.tabColor = newColor;
            activeTab.style.backgroundColor = newColor;
            state.updateIsTextModified(true);
          }
        } catch (error) {
          console.error("Error updating tab color persistence:", error);
        }
      });
    }
  });
})();
//# sourceMappingURL=app.js.map
