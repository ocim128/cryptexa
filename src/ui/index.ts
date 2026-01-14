/**
 * UI Index Module
 * Re-exports all UI-related functionality
 */

export { toast, showNotification } from './toast.js';
export type { ToastType } from './toast.js';

export {
    openPasswordDialog,
    openDeletePasswordDialog,
    openNewPasswordDialog,
    openConfirmDialog
} from './dialogs.js';
export type {
    PasswordDialogConfig,
    DeletePasswordDialogConfig,
    NewPasswordDialogConfig,
    ConfirmDialogCallback
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
export type { ThemePreference } from './themes.js';

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
export type { OnModifiedCallback, TabState } from './tabs.js';
