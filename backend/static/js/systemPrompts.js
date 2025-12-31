/**
 * System Prompt Management Module
 * Handles all system prompt functionality including creation, editing, selection, and management
 */
const SystemPrompts = {
    // State management
    state: {
        systemPrompts: Storage.getSystemPrompts(),
        activeSystemPromptId: Storage.getActiveSystemPromptId(),
        isEditingSystemPrompt: false,
        editingSystemPromptId: null,
        autoSaveTimeout: null,
        isRenamingFromSidebar: false
    },

    // Initialize system prompts functionality
    init() {
        // MIGRATION: Add order field to existing prompts that don't have it
        let needsSave = false;
        const prompts = Object.values(this.state.systemPrompts);

        // Sort by createdAt (current order) to preserve visual ordering
        const sortedByCreatedAt = prompts.sort((a, b) => b.createdAt - a.createdAt);

        sortedByCreatedAt.forEach((prompt, index) => {
            if (prompt.order === undefined) {
                prompt.order = index;
                needsSave = true;
            }
        });

        if (needsSave) {
            this.save();
        }

        this.bindEventListeners();
        this.render();
    },

    // Event listeners
    bindEventListeners() {
        // Add new system prompt button
        UI.elements.addPromptBtn?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent collapsing the section
            this.createNew();
        });

        // Exit editor button
        UI.elements.exitEditorBtn?.addEventListener('click', () => {
            this.exitEdit();
        });

        // Auto-save system prompt content
        UI.elements.systemPromptTextarea?.addEventListener('input', () => {
            this.debouncedSaveContent();
        });

        // Auto-save system prompt name
        UI.elements.editorTitle?.addEventListener('input', () => {
            this.debouncedSaveName();
        });
        UI.elements.editorTitle?.addEventListener('blur', () => {
            this.saveName();
        });

        // Collapsible system prompt section
        UI.elements.systemPromptHeader?.addEventListener('click', () => {
            this.toggleCollapse();
        });
    },

    // Create a new system prompt
    createNew() {
        const promptId = Storage.generateSystemPromptId();
        const promptName = `System Prompt ${Object.keys(this.state.systemPrompts).length + 1}`;

        // Calculate max order to place new prompt at bottom
        const existingOrders = Object.values(this.state.systemPrompts).map(p => p.order || 0);
        const maxOrder = existingOrders.length > 0 ? Math.max(...existingOrders) : -1;

        this.state.systemPrompts[promptId] = {
            id: promptId,
            name: promptName,
            content: '',
            createdAt: Date.now(),
            order: maxOrder + 1
        };

        this.save();
        this.render();
        this.edit(promptId);

        return promptId;
    },

    // Delete a system prompt
    delete(promptId) {
        if (!confirm('Are you sure you want to delete this system prompt?')) {
            return;
        }

        delete this.state.systemPrompts[promptId];
        
        // Clear active prompt if it was deleted
        if (this.state.activeSystemPromptId === promptId) {
            this.state.activeSystemPromptId = null;
            Storage.saveActiveSystemPromptId(null);
        }
        
        // Exit edit mode if editing the deleted prompt
        if (this.state.editingSystemPromptId === promptId) {
            this.exitEdit();
        }
        
        this.save();
        this.render();
    },

    // Select/deselect a system prompt
    select(promptId) {
        if (this.state.activeSystemPromptId === promptId) {
            // Deselect if clicking the same prompt
            this.state.activeSystemPromptId = null;
        } else {
            this.state.activeSystemPromptId = promptId;
        }
        
        Storage.saveActiveSystemPromptId(this.state.activeSystemPromptId);
        this.render();

        // Update agent name tag in chat header
        if (typeof Agents !== 'undefined') {
            Agents.updateAgentSelectorUI();
        }
    },

    // Edit a system prompt
    edit(promptId) {
        const prompt = this.state.systemPrompts[promptId];
        if (!prompt) return;
        
        // If clicking the same prompt that's already being edited, close the editor
        if (this.state.editingSystemPromptId === promptId && this.state.isEditingSystemPrompt) {
            this.exitEdit();
            return;
        }
        
        this.state.isEditingSystemPrompt = true;
        this.state.editingSystemPromptId = promptId;
        this.showEditor(prompt);
        this.render(); // Re-render to update highlight
    },

    // Show the system prompt editor
    showEditor(prompt) {
        if (!UI.elements.chatContainer || !UI.elements.systemPromptEditor) return;
        
        UI.elements.chatContainer.style.display = 'none';
        UI.elements.systemPromptEditor.classList.add('active');
        
        if (UI.elements.editorTitle) {
            UI.elements.editorTitle.value = prompt.name;
        }
        if (UI.elements.systemPromptTextarea) {
            UI.elements.systemPromptTextarea.value = prompt.content;
            UI.elements.systemPromptTextarea.focus();
        }
    },

    // Exit system prompt edit mode
    exitEdit() {
        if (!UI.elements.chatContainer || !UI.elements.systemPromptEditor) return;
        
        UI.elements.chatContainer.style.display = '';
        UI.elements.systemPromptEditor.classList.remove('active');
        
        this.state.isEditingSystemPrompt = false;
        this.state.editingSystemPromptId = null;
        
        // Clear any pending auto-save
        if (this.state.autoSaveTimeout) {
            clearTimeout(this.state.autoSaveTimeout);
            this.state.autoSaveTimeout = null;
        }
        
        this.render(); // Re-render to remove highlight
    },

    // Save system prompt content with debouncing
    debouncedSaveContent() {
        if (this.state.autoSaveTimeout) {
            clearTimeout(this.state.autoSaveTimeout);
        }
        
        this.state.autoSaveTimeout = setTimeout(() => {
            this.saveContent();
        }, 500); // 500ms debounce
    },

    // Save system prompt content immediately
    saveContent() {
        if (!this.state.editingSystemPromptId || 
            !this.state.systemPrompts[this.state.editingSystemPromptId] ||
            !UI.elements.systemPromptTextarea) {
            return;
        }
        
        this.state.systemPrompts[this.state.editingSystemPromptId].content = 
            UI.elements.systemPromptTextarea.value;
        this.save();
    },

    // Save system prompt name with debouncing
    debouncedSaveName() {        
        // Don't debounce save if we're currently renaming from sidebar
        if (this.state.isRenamingFromSidebar) {
            return;
        }
        
        if (this.state.autoSaveTimeout) {
            clearTimeout(this.state.autoSaveTimeout);
        }
        
        this.state.autoSaveTimeout = setTimeout(() => {
            this.saveName();
        }, 500); // 500ms debounce
    },

    // Save system prompt name immediately
    saveName() {
        if (!this.state.editingSystemPromptId || 
            !this.state.systemPrompts[this.state.editingSystemPromptId] ||
            !UI.elements.editorTitle) {
            return;
        }
        
        // Don't auto-save name if we're currently renaming from sidebar
        if (this.state.isRenamingFromSidebar) {
            return;
        }
        
        this.state.systemPrompts[this.state.editingSystemPromptId].name = 
            UI.elements.editorTitle.value || 'Untitled System Prompt';
        this.save();
        this.render();
    },

    // Rename a system prompt
    rename(promptId, newName) {
        if (!this.state.systemPrompts[promptId]) return;
        
        // Set flag to prevent auto-save conflicts
        this.state.isRenamingFromSidebar = true;
        
        this.state.systemPrompts[promptId].name = newName;
        
        // If this prompt is currently being edited, update the editor title too
        if (this.state.editingSystemPromptId === promptId && UI.elements.editorTitle) {
            UI.elements.editorTitle.value = newName;
        }
        
        this.save();
        this.render();
        
        // Clear the flag after a short delay to allow any pending blur events to complete
        setTimeout(() => {
            this.state.isRenamingFromSidebar = false;
        }, 100);
    },

    // Toggle collapse state of system prompt section
    toggleCollapse() {
        const list = UI.elements.systemPromptList;
        const icon = UI.elements.systemPromptCollapse;
        
        if (!list || !icon) return;
        
        if (list.classList.contains('collapsed')) {
            list.classList.remove('collapsed');
            icon.classList.remove('collapsed');
        } else {
            list.classList.add('collapsed');
            icon.classList.add('collapsed');
        }
    },

    // Render the system prompt list
    render() {
        if (!UI.elements.systemPromptList) {
            console.warn('systemPromptList element not found');
            return;
        }

        try {
            UI.elements.systemPromptList.innerHTML = '';

            // Sort by order field (ascending)
            const sortedPrompts = Object.values(this.state.systemPrompts)
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            sortedPrompts.forEach(prompt => {
                const promptItem = this.createPromptItem(prompt);

                // Make item draggable
                promptItem.draggable = true;
                promptItem.dataset.promptId = prompt.id;

                // Setup drag-and-drop handlers
                this.setupDragAndDrop(promptItem, prompt.id);

                UI.elements.systemPromptList.appendChild(promptItem);
            });
        } catch (error) {
            console.error('Failed to render system prompts:', error);
        }
    },

    // Create a system prompt list item
    createPromptItem(prompt) {
        return Components.createListItem({
            text: prompt.name,
            isActive: prompt.id === this.state.editingSystemPromptId,
            className: 'prompt-item',
            maxLength: 25,
            onClick: () => this.edit(prompt.id),
            onNameEdit: (newName) => {
                this.rename(prompt.id, newName);
            },
            actions: [
                {
                    icon: 'Use',
                    title: 'Use this system prompt',
                    onClick: () => this.select(prompt.id),
                    isUseButton: true,
                    isActive: prompt.id === this.state.activeSystemPromptId
                },
                {
                    icon: '✕',
                    title: 'Delete prompt',
                    onClick: () => this.delete(prompt.id)
                }
            ]
        });
    },

    // Setup drag-and-drop handlers for a prompt item
    setupDragAndDrop(promptItem, promptId) {
        promptItem.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            promptItem.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', promptId);
        });

        promptItem.addEventListener('dragend', (e) => {
            e.stopPropagation();
            promptItem.classList.remove('dragging');
            // Remove drag-over class from all items
            document.querySelectorAll('.prompt-item').forEach(item => {
                item.classList.remove('drag-over');
            });
        });

        promptItem.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            const draggingItem = document.querySelector('.dragging');
            if (draggingItem && draggingItem !== promptItem) {
                promptItem.classList.add('drag-over');
            }
        });

        promptItem.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            promptItem.classList.remove('drag-over');
        });

        promptItem.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            promptItem.classList.remove('drag-over');

            const draggedPromptId = e.dataTransfer.getData('text/plain');
            if (draggedPromptId && draggedPromptId !== promptId) {
                this.reorderPrompts(draggedPromptId, promptId);
            }
        });
    },

    // Reorder prompts after drag-and-drop
    reorderPrompts(draggedId, targetId) {
        try {
            const prompts = Object.values(this.state.systemPrompts);
            const sortedPrompts = prompts.sort((a, b) => (a.order || 0) - (b.order || 0));

            const draggedIndex = sortedPrompts.findIndex(p => p.id === draggedId);
            const targetIndex = sortedPrompts.findIndex(p => p.id === targetId);

            if (draggedIndex === -1 || targetIndex === -1) return;

            // Remove dragged item and insert at target position
            const [draggedPrompt] = sortedPrompts.splice(draggedIndex, 1);
            sortedPrompts.splice(targetIndex, 0, draggedPrompt);

            // Reassign order values
            sortedPrompts.forEach((prompt, index) => {
                prompt.order = index;
            });

            this.save();
            this.render();
        } catch (error) {
            console.error('Failed to reorder prompts:', error);
        }
    },

    // Save system prompts to storage
    save() {
        Storage.saveSystemPrompts(this.state.systemPrompts);
    },

    // Get the currently active system prompt
    getActivePrompt() {
        return this.state.activeSystemPromptId && 
               this.state.systemPrompts[this.state.activeSystemPromptId] ? 
               this.state.systemPrompts[this.state.activeSystemPromptId] : null;
    },

    // Get the active system prompt content
    getActivePromptContent() {
        const activePrompt = this.getActivePrompt();
        return activePrompt ? activePrompt.content : null;
    },

    // Check if currently editing a system prompt
    isEditing() {
        return this.state.isEditingSystemPrompt;
    },

    // Get all system prompts
    getAll() {
        return { ...this.state.systemPrompts };
    },

    // Get a specific system prompt by ID
    getById(promptId) {
        return this.state.systemPrompts[promptId] || null;
    },

    // Refresh state from storage (useful for syncing)
    refresh() {
        this.state.systemPrompts = Storage.getSystemPrompts();
        this.state.activeSystemPromptId = Storage.getActiveSystemPromptId();
        this.render();
    },

};