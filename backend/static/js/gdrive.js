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

                // Step 2: Strip ALL inline styles from inner elements
                heading.querySelectorAll('[style]').forEach(el => {
                    // Don't touch the heading itself yet, only inner elements
                    if (el !== heading) {
                        el.removeAttribute('style');
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

            // Strip .html extension from title for Google Drive
            const driveTitle = doc.title.endsWith('.html')
                ? doc.title.slice(0, -5)
                : doc.title;

            const response = await fetch('/drive/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: driveTitle,
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
