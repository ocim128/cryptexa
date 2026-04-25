/*
  Cryptexa - Client-side encrypted notes with server persistence

  Source of truth:
    - index.html: shell markup
    - styles.css: visual system
    - src/app.ts: runtime wiring and workspace orchestration
*/

import { debounce } from "./utils/fetch.js";
import { qs, qsa, on, setPasswordMode } from "./utils/dom.js";
import { toast } from "./ui/toast.js";
import { openPasswordDialog } from "./ui/dialogs.js";
import { initTheme, wireThemeToggle } from "./ui/themes.js";
import { initGlobalSearch, openSearch, markSearchIndexDirty } from "./ui/search.js";
import { initPasswordStrengthIndicators } from "./ui/password-strength.js";
import { initTabSwitcher, openTabSwitcher, setTabModified, clearAllModified } from "./ui/tab-switcher.js";
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
} from "./ui/tabs.js";
import { ClientState, setTabFunctions } from "./state/ClientState.js";

setTabFunctions({
    focusActiveTextarea,
    getContentFromTabs,
    setContentOfTabs
});

declare global {
    interface Window {
        state?: ClientState;
    }

    interface HTMLElement {
        _lnDebounce?: () => void;
    }
}

type AppView = "landing" | "workspace";

interface ShortcutDef {
    keys: string;
    description: string;
}

