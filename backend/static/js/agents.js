/**
 * Multi-Agent Chat Management
 * Handles adding, configuring, and managing multiple AI agents
 * Orchestration logic is in moderator.js
 */
const Agents = {
    initialized: false,
    MAX_AGENTS: 3,
    DEFAULT_TURNS: 'auto',
    MIN_TURNS: 1,
    MAX_TURNS: 10,
    AGENT_COLORS: ['#ea580c', '#3b82f6', '#8b5cf6'], // Orange, Blue, Purple

    init() {
        if (this.initialized) return;
        this.bindEvents();
        this.initialized = true;
        console.log('Agents module initialized');
    },

    bindEvents() {
        // Add Agent button
        UI.elements.addAgentBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showAddAgentModal();
        });

        // Turns selector
        UI.elements.turnsSelector?.addEventListener('change', (e) => {
            this.updateTurns(e.target.value);
        });

        // Agent selector dropdown
        UI.elements.agentSelector?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleAgentDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            this.closeAgentDropdown();
        });
    },

    /**
     * Get agents for current chat
     */
    getCurrentAgents() {
        if (!Chat.currentChatId) return [];
        const chats = Storage.getChats();
        const chat = chats[Chat.currentChatId];
        return chat?.agents || [];
    },

    /**
     * Get turns setting for current chat
     * Returns 'auto' or a number
     */
    getCurrentTurns() {
        if (!Chat.currentChatId) return this.DEFAULT_TURNS;
        const chats = Storage.getChats();
        const chat = chats[Chat.currentChatId];
        return chat?.turns || this.DEFAULT_TURNS;
    },

    /**
     * Build full agents list with correct colors matching orchestration logic
     * Returns: [Agent 1 (active prompt), Agent 2 (first added), Agent 3 (second added)]
     */
    getFullAgentsList() {
        const agents = [];

        // Agent 1: Active system prompt (if exists)
        const activePromptId = Storage.getActiveSystemPromptId();
        const systemPrompts = Storage.getSystemPrompts();

        if (activePromptId && systemPrompts[activePromptId]) {
            agents.push({
                id: 'agent_active_prompt',
                name: systemPrompts[activePromptId].name || 'Assistant',
                systemPromptId: activePromptId,
                color: this.AGENT_COLORS[0],  // Orange
                isActivePrompt: true
            });
        }

        // Agent 2+: Added agents from chat with unique colors
        const addedAgents = this.getCurrentAgents();
        const agentsWithUniqueColors = addedAgents.map((agent, index) => ({
            ...agent,
            color: this.AGENT_COLORS[(agents.length + index) % this.AGENT_COLORS.length],
            isActivePrompt: false
        }));

        agents.push(...agentsWithUniqueColors);

        return agents;
    },

    /**
     * Update the agent selector UI to show current agents
     */
    updateAgentSelectorUI() {
        const addedAgents = this.getCurrentAgents(); // For count display only
        const fullAgents = this.getFullAgentsList(); // For color display
        const turns = this.getCurrentTurns();

        // Update turns selector
        if (UI.elements.turnsSelector) {
            UI.elements.turnsSelector.value = turns;
        }

        // Show/hide turns control - only visible when there are multiple agents
        if (UI.elements.turnsControl) {
            UI.elements.turnsControl.style.display = fullAgents.length > 1 ? 'flex' : 'none';
        }

        // Update agent selector display
        if (UI.elements.agentSelector) {
            // Show "No Agents" only if no active prompt AND no added agents
            if (fullAgents.length === 0) {
                UI.elements.agentSelector.innerHTML = '<span class="agent-selector-text">No Agents</span>';
            } else if (fullAgents.length === 1) {
                // Single agent - show name and color
                const agent = fullAgents[0];
                UI.elements.agentSelector.innerHTML = `
                    <span class="agent-badge" style="background-color: ${agent.color}"></span>
                    <span class="agent-selector-text">${UI.escapeHtml(agent.name)}</span>
                `;
            } else {
                // Multiple agents - show all with colored dots
                const agentBadges = fullAgents.map(agent => `
                    <span class="agent-badge" style="background-color: ${agent.color}"></span>
                `).join('');
                UI.elements.agentSelector.innerHTML = `
                    ${agentBadges}
                    <span class="agent-selector-text">${fullAgents.length} Agents</span>
                `;
            }
        }

        // Show/hide add agent button based on added agents count (not including active prompt)
        if (UI.elements.addAgentBtn) {
            UI.elements.addAgentBtn.style.display = addedAgents.length >= this.MAX_AGENTS ? 'none' : 'flex';
        }
    },

    /**
     * Show modal to add a new agent
     */
    showAddAgentModal() {
        const systemPrompts = Storage.getSystemPrompts();
        const promptArray = Object.values(systemPrompts);

        if (promptArray.length === 0) {
            alert('Please create a system prompt first.');
            return;
        }

        const currentAgents = this.getCurrentAgents();
        if (currentAgents.length >= this.MAX_AGENTS) {
            alert(`Maximum of ${this.MAX_AGENTS} agents allowed.`);
            return;
        }

        // Create modal HTML
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" onclick="event.stopPropagation()">
                <h2>Add Agent</h2>
                <div class="form-group">
                    <label for="agentPrompt">System Prompt:</label>
                    <select id="agentPrompt">
                        <option value="">Select a prompt...</option>
                        ${promptArray.map(p => `<option value="${p.id}">${UI.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="agentName">Agent Name:</label>
                    <input type="text" id="agentName" placeholder="e.g., Code Assistant" />
                </div>
                <div class="modal-actions">
                    <button class="cancel-btn" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="save-btn" id="confirmAddAgent">Add Agent</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const promptSelect = document.getElementById('agentPrompt');

        // Auto-fill agent name when system prompt is selected
        promptSelect.addEventListener('change', (e) => {
            const promptId = e.target.value;
            const nameInput = document.getElementById('agentName');

            if (promptId && systemPrompts[promptId]) {
                nameInput.value = systemPrompts[promptId].name;
            }
        });

        // On mobile, intercept the select and show bottom sheet instead
        if (typeof Mobile !== 'undefined' && Mobile.isMobileView()) {
            // Create a visual trigger element
            const selectTrigger = document.createElement('div');
            selectTrigger.className = 'mobile-select-trigger';
            selectTrigger.innerHTML = '<span>Select a prompt...</span>';
            promptSelect.parentNode.insertBefore(selectTrigger, promptSelect);

            selectTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof MobileSheets !== 'undefined' && MobileSheets.showPromptSheet) {
                    MobileSheets.showPromptSheet((promptId) => {
                        // Update native select
                        promptSelect.value = promptId;
                        promptSelect.dispatchEvent(new Event('change'));
                        // Update visual trigger
                        const prompt = systemPrompts[promptId];
                        selectTrigger.innerHTML = `<span>${UI.escapeHtml(prompt?.name || promptId)}</span>`;
                    });
                }
            });
        }

        // Handle add agent confirmation
        document.getElementById('confirmAddAgent').addEventListener('click', () => {
            const name = document.getElementById('agentName').value.trim();
            const promptId = document.getElementById('agentPrompt').value;

            if (!name) {
                alert('Please enter an agent name.');
                return;
            }

            if (!promptId) {
                alert('Please select a system prompt.');
                return;
            }

            this.addAgent(name, promptId);
            modal.remove();
        });

        // Focus prompt input (now first field)
        setTimeout(() => document.getElementById('agentPrompt')?.focus(), 100);
    },

    /**
     * Add a new agent to the current chat
     */
    addAgent(name, systemPromptId) {
        if (!Chat.currentChatId) {
            console.error('ERROR: No current chat ID!');
            return;
        }

        const chats = Storage.getChats();
        const chat = chats[Chat.currentChatId];

        if (!chat.agents) {
            chat.agents = [];
        }

        if (chat.agents.length >= this.MAX_AGENTS) {
            alert(`Maximum of ${this.MAX_AGENTS} agents allowed.`);
            return;
        }

        // Create new agent
        const agentId = Storage.generateAgentId();
        const colorIndex = chat.agents.length % this.AGENT_COLORS.length;

        const newAgent = {
            id: agentId,
            name: name,
            systemPromptId: systemPromptId,
            color: this.AGENT_COLORS[colorIndex]
        };

        chat.agents.push(newAgent);

        // Initialize turns if not set
        if (!chat.turns) {
            chat.turns = this.DEFAULT_TURNS;
        }

        Storage.saveChats(chats);

        this.updateAgentSelectorUI();
    },

    /**
     * Update turns setting for current chat
     */
    updateTurns(turns) {
        if (!Chat.currentChatId) return;

        // Support 'auto' or numeric values
        let validTurns = turns;
        if (turns !== 'auto') {
            validTurns = Math.max(this.MIN_TURNS, Math.min(this.MAX_TURNS, parseInt(turns)));
        }

        const chats = Storage.getChats();
        const chat = chats[Chat.currentChatId];
        chat.turns = validTurns;

        Storage.saveChats(chats);
    },

    /**
     * Toggle agent dropdown to show all agents
     */
    toggleAgentDropdown() {
        const dropdown = document.getElementById('agentDropdown');
        if (!dropdown) {
            this.showAgentDropdown();
        } else {
            this.closeAgentDropdown();
        }
    },

    /**
     * Show dropdown with all agents and edit/delete options
     */
    showAgentDropdown() {
        this.closeAgentDropdown(); // Close if already open

        const fullAgents = this.getFullAgentsList();
        if (fullAgents.length === 0) {
            return;
        }

        const dropdown = document.createElement('div');
        dropdown.id = 'agentDropdown';
        dropdown.className = 'agent-dropdown';
        dropdown.onclick = (e) => e.stopPropagation();

        dropdown.innerHTML = fullAgents.map((agent, index) => `
            <div class="agent-dropdown-item">
                <span class="agent-badge" style="background-color: ${agent.color}"></span>
                <span class="agent-name">${UI.escapeHtml(agent.name)}</span>
                <div class="agent-actions">
                    ${agent.isActivePrompt ?
                        '<span class="agent-active-label">(Active Prompt)</span>' :
                        `<button class="agent-edit-btn" data-agent-index="${index}" title="Edit agent">✎</button>
                         <button class="agent-delete-btn" data-agent-index="${index}" title="Delete agent">×</button>`
                    }
                </div>
            </div>
        `).join('');

        UI.elements.agentSelector.appendChild(dropdown);

        // Bind edit/delete buttons (only for non-active-prompt agents)
        dropdown.querySelectorAll('.agent-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.agentIndex);
                // Adjust index for added agents (skip active prompt which is index 0)
                const adjustedIndex = index - 1;
                this.editAgent(adjustedIndex);
            });
        });

        dropdown.querySelectorAll('.agent-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.agentIndex);
                // Adjust index for added agents (skip active prompt which is index 0)
                const adjustedIndex = index - 1;
                this.deleteAgent(adjustedIndex);
            });
        });
    },

    /**
     * Close agent dropdown
     */
    closeAgentDropdown() {
        const dropdown = document.getElementById('agentDropdown');
        if (dropdown) {
            dropdown.remove();
        }
    },

    /**
     * Edit an agent's configuration
     */
    editAgent(agentIndex) {
        const agents = this.getCurrentAgents();
        const agent = agents[agentIndex];

        if (!agent) return;

        const systemPrompts = Storage.getSystemPrompts();
        const promptArray = Object.values(systemPrompts);

        // Create edit modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" onclick="event.stopPropagation()">
                <h2>Edit Agent</h2>
                <div class="form-group">
                    <label for="editAgentName">Agent Name:</label>
                    <input type="text" id="editAgentName" value="${UI.escapeHtml(agent.name)}" />
                </div>
                <div class="form-group">
                    <label for="editAgentPrompt">System Prompt:</label>
                    <select id="editAgentPrompt">
                        ${promptArray.map(p =>
                            `<option value="${p.id}" ${p.id === agent.systemPromptId ? 'selected' : ''}>
                                ${UI.escapeHtml(p.name)}
                            </option>`
                        ).join('')}
                    </select>
                </div>
                <div class="modal-actions">
                    <button class="cancel-btn" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="save-btn" id="confirmEditAgent">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const editPromptSelect = document.getElementById('editAgentPrompt');

        // On mobile, intercept the select and show bottom sheet instead
        if (typeof Mobile !== 'undefined' && Mobile.isMobileView()) {
            // Create a visual trigger element
            const selectTrigger = document.createElement('div');
            selectTrigger.className = 'mobile-select-trigger';
            const currentPrompt = systemPrompts[agent.systemPromptId];
            selectTrigger.innerHTML = `<span>${UI.escapeHtml(currentPrompt?.name || 'Select a prompt...')}</span>`;
            editPromptSelect.parentNode.insertBefore(selectTrigger, editPromptSelect);

            selectTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof MobileSheets !== 'undefined' && MobileSheets.showPromptSheet) {
                    MobileSheets.showPromptSheet((promptId) => {
                        // Update native select
                        editPromptSelect.value = promptId;
                        // Update visual trigger
                        const prompt = systemPrompts[promptId];
                        selectTrigger.innerHTML = `<span>${UI.escapeHtml(prompt?.name || promptId)}</span>`;
                    });
                }
            });
        }

        document.getElementById('confirmEditAgent').addEventListener('click', () => {
            const name = document.getElementById('editAgentName').value.trim();
            const promptId = document.getElementById('editAgentPrompt').value;

            if (!name) {
                alert('Please enter an agent name.');
                return;
            }

            this.updateAgent(agentIndex, name, promptId);
            modal.remove();
            this.closeAgentDropdown();
        });

        setTimeout(() => document.getElementById('editAgentName')?.focus(), 100);
    },

    /**
     * Update an agent's configuration
     */
    updateAgent(agentIndex, name, systemPromptId) {
        if (!Chat.currentChatId) return;

        const chats = Storage.getChats();
        const chat = chats[Chat.currentChatId];

        if (!chat.agents || !chat.agents[agentIndex]) return;

        chat.agents[agentIndex].name = name;
        chat.agents[agentIndex].systemPromptId = systemPromptId;

        Storage.saveChats(chats);
        this.updateAgentSelectorUI();
    },

    /**
     * Delete an agent from the current chat
     */
    deleteAgent(agentIndex) {
        const agents = this.getCurrentAgents();
        const agent = agents[agentIndex];

        if (!agent) return;

        if (!confirm(`Delete agent "${agent.name}"?`)) {
            return;
        }

        if (!Chat.currentChatId) return;

        const chats = Storage.getChats();
        const chat = chats[Chat.currentChatId];

        chat.agents.splice(agentIndex, 1);

        Storage.saveChats(chats);
        this.closeAgentDropdown();
        this.updateAgentSelectorUI();
    },

    /**
     * Enable/disable message input during agent conversations
     */
    setInputEnabled(enabled, turnInfo = null) {
        if (UI.elements.messageInput) {
            UI.elements.messageInput.disabled = !enabled;

            if (enabled) {
                UI.elements.messageInput.placeholder = 'Type a message...';
            } else if (turnInfo) {
                UI.elements.messageInput.placeholder = `Turn ${turnInfo.turn}/${turnInfo.totalTurns} - ${turnInfo.agentName} responding...`;
            } else {
                UI.elements.messageInput.placeholder = 'Agents are conversing...';
            }
        }

        if (UI.elements.sendBtn) {
            UI.elements.sendBtn.disabled = !enabled;
        }
    }
};
