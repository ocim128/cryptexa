/**
 * Tab Management Module
 * Provides tab UI functionality including creation, activation, and drag-and-drop
 */

import { qs, qsa, on } from '../utils/dom.js';

import { openConfirmDialog } from './dialogs.js';
import { getSeparatorHex } from '../utils/crypto-helpers.js';

// Module state
let tabCounter = 1;
let currentTabTitle = null;
let currentTextarea = null;

/**
 * Gets current tab title element
 * @returns {Element|null}
 */
export function getCurrentTabTitle() {
    return currentTabTitle;
}

/**
 * Gets current textarea element
 * @returns {HTMLTextAreaElement|null}
 */
export function getCurrentTextarea() {
    return currentTextarea;
}

/**
 * Updates the gutter line numbers for a textarea
 * @param {HTMLTextAreaElement} ta - Textarea element
 * @param {Element} gutter - Gutter element
 */
export function updateGutterForTextarea(ta, gutter) {
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
 * @param {string} text - Text content
 * @param {number} position - Character position
 * @returns {number} - Line number (1-indexed)
 */
export function getLineNumberFromPosition(text, position) {
    if (position < 0) return 1;
    const textUpToPosition = text.substring(0, position);
    return textUpToPosition.split('\n').length;
}

/**
 * Gets line height from textarea
 * @param {HTMLTextAreaElement} ta - Textarea element
 * @returns {number} - Line height in pixels
 */
export function getLineHeight(ta) {
    const computedStyle = window.getComputedStyle(ta);
    return parseInt(computedStyle.lineHeight) || parseInt(computedStyle.fontSize) * 1.2;
}

/**
 * Updates active line highlight
 * @param {HTMLTextAreaElement} ta - Textarea element
 * @param {Element} editorWrap - Editor wrapper element
 */
export function updateActiveLineHighlight(ta, editorWrap) {
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
 * @param {HTMLTextAreaElement} ta - Textarea element
 * @param {Element} editorWrap - Editor wrapper element
 */
export function updateSelectedLinesHighlight(ta, editorWrap) {
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

/**
 * Activates a tab by its header element
 * @param {Element} headerLi - Tab header element
 */
export function activateTab(headerLi) {
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

/**
 * Computes tab title from content
 * @param {string} content - Content to derive title from
 * @returns {string} - Tab title
 */
export function getTitleFromContent(content) {
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

/**
 * Focuses the active textarea
 */
export function focusActiveTextarea() {
    currentTabTitle = qs(".tab-header.active .tab-title");
    const panel = qs(".tab-panel.active");
    currentTextarea = panel ? panel.querySelector("textarea.textarea-contents") : null;
    currentTextarea && currentTextarea.focus();
}

/**
 * Adds a new tab
 * @param {boolean} isExistingTab - Whether this is an existing tab (from loaded content)
 * @param {string} contentIfAvailable - Initial content for the tab
 * @param {Element|null} insertAfter - Insert after this element (optional)
 * @param {Function} onModified - Callback when content is modified
 * @returns {Element} - The new tab header element
 */
export function addTab(isExistingTab, contentIfAvailable = "", insertAfter = null, onModified = null) {
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
    if (!isExistingTab && onModified) {
        onModified(true);
    }

    return li;
}

/**
 * Refreshes tab display (shows/hides close buttons)
 */
export function refreshTabs() {
    const headers = qsa(".tab-header");
    headers.forEach(h => {
        const closer = h.querySelector(".close");
        if (closer) closer.style.display = headers.length > 1 ? "" : "none";
    });
    focusActiveTextarea();
}

/**
 * Gets the element to insert before during drag-and-drop
 * @param {Element} container - Container element
 * @param {number} x - Mouse X position
 * @returns {Element|undefined}
 */
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

/**
 * Initializes tab drag-and-drop functionality
 * @param {Function} onModified - Callback when tabs are reordered
 */
export function initTabDragAndDrop(onModified = null) {
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

        if (onModified) onModified(true);
    });
}

/**
 * Initializes tabs layout with event listeners
 * @param {Function} onModified - Callback when content is modified
 */
export function initTabsLayout(onModified = null) {
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
                if (onModified) onModified(true);
                refreshTabs();
            });
            return;
        }
    });

    on(qs("#add_tab"), "click", () => {
        const activeTab = qs(".tab-header.active");
        addTab(false, "", activeTab, onModified);
    });

    initTabDragAndDrop(onModified);
    refreshTabs();
    onWindowResize();
    window.addEventListener("resize", onWindowResize);
}

/**
 * Handles window resize
 */
export function onWindowResize() {
    const menubar = qs("#menubar");
    const outter = qs("#main-content-outter");
    const headers = qs(".tab-headers");

    if (!menubar || !outter || !headers) return;

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

/**
 * Sets content for all tabs from a combined string
 * @param {string} content - Combined content with separators
 * @param {Object} state - Client state object
 */
export async function setContentOfTabs(content, state) {
    const sep = await getSeparatorHex();
    const parts = content ? content.split(sep) : [""];
    qsa(".tab-header").forEach(h => h.remove());
    qsa(".tab-panel").forEach(p => p.remove());

    tabCounter = 0;
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].startsWith("\u267B Reload this website to hide mobile app metadata! \u267B")) {
            state.setMobileAppMetadataTabContent(parts[i]);
        } else {
            addTab(true, parts[i], null, () => state.updateIsTextModified(true));
        }
    }
    if (qsa(".tab-header").length === 0) addTab(true, "", null, () => state.updateIsTextModified(true));
    const first = qs(".tab-header");
    if (first) activateTab(first);
}

/**
 * Gets combined content from all tabs
 * @param {Object} state - Client state object
 * @returns {Promise<string>} - Combined content with separators
 */
export async function getContentFromTabs(state) {
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

/**
 * Resets tab counter (for reinitialization)
 */
export function resetTabCounter() {
    tabCounter = 0;
}
