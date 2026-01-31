/**
 * Storage Sync - Handles server synchronization for user data
 * Uses write-through cache pattern: localStorage for fast reads, server as source of truth
 */
const StorageSync = {
    // Track sync state
    isSyncing: false,
    syncErrors: [],
    initialized: false,
    migrationComplete: false,

    /**
     * Initialize by fetching all data from server and populating localStorage cache
     * Call this once on app startup after authentication is confirmed
     */
    async init() {
        if (this.initialized) return true;

        try {
            this.showSyncIndicator('Syncing...');

            // Fetch all data types in parallel
            const [chats, documents, systemPrompts, agents] = await Promise.all([
                this.fetchFromServer('/api/chats'),
                this.fetchFromServer('/api/documents'),
                this.fetchFromServer('/api/system-prompts'),
                this.fetchFromServer('/api/agents')
            ]);

            // Check if server is empty but localStorage has data (migration needed)
            const serverEmpty = chats.length === 0 && documents.length === 0 &&
                               systemPrompts.length === 0 && agents.length === 0;
            const localData = this.getLocalStorageData();
            const hasLocalData = localData.chats.length > 0 || localData.documents.length > 0 ||
                                localData.systemPrompts.length > 0;

            if (serverEmpty && hasLocalData) {
                this.hideSyncIndicator();
                // Offer migration
                const shouldMigrate = await this.showMigrationPrompt(localData);
                if (shouldMigrate) {
                    await this.performMigration(localData);
                    // Re-fetch from server after migration
                    return this.init();
                }
            }

            // Convert arrays to objects keyed by client_id for localStorage format
            const chatsObj = {};
            chats.forEach(chat => {
                chatsObj[chat.client_id] = {
                    id: chat.client_id,
                    title: chat.title,
                    messages: chat.messages || [],
                    agents: chat.agents || [],
                    turns: chat.turns || 'auto',
                    createdAt: chat.created_at,
                    updated_at: chat.updated_at
                };
            });

            const docsObj = {};
            documents.forEach(doc => {
                docsObj[doc.client_id] = {
                    id: doc.client_id,
                    title: doc.title,
                    content: doc.content || '',
                    driveFileId: doc.driveFileId,
                    createdAt: doc.createdAt,
                    lastModified: doc.lastModified,
                    updated_at: doc.updated_at
                };
            });

            const promptsObj = {};
            systemPrompts.forEach(p => {
                promptsObj[p.client_id] = {
                    id: p.client_id,
                    name: p.name,
                    content: p.content || '',
                    sortOrder: p.sortOrder || 0,
                    createdAt: p.createdAt,
                    updated_at: p.updated_at
                };
            });

            const agentsObj = {};
            agents.forEach(a => {
                agentsObj[a.client_id] = {
                    id: a.client_id,
                    name: a.name,
                    systemPromptId: a.systemPromptId,
                    color: a.color,
                    sortOrder: a.sortOrder || 0,
                    createdAt: a.createdAt,
                    updated_at: a.updated_at
                };
            });

            // Update localStorage cache
            localStorage.setItem('chats', JSON.stringify(chatsObj));
            localStorage.setItem('documents', JSON.stringify(docsObj));
            localStorage.setItem('systemPrompts', JSON.stringify(promptsObj));
            localStorage.setItem('agents', JSON.stringify(agentsObj));

            this.initialized = true;
            this.hideSyncIndicator();
            console.log('StorageSync initialized - data loaded from server');

            // Initialize sync status timestamps from fetched data
            this.initializeSyncStatus(chats, documents, systemPrompts, agents);

            // Start real-time polling for cross-device sync
            this.startPolling();

            return true;

        } catch (error) {
            console.error('StorageSync init failed:', error);
            this.hideSyncIndicator();
            // Don't set initialized = true on failure
            // This prevents stale localStorage data from being saved to server
            // StorageSync methods check initialized before syncing
            this.initFailed = true;
            return false;
        }
    },

    // ========== Migration Methods ==========

    /**
     * Get existing data from localStorage for migration check
     */
    getLocalStorageData() {
        const parseJSON = (key) => {
            try {
                return JSON.parse(localStorage.getItem(key) || '{}');
            } catch {
                return {};
            }
        };

        const chats = Object.values(parseJSON('chats'));
        const documents = Object.values(parseJSON('documents'));
        const systemPrompts = Object.values(parseJSON('systemPrompts'));

        return { chats, documents, systemPrompts };
    },

    /**
     * Show migration prompt to user
     * Returns true if user wants to migrate, false to skip
     */
    showMigrationPrompt(localData) {
        return new Promise((resolve) => {
            const chatCount = localData.chats.length;
            const docCount = localData.documents.length;
            const promptCount = localData.systemPrompts.length;

            const itemList = [];
            if (chatCount > 0) itemList.push(`${chatCount} chat${chatCount > 1 ? 's' : ''}`);
            if (docCount > 0) itemList.push(`${docCount} document${docCount > 1 ? 's' : ''}`);
            if (promptCount > 0) itemList.push(`${promptCount} system prompt${promptCount > 1 ? 's' : ''}`);

            // Create modal
            const modal = document.createElement('div');
            modal.id = 'migration-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10002;
            `;

            modal.innerHTML = `
                <div style="
                    background: var(--bg-primary, white);
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 420px;
                    width: 90%;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                ">
                    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: var(--text-primary, #333);">
                        Import Local Data?
                    </h2>
                    <p style="margin: 0 0 16px 0; color: var(--text-secondary, #666); font-size: 14px; line-height: 1.5;">
                        Found existing data on this device: <strong>${itemList.join(', ')}</strong>.
                    </p>
                    <p style="margin: 0 0 20px 0; color: var(--text-secondary, #666); font-size: 14px; line-height: 1.5;">
                        Would you like to import this data to your cloud account? You'll be able to access it from any device.
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button id="migration-skip" style="
                            padding: 10px 20px;
                            border: 1px solid var(--border-color, #ddd);
                            background: transparent;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            color: var(--text-secondary, #666);
                        ">Skip</button>
                        <button id="migration-import" style="
                            padding: 10px 20px;
                            border: none;
                            background: var(--primary-color, #007bff);
                            color: white;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        ">Import Data</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            document.getElementById('migration-skip').onclick = () => {
                modal.remove();
                resolve(false);
            };

            document.getElementById('migration-import').onclick = () => {
                modal.remove();
                resolve(true);
            };
        });
    },

    /**
     * Perform migration - upload all localStorage data to server
     */
    async performMigration(localData) {
        try {
            this.showSyncIndicator('Importing data...');
            console.log('Starting migration...', localData);

            let successCount = 0;
            let errorCount = 0;

            // Migrate system prompts first (agents may reference them)
            for (const prompt of localData.systemPrompts) {
                try {
                    await this.saveToServer('/api/system-prompts', 'POST', {
                        client_id: prompt.id,
                        id: prompt.id,
                        name: prompt.name,
                        content: prompt.content || '',
                        sortOrder: prompt.sortOrder || prompt.order || 0,
                        createdAt: prompt.createdAt || Date.now()
                    });
                    successCount++;
                } catch (error) {
                    console.error('Failed to migrate system prompt:', prompt.id, error);
                    errorCount++;
                }
            }

            // Migrate documents
            for (const doc of localData.documents) {
                try {
                    await this.saveToServer('/api/documents', 'POST', {
                        client_id: doc.id,
                        id: doc.id,
                        title: doc.title,
                        content: doc.content || '',
                        driveFileId: doc.driveFileId,
                        createdAt: doc.createdAt || Date.now(),
                        lastModified: doc.lastModified || Date.now()
                    });
                    successCount++;
                } catch (error) {
                    console.error('Failed to migrate document:', doc.id, error);
                    errorCount++;
                }
            }

            // Migrate chats
            for (const chat of localData.chats) {
                try {
                    await this.saveToServer('/api/chats', 'POST', {
                        client_id: chat.id,
                        id: chat.id,
                        title: chat.title,
                        messages: chat.messages || [],
                        agents: chat.agents || [],
                        turns: chat.turns || 'auto',
                        created_at: chat.createdAt || Date.now()
                    });
                    successCount++;
                } catch (error) {
                    console.error('Failed to migrate chat:', chat.id, error);
                    errorCount++;
                }
            }

            this.hideSyncIndicator();

            if (errorCount === 0) {
                // Success - clear localStorage (except API keys and settings)
                this.clearMigratedData();
                this.migrationComplete = true;
                this.showMigrationSuccess(successCount);
                console.log(`Migration complete: ${successCount} items imported`);
            } else {
                // Partial failure - keep localStorage, show warning
                this.showMigrationPartialError(successCount, errorCount);
                console.warn(`Migration partial: ${successCount} succeeded, ${errorCount} failed`);
            }

            return errorCount === 0;

        } catch (error) {
            console.error('Migration failed:', error);
            this.hideSyncIndicator();
            this.showMigrationError();
            return false;
        }
    },

    /**
     * Clear migrated data from localStorage (keep API keys and settings)
     */
    clearMigratedData() {
        // Only clear data that was migrated
        localStorage.removeItem('chats');
        localStorage.removeItem('documents');
        localStorage.removeItem('systemPrompts');
        localStorage.removeItem('agents');
        localStorage.removeItem('claudeChanges');
        localStorage.removeItem('lastOpenDocumentId');
        localStorage.removeItem('activeSystemPromptId');
        // Keep: anthropicApiKey, appSettings, googleDriveConnected
        console.log('Migrated data cleared from localStorage');
    },

    /**
     * Show migration success notification
     */
    showMigrationSuccess(count) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #059669;
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = `Successfully imported ${count} items to your cloud account!`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    },

    /**
     * Show migration partial error
     */
    showMigrationPartialError(success, failed) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #f59e0b;
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10001;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        notification.textContent = `Imported ${success} items. ${failed} items failed and remain in local storage.`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 7000);
    },

    /**
     * Show migration error
     */
    showMigrationError() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10001;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        notification.textContent = 'Import failed. Your local data is preserved. Please try again later.';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 7000);
    },

    /**
     * Generic fetch from server
     */
    async fetchFromServer(endpoint) {
        const response = await fetch(endpoint);
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Not authenticated');
            }
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    },

    /**
     * Generic save to server
     */
    async saveToServer(endpoint, method, data) {
        const response = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `Server error: ${response.status}`);
        }

        return response.json();
    },

    /**
     * Delete from server
     */
    async deleteFromServer(endpoint) {
        const response = await fetch(endpoint, { method: 'DELETE' });
        if (!response.ok && response.status !== 404) {
            throw new Error(`Delete failed: ${response.status}`);
        }
        return true;
    },

    // ========== Chat Sync ==========

    async saveChat(chatId, chatData) {
        try {
            // Check if chat exists on server
            const exists = await this.chatExists(chatId);

            const payload = {
                client_id: chatId,
                id: chatId,
                title: chatData.title,
                messages: chatData.messages || [],
                agents: chatData.agents || [],
                turns: chatData.turns || 'auto',
                created_at: chatData.createdAt || Date.now()
            };

            let result;
            if (exists) {
                result = await this.saveToServer(`/api/chats/${chatId}`, 'PUT', payload);
            } else {
                result = await this.saveToServer('/api/chats', 'POST', payload);
            }

            // Update local sync status with server's updated_at
            if (result && result.updated_at) {
                this.updateLocalSyncStatus('chats', result.updated_at);
            }

            return true;
        } catch (error) {
            console.error('Failed to sync chat:', error);
            this.handleSyncError('chat', chatId, error);
            return false;
        }
    },

    async chatExists(chatId) {
        try {
            const response = await fetch(`/api/chats/${chatId}`);
            return response.ok;
        } catch {
            return false;
        }
    },

    async deleteChat(chatId) {
        try {
            await this.deleteFromServer(`/api/chats/${chatId}`);
            return true;
        } catch (error) {
            console.error('Failed to delete chat from server:', error);
            return false;
        }
    },

    // ========== Document Sync ==========

    async saveDocument(docId, docData) {
        try {
            const exists = await this.documentExists(docId);

            const payload = {
                client_id: docId,
                id: docId,
                title: docData.title,
                content: docData.content || '',
                driveFileId: docData.driveFileId,
                createdAt: docData.createdAt || Date.now(),
                lastModified: docData.lastModified || Date.now()
            };

            let result;
            if (exists) {
                result = await this.saveToServer(`/api/documents/${docId}`, 'PUT', payload);
            } else {
                result = await this.saveToServer('/api/documents', 'POST', payload);
            }

            // Update local sync status with server's updated_at
            if (result && result.updated_at) {
                this.updateLocalSyncStatus('documents', result.updated_at);
            }

            return true;
        } catch (error) {
            console.error('Failed to sync document:', error);
            this.handleSyncError('document', docId, error);
            return false;
        }
    },

    async documentExists(docId) {
        try {
            const response = await fetch(`/api/documents/${docId}`);
            return response.ok;
        } catch {
            return false;
        }
    },

    async deleteDocument(docId) {
        try {
            await this.deleteFromServer(`/api/documents/${docId}`);
            return true;
        } catch (error) {
            console.error('Failed to delete document from server:', error);
            return false;
        }
    },

    // ========== System Prompt Sync ==========

    async saveSystemPrompt(promptId, promptData) {
        try {
            const exists = await this.systemPromptExists(promptId);

            const payload = {
                client_id: promptId,
                id: promptId,
                name: promptData.name,
                content: promptData.content || '',
                sortOrder: promptData.sortOrder || 0,
                createdAt: promptData.createdAt || Date.now()
            };

            let result;
            if (exists) {
                result = await this.saveToServer(`/api/system-prompts/${promptId}`, 'PUT', payload);
            } else {
                result = await this.saveToServer('/api/system-prompts', 'POST', payload);
            }

            // Update local sync status with server's updated_at
            if (result && result.updated_at) {
                this.updateLocalSyncStatus('systemPrompts', result.updated_at);
            }

            return true;
        } catch (error) {
            console.error('Failed to sync system prompt:', error);
            this.handleSyncError('systemPrompt', promptId, error);
            return false;
        }
    },

    async systemPromptExists(promptId) {
        try {
            const response = await fetch(`/api/system-prompts/${promptId}`);
            return response.ok;
        } catch {
            return false;
        }
    },

    async deleteSystemPrompt(promptId) {
        try {
            await this.deleteFromServer(`/api/system-prompts/${promptId}`);
            return true;
        } catch (error) {
            console.error('Failed to delete system prompt from server:', error);
            return false;
        }
    },

    // ========== Agent Sync ==========

    async saveAgent(agentId, agentData) {
        try {
            const exists = await this.agentExists(agentId);

            const payload = {
                client_id: agentId,
                id: agentId,
                name: agentData.name,
                systemPromptId: agentData.systemPromptId,
                color: agentData.color,
                sortOrder: agentData.sortOrder || 0,
                createdAt: agentData.createdAt || Date.now()
            };

            let result;
            if (exists) {
                result = await this.saveToServer(`/api/agents/${agentId}`, 'PUT', payload);
            } else {
                result = await this.saveToServer('/api/agents', 'POST', payload);
            }

            // Update local sync status with server's updated_at
            if (result && result.updated_at) {
                this.updateLocalSyncStatus('agents', result.updated_at);
            }

            return true;
        } catch (error) {
            console.error('Failed to sync agent:', error);
            this.handleSyncError('agent', agentId, error);
            return false;
        }
    },

    async agentExists(agentId) {
        try {
            const response = await fetch(`/api/agents/${agentId}`);
            return response.ok;
        } catch {
            return false;
        }
    },

    async deleteAgent(agentId) {
        try {
            await this.deleteFromServer(`/api/agents/${agentId}`);
            return true;
        } catch (error) {
            console.error('Failed to delete agent from server:', error);
            return false;
        }
    },

    // ========== UI Feedback ==========

    showSyncIndicator(message = 'Syncing...') {
        // Add a subtle sync indicator to the UI
        let indicator = document.getElementById('sync-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'sync-indicator';
            indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--primary-color, #007bff);
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            `;
            document.body.appendChild(indicator);
        }
        indicator.innerHTML = `<span class="sync-spinner">↻</span> ${message}`;
        indicator.style.display = 'flex';
    },

    hideSyncIndicator() {
        const indicator = document.getElementById('sync-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    },

    handleSyncError(type, id, error) {
        console.error(`Sync error for ${type} ${id}:`, error);

        // Show user-visible error
        this.showSyncError(`Failed to sync ${type}. Changes saved locally.`);

        // Track for potential retry
        this.syncErrors.push({ type, id, error: error.message, timestamp: Date.now() });
    },

    showSyncError(message) {
        let errorEl = document.getElementById('sync-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'sync-error';
            errorEl.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #dc3545;
                color: white;
                padding: 12px 16px;
                border-radius: 4px;
                font-size: 13px;
                z-index: 10001;
                max-width: 300px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                cursor: pointer;
            `;
            errorEl.onclick = () => errorEl.style.display = 'none';
            document.body.appendChild(errorEl);
        }
        errorEl.textContent = message;
        errorEl.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorEl) errorEl.style.display = 'none';
        }, 5000);
    },

    /**
     * Retry failed syncs
     */
    async retryFailedSyncs() {
        if (this.syncErrors.length === 0) return;

        const errors = [...this.syncErrors];
        this.syncErrors = [];

        for (const err of errors) {
            // Re-read from localStorage and try to sync again
            if (err.type === 'chat') {
                const chats = Storage.getChats();
                if (chats[err.id]) {
                    await this.saveChat(err.id, chats[err.id]);
                }
            } else if (err.type === 'document') {
                const docs = Storage.getDocuments();
                if (docs[err.id]) {
                    await this.saveDocument(err.id, docs[err.id]);
                }
            } else if (err.type === 'systemPrompt') {
                const prompts = Storage.getSystemPrompts();
                if (prompts[err.id]) {
                    await this.saveSystemPrompt(err.id, prompts[err.id]);
                }
            } else if (err.type === 'agent') {
                const agents = JSON.parse(localStorage.getItem('agents') || '{}');
                if (agents[err.id]) {
                    await this.saveAgent(err.id, agents[err.id]);
                }
            }
        }
    },

    // ========== Real-Time Polling ==========

    pollingInterval: null,
    lastSyncStatus: null,
    POLL_INTERVAL_MS: 5000, // 5 seconds

    /**
     * Initialize sync status timestamps from fetched data
     */
    initializeSyncStatus(chats, documents, systemPrompts, agents) {
        const getMaxTimestamp = (items) => {
            let max = 0;
            for (const item of items) {
                if (item.updated_at && item.updated_at > max) {
                    max = item.updated_at;
                }
            }
            return max;
        };

        const status = {
            chats: getMaxTimestamp(chats),
            documents: getMaxTimestamp(documents),
            systemPrompts: getMaxTimestamp(systemPrompts),
            agents: getMaxTimestamp(agents)
        };

        localStorage.setItem('syncStatus', JSON.stringify(status));
        console.log('StorageSync: Initialized sync status timestamps');
    },

    /**
     * Start polling for updates from other devices
     */
    startPolling() {
        if (this.pollingInterval) return; // Already polling

        console.log('StorageSync: Starting real-time polling');

        // Listen for visibility changes
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

        // Start polling if tab is visible
        if (!document.hidden) {
            this.pollingInterval = setInterval(() => this.checkForUpdates(), this.POLL_INTERVAL_MS);
        }
    },

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        console.log('StorageSync: Stopped polling');
    },

    /**
     * Handle tab visibility changes - pause/resume polling
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Tab hidden - stop polling to save resources
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
                console.log('StorageSync: Paused polling (tab hidden)');
            }
        } else {
            // Tab visible - resume polling and check immediately
            if (!this.pollingInterval) {
                this.checkForUpdates(); // Check immediately when tab becomes visible
                this.pollingInterval = setInterval(() => this.checkForUpdates(), this.POLL_INTERVAL_MS);
                console.log('StorageSync: Resumed polling (tab visible)');
            }
        }
    },

    /**
     * Check server for updates and sync if newer
     */
    async checkForUpdates() {
        if (!this.initialized || this.isSyncing) return;

        try {
            const serverStatus = await this.fetchFromServer('/api/sync-status');

            // Compare with local timestamps stored in localStorage
            const localStatus = this.getLocalSyncStatus();

            let hasUpdates = false;
            const typesToRefresh = [];

            // Check each data type
            if (serverStatus.chats > localStatus.chats) {
                typesToRefresh.push('chats');
                hasUpdates = true;
            }
            if (serverStatus.documents > localStatus.documents) {
                typesToRefresh.push('documents');
                hasUpdates = true;
            }
            if (serverStatus.systemPrompts > localStatus.systemPrompts) {
                typesToRefresh.push('systemPrompts');
                hasUpdates = true;
            }
            if (serverStatus.agents > localStatus.agents) {
                typesToRefresh.push('agents');
                hasUpdates = true;
            }

            if (hasUpdates) {
                console.log('StorageSync: Detected updates from other device:', typesToRefresh);
                await this.refreshFromServer(typesToRefresh);
            }

        } catch (error) {
            // Silent fail - don't spam console on network errors
            // Will retry on next poll interval
        }
    },

    /**
     * Get local sync timestamps from localStorage
     */
    getLocalSyncStatus() {
        try {
            const status = JSON.parse(localStorage.getItem('syncStatus') || '{}');
            return {
                chats: status.chats || 0,
                documents: status.documents || 0,
                systemPrompts: status.systemPrompts || 0,
                agents: status.agents || 0
            };
        } catch {
            return { chats: 0, documents: 0, systemPrompts: 0, agents: 0 };
        }
    },

    /**
     * Update local sync timestamps
     */
    updateLocalSyncStatus(type, timestamp) {
        try {
            const status = this.getLocalSyncStatus();
            status[type] = timestamp;
            localStorage.setItem('syncStatus', JSON.stringify(status));
        } catch (error) {
            console.warn('Failed to update sync status:', error);
        }
    },

    /**
     * Refresh specific data types from server and update UI
     */
    async refreshFromServer(types) {
        this.isSyncing = true;

        try {
            for (const type of types) {
                if (type === 'chats') {
                    const chats = await this.fetchFromServer('/api/chats');
                    const chatsObj = {};
                    let maxTimestamp = 0;
                    chats.forEach(chat => {
                        chatsObj[chat.client_id] = {
                            id: chat.client_id,
                            title: chat.title,
                            messages: chat.messages || [],
                            agents: chat.agents || [],
                            turns: chat.turns || 'auto',
                            createdAt: chat.created_at,
                            updated_at: chat.updated_at
                        };
                        if (chat.updated_at > maxTimestamp) maxTimestamp = chat.updated_at;
                    });
                    localStorage.setItem('chats', JSON.stringify(chatsObj));
                    this.updateLocalSyncStatus('chats', maxTimestamp);

                    // Refresh UI
                    if (typeof Chat !== 'undefined' && Chat.renderChatList) {
                        Chat.renderChatList();
                        // Reload current chat if it was updated
                        if (Chat.currentChatId && chatsObj[Chat.currentChatId]) {
                            Chat.loadChat(Chat.currentChatId);
                        }
                    }
                }

                if (type === 'documents') {
                    const documents = await this.fetchFromServer('/api/documents');
                    const docsObj = {};
                    let maxTimestamp = 0;
                    documents.forEach(doc => {
                        docsObj[doc.client_id] = {
                            id: doc.client_id,
                            title: doc.title,
                            content: doc.content || '',
                            driveFileId: doc.driveFileId,
                            createdAt: doc.createdAt,
                            lastModified: doc.lastModified,
                            updated_at: doc.updated_at
                        };
                        if (doc.updated_at > maxTimestamp) maxTimestamp = doc.updated_at;
                    });
                    localStorage.setItem('documents', JSON.stringify(docsObj));
                    this.updateLocalSyncStatus('documents', maxTimestamp);

                    // Refresh UI
                    if (typeof Documents !== 'undefined' && Documents.renderDocumentList) {
                        Documents.renderDocumentList();
                        // Reload current document if it was updated
                        if (Documents.currentDocumentId && docsObj[Documents.currentDocumentId]) {
                            Documents.openDocument(Documents.currentDocumentId);
                        }
                    }
                }

                if (type === 'systemPrompts') {
                    const prompts = await this.fetchFromServer('/api/system-prompts');
                    const promptsObj = {};
                    let maxTimestamp = 0;
                    prompts.forEach(p => {
                        promptsObj[p.client_id] = {
                            id: p.client_id,
                            name: p.name,
                            content: p.content || '',
                            sortOrder: p.sortOrder || 0,
                            createdAt: p.createdAt,
                            updated_at: p.updated_at
                        };
                        if (p.updated_at > maxTimestamp) maxTimestamp = p.updated_at;
                    });
                    localStorage.setItem('systemPrompts', JSON.stringify(promptsObj));
                    this.updateLocalSyncStatus('systemPrompts', maxTimestamp);

                    // Refresh UI
                    if (typeof SystemPrompts !== 'undefined') {
                        SystemPrompts.refresh();
                    }
                }

                if (type === 'agents') {
                    const agents = await this.fetchFromServer('/api/agents');
                    const agentsObj = {};
                    let maxTimestamp = 0;
                    agents.forEach(a => {
                        agentsObj[a.client_id] = {
                            id: a.client_id,
                            name: a.name,
                            systemPromptId: a.systemPromptId,
                            color: a.color,
                            sortOrder: a.sortOrder || 0,
                            createdAt: a.createdAt,
                            updated_at: a.updated_at
                        };
                        if (a.updated_at > maxTimestamp) maxTimestamp = a.updated_at;
                    });
                    localStorage.setItem('agents', JSON.stringify(agentsObj));
                    this.updateLocalSyncStatus('agents', maxTimestamp);

                    // Refresh UI - Agents are per-chat so just update UI if needed
                    if (typeof Agents !== 'undefined' && Agents.updateAgentSelectorUI) {
                        Agents.updateAgentSelectorUI();
                    }
                }
            }

            console.log('StorageSync: Refreshed data from server:', types);

        } catch (error) {
            console.error('StorageSync: Failed to refresh from server:', error);
        } finally {
            this.isSyncing = false;
        }
    }
};
