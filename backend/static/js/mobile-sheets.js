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
        this.systemPromptModal = document.getElementById('systemPromptModal');

        this.bindEvents();
        this.initialized = true;
        console.log('MobileSheets module initialized');
    },

    bindEvents() {
        // Backdrop closes active sheet
        this.backdrop?.addEventListener('click', () => this.closeSheet());

        // Swipe to dismiss on sheets
        [this.modelSheet, this.agentSheet].forEach(sheet => {
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

        // Get available models and current selection
        const models = [
            { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Latest model, best for most tasks' },
            { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Most capable, complex reasoning' },
            { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fastest, great for simple tasks' }
        ];

        const currentModel = Storage?.getSetting?.('model') || 'claude-sonnet-4-5-20250929';

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
                if (typeof Storage !== 'undefined' && Storage.saveSetting) {
                    Storage.saveSetting('model', modelId);
                }
                // Update UI
                if (typeof Settings !== 'undefined' && Settings.updateModelDisplay) {
                    Settings.updateModelDisplay();
                }
                this.closeSheet();
            });
        });

        this.showSheet(this.modelSheet);
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
                <label for="promptNameInput" style="display: block; margin-bottom: 8px; font-weight: 500;">Name</label>
                <input type="text" id="promptNameInput" value="${escapedName}" style="width: 100%; padding: 10px; margin-bottom: 16px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 16px;">
                <label for="promptContentInput" style="display: block; margin-bottom: 8px; font-weight: 500;">System Prompt</label>
                <textarea id="promptContentInput" placeholder="Enter system prompt...">${escapedContent}</textarea>
            `;
        }

        this.systemPromptModal.classList.add('open');
        document.body.style.overflow = 'hidden';
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
    }
};
