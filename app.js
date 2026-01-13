/*
  Cryptexa - Client-side encrypted notes with server persistence
  Enhancements:
    1) Site selection via ?site=mysite and optional ?password auto-decrypt
    2) Ciphertext format: saltHex:ivHex:cipherHex (salt embedded for portability)
    3) True overwrite protection: server returns currentHashContent; client must send matching initHashContent to save/delete
    4) "Export Encrypted Backup" button available before decrypting (downloads minimal HTML that can prompt for password and decrypt)

  API:
    GET  /api/json?site=SITE
      -> { status:"success", isNew, eContent, currentDBVersion, expectedDBVersion, currentHashContent }
    POST /api/save
      body: { site, initHashContent, currentHashContent, encryptedContent }
      -> { status:"success", currentHashContent } | { status:"error", message }
    POST /api/delete
      body: { site, initHashContent }
      -> { status:"success" } | { status:"error", message }
*/

// ---------- Config ----------
function getQueryParam(name) {
  const url = new URL(window.location.href);
  const v = url.searchParams.get(name);
  return v && v.trim().length ? v.trim() : null;
}
// Prefer path segment /:site; fallback to ?site=; else default
function getSiteFromURL() {
  const path = window.location.pathname || "/";
  // Normalize: remove leading/trailing slashes
  const seg = path.replace(/^\/+|\/+$/g, "");
  if (seg && seg !== "api") return seg;
  const qp = getQueryParam("site");
  return qp || "local-notes";
}
const SITE_ID = getSiteFromURL();
// Accept either ?password=... or raw ?YourPass (whole querystring as password)
const URL_PASSWORD = (function () {
  const named = getQueryParam("password");
  if (named) return named;
  const qs = window.location.search || "";
  if (qs.startsWith("?") && qs.length > 1 && !qs.includes("=")) {
    return decodeURIComponent(qs.substring(1));
  }
  return null;
})();

// ---------- Keyboard Shortcuts ----------
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Skip if user is typing in input fields
    if (e.target.tagName === 'INPUT' && e.target.type !== 'color') return;

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;

    // Ctrl+S: Save
    if (isCtrl && e.key === 's') {
      e.preventDefault();
      document.getElementById('button-save')?.click();
      return;
    }

    // Ctrl+Alt+T: New Tab
    if (isCtrl && isAlt && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      document.getElementById('add_tab')?.click();
      return;
    }

    // Ctrl+R: Reload
    if (isCtrl && e.key === 'r') {
      e.preventDefault();
      document.getElementById('button-reload')?.click();
      return;
    }

    // Ctrl+Shift+P: Change Password
    if (isCtrl && isShift && e.key === 'P') {
      e.preventDefault();
      document.getElementById('button-savenew')?.click();
      return;
    }

    // Removed delete site shortcut as requested

    // Ctrl+Shift+G: Toggle Theme
    if (isCtrl && isShift && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault();
      document.getElementById('theme-toggle')?.click();
      return;
    }

    // Ctrl+1-9: Switch to tab by number
    if (isCtrl && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const tabIndex = parseInt(e.key) - 1;
      const tabs = document.querySelectorAll('.tab-header');
      if (tabs[tabIndex]) {
        tabs[tabIndex].querySelector('.tab-title')?.click();
      }
      return;
    }

    // Ctrl+Tab: Next tab
    if (isCtrl && e.key === 'Tab' && !isShift) {
      e.preventDefault();
      const tabs = document.querySelectorAll('.tab-header');
      const activeIndex = Array.from(tabs).findIndex(tab => tab.classList.contains('active'));
      const nextIndex = (activeIndex + 1) % tabs.length;
      tabs[nextIndex]?.querySelector('.tab-title')?.click();
      return;
    }

    // Ctrl+Shift+Tab: Previous tab
    if (isCtrl && e.key === 'Tab' && isShift) {
      e.preventDefault();
      const tabs = document.querySelectorAll('.tab-header');
      const activeIndex = Array.from(tabs).findIndex(tab => tab.classList.contains('active'));
      const prevIndex = activeIndex === 0 ? tabs.length - 1 : activeIndex - 1;
      tabs[prevIndex]?.querySelector('.tab-title')?.click();
      return;
    }

    // F1: Show keyboard shortcuts help
    if (e.key === 'F1') {
      e.preventDefault();
      showKeyboardShortcutsHelp();
      return;
    }

    // Escape: Close dialogs or focus textarea
    if (e.key === 'Escape') {
      const openDialog = document.querySelector('dialog[open]');
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
    { keys: 'Ctrl+S', desc: 'Save notes' },
    { keys: 'Ctrl+Alt+T', desc: 'New tab' },
    { keys: 'Ctrl+R', desc: 'Reload from server' },
    { keys: 'Ctrl+1-9', desc: 'Switch to tab by number' },
    { keys: 'Ctrl+Tab', desc: 'Next tab' },
    { keys: 'Ctrl+Shift+Tab', desc: 'Previous tab' },
    { keys: 'Ctrl+Shift+P', desc: 'Change password' },
    { keys: 'Ctrl+Shift+G', desc: 'Toggle theme' },
    { keys: 'F1', desc: 'Show this help' },
    { keys: 'Escape', desc: 'Close dialogs or focus editor' }
  ];

  const helpText = shortcuts.map(s => `<strong>${s.keys}</strong>: ${s.desc}`).join('<br>');
  showNotification(`<div style="text-align: left; line-height: 1.6;"><strong>🚀 Keyboard Shortcuts</strong><br><br>${helpText}</div>`, 'info', 8000);
}

// Function is now handled via event listener instead of onclick

// ---------- Production Error Handling ----------
function showNotification(message, type = 'info', duration = 5000) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = message; // Changed to innerHTML to support HTML content

  // Add to DOM
  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => notification.classList.add('show'), 10);

  // Auto remove
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
}

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  showNotification('An unexpected error occurred. Please refresh the page.', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showNotification('A network or processing error occurred. Please try again.', 'error');
  event.preventDefault();
});

