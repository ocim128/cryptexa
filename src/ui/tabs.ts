/**
 * Tab Management Module
 * Provides tab UI functionality including creation, activation, and drag-and-drop
 */

import { qs, qsa, on } from '../utils/dom.js';
import { openConfirmDialog } from './dialogs.js';
import { getSeparatorHex } from '../utils/crypto-helpers.js';

// ============================================================================
// TYPES
// ============================================================================

/** Callback when content is modified */
export type OnModifiedCallback = (modified: boolean) => void;

/** State interface for content management */
export interface TabState {
    getMobileAppMetadataTabContent(): string;
    setMobileAppMetadataTabContent(content: string): void;
    updateIsTextModified(modified: boolean): void;
}

/** Drag element result */
interface DragAfterResult {
    offset: number;
    element?: Element;
}

// ============================================================================
// MODULE STATE
// ============================================================================

let tabCounter = 1;
let currentTabTitle: Element | null = null;
let currentTextarea: HTMLTextAreaElement | null = null;

const TAB_COLOR_METADATA_PREFIX = "__CRYPTEXA_COLOR__:";
const DEFAULT_TAB_MARK_COLOR = "#d15f38";
const MOBILE_METADATA_HINT = "Reload this website to hide mobile app metadata!";

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Gets current tab title element
 */
export function getCurrentTabTitle(): Element | null {
    return currentTabTitle;
}

/**
 * Gets current textarea element
 */
export function getCurrentTextarea(): HTMLTextAreaElement | null {
    return currentTextarea;
}

function normalizeTabColor(color: string | null | undefined): string | null {
    if (!color) return null;
    const normalized = color.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalized)) return null;
    return normalized === "#ffffff" ? null : normalized;
}

