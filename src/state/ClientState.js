/**
 * Client State Management Module
 * Manages application state including authentication, content, and server communication
 * 
 * Note: To avoid circular dependencies, UI functions like focusActiveTextarea,
 * getContentFromTabs, and setContentOfTabs should be injected via setTabFunctions().
 */

import { sha512Hex, simpleWeakHash, randomHex } from '../utils/crypto-helpers.js';
import { aesGcmEncryptHex, aesGcmDecryptHex } from '../crypto/aes-gcm.js';
import { fetchWithRetry } from '../utils/fetch.js';
import { showLoader, showHint, hideHint } from '../utils/dom.js';
import { toast } from '../ui/toast.js';
import { openNewPasswordDialog, openConfirmDialog, openDeletePasswordDialog } from '../ui/dialogs.js';

// Injected tab functions (set via setTabFunctions to avoid circular deps)
let _focusActiveTextarea = () => { };
let _getContentFromTabs = async () => "";
let _setContentOfTabs = async () => { };

/**
 * Injects tab-related functions to avoid circular dependencies
 * @param {Object} funcs - Object containing focusActiveTextarea, getContentFromTabs, setContentOfTabs
 */
export function setTabFunctions(funcs) {
    if (funcs.focusActiveTextarea) _focusActiveTextarea = funcs.focusActiveTextarea;
    if (funcs.getContentFromTabs) _getContentFromTabs = funcs.getContentFromTabs;
    if (funcs.setContentOfTabs) _setContentOfTabs = funcs.setContentOfTabs;
}

/**
 * Client State Class
 * Manages the entire application state
 */
export class ClientState {
    constructor(siteId, urlPassword = null) {
        this.site = siteId;
        this.urlPassword = urlPassword;
        this.currentDBVersion = 2;
        this.expectedDBVersion = 2;

        this.siteHash = null; // SHA512(site)
        this.isTextModified = false;
        this.initHashContent = null;   // hash of initial decrypted content (from server's perspective)
        this.content = ""; // joined tabs
        this.password = ""; // user password
        this.initialIsNew = true;
        this.mobileAppMetadataTabContent = "";

        this.remote = {
            isNew: true,
            eContent: null,             // saltHex:ivHex:cipherHex
            currentHashContent: null    // returned by server to enforce overwrite protection
        };

        // Callbacks for UI updates
        this.onButtonEnablementChange = null;
        this.onStatusChange = null;
        this.onLastSavedUpdate = null;
        this.onFinishInitialization = null;
        this.onDecryptAndFinish = null;
    }

    getIsNew() { return !!this.remote.isNew; }
    getInitialIsNew() { return this.initialIsNew; }
    getIsTextModified() { return this.isTextModified; }
    getContent() { return this.content; }
    getPassword() { return this.password; }
    getMobileAppMetadataTabContent() { return this.mobileAppMetadataTabContent; }
    setMobileAppMetadataTabContent(m) { this.mobileAppMetadataTabContent = m || ""; }

    updateIsTextModified(mod) {
        if (this.isTextModified === mod) return;
        this.isTextModified = mod;
        if (this.onButtonEnablementChange) {
            this.onButtonEnablementChange(this.isTextModified, this.getIsNew());
        }
    }

    async init() {
        this.siteHash = await sha512Hex(this.site);
        await this.reloadFromServer();
        this.initialIsNew = this.getIsNew();
    }

    // Concurrency token (non-crypto) for overwrite detection. AES-GCM ensures confidentiality/integrity.
    computeHashContentForDBVersion(contentForHash, passwordForHash, dbVersion) {
        const weak = simpleWeakHash(`${contentForHash}::${passwordForHash}`);
        return weak + String(dbVersion);
    }

    setInitHashContent() {
        // Initial hash equals the server's currentHashContent once we decrypted content or empty on new
        if (this.remote.currentHashContent) {
            this.initHashContent = this.remote.currentHashContent;
        } else {
            // For new site, compute based on current blank content
            this.initHashContent = this.computeHashContentForDBVersion(this.content, this.password || "", this.currentDBVersion);
        }
    }

