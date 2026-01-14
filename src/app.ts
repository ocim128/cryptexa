/*
  Cryptexa - Client-side encrypted notes with server persistence
  
  Modular Architecture:
    - crypto/       - Encryption/decryption (AES-GCM, PBKDF2)
    - state/        - ClientState management
    - ui/           - UI components (dialogs, tabs, toast, themes)
    - utils/        - Utilities (fetch, dom, crypto-helpers)
  
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

// ============================================================================
// IMPORTS (ES Modules)
// ============================================================================

import { debounce } from './utils/fetch.js';
import { qs, qsa, on, setPasswordMode } from './utils/dom.js';
import { toast, showNotification } from './ui/toast.js';
import { openPasswordDialog, openConfirmDialog } from './ui/dialogs.js';
import { initTheme, wireThemeToggle } from './ui/themes.js';
import {
    initTabsLayout,
    activateTab,
    addTab,
    focusActiveTextarea,
    getTitleFromContent,
    updateGutterForTextarea,
    updateActiveLineHighlight,
    updateSelectedLinesHighlight,
    setContentOfTabs,
    getContentFromTabs,
    onWindowResize,
    getCurrentTabTitle
} from './ui/tabs.js';
import { ClientState, setTabFunctions } from './state/ClientState.js';

// Inject tab functions to avoid circular dependencies
setTabFunctions({
    focusActiveTextarea,
    getContentFromTabs,
    setContentOfTabs
});

// ============================================================================
// TYPE AUGMENTATION
// ============================================================================

declare global {
    interface Window {
        state: ClientState;
    }

    interface HTMLElement {
        _lnDebounce?: () => void;
    }
}

// ============================================================================
// CONFIG
// ============================================================================

function getQueryParam(name: string): string | null {
    const url = new URL(window.location.href);
    const v = url.searchParams.get(name);
    return v && v.trim().length ? v.trim() : null;
}

// Prefer path segment /:site; fallback to ?site=; else default
function getSiteFromURL(): string {
    const path = window.location.pathname || "/";
    // Normalize: remove leading/trailing slashes
    const seg = path.replace(/^\/+|\/+$/g, "");
    if (seg && seg !== "api") return seg;
    const qp = getQueryParam("site");
    return qp || "local-notes";
}

const SITE_ID = getSiteFromURL();

// Accept either ?password=... or raw ?YourPass (whole querystring as password)
const URL_PASSWORD = (function (): string | null {
    const named = getQueryParam("password");
    if (named) return named;
    const qs = window.location.search || "";
    if (qs.startsWith("?") && qs.length > 1 && !qs.includes("=")) {
        return decodeURIComponent(qs.substring(1));
    }
    return null;
})();

// ============================================================================
// GLOBAL STATE
// ============================================================================

let state = new ClientState(SITE_ID, URL_PASSWORD);
window.state = state; // valid for debugging
let ignoreInputEvent = true;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

function initKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
        // Skip if user is typing in input fields
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'color') return;

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
                (tabs[tabIndex].querySelector('.tab-title') as HTMLElement)?.click();
            }
            return;
        }

        // Ctrl+Tab: Next tab
        if (isCtrl && e.key === 'Tab' && !isShift) {
            e.preventDefault();
            const tabs = document.querySelectorAll('.tab-header');
            const activeIndex = Array.from(tabs).findIndex(tab => tab.classList.contains('active'));
            const nextIndex = (activeIndex + 1) % tabs.length;
            (tabs[nextIndex]?.querySelector('.tab-title') as HTMLElement)?.click();
            return;
        }

        // Ctrl+Shift+Tab: Previous tab
        if (isCtrl && e.key === 'Tab' && isShift) {
            e.preventDefault();
            const tabs = document.querySelectorAll('.tab-header');
            const activeIndex = Array.from(tabs).findIndex(tab => tab.classList.contains('active'));
            const prevIndex = activeIndex === 0 ? tabs.length - 1 : activeIndex - 1;
            (tabs[prevIndex]?.querySelector('.tab-title') as HTMLElement)?.click();
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
            const openDialog = document.querySelector('dialog[open]') as HTMLDialogElement;
            if (openDialog) {
                openDialog.close();
            } else {
                focusActiveTextarea();
            }
            return;
        }
    });
}

function showKeyboardShortcutsHelp(): void {
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

// ============================================================================
// ERROR HANDLING & HEALTH MONITORING
// ============================================================================

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
            const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            if (perfData) {
                console.log('Page load time:', Math.round(perfData.loadEventEnd - perfData.fetchStart), 'ms');
            }
        }, 0);
    });
}

// Health check function
async function checkServerHealth(): Promise<boolean> {
    try {
        const response = await fetch('/health', { method: 'GET' });
        return response.ok;
    } catch {
        return false;
    }
}

// Periodic health check (every 5 minutes)
function startHealthMonitoring(): void {
    healthCheckInterval = setInterval(async () => {
        const isHealthy = await checkServerHealth();
        if (!isHealthy) {
            showNotification('Connection to server lost. Please check your internet connection.', 'warning');
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// Stop health monitoring
// eslint-disable-next-line no-unused-vars
export function stopHealthMonitoring(): void {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }
}

// ============================================================================
// BUTTON ENABLEMENT
// ============================================================================

function updateButtonEnablement(isTextModified: boolean, isSiteNew: boolean): void {
    const bSave = qs<HTMLButtonElement>("#button-save");
    const bSaveNew = qs<HTMLButtonElement>("#button-savenew");
    const bReload = qs<HTMLButtonElement>("#button-reload");
    const bDelete = qs<HTMLButtonElement>("#button-delete");

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

// ============================================================================
// STATUS INDICATOR
// ============================================================================

const updateStatusIndicator = (status: string, text: string): void => {
    const indicator = qs("#status-indicator");
    const statusText = qs(".status-text");
    if (!indicator || !statusText) return;
    indicator.classList.remove("saving", "error", "modified");
    if (status && status !== "ready") indicator.classList.add(status);
    statusText.textContent = text || "Ready";
};

const updateLastSaved = (): void => {
    const lastSavedElement = qs<HTMLElement>("#last-saved");
    if (!lastSavedElement) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    lastSavedElement.textContent = `Last saved: ${timeString}`;
    lastSavedElement.style.display = 'inline';
};

const hideLastSaved = (): void => {
    const lastSavedElement = qs<HTMLElement>("#last-saved");
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

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initSite(): Promise<void> {
    // Optional auto-decrypt via ?password=...
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

async function finishInitialization(shouldSkipSettingContent?: boolean): Promise<void> {
    state.setInitHashContent();
    updateButtonEnablement(state.getIsTextModified(), state.getIsNew());
    focusActiveTextarea();
    ignoreInputEvent = true;
    if (shouldSkipSettingContent !== true) {
        setContentOfTabs(state.getContent(), state);
    }
    setTimeout(() => { ignoreInputEvent = false; }, 50);

    // Hint: mark huge tabs to avoid costly styles or scripts if needed
    try {
        const panel = qs<HTMLElement>(".tab-panel.active");
        const ta = panel && panel.querySelector<HTMLTextAreaElement>("textarea.textarea-contents");
        if (ta) {
            const isHuge = (ta.value && ta.value.length > 50000);
            if (panel) panel.dataset.huge = isHuge ? "1" : "";
        }
    } catch { /* ignore */ }
}

