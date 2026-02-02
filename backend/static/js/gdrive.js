/**
 * Google Drive Integration Module
 * Handles saving documents to and importing from Google Drive
 */
const GDrive = {
    // State management
    isConnected: false,
    initialized: false,
    pickerApiLoaded: false,
    pickerLoadFailed: false,

    /**
     * Detect if running on mobile or as PWA (installed app)
     * Used to disable problematic Picker features that don't work in these contexts
     */
    isMobileOrPWA() {
        // Check for PWA (standalone mode)
        const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone === true;

        // Check for mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         (window.innerWidth <= 768);

        return isPWA || isMobile;
    },

    /**
     * Debug helper - shows messages on screen for mobile debugging
     */
    debugLog(msg) {
        console.log('GDrive:', msg);
        // Show on-screen debug for mobile
        let debugEl = document.getElementById('gdrive-debug');
        if (!debugEl) {
            debugEl = document.createElement('div');
            debugEl.id = 'gdrive-debug';
            debugEl.style.cssText = 'position:fixed;bottom:60px;left:10px;right:10px;background:rgba(0,0,0,0.8);color:#0f0;font-family:monospace;font-size:11px;padding:8px;border-radius:4px;max-height:150px;overflow-y:auto;z-index:99999;white-space:pre-wrap;';
            document.body.appendChild(debugEl);
        }
        debugEl.textContent += new Date().toLocaleTimeString() + ': ' + msg + '\n';
        debugEl.scrollTop = debugEl.scrollHeight;
        // Auto-hide after 30 seconds
        clearTimeout(this._debugTimeout);
        this._debugTimeout = setTimeout(() => {
            if (debugEl) debugEl.remove();
        }, 30000);
    },

    /**
     * Process Google Docs HTML for proper display
     * Fixes UTF-8 encoding issues, converts heading styles to semantic HTML,
     * and cleans up Google Docs-specific markup
     */
    processGoogleDocsHTML(html) {
        if (!html) return '';

        try {
            // 1. Fix UTF-8 encoding issues (mojibake patterns from Google Drive API)
            html = html
                .replace(/â€¢/g, '•')  // Bullet point
                .replace(/â€"/g, '—')  // Em dash
                .replace(/â€"/g, '–')  // En dash
                .replace(/â€˜/g, '\u2018')  // Left single quote
                .replace(/â€™/g, '\u2019')  // Right single quote
                .replace(/â€œ/g, '\u201C')  // Left double quote
                .replace(/â€/g, '\u201D')   // Right double quote
                .replace(/Â /g, ' ');   // Non-breaking space issues

            // 2. Remove meta tags
            html = html.replace(/<meta[^>]*>/gi, '');

            // 2.5. Remove external stylesheet links (prevent CSP violations)
            html = html.replace(/<link[^>]*>/gi, '');

            // 3. Convert Google Docs paragraph-style headings to semantic HTML AND clean existing headers
            // Create temporary DOM for manipulation
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            // Process both paragraphs (convert if needed) and existing headers (clean)
            tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6').forEach(element => {
                let heading = element;

                // If it's a paragraph, check if it should be converted to a header
                if (element.tagName === 'P') {
                    const style = element.getAttribute('style') || '';
                    const isBold = style.includes('font-weight:700') || style.includes('font-weight:bold');
                    const fontSizeMatch = style.match(/font-size:\s*(\d+(?:\.\d+)?)(pt|px)/i);

                    if (isBold && fontSizeMatch) {
                        const size = parseFloat(fontSizeMatch[1]);
                        const unit = fontSizeMatch[2].toLowerCase();

                        // Convert to points if in pixels
                        const sizeInPoints = unit === 'px' ? size * 0.75 : size;

                        // Determine heading level based on font size
                        let headingLevel = 'h3';
                        if (sizeInPoints >= 18) headingLevel = 'h1';
                        else if (sizeInPoints >= 14) headingLevel = 'h2';

                        // Create new heading element
                        const newHeading = document.createElement(headingLevel);
                        newHeading.innerHTML = element.innerHTML;
                        newHeading.setAttribute('style', style);

                        element.replaceWith(newHeading);
                        heading = newHeading;
                    } else {
                        // Not a header, skip cleanup (keep as normal paragraph)
                        return;
                    }
                }

                // === COMPREHENSIVE GOOGLE DOCS CLEANUP ===
                // (applies to both converted headers and existing h1/h2/h3 tags)

                // Step 1: Remove ALL class attributes (Google Docs adds class="font", class="size", etc.)
                heading.querySelectorAll('[class]').forEach(el => {
                    el.removeAttribute('class');
                });

                // Step 2: Strip inline styles from inner elements, but PRESERVE font-family
                heading.querySelectorAll('[style]').forEach(el => {
                    // Don't touch the heading itself yet, only inner elements
                    if (el !== heading) {
                        // Preserve font-family before clearing styles
                        const fontFamily = el.style.fontFamily;
                        el.removeAttribute('style');
                        // Restore font-family if it existed
                        if (fontFamily) {
                            el.style.fontFamily = fontFamily;
                        }
                    }
                });

                // Step 3: Recursively unwrap empty SPANs (those with no attributes)
                let changed = true;
                while (changed) {
                    changed = false;
                    heading.querySelectorAll('span').forEach(span => {
                        // If span has no attributes (no style, no class, no id), unwrap it
                        if (span.attributes.length === 0 && span.parentNode) {
                            while (span.firstChild) {
                                span.parentNode.insertBefore(span.firstChild, span);
                            }
                            span.remove();
                            changed = true;
                        }
                    });
                }

                // Step 3.5: Convert block-level CSS formatting to semantic tags
                // (before we strip the CSS styles)
                const hasBlockBold = heading.style.fontWeight === '700' ||
                                     heading.style.fontWeight === 'bold';
                const hasBlockItalic = heading.style.fontStyle === 'italic';
                const hasBlockUnderline = heading.style.textDecoration &&
                                          heading.style.textDecoration.includes('underline');

                // If the header itself has CSS formatting, wrap content in semantic tags
                if (hasBlockBold || hasBlockItalic || hasBlockUnderline) {
                    let content = heading.innerHTML;

                    // Wrap in order: innermost first
                    if (hasBlockBold && !heading.querySelector('b')) {
                        content = `<b>${content}</b>`;
                    }
                    if (hasBlockItalic && !heading.querySelector('i')) {
                        content = `<i>${content}</i>`;
                    }
                    if (hasBlockUnderline && !heading.querySelector('u')) {
                        content = `<u>${content}</u>`;
                    }

                    heading.innerHTML = content;
                }

                // Step 4: Strip block-level formatting styles
                heading.style.fontWeight = '';
                heading.style.fontStyle = '';
                heading.style.textDecoration = '';
                heading.style.fontFamily = '';

                heading.style.padding = '';
                heading.style.paddingTop = '';
                heading.style.paddingBottom = '';
                heading.style.paddingLeft = '';
                heading.style.paddingRight = '';
                heading.style.margin = '';
                heading.style.lineHeight = '';
                heading.style.pageBreakAfter = '';
                heading.style.orphans = '';
                heading.style.widows = '';
                // Keep: text-align, color, background-color

                // Step 5: Remove style attribute if empty
                const remainingStyle = heading.getAttribute('style');
                if (!remainingStyle || !remainingStyle.trim()) {
                    heading.removeAttribute('style');
                }
            });

            // 4. Clean up Google Docs-specific classes
            tempDiv.querySelectorAll('[class*="lst-kix"]').forEach(el => {
                // Remove Google Docs list classes but keep the element
                const classes = el.className.split(' ').filter(c => !c.includes('lst-kix'));
                if (classes.length > 0) {
                    el.className = classes.join(' ');
                } else {
                    el.removeAttribute('class');
                }
            });

            // 5. Remove Google Docs internal ID attributes
            tempDiv.querySelectorAll('[id]').forEach(el => {
                const id = el.getAttribute('id');
                // Only remove if it looks like a Google Docs generated ID
                if (id && (id.startsWith('h.') || id.startsWith('id.'))) {
                    el.removeAttribute('id');
                }
            });

            return tempDiv.innerHTML;

        } catch (error) {
            console.error('Error processing Google Docs HTML:', error);
            // Fallback: just remove meta tags
            return html.replace(/<meta[^>]*>/gi, '');
        }
    },

    // Initialize Google Drive integration
    async init() {
        if (this.initialized) return;

        // Mark as initialized early to prevent double-init
        this.initialized = true;

        // Check connection status from backend - await to ensure accurate UI
        await this.checkConnectionStatus();

        // Load Google Picker API for file selection
        this.loadPickerAPI();

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
            } else {
                // API returned error - treat as not connected
                this.isConnected = false;
                Storage.saveGoogleDriveConnected(false);
            }
        } catch (error) {
            console.error('Failed to check Drive status:', error);
            // Network error or auth issue - treat as not connected
            this.isConnected = false;
            Storage.saveGoogleDriveConnected(false);
        }
        // Always update UI with current status
        this.updateUI();
    },

    // Reconnect - triggers re-auth with Drive scope
    async reconnect() {
        // User needs to re-authenticate to grant Drive permission
        if (confirm('To enable Google Drive access, you\'ll be redirected to Google to grant permissions. Continue?')) {
            // Go directly to OAuth login (requests Drive scope)
            window.location.href = '/auth/login';
        }
    },

    // Disconnect Google Drive
    async disconnect() {
        if (!confirm('Are you sure you want to disconnect Google Drive? Your local documents will be preserved, but Drive sync will stop.')) {
            return;
        }

        try {
            const response = await fetch('/drive/disconnect', { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                // Update local state
                this.isConnected = false;
                Storage.saveGoogleDriveConnected(false);
                Storage.clearGoogleDriveFolder();

                // Update UI
                this.updateUI();

                console.log('Google Drive disconnected');
            } else {
                alert('Failed to disconnect Google Drive: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Drive disconnect error:', error);
            alert('Failed to disconnect Google Drive. Please try again.');
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

            // Strip .html extension from title for Google Drive
            const driveTitle = doc.title.endsWith('.html')
                ? doc.title.slice(0, -5)
                : doc.title;

            // Build request body - include parentFolderId only for new files
            const requestBody = {
                title: driveTitle,
                content: doc.content,
                driveFileId: doc.driveFileId || null
            };

            // Only add parentFolderId for new files (not updates)
            if (!doc.driveFileId) {
                const defaultFolderId = this.getDefaultFolderId();
                if (defaultFolderId) {
                    requestBody.parentFolderId = defaultFolderId;
                }
            }

            const response = await fetch('/drive/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            // Handle access-denied or file-not-found errors for updates
            if (data.error === 'access_denied' || data.error === 'file_not_found') {
                doc.driveSyncStatus = 'access_denied';
                Storage.saveDocuments(Documents.documents);
                this.updateSyncIndicator(documentId, 'error');
                Documents.renderDocumentList();
                this.handleAccessDeniedOnSave(documentId, doc.driveFileId, data.error);
                return { success: false, error: data.error };
            }

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
                alert(`Failed to save to Drive: ${data.message || data.error}`);
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

            // Handle access-denied or file-not-found errors
            if (data.error === 'access_denied' || data.error === 'file_not_found') {
                doc.driveSyncStatus = 'access_denied';
                Storage.saveDocuments(Documents.documents);
                this.updateSyncIndicator(documentId, 'error', 'sync');
                Documents.renderDocumentList();
                this.handleAccessDenied(documentId, doc.driveFileId, data.error);
                return { success: false, error: data.error };
            }

            if (data.success) {
                // Update document with latest content from Drive
                doc.content = this.processGoogleDocsHTML(data.content);
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
                alert(`Failed to sync from Drive: ${data.message || data.error}`);
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

        if (this.pickerLoadFailed) {
            alert('Google Picker failed to load. This can happen in standalone app mode or with strict privacy settings. Try opening the app in your regular browser instead.');
            return;
        }

        if (!this.pickerApiLoaded) {
            alert('Google Picker is still loading. Please try again in a moment.');
            return;
        }

        // Debug: Log mobile detection
        const isMobile = this.isMobileOrPWA();
        this.debugLog('isMobile=' + isMobile + ' pickerLoaded=' + this.pickerApiLoaded);

        try {
            // Get OAuth token from backend for Picker
            const tokenResponse = await fetch('/drive/picker-token');
            const tokenData = await tokenResponse.json();
            this.debugLog('token success=' + tokenData.success);

            if (!tokenData.success) {
                alert('Failed to get Drive access. Please try reconnecting.');
                return;
            }

            // Show Google Picker
            // API key enables access to files not created by this app (drive.file scope)
            // On desktop: use hierarchical folder navigation with list view
            // On mobile/PWA: use vanilla ViewId.DOCS (custom DocsView breaks on these platforms)
            const pickerBuilder = new google.picker.PickerBuilder()
                .setOAuthToken(tokenData.accessToken)
                .setOrigin(window.location.protocol + '//' + window.location.host)
                .setCallback(async (data) => {
                    this.debugLog('Callback: ' + data.action);
                    if (data.action === google.picker.Action.PICKED) {
                        await this.handlePickerSelection(data.docs[0]);
                    }
                });

            if (isMobile) {
                // Mobile/PWA: vanilla docs view (most compatible)
                this.debugLog('Adding ViewId.DOCS (mobile)');
                pickerBuilder.addView(google.picker.ViewId.DOCS);
            } else {
                // Desktop: hierarchical folder navigation with list view
                const docsView = new google.picker.DocsView()
                    .setParent('root')
                    .setIncludeFolders(true)
                    .setSelectFolderEnabled(false)
                    .setMode(google.picker.DocsViewMode.LIST);
                pickerBuilder.addView(docsView);
            }

            // Add API key and App ID only on desktop (causes errors on mobile/PWA)
            if (!this.isMobileOrPWA()) {
                // API key required for importing existing Drive files
                if (tokenData.apiKey) {
                    pickerBuilder.setDeveloperKey(tokenData.apiKey);
                }
                // App ID required for drive.file scope to grant access on selection
                if (tokenData.appId) {
                    pickerBuilder.setAppId(tokenData.appId);
                }
            }

            this.debugLog('Building picker...');
            const picker = pickerBuilder.build();
            this.debugLog('Built OK, calling setVisible...');

            picker.setVisible(true);
            this.debugLog('setVisible() called - picker should appear');

        } catch (error) {
            this.debugLog('ERROR: ' + error.message);
            console.error('Picker error:', error);
            alert('Picker error: ' + error.message);
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
                console.log('\n=== GOOGLE DRIVE IMPORT: After processGoogleDocsHTML() ===');
                console.log(this.processGoogleDocsHTML(data.content));
                console.log('\n=== GOOGLE DRIVE IMPORT: Document Name ===');
                console.log(data.name);

                // Check if document with this driveFileId already exists
                const existingDoc = Object.values(Documents.documents)
                    .find(doc => doc.driveFileId === file.id);

                if (existingDoc) {
                    // Update existing document
                    existingDoc.title = data.name.endsWith('.html') ? data.name : data.name + '.html';
                    existingDoc.content = this.processGoogleDocsHTML(data.content);
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
                        content: this.processGoogleDocsHTML(data.content),
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
        console.log('GDrive: loadPickerAPI called, existing google.picker?', !!(window.google && window.google.picker));
        if (window.google && window.google.picker) {
            this.pickerApiLoaded = true;
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';

        // Timeout for script load (10 seconds)
        const timeout = setTimeout(() => {
            if (!this.pickerApiLoaded) {
                console.warn('Google Picker API load timed out');
                this.pickerLoadFailed = true;
            }
        }, 10000);

        script.onload = () => {
            console.log('GDrive: api.js loaded, calling gapi.load("picker")');
            try {
                gapi.load('picker', {
                    callback: () => {
                        clearTimeout(timeout);
                        this.pickerApiLoaded = true;
                        this.pickerLoadFailed = false;
                        console.log('GDrive: Picker API loaded successfully');
                    },
                    onerror: () => {
                        clearTimeout(timeout);
                        console.error('GDrive: Failed to load Google Picker module');
                        this.pickerLoadFailed = true;
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                console.error('Error initializing Google API:', error);
                this.pickerLoadFailed = true;
            }
        };

        script.onerror = () => {
            clearTimeout(timeout);
            console.error('Failed to load Google APIs script');
            this.pickerLoadFailed = true;
        };

        document.head.appendChild(script);
    },

    // Handle access-denied error when pulling from Drive
    handleAccessDenied(documentId, driveFileId, errorType) {
        const doc = Documents.documents[documentId];
        const docName = doc ? doc.title.replace('.html', '') : 'This document';

        const message = errorType === 'file_not_found'
            ? `"${docName}" was not found in Google Drive. It may have been deleted.\n\nWould you like to:\n• Click OK to re-link to a different file\n• Click Cancel to keep the document unlinked`
            : `Access to "${docName}" in Google Drive has been lost.\n\nThis can happen when:\n• The file was shared with you but access was revoked\n• You're using a new permission scope\n\nWould you like to re-link this document via the file picker?`;

        if (confirm(message)) {
            this.relinkDocument(documentId);
        }
    },

    // Handle access-denied error when saving to Drive
    handleAccessDeniedOnSave(documentId, driveFileId, errorType) {
        const doc = Documents.documents[documentId];
        const docName = doc ? doc.title.replace('.html', '') : 'This document';

        const message = errorType === 'file_not_found'
            ? `The linked Google Drive file for "${docName}" was not found.\n\nWould you like to:\n• Click OK to save as a new file in Drive\n• Click Cancel to keep working locally`
            : `Access to the linked Google Drive file for "${docName}" has been lost.\n\nWould you like to:\n• Click OK to save as a new file in Drive\n• Click Cancel to re-link to an existing file`;

        if (confirm(message)) {
            // Clear the driveFileId to create a new file
            if (doc) {
                doc.driveFileId = null;
                doc.driveSyncStatus = null;
                Storage.saveDocuments(Documents.documents);
                Documents.renderDocumentList();
                // Update Drive icon visibility
                if (typeof Documents !== 'undefined' && Documents.updateDriveIconVisibility) {
                    Documents.updateDriveIconVisibility();
                }
            }
            // Try saving again (will create a new file)
            this.saveToGoogleDrive(documentId);
        } else if (errorType === 'access_denied') {
            // Offer to re-link instead
            if (confirm('Would you like to re-link to an existing file instead?')) {
                this.relinkDocument(documentId);
            }
        }
    },

    // Re-link a document to a Google Drive file via Picker
    async relinkDocument(documentId) {
        if (!this.isConnected) {
            alert('Google Drive is not connected. Please enable Drive access in Settings.');
            return;
        }

        if (this.pickerLoadFailed) {
            alert('Google Picker failed to load. This can happen in standalone app mode or with strict privacy settings. Try opening the app in your regular browser instead.');
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
            // API key enables access to files not created by this app (drive.file scope)
            // On desktop: use hierarchical folder navigation with list view
            // On mobile/PWA: use vanilla ViewId.DOCS (custom DocsView breaks on these platforms)
            const pickerBuilder = new google.picker.PickerBuilder()
                .setOAuthToken(tokenData.accessToken)
                .setOrigin(window.location.protocol + '//' + window.location.host)
                .setTitle('Select a file to link')
                .setCallback(async (data) => {
                    if (data.action === google.picker.Action.PICKED) {
                        const selectedFile = data.docs[0];
                        await this.handleRelinkSelection(documentId, selectedFile);
                    }
                });

            if (this.isMobileOrPWA()) {
                // Mobile/PWA: vanilla docs view (most compatible)
                pickerBuilder.addView(google.picker.ViewId.DOCS);
            } else {
                // Desktop: hierarchical folder navigation with list view
                const docsView = new google.picker.DocsView()
                    .setParent('root')
                    .setIncludeFolders(true)
                    .setSelectFolderEnabled(false)
                    .setMode(google.picker.DocsViewMode.LIST);
                pickerBuilder.addView(docsView);
            }

            // Add API key and App ID only on desktop (causes errors on mobile/PWA)
            if (!this.isMobileOrPWA()) {
                // API key required for linking to existing Drive files
                if (tokenData.apiKey) {
                    pickerBuilder.setDeveloperKey(tokenData.apiKey);
                }
                // App ID required for drive.file scope to grant access on selection
                if (tokenData.appId) {
                    pickerBuilder.setAppId(tokenData.appId);
                }
            }

            const picker = pickerBuilder.build();

            picker.setVisible(true);

        } catch (error) {
            console.error('Re-link picker error:', error);
            alert('Failed to open file picker. Please try again.');
        }
    },

    // Handle file selection for re-linking
    async handleRelinkSelection(documentId, file) {
        const doc = Documents.documents[documentId];
        if (!doc) return;

        try {
            UI.showLoading();

            // Import via backend to verify access and get content
            const response = await fetch(`/drive/import/${file.id}`);
            const data = await response.json();

            UI.hideLoading();

            if (data.success) {
                // Ask user if they want to replace local content
                const replaceContent = confirm(
                    `Successfully linked to "${data.name}".\n\nWould you like to replace your local content with the Drive file content?\n\n• Click OK to replace with Drive content\n• Click Cancel to keep your local content (just update the link)`
                );

                // Update document with new Drive link
                doc.driveFileId = file.id;
                doc.driveSyncStatus = 'synced';
                doc.lastSyncedAt = Date.now();

                if (replaceContent) {
                    doc.content = this.processGoogleDocsHTML(data.content);
                    doc.lastModified = Date.now();
                }

                Storage.saveDocuments(Documents.documents);
                Documents.renderDocumentList();

                // Refresh UI if this document is currently open
                if (Documents.currentDocumentId === documentId) {
                    Documents.openDocument(documentId);
                }

                // Update Drive icon visibility
                if (typeof Documents !== 'undefined' && Documents.updateDriveIconVisibility) {
                    Documents.updateDriveIconVisibility();
                }

                console.log('Document re-linked to Drive file:', file.id);
            } else {
                alert(`Failed to link to file: ${data.message || data.error}`);
            }

        } catch (error) {
            UI.hideLoading();
            console.error('Re-link error:', error);
            alert('Failed to link document. Please try again.');
        }
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
        const disconnectBtn = UI.elements.gdriveDisconnectBtn;
        const saveToDriveBtn = UI.elements.saveToDriveBtn;
        const importFromDriveBtn = UI.elements.importFromDriveBtn;
        const folderBtn = UI.elements.gdriveFolderBtn;
        const folderName = UI.elements.gdriveFolderName;

        if (this.isConnected) {
            if (statusText) statusText.textContent = 'Connected';
            if (statusIcon) statusIcon.textContent = '✓';
            if (connectBtn) connectBtn.style.display = 'none';
            if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
            if (saveToDriveBtn) saveToDriveBtn.disabled = false;
            if (importFromDriveBtn) importFromDriveBtn.disabled = false;
            if (folderBtn) folderBtn.disabled = false;
        } else {
            if (statusText) statusText.textContent = 'Not connected';
            if (statusIcon) statusIcon.textContent = '☁️';
            if (connectBtn) {
                connectBtn.style.display = 'inline-block';
                connectBtn.textContent = 'Enable Drive Access';
            }
            if (disconnectBtn) disconnectBtn.style.display = 'none';
            if (saveToDriveBtn) saveToDriveBtn.disabled = true;
            if (importFromDriveBtn) importFromDriveBtn.disabled = true;
            if (folderBtn) folderBtn.disabled = true;
        }

        // Update folder name display
        const folder = Storage.getGoogleDriveFolder();
        if (folderName) {
            folderName.textContent = folder ? folder.name : 'None (saves to root)';
        }
    },

    // Get the default folder ID for saving new documents
    getDefaultFolderId() {
        const folder = Storage.getGoogleDriveFolder();
        return folder ? folder.id : null;
    },

    // Open folder picker to select default save folder
    async pickDefaultFolder() {
        if (!this.isConnected) {
            const proceed = confirm('Google Drive is not connected. Would you like to enable Drive access now?');
            if (proceed) {
                this.reconnect();
            }
            return;
        }

        if (this.pickerLoadFailed) {
            alert('Google Picker failed to load. This can happen in standalone app mode or with strict privacy settings. Try opening the app in your regular browser instead.');
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

            // Create a folder view
            const folderView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
                .setSelectFolderEnabled(true)
                .setIncludeFolders(true)
                .setMimeTypes('application/vnd.google-apps.folder');

            // Show Google Picker for folders
            // API key enables access to folders not created by this app (drive.file scope)
            const pickerBuilder = new google.picker.PickerBuilder()
                .addView(folderView)
                .setOAuthToken(tokenData.accessToken)
                .setOrigin(window.location.protocol + '//' + window.location.host)
                .setTitle('Select default folder for new documents')
                .setCallback((data) => {
                    if (data.action === google.picker.Action.PICKED) {
                        const folder = data.docs[0];
                        Storage.saveGoogleDriveFolder(folder.id, folder.name);
                        this.updateUI();
                        console.log('Default folder set:', folder.name, folder.id);
                    }
                });

            // Add API key if available (required for selecting existing folders)
            if (tokenData.apiKey) {
                pickerBuilder.setDeveloperKey(tokenData.apiKey);
            }

            // Add App ID (required for drive.file scope to grant access on selection)
            if (tokenData.appId) {
                pickerBuilder.setAppId(tokenData.appId);
            }

            const picker = pickerBuilder.build();

            picker.setVisible(true);

        } catch (error) {
            console.error('Folder picker error:', error);
            alert('Failed to open folder picker. Please try again.');
        }
    }
};