function hexToRgba(hex: string, alpha: number): string {
    const normalized = normalizeTabColor(hex);
    const source = normalized || DEFAULT_TAB_MARK_COLOR;

    const r = parseInt(source.slice(1, 3), 16);
    const g = parseInt(source.slice(3, 5), 16);
    const b = parseInt(source.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseTabPayload(content: string): { color: string | null; content: string } {
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

function applyTabColor(header: HTMLElement, color: string | null): void {
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

function syncTabColorControls(): void {
    const activeHeader = qs<HTMLElement>(".tab-header.active");
    const colorPicker = qs<HTMLInputElement>("#tab-color-picker");
    const clearButton = qs<HTMLButtonElement>("#clear-tab-color");
    const markControl = qs<HTMLElement>(".tab-mark-control");
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

// ============================================================================
// GUTTER & LINE HELPERS
// ============================================================================

/**
 * Updates the gutter line numbers for a textarea
 */
export function updateGutterForTextarea(
    ta: HTMLTextAreaElement | null,
    gutter: HTMLElement | null
): void {
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

/**
 * Gets line number from character position
 */
export function getLineNumberFromPosition(text: string, position: number): number {
    if (position < 0) return 1;
    const textUpToPosition = text.substring(0, position);
    return textUpToPosition.split('\n').length;
}

/**
 * Gets line height from textarea
 */
export function getLineHeight(ta: HTMLTextAreaElement): number {
    const computedStyle = window.getComputedStyle(ta);
    return parseInt(computedStyle.lineHeight) || parseInt(computedStyle.fontSize) * 1.2;
}

/**
 * Updates active line highlight
 */
export function updateActiveLineHighlight(
    ta: HTMLTextAreaElement,
    editorWrap: Element
): void {
    const existingHighlights = editorWrap.querySelectorAll('.active-line');
    existingHighlights.forEach(el => el.remove());

    const cursorPos = ta.selectionStart;
    const text = ta.value;
    const lineNumber = getLineNumberFromPosition(text, cursorPos);

    const highlight = document.createElement('div');
    highlight.className = 'active-line';

    const lineHeight = getLineHeight(ta);
    const top = (lineNumber - 1) * lineHeight + parseInt(window.getComputedStyle(ta).paddingTop);

    highlight.style.top = `${top}px`;
    highlight.style.height = `${lineHeight}px`;

    editorWrap.appendChild(highlight);
}

/**
 * Updates selected lines highlight
 */
export function updateSelectedLinesHighlight(
    ta: HTMLTextAreaElement,
    editorWrap: Element
): void {
    const existingHighlights = editorWrap.querySelectorAll('.selected-line');
    existingHighlights.forEach(el => el.remove());

    const selectionStart = ta.selectionStart;
    const selectionEnd = ta.selectionEnd;
    if (selectionStart === selectionEnd) return;

    const text = ta.value;
    const startLine = getLineNumberFromPosition(text, selectionStart);
    const endLine = getLineNumberFromPosition(text, selectionEnd);
    const lineHeight = getLineHeight(ta);
    const paddingTop = parseInt(window.getComputedStyle(ta).paddingTop);

    for (let i = startLine; i <= endLine; i++) {
        const highlight = document.createElement('div');
        highlight.className = 'selected-line';
        const top = (i - 1) * lineHeight + paddingTop;
        highlight.style.top = `${top}px`;
        highlight.style.height = `${lineHeight}px`;
        editorWrap.appendChild(highlight);
    }
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

/**
 * Activates a tab by its header element
 */
function getTabButton(header: Element): HTMLElement | null {
    return header.querySelector<HTMLElement>('[role="tab"]');
}

export function activateTab(headerLi: Element): void {
    const headers = qsa(".tab-header");
    const panels = qsa(".tab-panel");
    const id = (headerLi as HTMLElement).dataset.tabId;
    const panel = id ? qs(`#${id}`) : null;

    headers.forEach(h => {
        h.classList.remove("active");
        const tabButton = getTabButton(h);
        tabButton?.setAttribute("aria-selected", "false");
        tabButton?.setAttribute("tabindex", "-1");
    });
    panels.forEach(p => {
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

    const ta = panel?.querySelector<HTMLTextAreaElement>("textarea.textarea-contents");
    const gutter = panel?.querySelector<HTMLElement>(".line-gutter");
    if (!ta || !gutter) return;

    const y = Math.round(ta.scrollTop || 0);
    gutter.style.setProperty("--gutter-scroll-y", String(-y));
    gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
    gutter.style.removeProperty("top");
    gutter.style.transform = "translateZ(0)";

    const needsHeavyUpdate = ta.value.length > 50000;
    if (needsHeavyUpdate) {
        setTimeout(() => updateGutterForTextarea(ta, gutter), 0);
        return;
    }

    updateGutterForTextarea(ta, gutter);
}

/**
 * Computes tab title from content
 */
export function getTitleFromContent(content?: string): string {
    let effectiveContent: string;

    if (content === undefined && currentTextarea) {
        effectiveContent = currentTextarea.value.substring(0, 200);
    } else {
        effectiveContent = (content || "").substring(0, 200);
    }

    if (!effectiveContent) return "Empty Tab";

    let start = 0;
    while (start < effectiveContent.length) {
        const ch = effectiveContent[start];
        if (ch !== " " && ch !== "\n" && ch !== "\t" && ch !== "\r" && ch !== "\v" && ch !== "\f") break;
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

/**
 * Focuses the active textarea
 */
export function focusActiveTextarea(): void {
    currentTabTitle = qs(".tab-header.active .tab-title");
    const panel = qs(".tab-panel.active");
    currentTextarea = panel ? panel.querySelector<HTMLTextAreaElement>("textarea.textarea-contents") : null;
    currentTextarea?.focus();
}

/**
 * Adds a new tab
 */
export function addTab(
    isExistingTab: boolean,
    contentIfAvailable: string = "",
    insertAfter: Element | null = null,
    onModified: OnModifiedCallback | null = null
): Element {
    const headersContainer = qs(".tab-headers-container")!;
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
    qs("#tabs")!.appendChild(panel);

    const ta = panel.querySelector<HTMLTextAreaElement>("textarea.textarea-contents")!;
    const gutter = panel.querySelector<HTMLElement>(".line-gutter")!;

    const updateGutter = (): void => {
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
        const isHuge = (ta.value && ta.value.length > 50000);
        if (isHuge && now - lastScrollTs < 16) return;
        lastScrollTs = now;
        const y = Math.round(ta.scrollTop || 0);
        gutter.style.setProperty("--gutter-scroll-y", String(-y));
        gutter.style.removeProperty("top");
        gutter.style.transform = "translateZ(0)";
        gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
    });

    const isHuge = (ta.value && ta.value.length > 50000);
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

/**
 * Refreshes tab display (shows/hides close buttons)
 */
export function refreshTabs(): void {
    const headers = qsa(".tab-header");
    headers.forEach(h => {
        const closer = h.querySelector<HTMLElement>(".close");
        if (!closer) return;
        const shouldShow = headers.length > 1 && !h.classList.contains("pinned");
        closer.style.display = shouldShow ? "" : "none";
    });
    syncTabColorControls();
    focusActiveTextarea();
}

// ============================================================================
// DRAG AND DROP
// ============================================================================

/**
 * Gets the element to insert before during drag-and-drop
 */
function getDragAfterElement(container: Element, x: number): Element | undefined {
    const draggableElements = [...container.querySelectorAll(".tab-header:not([style*='opacity'])")];

    return draggableElements.reduce<DragAfterResult>((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
        }

        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Initializes tab drag-and-drop functionality
 */
export function initTabDragAndDrop(onModified: OnModifiedCallback | null = null): void {
    let draggedTab: HTMLElement | null = null;
    let draggedPanel: Element | null = null;

    const container = qs(".tab-headers-container")!;

    container.addEventListener("dragstart", (e) => {
        const event = e as DragEvent;
        const tabHeader = (event.target as Element).closest<HTMLElement>(".tab-header");
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
        const tabHeader = (e.target as Element).closest<HTMLElement>(".tab-header");
        if (tabHeader) {
            tabHeader.style.opacity = "";
        }
        draggedTab = null;
        draggedPanel = null;
    });

    container.addEventListener("dragover", (e) => {
        e.preventDefault();
        const event = e as DragEvent;
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

        const tabsContainer = qs("#tabs")!;
        const afterElement = getDragAfterElement(container, (e as DragEvent).clientX);

        if (afterElement == null) {
            tabsContainer.appendChild(draggedPanel);
        } else {
            const afterPanelId = (afterElement as HTMLElement).dataset.tabId;
            const afterPanel = afterPanelId ? qs(`#${afterPanelId}`) : null;
            if (afterPanel) {
                tabsContainer.insertBefore(draggedPanel, afterPanel);
            }
        }

        if (onModified) onModified(true);
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes tabs layout with event listeners
 */
export function initTabsLayout(onModified: OnModifiedCallback | null = null): void {
    const headersContainer = qs(".tab-headers-container");
    if (!headersContainer) return;

    on(headersContainer as HTMLElement, "click", (e) => {
        const event = e as MouseEvent;
        const li = (event.target as Element).closest(".tab-header");
        const close = (event.target as Element).closest(".close");

        if (close && li) {
            event.preventDefault();
            event.stopPropagation();
            activateTab(li);
            return;
        }

        if (li) activateTab(li);
    });

    on(headersContainer as HTMLElement, "keydown", (e) => {
        const event = e as KeyboardEvent;
        const tabButton = (event.target as Element).closest<HTMLElement>('[role="tab"]');
        if (!tabButton || !(headersContainer as HTMLElement).contains(tabButton)) return;

        const li = tabButton.closest<HTMLElement>(".tab-header");
        if (!li) return;

        const headers = qsa<HTMLElement>(".tab-header");
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

    on(headersContainer as HTMLElement, "dblclick", (e) => {
        const event = e as MouseEvent;
        const li = (event.target as Element).closest<HTMLElement>(".tab-header");
        const close = (event.target as Element).closest(".close");

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
        on(addTabBtn as HTMLElement, "click", () => {
            const activeTab = qs(".tab-header.active");
            addTab(false, "", activeTab, onModified);
        });
    }

    const colorPicker = qs<HTMLInputElement>("#tab-color-picker");
    if (colorPicker) {
        on(colorPicker, "input", () => {
            const activeTab = qs<HTMLElement>(".tab-header.active");
            if (!activeTab) return;
            applyTabColor(activeTab, colorPicker.value);
            syncTabColorControls();
            if (onModified) onModified(true);
        });
    }

    const clearColorBtn = qs<HTMLButtonElement>("#clear-tab-color");
    if (clearColorBtn) {
        on(clearColorBtn, "click", () => {
            const activeTab = qs<HTMLElement>(".tab-header.active");
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

/**
 * Handles window resize
 */
export function onWindowResize(): void {
    qsa(".tab-panel").forEach(panel => {
        const ta = panel.querySelector<HTMLTextAreaElement>("textarea.textarea-contents");
        const gutter = panel.querySelector<HTMLElement>(".line-gutter");
        if (ta && gutter) {
            const y = Math.round(ta.scrollTop || 0);
            gutter.style.setProperty("--gutter-scroll-y", String(-y));
            gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
            gutter.style.removeProperty("top");
            gutter.style.transform = "translateZ(0)";
        }
    });
}

// ============================================================================
// CONTENT MANAGEMENT
// ============================================================================

/**
 * Sets content for all tabs from a combined string
 */
export async function setContentOfTabs(content: string, state: TabState): Promise<void> {
    const sep = await getSeparatorHex();
    const parts = content ? content.split(sep) : [""];
    qsa(".tab-header").forEach(h => h.remove());
    qsa(".tab-panel").forEach(p => p.remove());

    tabCounter = 0;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i] ?? "";
        if (part.includes(MOBILE_METADATA_HINT)) {
            state.setMobileAppMetadataTabContent(part);
        } else {
            addTab(true, part, null, () => state.updateIsTextModified(true));
        }
    }

    if (qsa(".tab-header").length === 0) {
        addTab(true, "", null, () => state.updateIsTextModified(true));
    }

    const first = qs(".tab-header");
    if (first) activateTab(first);
}

/**
 * Gets combined content from all tabs
 */
export async function getContentFromTabs(state: TabState): Promise<string> {
    const sep = await getSeparatorHex();
    let all = "";
    const headers = qsa<HTMLElement>(".tab-header");

    for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (!header) continue;
        const id = header.dataset.tabId;
        const ta = id ? qs<HTMLTextAreaElement>(`#${id} textarea.textarea-contents`) : null;
        const tabColor = normalizeTabColor(header.dataset.tabColor);

        if (i > 0) all += sep;
        if (tabColor) {
            all += `${TAB_COLOR_METADATA_PREFIX}${tabColor}\n`;
        }
        all += ta?.value || "";
    }

    const meta = state.getMobileAppMetadataTabContent();
    if (typeof meta === "string" && meta.length > 0) {
        all += sep + meta;
    }
    return all;
}

/**
 * Resets tab counter (for reinitialization)
 */
export function resetTabCounter(): void {
    tabCounter = 0;
}