    async _getDecryptedContent(pass) {
        if (!this.remote.eContent) return null;
        try {
            const parts = this.remote.eContent.split(":");
            if (parts.length !== 3) return null;
            const [saltHex, ivHex, cipherHex] = parts;
            const plain = await aesGcmDecryptHex(ivHex, cipherHex, pass, saltHex);
            if (plain && plain.endsWith(this.siteHash)) {
                return plain;
            }
            return null;
        } catch {
            return null;
        }
    }

    // Try to decrypt using provided pass; returns true/false
    async setLoginPasswordAndContentIfCorrect(pass) {
        const plain = await this._getDecryptedContent(pass);
        if (plain !== null) {
            this.content = plain.slice(0, plain.length - this.siteHash.length);
            this.password = pass;
            return true;
        }
        return false;
    }

    async saveSite(newPass) {
        const executeSaveSite = async (passwordToUse) => {
            this.content = await _getContentFromTabs(this);

            const newHashContent = this.computeHashContentForDBVersion(this.content, passwordToUse, this.expectedDBVersion);

            // Create new salt every save for portability; embed in ciphertext
            const saltHex = randomHex(16);
            const { ivHex, cipherHex } = await aesGcmEncryptHex(String(this.content + this.siteHash), passwordToUse, saltHex);
            const eContentPayload = `${saltHex}:${ivHex}:${cipherHex}`;

            showLoader(true);
            try {
                const res = await fetchWithRetry("/api/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        site: this.site,
                        initHashContent: this.initHashContent || "",
                        currentHashContent: newHashContent,
                        encryptedContent: eContentPayload
                    })
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const data = await res.json();
                if (data.status === "success") {
                    toast("Saved!", "success", 1500);
                    this.remote.isNew = false;
                    this.remote.eContent = eContentPayload;
                    this.remote.currentHashContent = data.currentHashContent || newHashContent;
                    // Update initHashContent baseline to server-returned value
                    this.initHashContent = this.remote.currentHashContent;
                    this.password = passwordToUse;
                    this.currentDBVersion = this.expectedDBVersion;
                    this.isTextModified = false;
                    if (this.onStatusChange) this.onStatusChange("ready", "Ready");
                    if (this.onLastSavedUpdate) this.onLastSavedUpdate();
                    if (this.onFinishInitialization) this.onFinishInitialization(true);
                } else if (data.message) {
                    if (data.message.includes("modified in the meantime")) {
                        toast("Failed! Content was modified by another session. Use Ctrl+R to reload and see changes, then try saving again.", "error", 5000);
                    } else {
                        toast("Failed! " + data.message, "error", 2500);
                    }
                    _focusActiveTextarea();
                } else {
                    toast("Save failed!", "error", 2500);
                    _focusActiveTextarea();
                }
            } catch (error) {
                console.error('Save operation failed:', error);
                let errorMessage = "Save failed!";

                if (error.name === 'AbortError') {
                    errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(request timeout)</span>";
                } else if (error.message.includes('HTTP')) {
                    errorMessage += ` <br/> <span style='font-size: 0.9em; font-weight: normal'>(${error.message})</span>`;
                } else {
                    errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(connection issue)</span>";
                }

                toast(errorMessage, "error", 2500);
                _focusActiveTextarea();
            } finally {
                showLoader(false);
            }
        };

