/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const markSearchIndexDirty = vi.fn();

vi.mock('../../src/ui/search.js', async () => {
    const actual = await vi.importActual<typeof import('../../src/ui/search')>('../../src/ui/search');
    return {
        ...actual,
        initGlobalSearch: vi.fn(),
        openSearch: vi.fn(),
        markSearchIndexDirty
    };
});

vi.mock('../../src/ui/dialogs.js', () => ({
    openPasswordDialog: vi.fn(),
    openConfirmDialog: vi.fn()
}));

vi.mock('../../src/ui/toast.js', () => ({
    toast: vi.fn()
}));

vi.mock('../../src/ui/password-strength.js', () => ({
    initPasswordStrengthIndicators: vi.fn()
}));

vi.mock('../../src/ui/tab-switcher.js', () => ({
    initTabSwitcher: vi.fn(),
    openTabSwitcher: vi.fn(),
    setTabModified: vi.fn(),
    clearAllModified: vi.fn()
}));

vi.mock('../../src/state/ClientState.js', () => {
    class MockClientState {
        remote = { eContent: '', isNew: true };
        onButtonEnablementChange?: (isTextModified: boolean, isSiteNew: boolean) => void;
        onStatusChange?: (status: string, text: string) => void;
        onLastSavedUpdate?: () => void;
        onFinishInitialization?: (shouldSkipSettingContent?: boolean) => void;
        onDecryptAndFinish?: (isOld: boolean) => void;

        constructor(_siteId: string, _password: string | null) {}
        async init(): Promise<void> {}
        getIsNew(): boolean { return true; }
        getContent(): string { return ''; }
        getIsTextModified(): boolean { return false; }
        getInitialIsNew(): boolean { return true; }
        updateIsTextModified(_modified: boolean): void {}
        setInitHashContent(): void {}
        async saveSite(_forceNewPassword: boolean): Promise<void> {}
        async reloadSite(): Promise<void> {}
        async deleteSite(): Promise<void> {}
        async setLoginPasswordAndContentIfCorrect(_password: string): Promise<boolean> { return true; }
        getPassword(): string { return ''; }
    }

    return {
        ClientState: MockClientState,
        setTabFunctions: vi.fn()
    };
});

function buildAppShell(): void {
    document.body.innerHTML = `
        <div id="site-context" class="hidden"><span id="site-label"></span></div>
        <form id="landing-form"><input id="landing-site" /></form>
        <button id="theme-toggle"><span class="label"></span></button>
        <div id="help-shortcuts"></div>
        <dialog id="dialog-help"></dialog>
        <button id="button-save"></button>
        <button id="button-savenew"></button>
        <button id="button-reload"></button>
        <button id="button-delete"></button>
        <button id="button-export"></button>
        <button id="search-button"></button>
        <button id="help-button"></button>
        <button id="add_tab"></button>
        <input id="tab-color-picker" value="#d15f38" />
        <button id="clear-tab-color"></button>
        <div class="tab-mark-control"></div>
        <div id="status-indicator"><span class="status-text"></span></div>
        <div id="last-saved" class="hidden"></div>
        <div class="tab-headers-container"></div>
        <div id="tabs"></div>
    `;
}

describe('app Tab indentation', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        markSearchIndexDirty.mockReset();
        buildAppShell();
        window.history.replaceState({}, '', '/workspace-a');
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            return window.setTimeout(() => callback(performance.now()), 0);
        });
        vi.stubGlobal('cancelAnimationFrame', (id: number) => {
            window.clearTimeout(id);
        });
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockReturnValue({
                matches: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn()
            })
        });
        globalThis.fetch = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    });

    it('dispatches input-driven updates after inserting spaces with Tab', async () => {
        await import('../../src/app');
        document.dispatchEvent(new Event('DOMContentLoaded'));

        await new Promise((resolve) => setTimeout(resolve, 80));

        const textarea = document.querySelector<HTMLTextAreaElement>('.textarea-contents');
        expect(textarea).not.toBeNull();
        if (!textarea) return;

        textarea.focus();
        textarea.value = 'hello';
        textarea.selectionStart = 0;
        textarea.selectionEnd = 0;

        const keydownEvent = new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(keydownEvent);

        await new Promise((resolve) => setTimeout(resolve, 30));

        expect(textarea.value).toBe('    hello');
        expect(markSearchIndexDirty).toHaveBeenCalledTimes(1);
        expect(markSearchIndexDirty).toHaveBeenCalledWith(textarea.closest('.tab-panel')?.id);
    });
});
