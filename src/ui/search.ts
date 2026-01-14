/**
 * Global Search Module
 * Provides global search functionality across all tabs
 */

import { qs, qsa, on } from '../utils/dom.js';
import { activateTab } from './tabs.js';

// ============================================================================
// TYPES
// ============================================================================

/** Search result item */
export interface SearchResult {
    tabId: string;
    tabTitle: string;
    lineNumber: number;
    lineContent: string;
    matchStart: number;
    matchEnd: number;
}

/** Search state */
interface SearchState {
    isOpen: boolean;
    query: string;
    results: SearchResult[];
    selectedIndex: number;
}

// ============================================================================
// MODULE STATE
// ============================================================================

let searchState: SearchState = {
    isOpen: false,
    query: '',
    results: [],
    selectedIndex: -1
};

let searchDialog: HTMLDialogElement | null = null;
let searchInput: HTMLInputElement | null = null;
let resultsContainer: HTMLElement | null = null;

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Searches all tabs for matching content
 */
export function searchAllTabs(query: string): SearchResult[] {
    if (!query || query.length < 2) return [];

    const results: SearchResult[] = [];
    const headers = qsa<HTMLElement>('.tab-header');
    const lowerQuery = query.toLowerCase();

    for (const header of headers) {
        const tabId = header.dataset.tabId;
        if (!tabId) continue;

        const tabTitle = header.querySelector('.tab-title')?.textContent || 'Untitled';
        const textarea = qs<HTMLTextAreaElement>(`#${tabId} .textarea-contents`);
        if (!textarea) continue;

        const content = textarea.value;
        const lines = content.split('\n');

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

                // Find next match in same line
                matchIndex = lowerLine.indexOf(lowerQuery, matchIndex + 1);
            }
        }
    }

    return results;
}

/**
 * Highlights matched text in result
 */
