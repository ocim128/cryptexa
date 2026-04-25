/**
 * Global Search Module
 * Provides global search functionality across all tabs
 */

import { qs, qsa, on } from "../utils/dom.js";
import { activateTab } from "./tabs.js";

export interface SearchResult {
    tabId: string;
    tabTitle: string;
    lineNumber: number;
    lineContent: string;
    matchStart: number;
    matchEnd: number;
}

interface SearchState {
    isOpen: boolean;
    query: string;
    results: SearchResult[];
    selectedIndex: number;
}

interface SearchIndexEntry {
    tabId: string;
    tabTitle: string;
    content: string;
    lowerContent: string;
    lineStarts: number[];
}

const searchState: SearchState = {
    isOpen: false,
    query: "",
    results: [],
    selectedIndex: -1
};

let searchDialog: HTMLDialogElement | null = null;
let searchInput: HTMLInputElement | null = null;
let resultsContainer: HTMLElement | null = null;
const searchIndex = new Map<string, SearchIndexEntry>();
let searchInputRaf = 0;

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function highlightMatch(result: SearchResult): string {
    const before = escapeHtml(result.lineContent.substring(0, result.matchStart));
    const match = escapeHtml(result.lineContent.substring(result.matchStart, result.matchEnd));
    const after = escapeHtml(result.lineContent.substring(result.matchEnd));

    const maxLen = 64;
    const head = before.length > maxLen / 2 ? `...${before.substring(before.length - maxLen / 2)}` : before;
    const tail = after.length > maxLen / 2 ? `${after.substring(0, maxLen / 2)}...` : after;
    return `${head}<mark>${match}</mark>${tail}`;
}

function buildLineStarts(content: string): number[] {
    const starts = [0];
    for (let index = 0; index < content.length; index++) {
        if (content.charCodeAt(index) === 10) {
            starts.push(index + 1);
        }
    }
    return starts;
}

function findLineIndex(lineStarts: number[], position: number): number {
    let low = 0;
    let high = lineStarts.length - 1;

    while (low <= high) {
        const mid = (low + high) >> 1;
        if ((lineStarts[mid] ?? Number.MAX_SAFE_INTEGER) <= position) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return Math.max(0, high);
}

function getLineText(content: string, lineStarts: number[], lineIndex: number): string {
    const start = lineStarts[lineIndex] ?? 0;
    const nextStart = lineStarts[lineIndex + 1] ?? content.length;
    const end = nextStart > start ? nextStart - 1 : content.length;
    return content.slice(start, end);
}

function cacheTabEntry(header: HTMLElement): SearchIndexEntry | null {
    const tabId = header.dataset.tabId;
    if (!tabId) return null;

    const tabTitle = header.querySelector(".tab-title")?.textContent || "Untitled";
    const textarea = qs<HTMLTextAreaElement>(`#${tabId} .textarea-contents`);
    if (!textarea) {
        searchIndex.delete(tabId);
        return null;
    }

    const content = textarea.value || "";
    const cached = searchIndex.get(tabId);
    if (cached && cached.content === content && cached.tabTitle === tabTitle) {
        return cached;
    }

    const entry: SearchIndexEntry = {
        tabId,
        tabTitle,
        content,
        lowerContent: content.toLowerCase(),
        lineStarts: buildLineStarts(content)
    };
    searchIndex.set(tabId, entry);
    return entry;
}

function syncSearchIndex(): SearchIndexEntry[] {
    const activeTabIds = new Set<string>();
    const entries: SearchIndexEntry[] = [];

    for (const header of qsa<HTMLElement>(".tab-header")) {
        const entry = cacheTabEntry(header);
        if (!entry) continue;
        activeTabIds.add(entry.tabId);
        entries.push(entry);
    }

    Array.from(searchIndex.keys()).forEach((tabId) => {
        if (!activeTabIds.has(tabId)) {
            searchIndex.delete(tabId);
        }
    });

    return entries;
}

function getSearchMessage(): string {
    if (searchState.results.length > 0) return "";
    if (searchState.query.length >= 2) {
        return `No matches for "${escapeHtml(searchState.query)}".`;
    }
    if (searchState.query.length > 0) {
        return "Type at least 2 characters to search.";
    }
    return "Search across all open tabs.";
}

function updateSelectedResult(): void {
    if (!resultsContainer) return;

    const selected = resultsContainer.querySelector<HTMLElement>(".search-result.selected");
    if (selected) {
        selected.classList.remove("selected");
    }

    if (searchState.selectedIndex < 0) return;
    resultsContainer
        .querySelector<HTMLElement>(`.search-result[data-index="${searchState.selectedIndex}"]`)
        ?.classList.add("selected");
}

export function searchAllTabs(query: string): SearchResult[] {
    if (!query || query.length < 2) return [];

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const entry of syncSearchIndex()) {
        let matchIndex = entry.lowerContent.indexOf(lowerQuery);
        while (matchIndex !== -1) {
            const lineIndex = findLineIndex(entry.lineStarts, matchIndex);
            const lineContent = getLineText(entry.content, entry.lineStarts, lineIndex);
            const lineStart = entry.lineStarts[lineIndex] ?? 0;
            const matchStart = matchIndex - lineStart;

            results.push({
                tabId: entry.tabId,
                tabTitle: entry.tabTitle,
                lineNumber: lineIndex + 1,
                lineContent,
                matchStart,
                matchEnd: matchStart + query.length
            });

            matchIndex = entry.lowerContent.indexOf(lowerQuery, matchIndex + 1);
        }
    }

    return results;
}