        if (newPass === true) {
            openNewPasswordDialog({
                title: this.getIsNew() ? "Create password" : "Change password",
                onSave: async (pass1, pass2) => {
                    if (pass1.length === 0) {
                        showHint("#passwords-empty"); hideHint("#passwords-dont-match");
                        return false;
                    }
                    if (pass1 !== pass2) {
                        showHint("#passwords-dont-match"); hideHint("#passwords-empty");
                        return false;
                    }
                    await executeSaveSite(pass1);
                    return true;
                }
            });
        } else {
            await executeSaveSite(this.password);
        }
    }

    async deleteSite() {
        const runDelete = async () => {
            showLoader(true);
            try {
                const res = await fetchWithRetry("/api/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        site: this.site,
                        initHashContent: this.initHashContent || ""
                    })
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const data = await res.json();
                if (data.status === "success") {
                    toast("Site was deleted!", "success", 2000);
                    setTimeout(async () => {
                        this.password = "";
                        this.content = "";
                        this.remote = { isNew: true, eContent: null, currentHashContent: null };
                        await _setContentOfTabs("", this);
                        this.initialIsNew = true;
                        if (this.onFinishInitialization) this.onFinishInitialization();
                    }, 2200);
                } else {
                    toast("Failed! Site was modified in the meantime. Reload first.", "error", 5000);
                }
            } catch (error) {
                console.error('Delete operation failed:', error);
                let errorMessage = "Deleting failed!";

                if (error.name === 'AbortError') {
                    errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(request timeout)</span>";
                } else if (error.message.includes('HTTP')) {
                    errorMessage += ` <br/> <span style='font-size: 0.9em; font-weight: normal'>(${error.message})</span>`;
                } else {
                    errorMessage += " <br/> <span style='font-size: 0.9em; font-weight: normal'>(connection issue)</span>";
                }

                toast(errorMessage, "error", 2500);
                _focusActiveTextarea();
            } finally {
                showLoader(false);
            }
        };

        // First show confirmation dialog
        openConfirmDialog("#dialog-confirm-delete-site", async (ok) => {
            if (ok) {
                // Then require password confirmation
                openDeletePasswordDialog({
                    onOk: async (enteredPassword) => {
                        // For a new, unsaved site, there's no remote content.
                        // The user might have set a password for saving, which is in this.password.
                        if (!this.remote.eContent) {
                            if (enteredPassword === this.password) {
                                await runDelete();
                                return true;
                            }
                            return false;
                        }

                        const isCorrect = (await this._getDecryptedContent(enteredPassword)) !== null;
                        if (isCorrect) {
                            await runDelete();
                            return true;
                        }
                        return false;
                    }
                });
            } else {
                _focusActiveTextarea();
            }
        });
    }

    async reloadFromServer() {
        const url = `/api/json?site=${encodeURIComponent(this.site)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== "success") throw new Error("Server error");
        this.remote.isNew = !!data.isNew;
        this.remote.eContent = data.isNew ? null : data.eContent || null;
        this.currentDBVersion = data.currentDBVersion || 2;
        this.expectedDBVersion = data.expectedDBVersion || 2;
        this.remote.currentHashContent = data.currentHashContent || null;
        // Set initHashContent baseline to server's current
        this.initHashContent = this.remote.currentHashContent || null;
    }

    async reloadSite() {
        const executeReload = async () => {
            showLoader(true);
            try {
                await this.reloadFromServer();
                toast("Reloaded!", "success", 500);
                this.isTextModified = false;
                if (this.onStatusChange) this.onStatusChange("ready", "Ready");

                if (this.remote.isNew || !this.remote.eContent) {
                    this.content = "";
                    // If no site id (root path without /:site and no ?site), do not prompt for password; stay on landing
                    const pathSeg = (window.location.pathname || "/").replace(/^\/+|\/+$/g, "");
                    const hasSiteFromPath = !!(pathSeg && pathSeg !== "api");
                    const hasSiteFromQuery = !!(new URL(window.location.href).searchParams.get("site"));
                    if (!hasSiteFromPath && !hasSiteFromQuery) {
                        await _setContentOfTabs("", this);
                        if (this.onFinishInitialization) this.onFinishInitialization();
                        return;
                    }
                    if (this.onFinishInitialization) this.onFinishInitialization();
                } else {
                    // If URL contains password, try it first
                    if (this.urlPassword) {
                        const ok = await this.setLoginPasswordAndContentIfCorrect(this.urlPassword);
                        if (ok) {
                            if (this.onFinishInitialization) this.onFinishInitialization();
                            return;
                        }
                    }
                    const ok = await this.setLoginPasswordAndContentIfCorrect(this.password);
                    if (!ok) {
                        if (this.onDecryptAndFinish) this.onDecryptAndFinish(false);
                        return;
                    }
                    if (this.onDecryptAndFinish) this.onDecryptAndFinish(true);
                }
            } catch {
                toast("Reloading failed! <br/> <span style='font-size: 0.9em; font-weight: normal'>(connection issue)</span>", "error", 2500);
                _focusActiveTextarea();
            } finally {
                showLoader(false);
            }
        };

        if (this.isTextModified) {
            openConfirmDialog("#dialog-confirm-reload", async (ok) => {
                if (ok) await executeReload();
                else _focusActiveTextarea();
            });
        } else {
            await executeReload();
        }
    }
}