// Performance monitoring
if ('performance' in window) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      if (perfData) {
        console.log('Page load time:', Math.round(perfData.loadEventEnd - perfData.fetchStart), 'ms');
      }
    }, 0);
  });
}

// Health check function
async function checkServerHealth() {
  try {
    const response = await fetch('/health', { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

// Periodic health check (every 5 minutes)
let healthCheckInterval;
function startHealthMonitoring() {
  healthCheckInterval = setInterval(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      showNotification('Connection to server lost. Please check your internet connection.', 'warning');
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Stop health monitoring
// eslint-disable-next-line no-unused-vars
function stopHealthMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}




// ---------- Utilities: Network and Error Handling ----------

// Retry fetch with exponential backoff
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;

    } catch (error) {
      lastError = error;

      // Don't retry on abort or non-network errors
      if (error.name === 'AbortError' || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Debounce function for performance
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

// ---------- Utilities: Crypto primitives (Web Crypto) ----------

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function sha512Hex(input) {
  const data = typeof input === "string" ? textEncoder.encode(input) : input;
  const buf = await crypto.subtle.digest("SHA-512", data);
  return bufToHex(buf);
}
function bufToHex(buf) {
  const arr = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, "0");
  return s;
}
function hexToBuf(hex) {
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out.buffer;
}
async function pbkdf2KeyFromPassword(password, saltHex, iterations = 150000) {
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
function randomHex(bytes = 12) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return bufToHex(b.buffer);
}
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
    // Normalize occasional WebCrypto errors without throwing to callers
    return "";
  }
}

// ---------- Separator ----------
let separatorHexCache = null;
async function getSeparatorHex() {
  if (!separatorHexCache) {
    separatorHexCache = await sha512Hex("-- tab separator --");
  }
  return separatorHexCache;
}

// ---------- Client State ----------
class ClientState {
  constructor() {
    this.site = SITE_ID;
    this.currentDBVersion = 2;
    this.expectedDBVersion = 2;

    this.siteHash = null; // SHA512(site)
    this.isTextModified = false;
    this.initHashContent = null;   // hash of initial decrypted content (from server's perspective)
    this.content = ""; // joined tabs
    this.password = ""; // user password
    this.initialIsNew = true;
    this.mobileAppMetadataTabContent = "";

    this.remote = {
      isNew: true,
      eContent: null,             // saltHex:ivHex:cipherHex
      currentHashContent: null    // returned by server to enforce overwrite protection
    };
  }

  getIsNew() { return !!this.remote.isNew; }
  getInitialIsNew() { return this.initialIsNew; }
  getIsTextModified() { return this.isTextModified; }
  getContent() { return this.content; }
  getPassword() { return this.password; }
  getMobileAppMetadataTabContent() { return this.mobileAppMetadataTabContent; }
  setMobileAppMetadataTabContent(m) { this.mobileAppMetadataTabContent = m || ""; }

  updateIsTextModified(mod) {
    if (this.isTextModified === mod) return;
    this.isTextModified = mod;
    updateButtonEnablement(this.isTextModified, this.getIsNew());
  }

  async init() {
    this.siteHash = await sha512Hex(this.site);
    await this.reloadFromServer();
    this.initialIsNew = this.getIsNew();
  }

  // Concurrency token (non-crypto) for overwrite detection. AES-GCM ensures confidentiality/integrity.
  computeHashContentForDBVersion(contentForHash, passwordForHash, dbVersion) {
    const weak = simpleWeakHash(`${contentForHash}::${passwordForHash}`);
    return weak + String(dbVersion);
  }

  setInitHashContent() {
    // Initial hash equals the server's currentHashContent once we decrypted content or empty on new
    if (this.remote.currentHashContent) {
      this.initHashContent = this.remote.currentHashContent;
    } else {
      // For new site, compute based on current blank content
      this.initHashContent = this.computeHashContentForDBVersion(this.content, this.password || "", this.currentDBVersion);
    }
  }

  async _getDecryptedContent(pass) {
    if (!this.remote.eContent) return null;
    try {
      const parts = this.remote.eContent.split(":");
      if (parts.length !== 3) return null;
      const [saltHex, ivHex, cipherHex] = parts;
      const plain = await aesGcmDecryptHex(ivHex, cipherHex, pass, saltHex);
      if (plain && plain.endsWith(this.siteHash)) {
        return plain;
      }
      return null;
    } catch {
      return null;
    }
  }

  // Try to decrypt using provided pass; returns true/false
  async setLoginPasswordAndContentIfCorrect(pass) {
    const plain = await this._getDecryptedContent(pass);
    if (plain !== null) {
      this.content = plain.slice(0, plain.length - this.siteHash.length);
      this.password = pass;
      return true;
    }
    return false;
  }

  async saveSite(newPass) {
    const executeSaveSite = async (passwordToUse) => {
      this.content = await getContentFromTabs();


      const newHashContent = this.computeHashContentForDBVersion(this.content, passwordToUse, this.expectedDBVersion);

      // Create new salt every save for portability; embed in ciphertext
      const saltHex = randomHex(16);
      const { ivHex, cipherHex } = await aesGcmEncryptHex(String(this.content + this.siteHash), passwordToUse, saltHex);
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
          // Update initHashContent baseline to server-returned value
          this.initHashContent = this.remote.currentHashContent;
          this.password = passwordToUse;
          this.currentDBVersion = this.expectedDBVersion;
          this.isTextModified = false;
          updateStatusIndicator("ready", "Ready");
          updateLastSaved();
          finishInitialization(true);
        } else if (data.message) {
          if (data.message.includes("modified in the meantime")) {
            toast("Failed! Content was modified by another session. Use Ctrl+R to reload and see changes, then try saving again.", "error", 5000);
          } else {
            toast("Failed! " + data.message, "error", 2500);
          }
          focusActiveTextarea();
        } else {
          toast("Save failed!", "error", 2500);
          focusActiveTextarea();
        }
      } catch (error) {
        console.error('Save operation failed:', error);
        let errorMessage = "Save failed!";

        if (error.name === 'AbortError') {
          errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(request timeout)</span>";
        } else if (error.message.includes('HTTP')) {
          errorMessage += ` <br/> <span style='font-size: 0.9em; font-weight: normal'>(${error.message})</span>`;
        } else {
          errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(connection issue)</span>";
        }

        toast(errorMessage, "error", 2500);
        focusActiveTextarea();
      } finally {
        showLoader(false);
      }
    };

    if (newPass === true) {
      openNewPasswordDialog({
        title: this.getIsNew() ? "Create password" : "Change password",
        onSave: async (pass1, pass2) => {
          if (pass1.length === 0) {
            showHint("#passwords-empty"); hideHint("#passwords-dont-match");
            return false;
          }
          if (pass1 !== pass2) {
            showHint("#passwords-dont-match"); hideHint("#passwords-empty");
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
          toast("Site was deleted!", "success", 2000);
          setTimeout(async () => {
            this.password = "";
            this.content = "";
            this.remote = { isNew: true, eContent: null, currentHashContent: null };
            await setContentOfTabs("");
            this.initialIsNew = true;
            finishInitialization();
          }, 2200);
        } else {
          toast("Failed! Site was modified in the meantime. Reload first.", "error", 5000);
        }
      } catch (error) {
        console.error('Delete operation failed:', error);
        let errorMessage = "Deleting failed!";

        if (error.name === 'AbortError') {
          errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(request timeout)</span>";
        } else if (error.message.includes('HTTP')) {
          errorMessage += ` <br/> <span style='font-size: 0.9em; font-weight: normal'>(${error.message})</span>`;
        } else {
          errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(connection issue)</span>";
        }

        toast(errorMessage, "error", 2500);
        focusActiveTextarea();
      } finally {
        showLoader(false);
      }
    };

    // First show confirmation dialog
    openConfirmDialog("#dialog-confirm-delete-site", async (ok) => {
      if (ok) {
        // Then require password confirmation
        openDeletePasswordDialog({
          onOk: async (enteredPassword) => {
            // For a new, unsaved site, there's no remote content.
            // The user might have set a password for saving, which is in this.password.
            if (!this.remote.eContent) {
              if (enteredPassword === this.password) {
                await runDelete();
                return true;
              }
              return false;
            }

            const isCorrect = (await this._getDecryptedContent(enteredPassword)) !== null;
            if (isCorrect) {
              await runDelete();
              return true;
            }
            return false;
          }
        });
      } else {
        focusActiveTextarea();
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
    // Set initHashContent baseline to server's current
    this.initHashContent = this.remote.currentHashContent || null;
  }

  // Check if content has been modified by another session


  async reloadSite() {
    const executeReload = async () => {
      showLoader(true);
      try {
        await this.reloadFromServer();
        toast("Reloaded!", "success", 500);
        this.isTextModified = false;
        updateStatusIndicator("ready", "Ready");

        if (this.remote.isNew || !this.remote.eContent) {
          this.content = "";
          // If no site id (root path without /:site and no ?site), do not prompt for password; stay on landing
          const pathSeg = (window.location.pathname || "/").replace(/^\/+|\/+$/g, "");
          const hasSiteFromPath = !!(pathSeg && pathSeg !== "api");
          const hasSiteFromQuery = !!(new URL(window.location.href).searchParams.get("site"));
          if (!hasSiteFromPath && !hasSiteFromQuery) {
            await setContentOfTabs("");
            finishInitialization();
            return;
          }
          finishInitialization();
        } else {
          // If URL contains password, try it first
          if (URL_PASSWORD) {
            const ok = await this.setLoginPasswordAndContentIfCorrect(URL_PASSWORD);
            if (ok) {
              finishInitialization();
              return;
            }
          }
          const ok = await this.setLoginPasswordAndContentIfCorrect(this.password);
          if (!ok) {
            decryptContentAndFinishInitialization(false);
            return;
          }
          decryptContentAndFinishInitialization(true);
        }
      } catch {
        toast("Reloading failed! <br/> <span style='font-size: 0.9em; font-weight: normal'>(connection issue)</span>", "error", 2500);
        focusActiveTextarea();
      } finally {
        showLoader(false);
      }
    };

    if (this.isTextModified) {
      openConfirmDialog("#dialog-confirm-reload", async (ok) => {
        if (ok) await executeReload();
        else focusActiveTextarea();
      });
    } else {
      await executeReload();
    }
  }
}

// Simple weak hash (non-crypto) only for concurrency token
function simpleWeakHash(str) {
  let h1 = 0x811c9dc5, h2 = 0x1000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c; h1 = Math.imul(h1, 0x01000193);
    h2 += c + (h2 << 1) + (h2 << 4) + (h2 << 7) + (h2 << 8) + (h2 << 24);
  }
  return (Math.abs(h1) + Math.abs(h2)).toString(16);
}

// ---------- Global state ----------
let state = new ClientState();
let currentTabTitle = null;
let currentTextarea = null;
let ignoreInputEvent = true;

// ---------- DOM helpers ----------
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function on(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); }

function showLoader(onFlag) {
  qs("#loader").style.display = onFlag ? "flex" : "none";
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
    // Prefer masking with blur + opacity for privacy; optionally hide for stricter mode
    if (opts.hide) {
      menubar && menubar.classList.add("app-hidden");
      main && main.classList.add("app-hidden");
      menubar && menubar.classList.remove("app-masked");
      main && main.classList.remove("app-masked");
    } else {
      menubar && menubar.classList.add("app-masked");
      main && main.classList.add("app-masked");
      menubar && menubar.classList.remove("app-hidden");
      main && main.classList.remove("app-hidden");
    }
  } else {
    html.classList.remove("password-mode");
    ov.classList.add("hidden");
    menubar && menubar.classList.remove("app-masked", "app-hidden");
    main && main.classList.remove("app-masked", "app-hidden");
  }
}
// Enhanced toast notification system
function toast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) {
    const outer = qs("#outer-toast"), el = qs("#toast");
    if (outer && el) {
      el.innerHTML = message;
      outer.style.display = "block";
      outer.style.opacity = "1";
      setTimeout(() => outer.style.display = "none", duration);
    }
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  toast.innerHTML = `<div class="toast-content"><span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button></div>`;
  container.appendChild(toast);
  setTimeout(() => toast.parentElement && toast.remove(), duration);
}

// Dialog helpers using <dialog> with async validation (keep open on error)
const openPasswordDialog = ({ onOk, obscure = true, hideUI = false }) => {
  const dlg = qs("#dialog-password"), input = qs("#enterpassword");
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
        return; // keep dialog open
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
const openDeletePasswordDialog = ({ onOk }) => {
  const dlg = qs("#dialog-delete-password"), input = qs("#deletepassword");
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
        return; // keep dialog open
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

const openNewPasswordDialog = ({ title, onSave }) => {
  const dlg = qs("#dialog-new-password"), titleEl = qs("#dialog-new-password-title"), p1 = qs("#newpassword1"), p2 = qs("#newpassword2");
  titleEl.textContent = title || "Create password";
  hideHint("#passwords-empty");
  hideHint("#passwords-dont-match");
  dlg.returnValue = "cancel";
  dlg.showModal();
  setTimeout(() => (p1.value = "", p2.value = "", p1.focus()), 0);
  const handler = async () => {
    const ok = dlg.returnValue === "ok";
    if (!ok) return dlg.removeEventListener("close", handler);
    const proceed = await onSave(p1.value, p2.value);
    proceed ? dlg.removeEventListener("close", handler) : setTimeout(() => dlg.showModal(), 0);
  };
  dlg.addEventListener("close", handler);
};
const openConfirmDialog = (selector, cb) => {
  const dlg = qs(selector);
  dlg.returnValue = "cancel";
  dlg.showModal();
  const handler = () => {
    dlg.removeEventListener("close", handler);
    cb(dlg.returnValue === "ok");
  };
  dlg.addEventListener("close", handler);
};
const showHint = sel => qs(sel)?.style.setProperty('display', 'block');
const hideHint = sel => qs(sel)?.style.setProperty('display', 'none');

// ---------- Tabs UI ----------
function initTabsLayout() {
  // Single click for tab switching only
  on(qs(".tab-headers-container"), "click", (e) => {
    const li = e.target.closest(".tab-header");
    const close = e.target.closest(".close");

    // For close button: switch to tab but prevent close action
    if (close && li) {
      e.preventDefault();
      e.stopPropagation();
      activateTab(li); // Switch to the tab first
      return;
    }

    if (li) activateTab(li);
  });

  // Double click for close button and color picker
  on(qs(".tab-headers-container"), "dblclick", (e) => {
    const li = e.target.closest(".tab-header");
    const close = e.target.closest(".close");

    if (close && li) {
      const headers = qsa(".tab-header");
      if (headers.length <= 1) return;
      const idx = headers.indexOf(li);
      openConfirmDialog("#dialog-confirm-delete-tab", (ok) => {
        if (!ok) { focusActiveTextarea(); return; }
        const tabId = li.dataset.tabId;
        li.remove();
        const panel = qs(`#${tabId}`);
        panel && panel.remove();
        const newHeaders = qsa(".tab-header");
        const toActivate = newHeaders[Math.max(0, idx - 1)];
        if (toActivate) activateTab(toActivate);
        state.updateIsTextModified(true);
        refreshTabs();
      });
      return;
    }
  });

  on(qs("#add_tab"), "click", () => {
    const activeTab = qs(".tab-header.active");
    addTab(false, "", activeTab);
  });

  initTabDragAndDrop();
  refreshTabs();
  onWindowResize();
  window.addEventListener("resize", onWindowResize);
}

function refreshTabs() {
  const headers = qsa(".tab-header");
  headers.forEach(h => {
    const closer = h.querySelector(".close");
    if (closer) closer.style.display = headers.length > 1 ? "" : "none";
  });
  focusActiveTextarea();
}

function initTabDragAndDrop() {
  let draggedTab = null;
  let draggedPanel = null;

  const container = qs(".tab-headers-container");

  container.addEventListener("dragstart", (e) => {
    const tabHeader = e.target.closest(".tab-header");
    if (!tabHeader) return;

    draggedTab = tabHeader;
    draggedPanel = qs(`#${tabHeader.dataset.tabId}`);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", tabHeader.outerHTML);

    // Add visual feedback
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
    e.dataTransfer.dropEffect = "move";

    const afterElement = getDragAfterElement(container, e.clientX);
    const dragging = qs(".tab-header[style*='opacity']");

    if (afterElement == null) {
      container.appendChild(dragging);
    } else {
      container.insertBefore(dragging, afterElement);
    }
  });

  container.addEventListener("drop", (e) => {
    e.preventDefault();

    if (!draggedTab || !draggedPanel) return;

    // Reorder the corresponding panel
    const tabsContainer = qs("#tabs");
    const afterElement = getDragAfterElement(container, e.clientX);

    if (afterElement == null) {
      tabsContainer.appendChild(draggedPanel);
    } else {
      const afterPanelId = afterElement.dataset.tabId;
      const afterPanel = qs(`#${afterPanelId}`);
      if (afterPanel) {
        tabsContainer.insertBefore(draggedPanel, afterPanel);
      }
    }

    state.updateIsTextModified(true);
  });
}

function getDragAfterElement(container, x) {
  const draggableElements = [...container.querySelectorAll(".tab-header:not([style*='opacity'])")];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = x - box.left - box.width / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
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

// Get line number from character position
function getLineNumberFromPosition(text, position) {
  if (position < 0) return 1;
  const textUpToPosition = text.substring(0, position);
  return textUpToPosition.split('\n').length;
}



// Get line height from textarea
function getLineHeight(ta) {
  const computedStyle = window.getComputedStyle(ta);
  return parseInt(computedStyle.lineHeight) || parseInt(computedStyle.fontSize) * 1.2;
}

// Update active line highlight
function updateActiveLineHighlight(ta, editorWrap) {
  // Remove existing active line highlights
  const existingHighlights = editorWrap.querySelectorAll('.active-line');
  existingHighlights.forEach(el => el.remove());

  // Get cursor position
  const cursorPos = ta.selectionStart;
  const text = ta.value;

  // Get line number
  const lineNumber = getLineNumberFromPosition(text, cursorPos);

  // Create highlight element
  const highlight = document.createElement('div');
  highlight.className = 'active-line';

  // Calculate position
  const lineHeight = getLineHeight(ta);
  const top = (lineNumber - 1) * lineHeight + parseInt(window.getComputedStyle(ta).paddingTop);

  // Set position and dimensions
  highlight.style.top = `${top}px`;
  highlight.style.height = `${lineHeight}px`;

  // Add to editor wrap
  editorWrap.appendChild(highlight);
}

// Update selected lines highlight
function updateSelectedLinesHighlight(ta, editorWrap) {
  // Remove existing selected line highlights
  const existingHighlights = editorWrap.querySelectorAll('.selected-line');
  existingHighlights.forEach(el => el.remove());

  // Check if there's a selection
  const selectionStart = ta.selectionStart;
  const selectionEnd = ta.selectionEnd;

  if (selectionStart === selectionEnd) return; // No selection

  const text = ta.value;

  // Get start and end line numbers
  const startLine = getLineNumberFromPosition(text, selectionStart);
  const endLine = getLineNumberFromPosition(text, selectionEnd);

  // Get line height
  const lineHeight = getLineHeight(ta);
  const paddingTop = parseInt(window.getComputedStyle(ta).paddingTop);

  // Create highlight elements for each selected line
  for (let i = startLine; i <= endLine; i++) {
    const highlight = document.createElement('div');
    highlight.className = 'selected-line';

    // Calculate position
    const top = (i - 1) * lineHeight + paddingTop;

    // Set position and dimensions
    highlight.style.top = `${top}px`;
    highlight.style.height = `${lineHeight}px`;

    // Add to editor wrap
    editorWrap.appendChild(highlight);
  }
}

function activateTab(headerLi) {
  // Batch DOM mutations to avoid repeated style/layout passes
  const headers = qsa(".tab-header");
  const panels = qsa(".tab-panel");
  const id = headerLi.dataset.tabId;
  const panel = qs(`#${id}`);

  // Use a document fragment-like batching via requestAnimationFrame
  requestAnimationFrame(() => {
    headers.forEach(h => h.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    headerLi.classList.add("active");
    if (panel) panel.classList.add("active");

    // Defer heavy work to idle time to keep tab switch snappy
    setTimeout(() => {
      focusActiveTextarea();
      const ta = panel && panel.querySelector("textarea.textarea-contents");
      const gutter = panel && panel.querySelector(".line-gutter");
      if (ta && gutter) {
        // For very large notes, avoid regenerating entire gutter if not needed
        // Only sync scroll transform first; regenerate numbers lazily
        const y = Math.round(ta.scrollTop || 0);
        gutter.style.setProperty("--gutter-scroll-y", String(-y));
        gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
        gutter.style.removeProperty("top");
        gutter.style.transform = "translateZ(0)";

        // Lazy line number update for big docs
        const needsHeavyUpdate = (ta.value && ta.value.length > 50000);
        if (needsHeavyUpdate) {
          // Generate numbers off main turn to avoid blocking the click
          setTimeout(() => updateGutterForTextarea(ta, gutter), 0);
        } else {
          updateGutterForTextarea(ta, gutter);
        }
      }
    }, 0);
  });
}

let tabCounter = 1;
function addTab(isExistingTab, contentIfAvailable = "", insertAfter = null) {
  const headersContainer = qs(".tab-headers-container");
  const id = `tab-${tabCounter++}`;

  // Parse content and color metadata
  let actualContent = contentIfAvailable;
  let tabColor = null;

  // Check if content has color metadata
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

  // Store color in dataset
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
  span.textContent = "×";

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

  // Initial content
  if (actualContent && actualContent.length > 0) {
    ta.value = actualContent;
    // Compute initial title from the first 200 chars only (fast even for large notes)
    a.textContent = getTitleFromContent(actualContent.substring(0, 200));
  } else {
    // Ensure title reflects actual content if empty/whitespace
    a.textContent = getTitleFromContent("");
  }



  // Wire updates
  let rafId = 0;
  ta.addEventListener("input", () => {
    // coalesce rapid input events into a single rAF update
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      updateGutter();
    });
  });

  // Sync gutter vertical offset with textarea scroll using CSS transform
  // Throttle scroll events for large notes to reduce main-thread work
  let lastScrollTs = 0;
  ta.addEventListener("scroll", () => {
    const now = performance.now ? performance.now() : Date.now();
    const isHuge = (ta.value && ta.value.length > 50000);
    if (isHuge && now - lastScrollTs < 16) {
      // ~60fps throttle
      return;
    }
    lastScrollTs = now;
    const y = Math.round(ta.scrollTop || 0);
    gutter.style.setProperty("--gutter-scroll-y", String(-y));
    gutter.style.removeProperty("top");
    gutter.style.transform = "translateZ(0)";
    gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
  });

  // Ensure initial render
  // For huge notes, defer full line number generation slightly
  const isHuge = (ta.value && ta.value.length > 50000);
  if (isHuge) {
    setTimeout(updateGutter, 0);
  } else {
    requestAnimationFrame(updateGutter);
  }

  // Initialize line highlights
  const editorWrap = panel.querySelector(".editor-wrap");
  if (editorWrap) {
    // Small delay to ensure textarea is ready
    setTimeout(() => {
      updateActiveLineHighlight(ta, editorWrap);
      updateSelectedLinesHighlight(ta, editorWrap);
    }, 0);
  }

  refreshTabs();
  onWindowResize();
  activateTab(li);
  if (!isExistingTab) {
    state.updateIsTextModified(true);
  }
}

// ---------- Scrolling/resize ----------
function onWindowResize() {
  const menubar = qs("#menubar");
  const outter = qs("#main-content-outter");
  const headers = qs(".tab-headers");
  const top = menubar.getBoundingClientRect().height;
  outter.style.top = `${top}px`;
  const h = window.innerHeight - top;
  outter.style.height = `${h}px`;
  const panels = qsa(".tab-panel");
  const headerH = headers.getBoundingClientRect().height; // variable due to multi-row tabs
  panels.forEach(p => {
    p.style.height = `${Math.max(0, h - headerH)}px`;
  });
  // Keep gutter scroll offset aligned after resizes
  qsa(".tab-panel").forEach(panel => {
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

// ---------- Init site flow ----------
async function initSite() {
  // Optional auto-decrypt via ?password=...
  if (!state.getIsNew() && URL_PASSWORD) {
    const ok = await state.setLoginPasswordAndContentIfCorrect(URL_PASSWORD);
    if (ok) {
      finishInitialization();
      return;
    }
  }

  if (state.getIsNew()) {
    await setContentOfTabs("");
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
    setContentOfTabs(state.getContent());
  }
  setTimeout(() => { ignoreInputEvent = false; }, 50);

  // Hint: mark huge tabs to avoid costly styles or scripts if needed
  try {
    const panel = qs(".tab-panel.active");
    const ta = panel && panel.querySelector("textarea.textarea-contents");
    if (ta) {
      const isHuge = (ta.value && ta.value.length > 50000);
      panel.dataset.huge = isHuge ? "1" : "";
    }
  } catch { /* ignore */ }
}

function decryptContentAndFinishInitialization(isOld) {
  const openPrompt = () => {
    // Hide UI until authenticated to avoid exposing content
    openPasswordDialog({
      obscure: true,
      hideUI: true,
      onOk: async (pass) => {
        if (pass == null) { focusActiveTextarea(); return false; }
        const ok = await state.setLoginPasswordAndContentIfCorrect(pass);
        if (ok) {
          finishInitialization();
          return true; // close dialog (setPasswordMode(false) handled in openPasswordDialog)
        }
        // wrong password: keep dialog open
        return false;
      }
    });
  };

  if (isOld === true) {
    state.setLoginPasswordAndContentIfCorrect(state.getPassword()).then(ok => {
      if (!ok) openPrompt();
      else finishInitialization();
    });
  } else {
    openPrompt();
  }
}

// ---------- Button enablement ----------
function updateButtonEnablement(isTextModified, isSiteNew) {
  const bSave = qs("#button-save");
  const bSaveNew = qs("#button-savenew");
  const bReload = qs("#button-reload");
  const bDelete = qs("#button-delete");

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

// ---------- Content <-> Tabs ----------
async function setContentOfTabs(content) {
  const sep = await getSeparatorHex();
  const parts = content ? content.split(sep) : [""];
  qsa(".tab-header").forEach(h => h.remove());
  qsa(".tab-panel").forEach(p => p.remove());

  tabCounter = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith("\u267B Reload this website to hide mobile app metadata! \u267B")) {
      state.setMobileAppMetadataTabContent(parts[i]);
    } else {
      addTab(true, parts[i]);
    }
  }
  if (qsa(".tab-header").length === 0) addTab(true, "");
  const first = qs(".tab-header");
  if (first) activateTab(first);
}

async function getContentFromTabs() {
  const sep = await getSeparatorHex();
  let all = "";
  const headers = qsa(".tab-header");
  for (let i = 0; i < headers.length; i++) {
    const id = headers[i].dataset.tabId;
    const ta = qs(`#${id} textarea.textarea-contents`);
    const tabColor = headers[i].dataset.tabColor;

    if (i > 0) all += sep;

    // Add color metadata if tab has a color
    if (tabColor && tabColor !== "#ffffff") {
      all += `__CRYPTEXA_COLOR__:${tabColor}\n`;
    }

    all += ta.value;
  }
  const meta = state.getMobileAppMetadataTabContent();
  if (typeof meta === "string" && meta.length > 0) {
    all += sep + meta;
  }
  return all;
}

// Compute tab title from textarea content
function getTitleFromContent(content) {
  // Only look at the first 200 characters max to avoid heavy scans on huge notes
  if (content === undefined && currentTextarea) {
    content = currentTextarea.value.substring(0, 200);
  } else {
    content = (content || "").substring(0, 200);
  }
  if (!content) return "Empty Tab";

  // Skip leading whitespace quickly
  let start = 0;
  while (start < content.length) {
    const ch = content[start];
    if (ch !== " " && ch !== "\n" && ch !== "\t" && ch !== "\r" && ch !== "\v" && ch !== "\f") break;
    start++;
  }
  if (start >= content.length) return "Empty Tab";

  // Find end of first line within the capped window
  const nlRel = content.indexOf("\n", start);
  const end = nlRel === -1 ? content.length : nlRel;
  let title = content.substring(start, end);

  if (!title || title.length === 0) return "Empty Tab";
  if (title.length > 20) title = title.substr(0, 18) + "...";
  return title;
}

// Focus helpers
function focusActiveTextarea() {
  currentTabTitle = qs(".tab-header.active .tab-title");
  const panel = qs(".tab-panel.active");
  currentTextarea = panel ? panel.querySelector("textarea.textarea-contents") : null;
  currentTextarea && currentTextarea.focus();
}

// ---------- Export Encrypted Backup ----------
function exportEncryptedBackup(eContent) {
  // Produce a minimal HTML that only contains a small decryptor for saltHex:ivHex:cipherHex
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
</script>
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

// ---------- Event wiring ----------
function wireEvents() {
  // Removed unused syncAllGutters function to reduce code size and avoid extra work

  // Coalesce textarea input updates with rAF to reduce layout thrash
  let pendingRaf = 0;
  document.addEventListener("input", (e) => {
    if (!(e.target instanceof HTMLTextAreaElement)) return;
    if (!e.target.classList.contains("textarea-contents")) return;
    if (ignoreInputEvent) { e.preventDefault(); return; }
    state.updateIsTextModified(true);

    const ta = e.target;
    if (pendingRaf) cancelAnimationFrame(pendingRaf);
    pendingRaf = requestAnimationFrame(() => {
      pendingRaf = 0;

      // Title update guard: only compute when caret near start and content not too large
      try {
        const start = ta.selectionStart;
        const isHuge = (ta.value && ta.value.length > 50000);
        if (!isHuge && start <= 201 && currentTabTitle) {
          currentTabTitle.textContent = getTitleFromContent(ta.value.substring(0, 200));
        }
      } catch { /* ignore */ }

      // Gutter update throttling for large notes: avoid per-keystroke full regen
      const panel = ta.closest(".tab-panel");
      const gutter = panel && panel.querySelector(".line-gutter");
      const editorWrap = panel && panel.querySelector(".editor-wrap");
      if (gutter) {
        const isHuge = (ta.value && ta.value.length > 50000);
        if (isHuge) {
          // Only adjust scroll transform now; regenerate line numbers debounced
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

      // Update line highlights
      if (editorWrap) {
        updateActiveLineHighlight(ta, editorWrap);
        updateSelectedLinesHighlight(ta, editorWrap);
      }
    });
  });

  // Handle cursor movement and selection changes
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

  // Handle mouseup events (for when user selects text with mouse)
  document.addEventListener("mouseup", (e) => {
    if (!(e.target instanceof HTMLTextAreaElement)) return;
    if (!e.target.classList.contains("textarea-contents")) return;

    const ta = e.target;
    const panel = ta.closest(".tab-panel");
    const editorWrap = panel && panel.querySelector(".editor-wrap");
    if (editorWrap) {
      // Small delay to ensure selection is updated
      setTimeout(() => {
        updateActiveLineHighlight(ta, editorWrap);
        updateSelectedLinesHighlight(ta, editorWrap);
      }, 0);
    }
  });
  document.addEventListener("paste", (e) => {
    if (!(e.target instanceof HTMLTextAreaElement)) return;
    if (!e.target.classList.contains("textarea-contents")) return;
    setTimeout(() => {
      const ta = e.target;
      const isHuge = (ta.value && ta.value.length > 50000);
      if (!isHuge && currentTabTitle) {
        currentTabTitle.textContent = getTitleFromContent();
      }
      // Deferred gutter update after paste
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

  // Tab inserts 4 spaces and Ctrl+S
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

  // Password input Enter key handling (routes to dialog ok without closing the dialog early)
  on(qs("#enterpassword"), "keypress", (e) => {
    if (e.which === 13 || e.key === "Enter") {
      e.preventDefault();
      const decryptButton = qs("#dialog-password button[value='ok']");
      if (decryptButton && !decryptButton.disabled) {
        decryptButton.click();
      }
    }
  });

  // New password confirmation Enter key handling
  on(qs("#newpassword2"), "keypress", (e) => {
    if (e.which === 13 || e.key === "Enter") {
      const saveButton = qs("#dialog-new-password button[value='ok']");
      if (saveButton) {
        saveButton.click();
      }
      e.preventDefault();
    }
  });

  // Buttons
  on(qs("#button-save"), "click", () => state.saveSite(state.getIsNew()));
  on(qs("#button-savenew"), "click", () => state.saveSite(true));
  on(qs("#button-reload"), "click", () => state.reloadSite());
  on(qs("#button-delete"), "click", () => {
    openConfirmDialog("#dialog-confirm-delete-site", async (ok) => {
      if (ok) state.deleteSite();
      else focusActiveTextarea();
    });
  });

  // Help button
  on(qs("#help-button"), "click", () => {
    showKeyboardShortcutsHelp();
  });

  // Keyboard shortcuts
  setupKeyboardShortcuts();

  // Auto-save functionality removed for data safety

  // Backup export button (visible before decrypt) - avoid duplicate creation
  if (!qs("#button-export")) {
    const backupBtn = document.createElement("button");
    backupBtn.id = "button-export";
    backupBtn.textContent = "Export Encrypted Backup";
    backupBtn.title = "Download encrypted backup (before decrypt)";
    backupBtn.className = "";
    qs("#menubar-buttons").appendChild(backupBtn);
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

// ---------- Dialog Functions ----------

// Remove dead code: state.delete() does not exist; use state.deleteSite instead where needed




// ---------- Status Indicator ----------
const updateStatusIndicator = (status, text) => {
  const indicator = qs("#status-indicator"), statusText = qs(".status-text");
  if (!indicator || !statusText) return;
  indicator.classList.remove("saving", "error", "modified");
  if (status && status !== "ready") indicator.classList.add(status);
  statusText.textContent = text || "Ready";
};

const updateLastSaved = () => {
  const lastSavedElement = qs("#last-saved");
  if (!lastSavedElement) return;

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  lastSavedElement.textContent = `Last saved: ${timeString}`;
  lastSavedElement.style.display = 'inline';
};

const hideLastSaved = () => {
  const lastSavedElement = qs("#last-saved");
  if (lastSavedElement) {
    lastSavedElement.style.display = 'none';
  }
};


// Listen for text changes to update status
document.addEventListener("input", e => {
  if (e.target instanceof HTMLTextAreaElement && e.target.classList.contains("textarea-contents")) {
    updateStatusIndicator("modified", "Modified");
    hideLastSaved();
  }
});


// ---------- Keyboard Shortcuts ----------
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Skip if user is typing in an input field (except textarea)
    if (e.target.tagName === "INPUT" && e.target.type !== "textarea") return;

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Ctrl/Cmd + R: Reload
    if (isCtrlOrCmd && key === "r" && !e.shiftKey) {
      e.preventDefault();
      if (!qs("#button-reload").disabled) {
        state.reloadSite();
      }
      return;
    }

    // Ctrl/Cmd + T: New Tab
    if (isCtrlOrCmd && key === "t") {
      e.preventDefault();
      addTab(false);
      return;
    }

    // Ctrl/Cmd + W: Close Tab (if more than one tab)
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

    // Ctrl/Cmd + Shift + S: Save with new password
    if (isCtrlOrCmd && e.shiftKey && key === "s") {
      e.preventDefault();
      if (!qs("#button-savenew").disabled) {
        state.saveSite(true);
      }
      return;
    }

    // Ctrl/Cmd + E: Export encrypted backup
    if (isCtrlOrCmd && key === "e") {
      e.preventDefault();
      qs("#button-export").click();
      return;
    }



    // Ctrl/Cmd + 1-9: Switch to tab by number
    if (isCtrlOrCmd && key >= "1" && key <= "9") {
      e.preventDefault();
      const tabIndex = parseInt(key) - 1;
      const headers = qsa(".tab-header");
      if (headers[tabIndex]) {
        activateTab(headers[tabIndex]);
      }
      return;
    }

    // Escape: Focus active textarea
    if (key === "escape") {
      focusActiveTextarea();
      return;
    }
  });
}

// ---------- Bootstrap ----------
(async function bootstrap() {
  // Defer heavy initialization to next frame to improve FCP
  requestAnimationFrame(async () => {
    const path = window.location.pathname || "/";
    const seg = path.replace(/^\/+|\/+$/g, "");
    const qp = getQueryParam("site");
    const hasSiteId = (seg && seg !== "api") || qp;

    if (!hasSiteId) return;

    await state.init();
    initTabsLayout();
    onWindowResize();
    wireEvents();

    if (state.getIsNew() || !state.remote.eContent) {
      await setContentOfTabs("");
      finishInitialization();
    } else {
      setPasswordMode(true, { hide: true });
      initSite();
    }
  });
})();

/* ===== Theme Toggle (persisted, accessible) ===== */
(function () {
  const STORAGE_KEY = 'theme-preference'; // 'dark' | 'light'
  const root = document.documentElement;

  function getSystemPref() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light' : 'dark';
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
      /* ignore storage errors */
    }
  }

  function applyTheme(theme) {
    root.classList.remove('theme-dark', 'theme-light');
    if (theme === 'light') {
      root.classList.add('theme-light');
    } else {
      root.classList.add('theme-dark'); // default explicit
    }
    updateToggle(theme);
  }

  function currentTheme() {
    const stored = getStored();
    if (stored === 'dark' || stored === 'light') return stored;
    if (root.classList.contains('theme-light')) return 'light';
    if (root.classList.contains('theme-dark')) return 'dark';
    const system = getSystemPref();
    return system === 'light' ? 'light' : 'dark';
  }

  function updateToggle(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const label = btn.querySelector('.label');
    const icon = btn.querySelector('.icon');
    const isDark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(isDark));
    if (label) label.textContent = isDark ? 'Dark' : 'Light';
    if (icon) icon.textContent = isDark ? '🌙' : '🔆';
  }

  function initTheme() {
    const initial = getStored() || 'light'; // default to light
    applyTheme(initial);
  }

  function wireToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      store(next);
    });
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const handleChange = () => {
        if (getStored()) return; // user preference wins
        applyTheme(getSystemPref());
      };
      if (mq.addEventListener) mq.addEventListener('change', handleChange);
      else if (mq.addListener) mq.addListener(handleChange);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    wireToggle();
    initKeyboardShortcuts();

    // Global color picker functionality
    const globalColorPicker = document.getElementById('tab-color-picker');
    if (globalColorPicker) {
      // Debounce color changes for better performance
      let colorChangeTimeout;

      globalColorPicker.addEventListener('input', (e) => {
        try {
          const activeTab = document.querySelector('.tab-header.active');
          if (activeTab) {
            const newColor = e.target.value;
            // Immediate visual feedback
            activeTab.style.backgroundColor = newColor;
          }
        } catch (error) {
          console.error('Error updating tab color preview:', error);
        }
      });

      globalColorPicker.addEventListener('change', (e) => {
        try {
          const activeTab = document.querySelector('.tab-header.active');
          if (activeTab) {
            const newColor = e.target.value;
            // Validate color format
            if (!/^#[0-9A-F]{6}$/i.test(newColor)) {
              console.warn('Invalid color format:', newColor);
              return;
            }

            activeTab.dataset.tabColor = newColor;
            activeTab.style.backgroundColor = newColor;

            // Debounce the save operation
            clearTimeout(colorChangeTimeout);
            colorChangeTimeout = setTimeout(() => {
              state.updateIsTextModified(true);
              refreshTabs();
            }, 300);
          }
        } catch (error) {
          console.error('Error updating tab color:', error);
        }
      });

      // Update color picker when tab changes
      document.addEventListener('tab-activated', (e) => {
        try {
          const activeTab = e.detail?.tab;
          if (activeTab && activeTab.dataset.tabColor) {
            globalColorPicker.value = activeTab.dataset.tabColor;
          } else {
            globalColorPicker.value = '#ffffff';
          }
        } catch (error) {
          console.error('Error updating color picker on tab change:', error);
          globalColorPicker.value = '#ffffff'; // Fallback
        }
      });
    }

    // Start health monitoring in production
    if (window.location.protocol === 'https:' || window.location.hostname !== 'localhost') {
      startHealthMonitoring();
    }
  });
})();