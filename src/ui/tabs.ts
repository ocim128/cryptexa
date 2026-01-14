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

/**
 * Updates selected lines highlight
 */
export function updateSelectedLinesHighlight(
    ta: HTMLTextAreaElement,
    editorWrap: Element
): void {
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

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

/**
 * Activates a tab by its header element
 */
export function activateTab(headerLi: Element): void {
    const headers = qsa(".tab-header");
    const panels = qsa(".tab-panel");
    const id = (headerLi as HTMLElement).dataset.tabId;
    const panel = id ? qs(`#${id}`) : null;

    // Use a document fragment-like batching via requestAnimationFrame
    requestAnimationFrame(() => {
        headers.forEach(h => h.classList.remove("active"));
        panels.forEach(p => p.classList.remove("active"));
        headerLi.classList.add("active");
        if (panel) panel.classList.add("active");

        // Defer heavy work to idle time to keep tab switch snappy
        setTimeout(() => {
            focusActiveTextarea();
            const ta = panel?.querySelector<HTMLTextAreaElement>("textarea.textarea-contents");
            const gutter = panel?.querySelector<HTMLElement>(".line-gutter");
            if (ta && gutter) {
                const y = Math.round(ta.scrollTop || 0);
                gutter.style.setProperty("--gutter-scroll-y", String(-y));
                gutter.style.setProperty("--gutter-before-transform", `translateY(${-y}px)`);
                gutter.style.removeProperty("top");
                gutter.style.transform = "translateZ(0)";

                // Lazy line number update for big docs
                const needsHeavyUpdate = (ta.value && ta.value.length > 50000);
                if (needsHeavyUpdate) {
                    setTimeout(() => updateGutterForTextarea(ta, gutter), 0);
                } else {
                    updateGutterForTextarea(ta, gutter);
                }
            }
        }, 0);
    });
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

    // Skip leading whitespace quickly
    let start = 0;
    while (start < effectiveContent.length) {
        const ch = effectiveContent[start];
        if (ch !== " " && ch !== "\n" && ch !== "\t" && ch !== "\r" && ch !== "\v" && ch !== "\f") break;
        start++;
    }
    if (start >= effectiveContent.length) return "Empty Tab";

    // Find end of first line within the capped window
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

    // Parse content and color metadata
    let actualContent = contentIfAvailable;
    let tabColor: string | null = null;

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
    qs("#tabs")!.appendChild(panel);

    const ta = panel.querySelector<HTMLTextAreaElement>("textarea.textarea-contents")!;
    const gutter = panel.querySelector<HTMLElement>(".line-gutter")!;

    const updateGutter = (): void => {
        updateGutterForTextarea(ta, gutter);
    };

    // Initial content
    if (actualContent && actualContent.length > 0) {
        ta.value = actualContent;
        a.textContent = getTitleFromContent(actualContent.substring(0, 200));
    } else {
        a.textContent = getTitleFromContent("");
    }

    // Wire updates
    let rafId = 0;
    ta.addEventListener("input", () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            updateGutter();
        });
    });

    // Sync gutter vertical offset with textarea scroll
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

    // Ensure initial render
    const isHuge = (ta.value && ta.value.length > 50000);
    if (isHuge) {
        setTimeout(updateGutter, 0);
    } else {
        requestAnimationFrame(updateGutter);
    }

    // Initialize line highlights
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
        if (closer) closer.style.display = headers.length > 1 ? "" : "none";
    });
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
            return { offset: offset, element: child };
        } else {
            return closest;
        }
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

    // Single click for tab switching only
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

    // Double click for close button and color picker
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
            return;
        }
    });

    const addTabBtn = qs("#add_tab");
    if (addTabBtn) {
        on(addTabBtn as HTMLElement, "click", () => {
            const activeTab = qs(".tab-header.active");
            addTab(false, "", activeTab, onModified);
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
    const menubar = qs<HTMLElement>("#menubar");
    const outter = qs<HTMLElement>("#main-content-outter");
    const headers = qs<HTMLElement>(".tab-headers");

    if (!menubar || !outter || !headers) return;

    const top = menubar.getBoundingClientRect().height;
    outter.style.top = `${top}px`;
    const h = window.innerHeight - top;
    outter.style.height = `${h}px`;
    const panels = qsa<HTMLElement>(".tab-panel");
    const headerH = headers.getBoundingClientRect().height;
    panels.forEach(p => {
        p.style.height = `${Math.max(0, h - headerH)}px`;
    });

    // Keep gutter scroll offset aligned after resizes
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
        if (part.startsWith("♻ Reload this website to hide mobile app metadata! ♻")) {
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
        const tabColor = header.dataset.tabColor;

        if (i > 0) all += sep;

        // Add color metadata if tab has a color
        if (tabColor && tabColor !== "#ffffff") {
            all += `__CRYPTEXA_COLOR__:${tabColor}\n`;
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
