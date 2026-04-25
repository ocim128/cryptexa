/**
 * Tab Switcher
 * Provides fuzzy tab search, fast activation, and visible pin controls.
 */

import { qs, qsa } from "../utils/dom.js";
import { activateTab } from "./tabs.js";

interface TabInfo {
    header: HTMLElement;
    id: string;
    title: string;
    content: string;
    preview: string;
    isPinned: boolean;
    isModified: boolean;
    index: number;
}

let switcherDialog: HTMLDialogElement | null = null;
let isInitialized = false;

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function fuzzyMatch(query: string, text: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    if (textLower === queryLower) return 1000;
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

function highlightMatch(query: string, text: string): string {
    if (!query) return escapeHtml(text);

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    let output = "";
    let queryIndex = 0;

    for (let index = 0; index < text.length; index++) {
        const character = text[index] || "";
        const queryCharacter = queryLower[queryIndex] || "";
        if (queryIndex < queryLower.length && textLower[index] === queryCharacter) {
            output += `<mark>${escapeHtml(character)}</mark>`;
            queryIndex++;
        } else {
            output += escapeHtml(character);
        }
    }

    return output;
}

function getAllTabs(): TabInfo[] {
    return qsa<HTMLElement>(".tab-header").map((header, index) => {
        const id = header.dataset.tabId || "";
        const title = header.querySelector(".tab-title")?.textContent || "Empty Tab";
        const textarea = id ? qs<HTMLTextAreaElement>(`#${id} .textarea-contents`) : null;
        const content = textarea?.value || "";
        return {
            header,
            id,
            title,
            content,
            preview: content ? `${content.substring(0, 96)}${content.length > 96 ? "..." : ""}` : "Empty",
            isPinned: header.classList.contains("pinned"),
            isModified: header.classList.contains("modified"),
            index
        };
    });
}

function ensureSwitcherDialog(): HTMLDialogElement {
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

    const input = dialog.querySelector<HTMLInputElement>("#tab-switcher-input");
    const list = dialog.querySelector<HTMLElement>("#tab-switcher-list");

    input?.addEventListener("input", () => {
        renderTabList(input.value);
    });

    input?.addEventListener("keydown", (event) => {
        const items = list?.querySelectorAll<HTMLElement>(".tab-switcher-item") || [];
        const activeItem = list?.querySelector<HTMLElement>(".tab-switcher-item.active") || null;
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
            const header = qs<HTMLElement>(`.tab-header[data-tab-id="${activeItem.dataset.tabId}"]`);
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
        const pinButton = (event.target as HTMLElement).closest<HTMLButtonElement>(".tab-switcher-pin");
        if (pinButton) {
            event.preventDefault();
            event.stopPropagation();
            const tabId = pinButton.dataset.tabId;
            if (!tabId) return;
            const header = qs<HTMLElement>(`.tab-header[data-tab-id="${tabId}"]`);
            if (!header) return;
            togglePinTab(header);
            renderTabList(input?.value || "");
            return;
        }

        const item = (event.target as HTMLElement).closest<HTMLElement>(".tab-switcher-item");
        if (!item?.dataset.tabId) return;
        const header = qs<HTMLElement>(`.tab-header[data-tab-id="${item.dataset.tabId}"]`);
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

function renderTabList(query: string = ""): void {
    const list = qs<HTMLElement>("#tab-switcher-list");
    const stat = qs<HTMLElement>("#tab-switcher-stat");
    if (!list) return;

    const allTabs = getAllTabs();
    let tabs = allTabs;
    if (query.trim()) {
        tabs = tabs
            .map((tab) => ({
                ...tab,
                score: Math.max(fuzzyMatch(query, tab.title), fuzzyMatch(query, tab.content) * 0.5)
            }))
            .filter((tab) => (tab as TabInfo & { score: number }).score > 0)
            .sort((a, b) => (b as TabInfo & { score: number }).score - (a as TabInfo & { score: number }).score);
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
                    ${highlightMatch(query, tab.title)}
                    ${tab.isModified ? '<span class="modified-dot" aria-label="Unsaved changes"></span>' : ""}
                </div>
                <div class="tab-switcher-item-preview">
                    ${escapeHtml(tab.preview)}
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
        const pinnedCount = tabs.filter((tab) => tab.isPinned).length;
        stat.textContent = `${tabs.length}/${allTabs.length} tabs${pinnedCount ? `, ${pinnedCount} pinned` : ""}`;
    }
}

export function openTabSwitcher(): void {
    const dialog = ensureSwitcherDialog();
    const input = dialog.querySelector<HTMLInputElement>("#tab-switcher-input");
    if (input) input.value = "";
    renderTabList();
    dialog.showModal();
    input?.focus();
}

export function closeSwitcher(): void {
    switcherDialog?.close();
}

export function togglePinTab(header: HTMLElement): void {
    header.classList.toggle("pinned");

    let pinIndicator = header.querySelector<HTMLElement>(".pin-indicator");
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

    const closeButton = header.querySelector<HTMLElement>(".close");
    if (closeButton) {
        closeButton.style.display = header.classList.contains("pinned") ? "none" : "";
    }
}

export function setTabModified(header: HTMLElement, modified: boolean): void {
    header.classList.toggle("modified", modified);
}

export function clearAllModified(): void {
    qsa<HTMLElement>(".tab-header.modified").forEach((header) => header.classList.remove("modified"));
}

export function getPinnedTabs(): string[] {
    return qsa<HTMLElement>(".tab-header.pinned")
        .map((header) => header.dataset.tabId || "")
        .filter(Boolean);
}

export function restorePinnedTabs(pinnedIds: string[]): void {
    pinnedIds.forEach((id) => {
        const header = qs<HTMLElement>(`.tab-header[data-tab-id="${id}"]`);
        if (header && !header.classList.contains("pinned")) {
            togglePinTab(header);
        }
    });
}

export function initTabSwitcher(): void {
    if (isInitialized) return;
    isInitialized = true;

    document.addEventListener("dblclick", (event) => {
        const pinIndicator = (event.target as HTMLElement).closest(".pin-indicator");
        if (!pinIndicator) return;
        const header = pinIndicator.closest<HTMLElement>(".tab-header");
        if (!header) return;
        event.preventDefault();
        event.stopPropagation();
        togglePinTab(header);
    });
}
