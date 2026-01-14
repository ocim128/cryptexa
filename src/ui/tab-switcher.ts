/**
 * Tab Switcher (Quick Tab Navigation)
 * Provides Ctrl+P style fuzzy search for tabs
 */

import { qs, qsa } from '../utils/dom.js';
import { activateTab } from './tabs.js';

// ============================================================================
// TYPES
// ============================================================================

interface TabInfo {
    header: HTMLElement;
    id: string;
    title: string;
    content: string;
    isPinned: boolean;
    isModified: boolean;
    index: number;
}

// ============================================================================
// MODULE STATE
// ============================================================================

let switcherDialog: HTMLDialogElement | null = null;
let isInitialized = false;

// ============================================================================
// FUZZY SEARCH
// ============================================================================

/**
 * Simple fuzzy match scoring
 * Returns score (higher is better), -1 if no match
 */
function fuzzyMatch(query: string, text: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match gets highest score
    if (textLower === queryLower) return 1000;

    // Starts with gets high score
    if (textLower.startsWith(queryLower)) return 500 + (100 - text.length);

    // Contains gets medium score
    if (textLower.includes(queryLower)) return 200 + (100 - textLower.indexOf(queryLower));

    // Fuzzy character matching
    let queryIndex = 0;
    let score = 0;
    let lastMatchIndex = -1;

    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
        if (textLower[i] === queryLower[queryIndex]) {
            // Consecutive matches get bonus
            if (lastMatchIndex === i - 1) {
                score += 5;
            } else {
                score += 1;
            }
            lastMatchIndex = i;
            queryIndex++;
        }
    }

    // All query characters must be found
    if (queryIndex !== queryLower.length) return -1;

    return score;
}

/**
 * Highlights matching characters in text
 */
function highlightMatch(query: string, text: string): string {
    if (!query) return escapeHtml(text);

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    let result = '';
    let queryIndex = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i] || '';
        const charLower = textLower[i] || '';
        const queryChar = queryLower[queryIndex] || '';
        if (queryIndex < queryLower.length && charLower === queryChar) {
            result += `<mark>${escapeHtml(char)}</mark>`;
            queryIndex++;
        } else {
            result += escapeHtml(char);
        }
    }

    return result;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================================
// TAB INFO GATHERING
// ============================================================================

/**
 * Gets all tabs with their metadata
 */
function getAllTabs(): TabInfo[] {
    const headers = qsa<HTMLElement>('.tab-header');
    const tabs: TabInfo[] = [];

    headers.forEach((header, index) => {
        const id = header.dataset.tabId || '';
        const titleEl = header.querySelector('.tab-title');
        const title = titleEl?.textContent || 'Empty Tab';
        const isPinned = header.classList.contains('pinned');
        const isModified = header.classList.contains('modified');

        // Get content preview from the tab panel
        const panel = id ? qs<HTMLElement>(`#${id}`) : null;
        const textarea = panel?.querySelector<HTMLTextAreaElement>('.textarea-contents');
        const content = textarea?.value?.substring(0, 200) || '';

        tabs.push({
            header,
            id,
            title,
            content,
            isPinned,
            isModified,
            index
        });
    });

    return tabs;
}

// ============================================================================
// SWITCHER UI
// ============================================================================

/**
 * Creates the switcher dialog if it doesn't exist
 */