function renderResults(): void {
    if (!resultsContainer) return;

    if (searchState.results.length === 0) {
        resultsContainer.innerHTML = `<div class="search-hint">${getSearchMessage()}</div>`;
        return;
    }

    const headerHtml = `
        <div class="search-results-header">
            ${searchState.results.length} result${searchState.results.length === 1 ? "" : "s"}
        </div>
    `;

    const resultsHtml = searchState.results.map((result, index) => `
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
    `).join("");

    resultsContainer.innerHTML = `${headerHtml}${resultsHtml}`;
}

function scrollSelectedIntoView(): void {
    resultsContainer?.querySelector(".search-result.selected")?.scrollIntoView({
        block: "nearest",
        behavior: "smooth"
    });
}

function handleSearchInput(): void {
    if (!searchInput) return;

    const nextQuery = searchInput.value;
    if (searchInputRaf) cancelAnimationFrame(searchInputRaf);
    searchInputRaf = requestAnimationFrame(() => {
        searchInputRaf = 0;
        searchState.query = nextQuery;
        searchState.results = searchAllTabs(searchState.query);
        searchState.selectedIndex = searchState.results.length > 0 ? 0 : -1;
        renderResults();
    });
}

export function goToResult(result: SearchResult): void {
    const tabHeader = qs<HTMLElement>(`.tab-header[data-tab-id="${result.tabId}"]`);
    if (!tabHeader) {
        closeSearch();
        return;
    }

    activateTab(tabHeader);
    setTimeout(() => {
        const textarea = qs<HTMLTextAreaElement>(`#${result.tabId} .textarea-contents`);
        if (!textarea) return;

        const content = textarea.value || "";
        const lineStarts = buildLineStarts(content);
        const lineStart = lineStarts[result.lineNumber - 1] ?? 0;
        const charPosition = lineStart + result.matchStart;

        textarea.focus();
        textarea.setSelectionRange(charPosition, charPosition + (result.matchEnd - result.matchStart));

        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 24;
        textarea.scrollTop = Math.max(0, (result.lineNumber - 5) * lineHeight);
    }, 100);

    closeSearch();
}

function handleSearchKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown") {
        event.preventDefault();
        if (searchState.results.length === 0) return;
        searchState.selectedIndex = Math.min(searchState.selectedIndex + 1, searchState.results.length - 1);
        updateSelectedResult();
        scrollSelectedIntoView();
        return;
    }

    if (event.key === "ArrowUp") {
        event.preventDefault();
        if (searchState.results.length === 0) return;
        searchState.selectedIndex = Math.max(searchState.selectedIndex - 1, 0);
        updateSelectedResult();
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

function handleResultClick(event: Event): void {
    const resultEl = (event.target as HTMLElement).closest<HTMLElement>(".search-result");
    if (!resultEl) return;

    const index = parseInt(resultEl.dataset.index || "-1", 10);
    if (index < 0) return;

    const result = searchState.results[index];
    if (result) {
        goToResult(result);
    }
}

export function openSearch(): void {
    if (!searchDialog) initSearchDialog();

    syncSearchIndex();
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

export function closeSearch(): void {
    searchState.isOpen = false;
    searchDialog?.close();
}

export function toggleSearch(): void {
    if (searchState.isOpen) {
        closeSearch();
    } else {
        openSearch();
    }
}

export function initSearchDialog(): void {
    searchDialog = qs<HTMLDialogElement>("#search-dialog");
    if (searchDialog) {
        searchInput = qs<HTMLInputElement>("#search-input");
        resultsContainer = qs<HTMLElement>("#search-results");
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
    searchInput = qs<HTMLInputElement>("#search-input");
    resultsContainer = qs<HTMLElement>("#search-results");

    if (searchInput) {
        on(searchInput, "input", handleSearchInput);
        on(searchInput, "keydown", handleSearchKeydown as EventListener);
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

export function initGlobalSearch(): void {
    initSearchDialog();
}
