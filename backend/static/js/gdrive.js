/**
 * Google Drive Integration Module
 * Handles saving documents to and importing from Google Drive
 */
const GDrive = {
    // State management
    isConnected: false,
    initialized: false,
    pickerApiLoaded: false,

    /**
     * Remove meta tags from Google Drive HTML
     * Preserves all content and inline styles
     */
    stripMetaTags(html) {
        if (!html) return '';
        // Remove all <meta> tags
        return html.replace(/<meta[^>]*>/gi, '');
    },

    // Initialize Google Drive integration
    async init() {
        if (this.initialized) return;

        // Check connection status from backend
        await this.checkConnectionStatus();

        // Load Google Picker API for file selection
        this.loadPickerAPI();

        this.initialized = true;
        console.log('GDrive module initialized');
    },

    // Check if user has granted Drive access
    async checkConnectionStatus() {
        try {
            const response = await fetch('/drive/status');
            const data = await response.json();

            if (data.success) {
                this.isConnected = data.connected;
                Storage.saveGoogleDriveConnected(data.connected);
                this.updateUI();
            }
        } catch (error) {
            console.error('Failed to check Drive status:', error);
            this.isConnected = false;
        }
    },

    // Reconnect - triggers re-auth with Drive scope
    async reconnect() {
        // User needs to re-authenticate to grant Drive permission
        if (confirm('To enable Google Drive access, you need to reconnect your account. You will be logged out and redirected to Google. Continue?')) {
            // Trigger logout and re-login to get new scope
            window.location.href = '/auth/logout';
        }
    },

    // Save document to Google Drive (via backend)
    async saveToGoogleDrive(documentId) {
        if (!this.isConnected) {
            const proceed = confirm('Google Drive is not connected. Would you like to enable Drive access now?');
            if (proceed) {
                this.reconnect();
            }
            return { success: false };
        }

        const doc = Documents.documents[documentId];
        if (!doc) return { success: false, error: 'Document not found' };

        try {
            // Update UI to show syncing
            this.updateSyncIndicator(documentId, 'syncing');

            const response = await fetch('/drive/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: doc.title,
                    content: doc.content,
                    driveFileId: doc.driveFileId || null
                })
            });

            const data = await response.json();

            if (data.success) {
                // Update document with Drive metadata
                doc.driveFileId = data.fileId;
                doc.driveSyncStatus = 'synced';
                doc.lastSyncedAt = Date.now();
                Storage.saveDocuments(Documents.documents);

                this.updateSyncIndicator(documentId, 'synced');
                Documents.renderDocumentList();

                // Update Drive icon visibility
                if (typeof Documents !== 'undefined' && Documents.updateDriveIconVisibility) {
                    Documents.updateDriveIconVisibility();
                }

                return { success: true };
            } else {
                doc.driveSyncStatus = 'error';
                this.updateSyncIndicator(documentId, 'error');
                alert(`Failed to save to Drive: ${data.error}`);
                return { success: false, error: data.error };
            }

        } catch (error) {
            console.error('Drive save error:', error);
            doc.driveSyncStatus = 'error';
            this.updateSyncIndicator(documentId, 'error');
            alert('Failed to save to Google Drive. Please try again.');
            return { success: false, error: error.message };
        }
    },

    // Pull latest version from Google Drive (for sync button)
    async pullFromDrive(documentId) {
        if (!this.isConnected) {
            alert('Google Drive is not connected. Please enable Drive access in Settings.');
            return { success: false };
        }

        const doc = Documents.documents[documentId];
        if (!doc) return { success: false, error: 'Document not found' };

        if (!doc.driveFileId) {
            alert('This document is not linked to Google Drive. Save it to Drive first.');
            return { success: false };
        }

        try {
            // Update UI to show syncing
            this.updateSyncIndicator(documentId, 'syncing', 'sync');

            // Fetch latest version from Drive via backend
            const response = await fetch(`/drive/import/${doc.driveFileId}`);
            const data = await response.json();

            if (data.success) {
                // Update document with latest content from Drive
                doc.content = this.stripMetaTags(data.content);
                doc.lastModified = Date.now();
                doc.driveSyncStatus = 'synced';
                doc.lastSyncedAt = Date.now();

                Storage.saveDocuments(Documents.documents);

                // Refresh UI if this document is currently open
                if (Documents.currentDocumentId === documentId) {
                    Documents.openDocument(documentId);
                }

                this.updateSyncIndicator(documentId, 'synced', 'sync');
                Documents.renderDocumentList();

                return { success: true };
            } else {
                doc.driveSyncStatus = 'error';
                this.updateSyncIndicator(documentId, 'error', 'sync');
                alert(`Failed to sync from Drive: ${data.error}`);
                return { success: false, error: data.error };
            }

        } catch (error) {
            console.error('Drive sync error:', error);
            doc.driveSyncStatus = 'error';
            this.updateSyncIndicator(documentId, 'error', 'sync');
            alert('Failed to sync from Google Drive. Please try again.');
            return { success: false, error: error.message };
        }
    },

    // Import from Google Drive using Picker
    async importFromGoogleDrive() {
        if (!this.isConnected) {
            const proceed = confirm('Google Drive is not connected. Would you like to enable Drive access now?');
            if (proceed) {
                this.reconnect();
            }
            return;
        }

        if (!this.pickerApiLoaded) {
            alert('Google Picker is still loading. Please try again in a moment.');
            return;
        }

        try {
            // Get OAuth token from backend for Picker
            const tokenResponse = await fetch('/drive/picker-token');
            const tokenData = await tokenResponse.json();

            if (!tokenData.success) {
                alert('Failed to get Drive access. Please try reconnecting.');
                return;
            }

            // Show Google Picker
            const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.DOCS)
                .setOAuthToken(tokenData.accessToken)
                .setCallback(async (data) => {
                    if (data.action === google.picker.Action.PICKED) {
                        await this.handlePickerSelection(data.docs[0]);
                    }
                })
                .build();

            picker.setVisible(true);

        } catch (error) {
            console.error('Picker error:', error);
            alert('Failed to open file picker. Please try again.');
        }
    },

    // Handle file selection from Picker
    async handlePickerSelection(file) {
        try {
            // Show loading indicator
            UI.showLoading();

            // Import via backend
            const response = await fetch(`/drive/import/${file.id}`);
            const data = await response.json();

            UI.hideLoading();

            if (data.success) {
                // Log raw HTML from Google Drive for debugging
                console.log('=== GOOGLE DRIVE IMPORT: Raw HTML ===');
                console.log(data.content);
                console.log('\n=== GOOGLE DRIVE IMPORT: After stripMetaTags() ===');
                console.log(this.stripMetaTags(data.content));
                console.log('\n=== GOOGLE DRIVE IMPORT: Document Name ===');
                console.log(data.name);

                // Check if document with this driveFileId already exists
                const existingDoc = Object.values(Documents.documents)
                    .find(doc => doc.driveFileId === file.id);

                if (existingDoc) {
                    // Update existing document
                    existingDoc.title = data.name.endsWith('.html') ? data.name : data.name + '.html';
                    existingDoc.content = this.stripMetaTags(data.content);
                    existingDoc.lastModified = Date.now();
                    existingDoc.driveSyncStatus = 'synced';
                    existingDoc.lastSyncedAt = Date.now();

                    Storage.saveDocuments(Documents.documents);
                    Documents.renderDocumentList();
                    Documents.openDocument(existingDoc.id);

                    console.log('Updated existing document linked to Drive file:', file.id);
                } else {
                    // Create new document
                    const documentId = Storage.generateDocumentId();
                    const newDoc = {
                        id: documentId,
                        title: data.name.endsWith('.html') ? data.name : data.name + '.html',
                        content: this.stripMetaTags(data.content),
                        createdAt: Date.now(),
                        lastModified: Date.now(),
                        driveFileId: file.id,
                        driveSyncStatus: 'synced',
                        lastSyncedAt: Date.now()
                    };

                    Documents.documents[documentId] = newDoc;
                    Storage.saveDocuments(Documents.documents);
                    Documents.renderDocumentList();
                    Documents.openDocument(documentId);

                    console.log('Created new document from Drive file:', file.id);
                }

            } else {
                alert(`Failed to import: ${data.error}`);
            }

        } catch (error) {
            UI.hideLoading();
            console.error('Import error:', error);
            alert('Failed to import document. Please try again.');
        }
    },

    // Load Google Picker API
    loadPickerAPI() {
        if (window.google && window.google.picker) {
            this.pickerApiLoaded = true;
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
            gapi.load('picker', () => {
                this.pickerApiLoaded = true;
                console.log('Google Picker API loaded');
            });
        };
        document.head.appendChild(script);
    },

    // Update sync indicator in toolbar
    updateSyncIndicator(documentId, status, operation = 'save') {
        const indicator = UI.elements.driveSyncIndicator;
        if (!indicator) return;

        // Only show indicator for currently open document
        if (Documents.currentDocumentId !== documentId) return;

        indicator.style.display = 'inline-flex';
        indicator.className = `drive-sync-indicator ${status}`;

        const messages = {
            save: {
                'syncing': '☁️ Saving to Drive...',
                'synced': '✓ Saved to Drive',
                'error': '⚠️ Save failed'
            },
            sync: {
                'syncing': '🔄 Syncing from Drive...',
                'synced': '✓ Synced from Drive',
                'error': '⚠️ Sync failed'
            }
        };

        indicator.textContent = messages[operation]?.[status] || '';

        // Hide success message after 3 seconds
        if (status === 'synced') {
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 3000);
        }
    },

    // Update UI based on connection status
    updateUI() {
        // Update Settings modal status
        const statusText = UI.elements.gdriveStatusText;
        const statusIcon = UI.elements.gdriveStatusIcon;
        const connectBtn = UI.elements.gdriveConnectBtn;
        const saveToDriveBtn = UI.elements.saveToDriveBtn;
        const importFromDriveBtn = UI.elements.importFromDriveBtn;

        if (this.isConnected) {
            if (statusText) statusText.textContent = 'Connected';
            if (statusIcon) statusIcon.textContent = '✓';
            if (connectBtn) connectBtn.textContent = 'Reconnect Drive Access';
            if (saveToDriveBtn) saveToDriveBtn.disabled = false;
            if (importFromDriveBtn) importFromDriveBtn.disabled = false;
        } else {
            if (statusText) statusText.textContent = 'Not connected';
            if (statusIcon) statusIcon.textContent = '☁️';
            if (connectBtn) connectBtn.textContent = 'Enable Drive Access';
            if (saveToDriveBtn) saveToDriveBtn.disabled = true;
            if (importFromDriveBtn) importFromDriveBtn.disabled = true;
        }
    }
};