function highlightMatch(result: SearchResult): string {
    const before = escapeHtml(result.lineContent.substring(0, result.matchStart));
    const match = escapeHtml(result.lineContent.substring(result.matchStart, result.matchEnd));
    const after = escapeHtml(result.lineContent.substring(result.matchEnd));

    // Truncate long lines
    const maxLen = 60;
    let displayBefore = before;
    let displayAfter = after;

    if (before.length > maxLen / 2) {
        displayBefore = '...' + before.substring(before.length - maxLen / 2);
    }
    if (after.length > maxLen / 2) {
        displayAfter = after.substring(0, maxLen / 2) + '...';
    }

    return `${displayBefore}<mark>${match}</mark>${displayAfter}`;
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Renders search results
 */
function renderResults(): void {
    if (!resultsContainer) return;

    if (searchState.results.length === 0) {
        if (searchState.query.length >= 2) {
            resultsContainer.innerHTML = `
                <div class="search-no-results">
                    <span class="search-no-results-icon">🔍</span>
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
        <div class="search-result${index === searchState.selectedIndex ? ' selected' : ''}" 
             data-index="${index}"
             data-tab-id="${result.tabId}"
             data-line="${result.lineNumber}">
            <div class="search-result-header">
                <span class="search-result-tab">📄 ${escapeHtml(result.tabTitle)}</span>
                <span class="search-result-line">Line ${result.lineNumber}</span>
            </div>
            <div class="search-result-content">${highlightMatch(result)}</div>
        </div>
    `).join('');

    resultsContainer.innerHTML = `
        <div class="search-results-header">
            Found ${searchState.results.length} match${searchState.results.length === 1 ? '' : 'es'}
        </div>
        ${html}
    `;
}

/**
 * Navigates to a search result
 */
export function goToResult(result: SearchResult): void {
    // Find and activate the tab
    const tabHeader = qs<HTMLElement>(`.tab-header[data-tab-id="${result.tabId}"]`);
    if (tabHeader) {
        activateTab(tabHeader);

        // After tab activation, scroll to and select the line
        setTimeout(() => {
            const textarea = qs<HTMLTextAreaElement>(`#${result.tabId} .textarea-contents`);
            if (!textarea) return;

            const lines = textarea.value.split('\n');
            let charPosition = 0;

            // Calculate character position of the line start
            for (let i = 0; i < result.lineNumber - 1; i++) {
                const lineLength = lines[i]?.length ?? 0;
                charPosition += lineLength + 1; // +1 for newline
            }

            // Add match start offset
            charPosition += result.matchStart;

            // Select the matched text
            textarea.focus();
            textarea.setSelectionRange(charPosition, charPosition + (result.matchEnd - result.matchStart));

            // Scroll the textarea to show the selection
            const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
            const scrollTop = (result.lineNumber - 5) * lineHeight; // Show some context
            textarea.scrollTop = Math.max(0, scrollTop);
        }, 100);
    }

    closeSearch();
}

/**
 * Handles keyboard navigation in search results
 */
function handleSearchKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (searchState.results.length > 0) {
            searchState.selectedIndex = Math.min(
                searchState.selectedIndex + 1,
                searchState.results.length - 1
            );
            renderResults();
            scrollSelectedIntoView();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (searchState.results.length > 0) {
            searchState.selectedIndex = Math.max(searchState.selectedIndex - 1, 0);
            renderResults();
            scrollSelectedIntoView();
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedResult = searchState.results[searchState.selectedIndex];
        if (searchState.selectedIndex >= 0 && selectedResult) {
            goToResult(selectedResult);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
    }
}

/**
 * Scrolls selected result into view
 */
function scrollSelectedIntoView(): void {
    const selected = resultsContainer?.querySelector('.search-result.selected');
    if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

/**
 * Handles search input changes
 */
function handleSearchInput(): void {
    if (!searchInput) return;

    searchState.query = searchInput.value;
    searchState.results = searchAllTabs(searchState.query);
    searchState.selectedIndex = searchState.results.length > 0 ? 0 : -1;
    renderResults();
}

/**
 * Handles clicking on a search result
 */
function handleResultClick(e: Event): void {
    const resultEl = (e.target as HTMLElement).closest('.search-result');
    if (!resultEl) return;

    const index = parseInt(resultEl.getAttribute('data-index') || '-1', 10);
    const result = searchState.results[index];
    if (index >= 0 && result) {
        goToResult(result);
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Opens the search dialog
 */
export function openSearch(): void {
    if (!searchDialog) {
        initSearchDialog();
    }

    searchState = {
        isOpen: true,
        query: '',
        results: [],
        selectedIndex: -1
    };

    if (searchInput) {
        searchInput.value = '';
    }

    renderResults();
    searchDialog?.showModal();

    setTimeout(() => {
        searchInput?.focus();
    }, 50);
}

/**
 * Closes the search dialog
 */
export function closeSearch(): void {
    searchState.isOpen = false;
    searchDialog?.close();
}

/**
 * Toggles the search dialog
 */
export function toggleSearch(): void {
    if (searchState.isOpen) {
        closeSearch();
    } else {
        openSearch();
    }
}

/**
 * Initializes the search dialog
 */
export function initSearchDialog(): void {
    // Check if dialog already exists
    searchDialog = qs<HTMLDialogElement>('#search-dialog');
    if (searchDialog) {
        searchInput = qs<HTMLInputElement>('#search-input');
        resultsContainer = qs<HTMLElement>('#search-results');
        return;
    }

    // Create the dialog
    const dialog = document.createElement('dialog');
    dialog.id = 'search-dialog';
    dialog.className = 'app-dialog search-dialog';
    dialog.innerHTML = `
        <form method="dialog">
            <div class="search-header">
                <div class="search-input-wrapper">
                    <span class="search-icon">🔍</span>
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
                <span>↑↓ Navigate</span>
                <span>↵ Go to</span>
                <span>Esc Close</span>
            </div>
        </form>
    `;

    document.body.appendChild(dialog);

    searchDialog = dialog;
    searchInput = qs<HTMLInputElement>('#search-input');
    resultsContainer = qs<HTMLElement>('#search-results');

    // Wire up events
    if (searchInput) {
        on(searchInput as HTMLElement, 'input', handleSearchInput);
        on(searchInput as HTMLElement, 'keydown', handleSearchKeydown as EventListener);
    }

    if (resultsContainer) {
        on(resultsContainer, 'click', handleResultClick);
    }

    // Close on backdrop click
    on(dialog, 'click', (e) => {
        if (e.target === dialog) {
            closeSearch();
        }
    });
}

/**
 * Initializes global search keyboard shortcut
 */
export function initGlobalSearch(): void {
    initSearchDialog();

    // Add keyboard shortcut Ctrl+F / Cmd+F
    on(document, 'keydown', ((e: KeyboardEvent) => {
        // Ctrl+Shift+F or Cmd+Shift+F for global search
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            openSearch();
        }
    }) as EventListener);
}