function decryptContentAndFinishInitialization(isOld: boolean): void {
    const openPrompt = () => {
        // Hide UI until authenticated to avoid exposing content
        openPasswordDialog({
            obscure: true,
            hideUI: true,
            onOk: async (pass: string): Promise<boolean> => {
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

// ============================================================================
// EXPORT ENCRYPTED BACKUP
// ============================================================================

function exportEncryptedBackup(eContent: string): void {
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

// ============================================================================
// EVENT WIRING
// ============================================================================

function wireEvents(): void {
    // Coalesce textarea input updates with rAF to reduce layout thrash
    let pendingRaf = 0;
    document.addEventListener("input", (e) => {
        if (!(e.target instanceof HTMLTextAreaElement)) return;
        if (!e.target.classList.contains("textarea-contents")) return;
        if (ignoreInputEvent) { e.preventDefault(); return; }
        state.updateIsTextModified(true);

        const ta = e.target;
        const currentTabTitle = getCurrentTabTitle();

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
            const panel = ta.closest(".tab-panel") as HTMLElement;
            const gutter = panel && panel.querySelector<HTMLElement>(".line-gutter");
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
        const currentTabTitle = getCurrentTabTitle();
        setTimeout(() => {
            const ta = e.target as HTMLTextAreaElement;
            const isHuge = (ta.value && ta.value.length > 50000);
            if (!isHuge && currentTabTitle) {
                currentTabTitle.textContent = getTitleFromContent();
            }
            // Deferred gutter update after paste
            const panel = ta.closest(".tab-panel");
            const gutter = panel && panel.querySelector<HTMLElement>(".line-gutter");
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

    // Tab inserts 4 spaces
    document.addEventListener("keydown", (e) => {
        const ta = document.activeElement as HTMLTextAreaElement;
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

    // Password input Enter key handling
    on(qs("#enterpassword") as HTMLElement, "keypress", (e) => {
        const event = e as KeyboardEvent;
        if (event.which === 13 || event.key === "Enter") {
            event.preventDefault();
            const decryptButton = qs("#dialog-password button[value='ok']") as HTMLButtonElement;
            if (decryptButton && !decryptButton.disabled) {
                decryptButton.click();
            }
        }
    });

    // New password confirmation Enter key handling
    on(qs("#newpassword2") as HTMLElement, "keypress", (e) => {
        const event = e as KeyboardEvent;
        if (event.which === 13 || event.key === "Enter") {
            const saveButton = qs("#dialog-new-password button[value='ok']") as HTMLButtonElement;
            if (saveButton) {
                saveButton.click();
            }
            event.preventDefault();
        }
    });

    // Buttons
    on(qs("#button-save") as HTMLElement, "click", () => state.saveSite(state.getIsNew()));
    on(qs("#button-savenew") as HTMLElement, "click", () => state.saveSite(true));
    on(qs("#button-reload") as HTMLElement, "click", () => state.reloadSite());
    on(qs("#button-delete") as HTMLElement, "click", () => {
        openConfirmDialog("#dialog-confirm-delete-site", async (ok) => {
            if (ok) state.deleteSite();
            else focusActiveTextarea();
        });
    });

    // Help button
    on(qs("#help-button") as HTMLElement, "click", () => {
        showKeyboardShortcutsHelp();
    });

    // Keyboard shortcuts
    setupKeyboardShortcuts();

    // Backup export button (visible before decrypt) - avoid duplicate creation
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

// Additional keyboard shortcuts setup
function setupKeyboardShortcuts(): void {
    document.addEventListener("keydown", (e) => {
        // Skip if user is typing in an input field (except textarea)
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "textarea") return;

        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();

        // Ctrl/Cmd + R: Reload
        if (isCtrlOrCmd && key === "r" && !e.shiftKey) {
            e.preventDefault();
            if (!(qs("#button-reload") as HTMLButtonElement).disabled) {
                state.reloadSite();
            }
            return;
        }

        // Ctrl/Cmd + T: New Tab
        if (isCtrlOrCmd && key === "t") {
            e.preventDefault();
            addTab(false, "", null, () => state.updateIsTextModified(true));
            return;
        }

        // Ctrl/Cmd + W: Close Tab (if more than one tab)
        if (isCtrlOrCmd && key === "w") {
            const headers = qsa(".tab-header");
            if (headers.length > 1) {
                e.preventDefault();
                const activeHeader = qs(".tab-header.active");
                if (activeHeader) {
                    const closeBtn = activeHeader.querySelector(".close") as HTMLElement;
                    if (closeBtn) closeBtn.click();
                }
            }
            return;
        }

        // Ctrl/Cmd + Shift + S: Save with new password
        if (isCtrlOrCmd && e.shiftKey && key === "s") {
            e.preventDefault();
            if (!(qs("#button-savenew") as HTMLButtonElement).disabled) {
                state.saveSite(true);
            }
            return;
        }

        // Ctrl/Cmd + E: Export encrypted backup
        if (isCtrlOrCmd && key === "e") {
            e.preventDefault();
            (qs("#button-export") as HTMLButtonElement)?.click();
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

// ============================================================================
// BOOTSTRAP
// ============================================================================

(async function bootstrap() {
    // Set up state callbacks
    state.onButtonEnablementChange = updateButtonEnablement;
    state.onStatusChange = updateStatusIndicator;
    state.onLastSavedUpdate = updateLastSaved;
    state.onFinishInitialization = finishInitialization;
    state.onDecryptAndFinish = decryptContentAndFinishInitialization;

    // Defer heavy initialization to next frame to improve FCP
    requestAnimationFrame(async () => {
        const path = window.location.pathname || "/";
        const seg = path.replace(/^\/+|\/+$/g, "");
        const qp = getQueryParam("site");
        const hasSiteId = (seg && seg !== "api") || qp;

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

// ============================================================================
// THEME & COLOR PICKER INITIALIZATION (DOMContentLoaded)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    wireThemeToggle();
    initKeyboardShortcuts();

    // Global color picker functionality
    const globalColorPicker = document.getElementById('tab-color-picker') as HTMLInputElement;
    if (globalColorPicker) {
        globalColorPicker.addEventListener('input', (e) => {
            try {
                const activeTab = document.querySelector('.tab-header.active') as HTMLElement;
                if (activeTab) {
                    const target = e.target as HTMLInputElement;
                    const newColor = target.value;
                    // Immediate visual feedback
                    activeTab.style.backgroundColor = newColor;
                }
            } catch (error) {
                console.error('Error updating tab color preview:', error);
            }
        });

        globalColorPicker.addEventListener('change', (e) => {
            try {
                const activeTab = document.querySelector('.tab-header.active') as HTMLElement;
                if (activeTab) {
                    const target = e.target as HTMLInputElement;
                    const newColor = target.value;
                    // Validate color format
                    if (!/^#[0-9A-F]{6}$/i.test(newColor)) {
                        console.warn('Invalid color format:', newColor);
                        return;
                    }

                    activeTab.dataset.tabColor = newColor;
                    activeTab.style.backgroundColor = newColor;

                    // Trigger state update
                    state.updateIsTextModified(true);
                }
            } catch (error) {
                console.error('Error updating tab color persistence:', error);
            }
        });
    }
});
