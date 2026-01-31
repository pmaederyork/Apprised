/**
 * Storage Sync - Handles server synchronization for user data
 * Uses write-through cache pattern: localStorage for fast reads, server as source of truth
 */
const StorageSync = {
    // Track sync state
    isSyncing: false,
    syncErrors: [],
    initialized: false,

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

            // Convert arrays to objects keyed by client_id for localStorage format
            const chatsObj = {};
            chats.forEach(chat => {
                chatsObj[chat.client_id] = {
                    id: chat.client_id,
                    title: chat.title,
                    messages: chat.messages || [],
                    agents: chat.agents || [],
                    turns: chat.turns || 'auto',
                    createdAt: chat.created_at
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
                    lastModified: doc.lastModified
                };
            });

            const promptsObj = {};
            systemPrompts.forEach(p => {
                promptsObj[p.client_id] = {
                    id: p.client_id,
                    name: p.name,
                    content: p.content || '',
                    sortOrder: p.sortOrder || 0,
                    createdAt: p.createdAt
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
                    createdAt: a.createdAt
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
            return true;

        } catch (error) {
            console.error('StorageSync init failed:', error);
            this.hideSyncIndicator();
            // Don't block app - use localStorage data if available
            this.initialized = true;
            return false;
        }
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

            if (exists) {
                await this.saveToServer(`/api/chats/${chatId}`, 'PUT', payload);
            } else {
                await this.saveToServer('/api/chats', 'POST', payload);
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

            if (exists) {
                await this.saveToServer(`/api/documents/${docId}`, 'PUT', payload);
            } else {
                await this.saveToServer('/api/documents', 'POST', payload);
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

            if (exists) {
                await this.saveToServer(`/api/system-prompts/${promptId}`, 'PUT', payload);
            } else {
                await this.saveToServer('/api/system-prompts', 'POST', payload);
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

            if (exists) {
                await this.saveToServer(`/api/agents/${agentId}`, 'PUT', payload);
            } else {
                await this.saveToServer('/api/agents', 'POST', payload);
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
    }
};