const SHORTCUTS: ShortcutDef[] = [
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

function getQueryParam(name: string): string | null {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(name);
    return value && value.trim().length ? value.trim() : null;
}

function getSiteFromURL(): string | null {
    const path = window.location.pathname || "/";
    const segment = path.replace(/^\/+|\/+$/g, "");
    if (segment && segment !== "api") return segment;
    return getQueryParam("site");
}

const SITE_ID = getSiteFromURL();
const URL_PASSWORD = (() => {
    const named = getQueryParam("password");
    if (named) return named;
    const query = window.location.search || "";
    if (query.startsWith("?") && query.length > 1 && !query.includes("=")) {
        return decodeURIComponent(query.substring(1));
    }
    return null;
})();

let state: ClientState | null = null;
let ignoreInputEvent = true;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let landingInitialized = false;
let workspaceEventsWired = false;
let highlightUpdateRaf = 0;

function scheduleEditorHighlightUpdate(textarea: HTMLTextAreaElement): void {
    if (highlightUpdateRaf) cancelAnimationFrame(highlightUpdateRaf);
    highlightUpdateRaf = requestAnimationFrame(() => {
        highlightUpdateRaf = 0;
        const editorWrap = textarea.closest(".tab-panel")?.querySelector(".editor-wrap");
        if (!editorWrap) return;
        updateActiveLineHighlight(textarea, editorWrap);
        updateSelectedLinesHighlight(textarea, editorWrap);
    });
}

function scheduleNextFrame(callback: () => void): void {
    requestAnimationFrame(() => callback());
}

function getState(): ClientState {
    if (!state) {
        throw new Error("Workspace state is not initialized");
    }
    return state;
}

function setAppView(view: AppView): void {
    document.body.classList.toggle("view-landing", view === "landing");
    document.body.classList.toggle("view-workspace", view === "workspace");
}

function renderShortcutHelp(): void {
    const container = qs<HTMLElement>("#help-shortcuts");
    if (!container) return;

    container.innerHTML = SHORTCUTS.map((shortcut) => `
        <div class="shortcut-item">
            <span class="shortcut-keys">${shortcut.keys}</span>
            <span class="shortcut-description">${shortcut.description}</span>
        </div>
    `).join("");
}

function openHelpDialog(): void {
    renderShortcutHelp();
    const dialog = qs<HTMLDialogElement>("#dialog-help");
    if (!dialog) return;
    const blockingDialog = qsa<HTMLDialogElement>("dialog[open]").find((openDialog) => openDialog !== dialog);
    if (blockingDialog) return;
    if (!dialog.open) {
        dialog.showModal();
    }
}

function closeTopmostDialog(): boolean {
    const openDialogs = qsa<HTMLDialogElement>("dialog[open]");
    const dialog = openDialogs[openDialogs.length - 1];
    if (!dialog) return false;
    if (dialog.dataset.lockClose === "true") {
        dialog.querySelector<HTMLElement>("input, button, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
        return true;
    }
    dialog.close();
    return true;
}

function setSiteLabel(siteId: string | null): void {
    const siteContext = qs<HTMLElement>("#site-context");
    const siteLabel = qs<HTMLElement>("#site-label");
    if (!siteContext || !siteLabel) return;

    if (!siteId) {
        siteContext.classList.add("hidden");
        siteLabel.textContent = "";
        return;
    }

    siteLabel.textContent = siteId;
    siteContext.classList.remove("hidden");
}

function navigateToWorkspace(siteId: string): void {
    const password = getQueryParam("password");
    let destination = `${window.location.origin}/${encodeURIComponent(siteId)}`;
    if (password) {
        destination += `?password=${encodeURIComponent(password)}`;
    }
    window.location.href = destination;
}

function initLanding(): void {
    if (landingInitialized) return;
    landingInitialized = true;

    const form = qs<HTMLFormElement>("#landing-form");
    const input = qs<HTMLInputElement>("#landing-site");
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

function updateButtonEnablement(isTextModified: boolean, isSiteNew: boolean): void {
    const workspace = getState();
    const saveButton = qs<HTMLButtonElement>("#button-save");
    const saveNewButton = qs<HTMLButtonElement>("#button-savenew");
    const reloadButton = qs<HTMLButtonElement>("#button-reload");
    const deleteButton = qs<HTMLButtonElement>("#button-delete");

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

function updateStatusIndicator(status: string, text: string): void {
    const indicator = qs<HTMLElement>("#status-indicator");
    const statusText = qs<HTMLElement>(".status-text");
    if (!indicator || !statusText) return;

    indicator.classList.remove("saving", "error", "modified");
    if (status && status !== "ready") {
        indicator.classList.add(status);
    }
    statusText.textContent = text || "Ready";
}

function updateLastSaved(): void {
    const lastSaved = qs<HTMLElement>("#last-saved");
    if (!lastSaved) return;

    const now = new Date();
    lastSaved.textContent = `Saved ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    lastSaved.classList.remove("hidden");
}

function hideLastSaved(): void {
    const lastSaved = qs<HTMLElement>("#last-saved");
    lastSaved?.classList.add("hidden");
}

function setupStatusTracking(): void {
    document.addEventListener("input", (event) => {
        if (!(event.target instanceof HTMLTextAreaElement)) return;
        if (!event.target.classList.contains("textarea-contents")) return;

        updateStatusIndicator("modified", "Modified");
        hideLastSaved();

        const panel = event.target.closest(".tab-panel");
        if (!panel) return;
        const header = document.querySelector<HTMLElement>(`.tab-header[data-tab-id="${panel.id}"]`);
        if (header) {
            setTabModified(header, true);
        }
    });
}

async function checkServerHealth(): Promise<boolean> {
    try {
        const response = await fetch("/health", { method: "GET" });
        return response.ok;
    } catch {
        return false;
    }
}

function startHealthMonitoring(): void {
    if (healthCheckInterval) return;

    healthCheckInterval = setInterval(async () => {
        const isHealthy = await checkServerHealth();
        if (!isHealthy) {
            toast("Connection check failed.", "warning", 2400);
        }
    }, 5 * 60 * 1000);
}

export function stopHealthMonitoring(): void {
    if (!healthCheckInterval) return;
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
}

function handleGlobalErrors(): void {
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

function exportEncryptedBackup(eContent: string): void {
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

function triggerExport(): void {
    const workspace = getState();
    const encrypted = workspace.remote.eContent;
    if (!encrypted) {
        toast("Nothing to export yet.", "warning", 1400);
        return;
    }
    exportEncryptedBackup(encrypted);
}

function cycleTabs(direction: 1 | -1): void {
    const headers = qsa<HTMLElement>(".tab-header");
    if (headers.length === 0) return;

    const activeIndex = headers.findIndex((tab) => tab.classList.contains("active"));
    const nextIndex = activeIndex === -1
        ? 0
        : (activeIndex + direction + headers.length) % headers.length;
    const target = headers[nextIndex];
    if (target) activateTab(target);
}

function jumpToTabByNumber(index: number): void {
    const headers = qsa<HTMLElement>(".tab-header");
    const target = headers[index];
    if (target) activateTab(target);
}

function createNewTab(): void {
    addTab(false, "", qs(".tab-header.active"), () => getState().updateIsTextModified(true));
}

function triggerSave(forceNewPassword: boolean): void {
    const workspace = getState();
    if (!forceNewPassword && !workspace.getIsNew()) {
        updateStatusIndicator("saving", "Saving");
    }
    void workspace.saveSite(forceNewPassword || workspace.getIsNew());
}

function isFormField(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "TEXTAREA") return false;
    if (tag === "INPUT" || tag === "SELECT" || tag === "OPTION") return true;
    return target.isContentEditable;
}

function initKeyboardShortcuts(): void {
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

        const openDialogs = qsa<HTMLDialogElement>("dialog[open]");
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
            qs<HTMLButtonElement>("#theme-toggle")?.click();
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

function wireWorkspaceButtons(): void {
    on(qs("#button-save") as HTMLElement, "click", () => triggerSave(false));
    on(qs("#button-savenew") as HTMLElement, "click", () => triggerSave(true));
    on(qs("#button-reload") as HTMLElement, "click", () => {
        void getState().reloadSite();
    });
    on(qs("#button-delete") as HTMLElement, "click", () => {
        void getState().deleteSite();
    });
    on(qs("#button-export") as HTMLElement, "click", triggerExport);
    on(qs("#search-button") as HTMLElement, "click", openSearch);
    on(qs("#help-button") as HTMLElement, "click", openHelpDialog);
}

function wireWorkspaceEvents(): void {
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
                const isHuge = textarea.value.length > 50000;
                if (!isHuge && start <= 201 && activeTabTitle) {
                    activeTabTitle.textContent = getTitleFromContent(textarea.value.substring(0, 200));
                }
                markSearchIndexDirty(textarea.closest(".tab-panel")?.id);
            } catch {
                void 0;
            }

            const panel = textarea.closest(".tab-panel") as HTMLElement | null;
            const gutter = panel?.querySelector<HTMLElement>(".line-gutter") || null;
            const editorWrap = panel?.querySelector(".editor-wrap") || null;
            if (gutter) {
                const isHuge = textarea.value.length > 50000;
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
                scheduleEditorHighlightUpdate(textarea);
            }
        });
    });

    document.addEventListener("selectionchange", () => {
        const textarea = document.activeElement;
        if (!(textarea instanceof HTMLTextAreaElement)) return;
        if (!textarea.classList.contains("textarea-contents")) return;

        scheduleEditorHighlightUpdate(textarea);
    });

    document.addEventListener("mouseup", (event) => {
        if (!(event.target instanceof HTMLTextAreaElement)) return;
        if (!event.target.classList.contains("textarea-contents")) return;

        const textarea = event.target;
        scheduleNextFrame(() => {
            scheduleEditorHighlightUpdate(textarea);
        });
    });

    document.addEventListener("paste", (event) => {
        if (!(event.target instanceof HTMLTextAreaElement)) return;
        if (!event.target.classList.contains("textarea-contents")) return;

        const textarea = event.target;
        const activeTabTitle = getCurrentTabTitle();
        scheduleNextFrame(() => {
            const isHuge = textarea.value.length > 50000;
            if (!isHuge && activeTabTitle) {
                activeTabTitle.textContent = getTitleFromContent();
            }
            markSearchIndexDirty(textarea.closest(".tab-panel")?.id);

            const gutter = textarea.closest(".tab-panel")?.querySelector<HTMLElement>(".line-gutter") || null;
            if (!gutter) return;
            if (isHuge) {
                if (!gutter._lnDebounce) {
                    gutter._lnDebounce = debounce(() => updateGutterForTextarea(textarea, gutter), 120);
                }
                gutter._lnDebounce();
            } else {
                updateGutterForTextarea(textarea, gutter);
            }
            scheduleEditorHighlightUpdate(textarea);
        });
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
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        scheduleEditorHighlightUpdate(textarea);
    });

}

async function initSite(): Promise<void> {
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

async function finishInitialization(shouldSkipSettingContent?: boolean): Promise<void> {
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

function decryptContentAndFinishInitialization(isOld: boolean): void {
    const workspace = getState();
    const openPrompt = () => {
        openPasswordDialog({
            obscure: true,
            hideUI: true,
            onOk: async (password: string): Promise<boolean> => {
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

async function bootstrapWorkspace(): Promise<void> {
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
    state.onFinishInitialization = (shouldSkipSettingContent?: boolean) => {
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
