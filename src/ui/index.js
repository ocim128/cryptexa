/**
 * UI Index Module
 * Re-exports all UI-related functionality
 */

export { toast, showNotification } from './toast.js';

export {
    openPasswordDialog,
    openDeletePasswordDialog,
    openNewPasswordDialog,
    openConfirmDialog
} from './dialogs.js';

export {
    initTheme,
    wireThemeToggle,
    applyTheme,
    currentTheme,
    store as storeTheme,
    getStored as getStoredTheme,
    getSystemPref
} from './themes.js';

export {
    initTabsLayout,
    refreshTabs,
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
    getCurrentTabTitle,
    getCurrentTextarea,
    resetTabCounter
} from './tabs.js';
