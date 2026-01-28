/**
 * Mobile Bottom Sheets and Full-Screen Modals
 * Native-feeling modal patterns with swipe-to-dismiss.
 */
const MobileSheets = {
    initialized: false,
    activeSheet: null,
    startY: 0,
    currentY: 0,
    sheetHeight: 0,

    init() {
        if (this.initialized) {
            console.warn('MobileSheets module already initialized');
            return;
        }

        this.backdrop = document.getElementById('bottomSheetBackdrop');
        this.modelSheet = document.getElementById('modelBottomSheet');
        this.agentSheet = document.getElementById('agentBottomSheet');
        this.themeSheet = document.getElementById('themeBottomSheet');
        this.promptSheet = document.getElementById('promptBottomSheet');
        this.systemPromptModal = document.getElementById('systemPromptModal');

        // Toolbar sheets
        this.fontSizeSheet = document.getElementById('fontSizeBottomSheet');
        this.fontFamilySheet = document.getElementById('fontFamilyBottomSheet');
        this.formatSheet = document.getElementById('formatBottomSheet');
        this.alignSheet = document.getElementById('alignBottomSheet');

        this.bindEvents();
        this.initModelDisplay();
        this.initToolbarTriggers();
        this.initialized = true;
        console.log('MobileSheets module initialized');
    },

    bindEvents() {
        // Backdrop closes active sheet
        this.backdrop?.addEventListener('click', () => this.closeSheet());

        // Swipe to dismiss on sheets
        [this.modelSheet, this.agentSheet, this.themeSheet, this.promptSheet,
         this.fontSizeSheet, this.fontFamilySheet, this.formatSheet, this.alignSheet].forEach(sheet => {
            if (!sheet) return;

            sheet.addEventListener('touchstart', (e) => this.handleSheetTouchStart(e, sheet), { passive: true });
            sheet.addEventListener('touchmove', (e) => this.handleSheetTouchMove(e, sheet), { passive: false });
            sheet.addEventListener('touchend', () => this.handleSheetTouchEnd(sheet));
        });

        // Model selector trigger (in sidebar)
        const modelSelector = document.querySelector('.model-selector, #modelSelector');
        modelSelector?.addEventListener('click', (e) => {
            if (typeof Mobile !== 'undefined' && Mobile.isMobileView()) {
                e.preventDefault();
                e.stopPropagation();
                this.showModelSheet();
            }
        });

        // Agent indicator trigger (in chat header)
        const agentIndicator = document.querySelector('.agent-indicator, #agentIndicator');
        agentIndicator?.addEventListener('click', (e) => {
            if (typeof Mobile !== 'undefined' && Mobile.isMobileView()) {
                e.preventDefault();
                e.stopPropagation();
                this.showAgentSheet();
            }
        });

        // System prompt modal triggers
        document.getElementById('systemPromptModalBack')?.addEventListener('click', () => {
            this.closeSystemPromptModal();
        });

        document.getElementById('systemPromptModalSave')?.addEventListener('click', () => {
            this.saveSystemPrompt();
        });

        // Theme selector trigger (in settings)
        this.initThemeTrigger();
    },

    initThemeTrigger() {
        const themeSelect = document.getElementById('themeSelect');
        if (!themeSelect) return;

        const themeContainer = themeSelect.closest('.settings-section-content');
        if (!themeContainer) return;

        // Create mobile trigger element
        const trigger = document.createElement('div');
        trigger.className = 'theme-selector-trigger';
        trigger.id = 'themeSelectorTrigger';

        // Get current theme name
        const currentTheme = themeSelect.value || 'system';
        const themeNames = { system: 'System', light: 'Light', dark: 'Dark' };
        trigger.textContent = themeNames[currentTheme] || 'System';

        themeContainer.appendChild(trigger);

        trigger.addEventListener('click', (e) => {
            if (typeof Mobile !== 'undefined' && Mobile.isMobileView()) {
                e.preventDefault();
                e.stopPropagation();
                this.showThemeSheet();
            }
        });

        // Update trigger when theme changes (from desktop or elsewhere)
        themeSelect.addEventListener('change', () => {
            const theme = themeSelect.value || 'system';
            trigger.textContent = themeNames[theme] || 'System';
        });
    },

    // ===== Bottom Sheet Methods =====

    showSheet(sheet) {
        if (!sheet) return;

        // Only show on mobile
        if (typeof Mobile !== 'undefined' && !Mobile.isMobileView()) return;

        this.activeSheet = sheet;
        sheet.classList.add('open');
        this.backdrop?.classList.add('visible');
        document.body.style.overflow = 'hidden';
    },

    closeSheet() {
        if (!this.activeSheet) return;

        this.activeSheet.classList.remove('open');
        this.activeSheet.style.transform = '';
        this.backdrop?.classList.remove('visible');
        document.body.style.overflow = '';
        this.activeSheet = null;
    },

    handleSheetTouchStart(e, sheet) {
        // Only handle touch on handle or header
        const handle = sheet.querySelector('.bottom-sheet-handle');
        const header = sheet.querySelector('.bottom-sheet-header');
        if (!e.target.closest('.bottom-sheet-handle') && !e.target.closest('.bottom-sheet-header')) {
            return;
        }

        this.startY = e.touches[0].clientY;
        this.sheetHeight = sheet.offsetHeight;
        sheet.classList.add('dragging');
    },

    handleSheetTouchMove(e, sheet) {
        if (!sheet.classList.contains('dragging')) return;

        this.currentY = e.touches[0].clientY;
        const deltaY = this.currentY - this.startY;

        // Only allow dragging down
        if (deltaY > 0) {
            e.preventDefault();
            sheet.style.transform = `translateY(${deltaY}px)`;
        }
    },

    handleSheetTouchEnd(sheet) {
        if (!sheet.classList.contains('dragging')) return;

        sheet.classList.remove('dragging');
        const deltaY = this.currentY - this.startY;

        // If dragged more than 30% of height, close
        if (deltaY > this.sheetHeight * 0.3) {
            this.closeSheet();
        } else {
            sheet.style.transform = '';
        }
    },

    // ===== Model Sheet =====

    showModelSheet() {
        const content = document.getElementById('modelSheetContent');
        if (!content) return;

        // Get available models from the native select
        const modelSelect = document.getElementById('modelSelect');
        const models = modelSelect ? Array.from(modelSelect.options).map(opt => ({
            id: opt.value,
            name: opt.textContent.trim(),
            description: this.getModelDescription(opt.value)
        })) : [
            { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Latest model, best for most tasks' },
            { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Most capable, complex reasoning' },
            { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fastest, great for simple tasks' }
        ];

        const currentModel = modelSelect?.value || Storage?.getSetting?.('model') || 'claude-sonnet-4-5-20250929';

        content.innerHTML = models.map(model => `
            <div class="bottom-sheet-item ${model.id === currentModel ? 'selected' : ''}" data-model="${model.id}">
                <span class="model-name">${model.name}</span>
                <span class="model-description">${model.description}</span>
            </div>
        `).join('');

        // Bind click handlers
        content.querySelectorAll('.bottom-sheet-item').forEach(item => {
            item.addEventListener('click', () => {
                const modelId = item.dataset.model;
                const modelName = item.querySelector('.model-name')?.textContent || modelId;

                // Update native select
                if (modelSelect) {
                    modelSelect.value = modelId;
                }

                // Save to storage
                if (typeof Storage !== 'undefined' && Storage.saveSetting) {
                    Storage.saveSetting('model', modelId);
                }

                // Update mobile display
                this.updateModelDisplay(modelName);

                this.closeSheet();
            });
        });

        this.showSheet(this.modelSheet);
    },

    getModelDescription(modelId) {
        if (modelId.includes('sonnet')) return 'Latest model, best for most tasks';
        if (modelId.includes('opus')) return 'Most capable, complex reasoning';
        if (modelId.includes('haiku')) return 'Fastest, great for simple tasks';
        return '';
    },

    updateModelDisplay(modelName) {
        const modelSelector = document.querySelector('.model-selector');
        if (modelSelector) {
            modelSelector.setAttribute('data-model-name', modelName);
        }
    },

    initModelDisplay() {
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) {
            const selectedOption = modelSelect.options[modelSelect.selectedIndex];
            if (selectedOption) {
                this.updateModelDisplay(selectedOption.textContent.trim());
            }
        }
    },

    // ===== Agent Sheet =====

    showAgentSheet() {
        const content = document.getElementById('agentSheetContent');
        if (!content) return;

        // Get agents from SystemPrompts/Agents module
        const agents = typeof SystemPrompts !== 'undefined' ? Object.values(SystemPrompts.items || {}) : [];

        if (agents.length === 0) {
            content.innerHTML = '<div class="bottom-sheet-item">No agents configured</div>';
        } else {
            content.innerHTML = agents.map(agent => `
                <div class="bottom-sheet-item agent-item" data-agent="${agent.id}">
                    <span class="agent-color" style="background: ${agent.color || '#888'}"></span>
                    <span class="item-label">${agent.name}</span>
                    <div class="agent-toggle ${agent.isActive ? 'active' : ''}" data-agent="${agent.id}"></div>
                </div>
            `).join('');

            // Bind toggle handlers
            content.querySelectorAll('.agent-toggle').forEach(toggle => {
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const agentId = toggle.dataset.agent;
                    toggle.classList.toggle('active');

                    if (typeof Agents !== 'undefined' && Agents.toggleAgent) {
                        Agents.toggleAgent(agentId);
                    }
                });
            });
        }

        this.showSheet(this.agentSheet);
    },

    // ===== Theme Sheet =====

    showThemeSheet() {
        const content = document.getElementById('themeSheetContent');
        if (!content) return;

        const themes = [
            { id: 'system', name: 'System', description: 'Follow device settings' },
            { id: 'light', name: 'Light', description: 'Light background' },
            { id: 'dark', name: 'Dark', description: 'Dark background' }
        ];

        const currentTheme = Storage?.getSetting?.('theme') || 'system';

        content.innerHTML = themes.map(theme => `
            <div class="bottom-sheet-item ${theme.id === currentTheme ? 'selected' : ''}" data-value="${theme.id}">
                <span class="theme-name">${theme.name}</span>
                <span class="theme-description">${theme.description}</span>
            </div>
        `).join('');

        // Bind click handlers
        content.querySelectorAll('.bottom-sheet-item').forEach(item => {
            item.addEventListener('click', () => {
                const themeId = item.dataset.value;

                // Update native select
                const themeSelect = document.getElementById('themeSelect');
                if (themeSelect) {
                    themeSelect.value = themeId;
                    // Trigger change event to apply theme
                    themeSelect.dispatchEvent(new Event('change'));
                }

                // Save to storage
                if (typeof Storage !== 'undefined' && Storage.saveSetting) {
                    Storage.saveSetting('theme', themeId);
                }

                this.closeSheet();
            });
        });

        this.showSheet(this.themeSheet);
    },

    // ===== Prompt Selector Sheet (for Add Agent modal) =====

    showPromptSheet(callback) {
        const content = document.getElementById('promptSheetContent');
        if (!content) return;

        // Get prompts from SystemPrompts module
        const prompts = typeof SystemPrompts !== 'undefined' && SystemPrompts.state?.systemPrompts
            ? Object.values(SystemPrompts.state.systemPrompts)
            : [];

        if (prompts.length === 0) {
            content.innerHTML = '<div class="bottom-sheet-item">No system prompts available</div>';
        } else {
            content.innerHTML = prompts.map(prompt => `
                <div class="bottom-sheet-item prompt-item" data-prompt-id="${prompt.id}">
                    <span class="prompt-name">${prompt.name || 'Untitled'}</span>
                </div>
            `).join('');

            // Bind click handlers
            content.querySelectorAll('.bottom-sheet-item').forEach(item => {
                item.addEventListener('click', () => {
                    const promptId = item.dataset.promptId;
                    if (callback && typeof callback === 'function') {
                        callback(promptId);
                    }
                    this.closeSheet();
                });
            });
        }

        this.showSheet(this.promptSheet);
    },

    // ===== System Prompt Modal =====

    showSystemPromptModal(promptId) {
        if (!this.systemPromptModal) return;

        // Only show on mobile
        if (typeof Mobile !== 'undefined' && !Mobile.isMobileView()) return;

        this.currentPromptId = promptId;

        // Get prompt content from SystemPrompts state
        const content = document.getElementById('systemPromptModalContent');
        if (content && typeof SystemPrompts !== 'undefined') {
            const prompt = SystemPrompts.state?.systemPrompts?.[promptId];
            const escapedName = (prompt?.name || '').replace(/"/g, '&quot;');
            const escapedContent = (prompt?.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            content.innerHTML = `
                <label for="promptNameInput" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--color-text);">Name</label>
                <input type="text" id="promptNameInput" value="${escapedName}" style="width: 100%; padding: 10px; margin-bottom: 16px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 16px; background: var(--color-bg-input); color: var(--color-text);">

                <div style="margin-bottom: 16px; padding: 12px; background: var(--color-bg-subtle); border-radius: 8px;">
                    <label for="mobilePromptDescription" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--color-text);">Generate with AI</label>
                    <input type="text" id="mobilePromptDescription" placeholder="Describe what this agent should do..." style="width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 14px; background: var(--color-bg-input); color: var(--color-text);">
                    <button type="button" id="mobileGenerateBtn" style="width: 100%; padding: 10px; background: var(--color-primary); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">✨ Generate</button>
                    <div id="mobileGeneratorStatus" style="display: none; margin-top: 8px; padding: 8px; border-radius: 6px; font-size: 13px;"></div>
                </div>

                <label for="promptContentInput" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--color-text);">System Prompt</label>
                <textarea id="promptContentInput" placeholder="Enter system prompt...">${escapedContent}</textarea>
            `;

            // Bind generate button
            const generateBtn = document.getElementById('mobileGenerateBtn');
            generateBtn?.addEventListener('click', () => this.generateMobilePrompt());

            // Enter key in description triggers generate
            const descInput = document.getElementById('mobilePromptDescription');
            descInput?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.generateMobilePrompt();
                }
            });
        }

        this.systemPromptModal.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    async generateMobilePrompt() {
        const descInput = document.getElementById('mobilePromptDescription');
        const generateBtn = document.getElementById('mobileGenerateBtn');
        const statusDiv = document.getElementById('mobileGeneratorStatus');
        const textarea = document.getElementById('promptContentInput');
        const nameInput = document.getElementById('promptNameInput');

        const description = descInput?.value?.trim();
        if (!description) {
            this.showMobileGeneratorStatus('Please enter a description first.', 'error');
            return;
        }

        if (this.isGenerating) return;

        try {
            this.isGenerating = true;
            generateBtn.disabled = true;
            generateBtn.textContent = '⏳ Generating...';
            this.showMobileGeneratorStatus('Generating your system prompt...', 'loading');

            // Clear textarea for streaming
            if (textarea) textarea.value = '';

            // Use PromptGenerator's API call if available
            if (typeof PromptGenerator !== 'undefined' && PromptGenerator.callGenerationAPI) {
                const result = await PromptGenerator.callGenerationAPI(description, textarea);

                if (nameInput && result.name) {
                    nameInput.value = result.name;
                }
                if (textarea) {
                    textarea.value = result.prompt;
                }

                this.showMobileGeneratorStatus('✓ Generated successfully!', 'success');
                descInput.value = '';

                setTimeout(() => {
                    if (statusDiv) statusDiv.style.display = 'none';
                }, 3000);
            } else {
                throw new Error('Prompt generator not available');
            }
        } catch (error) {
            console.error('Mobile prompt generation error:', error);
            this.showMobileGeneratorStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.textContent = '✨ Generate';
        }
    },

    showMobileGeneratorStatus(message, type) {
        const statusDiv = document.getElementById('mobileGeneratorStatus');
        if (!statusDiv) return;

        statusDiv.style.display = 'block';
        statusDiv.textContent = message;

        // Style based on type
        statusDiv.style.background = type === 'error' ? 'var(--color-error-bg, #ffebee)' :
                                     type === 'success' ? 'var(--color-success-bg, #e8f5e9)' :
                                     'var(--color-bg-subtle)';
        statusDiv.style.color = type === 'error' ? 'var(--color-error, #c62828)' :
                                type === 'success' ? 'var(--color-success, #2e7d32)' :
                                'var(--color-text)';
    },

    closeSystemPromptModal() {
        if (!this.systemPromptModal) return;

        this.systemPromptModal.classList.remove('open');
        document.body.style.overflow = '';
        this.currentPromptId = null;
    },

    saveSystemPrompt() {
        if (!this.currentPromptId) return;

        const name = document.getElementById('promptNameInput')?.value;
        const content = document.getElementById('promptContentInput')?.value;

        if (typeof SystemPrompts !== 'undefined') {
            const prompt = SystemPrompts.state.systemPrompts[this.currentPromptId];
            if (prompt) {
                prompt.name = name || prompt.name;
                prompt.content = content || '';
                prompt.updatedAt = Date.now();
                SystemPrompts.save();
                SystemPrompts.render();
            }
        }

        this.closeSystemPromptModal();
    },

    // ===== Toolbar Sheet Methods =====

    initToolbarTriggers() {
        // Font Size trigger
        const fontSizeSelect = document.getElementById('fontSizeSelect');
        if (fontSizeSelect) {
            const trigger = this.createToolbarTrigger('fontSizeTrigger', '14');
            fontSizeSelect.parentNode.insertBefore(trigger, fontSizeSelect.nextSibling);
            trigger.addEventListener('click', () => this.showFontSizeSheet());
        }

        // Font Family trigger
        const fontFamilySelect = document.getElementById('fontFamilySelect');
        if (fontFamilySelect) {
            const trigger = this.createToolbarTrigger('fontFamilyTrigger', 'Font');
            fontFamilySelect.parentNode.insertBefore(trigger, fontFamilySelect.nextSibling);
            trigger.addEventListener('click', () => this.showFontFamilySheet());
        }

        // Format (Header) trigger
        const formatSelect = document.getElementById('formatSelect');
        if (formatSelect) {
            const trigger = this.createToolbarTrigger('formatTrigger', 'P');
            formatSelect.parentNode.insertBefore(trigger, formatSelect.nextSibling);
            trigger.addEventListener('click', () => this.showFormatSheet());
        }

        // Alignment trigger
        const alignSelect = document.getElementById('textAlignSelect');
        if (alignSelect) {
            const trigger = this.createToolbarTrigger('alignTrigger', '≡');
            alignSelect.parentNode.insertBefore(trigger, alignSelect.nextSibling);
            trigger.addEventListener('click', () => this.showAlignSheet());
        }
    },

    createToolbarTrigger(id, label) {
        const trigger = document.createElement('button');
        trigger.className = 'toolbar-select-trigger';
        trigger.id = id;
        trigger.type = 'button';
        trigger.innerHTML = `<span>${label}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        return trigger;
    },

    // Font Size Sheet
    showFontSizeSheet() {
        const content = document.getElementById('fontSizeSheetContent');
        if (!content) return;

        const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];
        const fontSizeSelect = document.getElementById('fontSizeSelect');
        const currentSize = fontSizeSelect?.value || '14';

        content.innerHTML = sizes.map(size => `
            <div class="bottom-sheet-item ${String(size) === currentSize ? 'selected' : ''}" data-value="${size}">
                <span style="font-size: ${Math.min(size, 24)}px;">${size}</span>
            </div>
        `).join('');

        content.querySelectorAll('.bottom-sheet-item').forEach(item => {
            item.addEventListener('click', () => {
                const value = item.dataset.value;
                if (fontSizeSelect) {
                    fontSizeSelect.value = value;
                    fontSizeSelect.dispatchEvent(new Event('change'));
                }
                document.getElementById('fontSizeTrigger').querySelector('span').textContent = value;
                this.closeSheet();
            });
        });

        this.showSheet(this.fontSizeSheet);
    },

    // Font Family Sheet
    showFontFamilySheet() {
        const content = document.getElementById('fontFamilySheetContent');
        if (!content) return;

        const fonts = [
            { value: 'Arial', name: 'Arial' },
            { value: 'Times New Roman', name: 'Times New Roman' },
            { value: 'Georgia', name: 'Georgia' },
            { value: 'Courier New', name: 'Courier New' },
            { value: 'Verdana', name: 'Verdana' }
        ];
        const fontFamilySelect = document.getElementById('fontFamilySelect');
        const currentFont = fontFamilySelect?.value || 'Arial';

        content.innerHTML = fonts.map(font => `
            <div class="bottom-sheet-item ${font.value === currentFont ? 'selected' : ''}" data-value="${font.value}">
                <span style="font-family: '${font.value}';">${font.name}</span>
            </div>
        `).join('');

        content.querySelectorAll('.bottom-sheet-item').forEach(item => {
            item.addEventListener('click', () => {
                const value = item.dataset.value;
                if (fontFamilySelect) {
                    fontFamilySelect.value = value;
                    fontFamilySelect.dispatchEvent(new Event('change'));
                }
                document.getElementById('fontFamilyTrigger').querySelector('span').textContent = value.split(' ')[0];
                this.closeSheet();
            });
        });

        this.showSheet(this.fontFamilySheet);
    },

    // Format (Header) Sheet
    showFormatSheet() {
        const content = document.getElementById('formatSheetContent');
        if (!content) return;

        const formats = [
            { value: 'p', name: 'Paragraph', label: 'P' },
            { value: 't', name: 'Title', label: 'T' },
            { value: 'h1', name: 'Heading 1', label: 'H1' },
            { value: 'h2', name: 'Heading 2', label: 'H2' },
            { value: 'h3', name: 'Heading 3', label: 'H3' }
        ];
        const formatSelect = document.getElementById('formatSelect');
        const currentFormat = formatSelect?.value || 'p';

        content.innerHTML = formats.map(format => `
            <div class="bottom-sheet-item ${format.value === currentFormat ? 'selected' : ''}" data-value="${format.value}">
                <span><strong>${format.label}</strong> - ${format.name}</span>
            </div>
        `).join('');

        content.querySelectorAll('.bottom-sheet-item').forEach(item => {
            item.addEventListener('click', () => {
                const value = item.dataset.value;
                if (formatSelect) {
                    formatSelect.value = value;
                    formatSelect.dispatchEvent(new Event('change'));
                }
                const format = formats.find(f => f.value === value);
                document.getElementById('formatTrigger').querySelector('span').textContent = format?.label || 'P';
                this.closeSheet();
            });
        });

        this.showSheet(this.formatSheet);
    },

    // Alignment Sheet
    showAlignSheet() {
        const content = document.getElementById('alignSheetContent');
        if (!content) return;

        const alignments = [
            { value: 'left', name: 'Left', icon: '⬅' },
            { value: 'center', name: 'Center', icon: '⬌' },
            { value: 'right', name: 'Right', icon: '➡' },
            { value: 'justify', name: 'Justify', icon: '≡' }
        ];
        const alignSelect = document.getElementById('textAlignSelect');
        const currentAlign = alignSelect?.value || 'left';

        content.innerHTML = alignments.map(align => `
            <div class="bottom-sheet-item ${align.value === currentAlign ? 'selected' : ''}" data-value="${align.value}">
                <span>${align.icon} ${align.name}</span>
            </div>
        `).join('');

        content.querySelectorAll('.bottom-sheet-item').forEach(item => {
            item.addEventListener('click', () => {
                const value = item.dataset.value;
                if (alignSelect) {
                    alignSelect.value = value;
                    alignSelect.dispatchEvent(new Event('change'));
                }
                const align = alignments.find(a => a.value === value);
                document.getElementById('alignTrigger').querySelector('span').textContent = align?.icon || '≡';
                this.closeSheet();
            });
        });

        this.showSheet(this.alignSheet);
    }
};