function ensureSwitcherDialog(): HTMLDialogElement {
    if (switcherDialog) return switcherDialog;

    const dialog = document.createElement('dialog');
    dialog.id = 'tab-switcher-dialog';
    dialog.className = 'tab-switcher-dialog';
    dialog.innerHTML = `
        <div class="tab-switcher-container">
            <div class="tab-switcher-header">
                <input type="text" 
                       id="tab-switcher-input" 
                       class="tab-switcher-input" 
                       placeholder="Search tabs... (↑↓ to navigate, Enter to select)"
                       autocomplete="off" />
                <kbd class="tab-switcher-hint">Esc to close</kbd>
            </div>
            <div class="tab-switcher-list" id="tab-switcher-list">
                <!-- Tab items rendered here -->
            </div>
            <div class="tab-switcher-footer">
                <span class="tab-switcher-stat" id="tab-switcher-stat">0 tabs</span>
                <div class="tab-switcher-shortcuts">
                    <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
                    <span><kbd>Enter</kbd> Select</span>
                    <span><kbd>Ctrl+P</kbd> Pin/Unpin</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
    switcherDialog = dialog;

    // Wire up event handlers
    const input = dialog.querySelector<HTMLInputElement>('#tab-switcher-input')!;
    const list = dialog.querySelector<HTMLElement>('#tab-switcher-list')!;

    // Search on input
    input.addEventListener('input', () => {
        renderTabList(input.value);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll<HTMLElement>('.tab-switcher-item');
        const activeItem = list.querySelector<HTMLElement>('.tab-switcher-item.active');
        const activeIndex = activeItem ? Array.from(items).indexOf(activeItem) : -1;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (items.length > 0) {
                    const nextIndex = (activeIndex + 1) % items.length;
                    items.forEach((item, i) => item.classList.toggle('active', i === nextIndex));
                    items[nextIndex]?.scrollIntoView({ block: 'nearest' });
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (items.length > 0) {
                    const prevIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
                    items.forEach((item, i) => item.classList.toggle('active', i === prevIndex));
                    items[prevIndex]?.scrollIntoView({ block: 'nearest' });
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (activeItem) {
                    const tabId = activeItem.dataset.tabId;
                    const header = tabId ? qs<HTMLElement>(`.tab-header[data-tab-id="${tabId}"]`) : null;
                    if (header) {
                        activateTab(header);
                        closeSwitcher();
                    }
                }
                break;

            case 'Escape':
                e.preventDefault();
                closeSwitcher();
                break;

            case 'p':
            case 'P':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (activeItem) {
                        const tabId = activeItem.dataset.tabId;
                        const header = tabId ? qs<HTMLElement>(`.tab-header[data-tab-id="${tabId}"]`) : null;
                        if (header) {
                            togglePinTab(header);
                            renderTabList(input.value);
                        }
                    }
                }
                break;
        }
    });

    // Click to select
    list.addEventListener('click', (e) => {
        const item = (e.target as Element).closest<HTMLElement>('.tab-switcher-item');
        if (item) {
            const tabId = item.dataset.tabId;
            const header = tabId ? qs<HTMLElement>(`.tab-header[data-tab-id="${tabId}"]`) : null;
            if (header) {
                activateTab(header);
                closeSwitcher();
            }
        }
    });

    // Close on backdrop click
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            closeSwitcher();
        }
    });

    return dialog;
}

/**
 * Renders the filtered tab list
 */
function renderTabList(query: string = ''): void {
    const list = qs<HTMLElement>('#tab-switcher-list');
    const stat = qs<HTMLElement>('#tab-switcher-stat');
    if (!list) return;

    let tabs = getAllTabs();

    // Filter and score by query
    if (query.trim()) {
        tabs = tabs
            .map(tab => ({
                ...tab,
                score: Math.max(
                    fuzzyMatch(query, tab.title),
                    fuzzyMatch(query, tab.content) * 0.5 // Content matches worth less
                )
            }))
            .filter(tab => tab.score > 0)
            .sort((a, b) => (b as any).score - (a as any).score);
    }

    // Sort: pinned first, then by index
    tabs.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return a.index - b.index;
    });

    // Render items
    list.innerHTML = tabs.map((tab, i) => `
        <div class="tab-switcher-item ${i === 0 ? 'active' : ''} ${tab.isPinned ? 'pinned' : ''} ${tab.isModified ? 'modified' : ''}" 
             data-tab-id="${tab.id}">
            <div class="tab-switcher-item-icon">
                ${tab.isPinned ? '📌' : '📄'}
            </div>
            <div class="tab-switcher-item-content">
                <div class="tab-switcher-item-title">
                    ${highlightMatch(query, tab.title)}
                    ${tab.isModified ? '<span class="modified-dot">●</span>' : ''}
                </div>
                <div class="tab-switcher-item-preview">
                    ${tab.content ? escapeHtml(tab.content.substring(0, 80)) + (tab.content.length > 80 ? '...' : '') : '<em>Empty</em>'}
                </div>
            </div>
            <div class="tab-switcher-item-index">#${tab.index + 1}</div>
        </div>
    `).join('');

    // Update stat
    if (stat) {
        const totalTabs = getAllTabs().length;
        const pinnedCount = tabs.filter(t => t.isPinned).length;
        stat.textContent = `${tabs.length}/${totalTabs} tabs${pinnedCount ? ` • ${pinnedCount} pinned` : ''}`;
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Opens the tab switcher dialog
 */
export function openTabSwitcher(): void {
    const dialog = ensureSwitcherDialog();
    const input = dialog.querySelector<HTMLInputElement>('#tab-switcher-input');

    // Reset and show
    if (input) {
        input.value = '';
    }
    renderTabList();

    dialog.showModal();
    input?.focus();
}

/**
 * Closes the tab switcher dialog
 */
export function closeSwitcher(): void {
    switcherDialog?.close();
}

/**
 * Toggles pin state on a tab
 */
export function togglePinTab(header: HTMLElement): void {
    header.classList.toggle('pinned');

    // Add pin indicator if not present
    let pinIndicator = header.querySelector('.pin-indicator');
    if (header.classList.contains('pinned')) {
        if (!pinIndicator) {
            const newIndicator = document.createElement('span');
            newIndicator.className = 'pin-indicator';
            newIndicator.textContent = '📌';
            newIndicator.title = 'Pinned - double-click to unpin';
            header.insertBefore(newIndicator, header.firstChild);
            pinIndicator = newIndicator;
        }
        // Move pinned tabs to the front
        const container = qs('.tab-headers-container');
        const firstUnpinned = container?.querySelector('.tab-header:not(.pinned)');
        if (container && firstUnpinned && firstUnpinned !== header) {
            container.insertBefore(header, firstUnpinned);
        } else if (container) {
            container.insertBefore(header, container.firstChild);
        }
    } else {
        pinIndicator?.remove();
    }

    // Update close button visibility
    const closeBtn = header.querySelector<HTMLElement>('.close');
    if (closeBtn) {
        closeBtn.style.display = header.classList.contains('pinned') ? 'none' : '';
    }
}

/**
 * Marks a tab as modified (has unsaved changes)
 */
export function setTabModified(header: HTMLElement, modified: boolean): void {
    header.classList.toggle('modified', modified);
}

/**
 * Marks all tabs as saved (removes modified indicator)
 */
export function clearAllModified(): void {
    qsa('.tab-header.modified').forEach(header => {
        header.classList.remove('modified');
    });
}

/**
 * Gets list of pinned tab IDs
 */
export function getPinnedTabs(): string[] {
    return qsa<HTMLElement>('.tab-header.pinned')
        .map(h => h.dataset.tabId || '')
        .filter(id => id);
}

/**
 * Restores pinned state from stored IDs
 */
export function restorePinnedTabs(pinnedIds: string[]): void {
    pinnedIds.forEach(id => {
        const header = qs<HTMLElement>(`.tab-header[data-tab-id="${id}"]`);
        if (header && !header.classList.contains('pinned')) {
            togglePinTab(header);
        }
    });
}

/**
 * Initializes the tab switcher keyboard shortcut
 */
export function initTabSwitcher(): void {
    if (isInitialized) return;
    isInitialized = true;

    // Ctrl+P / Cmd+P to open switcher
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey && !e.altKey) {
            // Don't interfere if a dialog is open
            const openDialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
            const firstDialog = openDialogs[0];
            if (openDialogs.length === 0 || (openDialogs.length === 1 && firstDialog?.id === 'tab-switcher-dialog')) {
                e.preventDefault();
                openTabSwitcher();
            }
        }
    });

    // Double-click on pin indicator to unpin
    document.addEventListener('dblclick', (e) => {
        const pinIndicator = (e.target as Element).closest('.pin-indicator');
        if (pinIndicator) {
            const header = pinIndicator.closest<HTMLElement>('.tab-header');
            if (header) {
                e.preventDefault();
                e.stopPropagation();
                togglePinTab(header);
            }
        }
    });
}
