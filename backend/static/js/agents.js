/**
 * Multi-Agent Chat Management
 * Handles adding, configuring, and orchestrating multiple AI agents in conversations
 */
const Agents = {
    initialized: false,
    MAX_AGENTS: 3,
    DEFAULT_TURNS: 1,
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
            this.updateTurns(parseInt(e.target.value));
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
                    <span class="agent-selector-text">${this.escapeHtml(agent.name)}</span>
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
                        ${promptArray.map(p => `<option value="${p.id}">${this.escapeHtml(p.name)}</option>`).join('')}
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

        // Auto-fill agent name when system prompt is selected
        document.getElementById('agentPrompt').addEventListener('change', (e) => {
            const promptId = e.target.value;
            const nameInput = document.getElementById('agentName');

            if (promptId && systemPrompts[promptId]) {
                nameInput.value = systemPrompts[promptId].name;
            }
        });

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
        console.log('➕ addAgent called');
        console.log('➕ Current chat ID:', Chat.currentChatId);
        console.log('➕ Agent name:', name);
        console.log('➕ System prompt ID:', systemPromptId);

        if (!Chat.currentChatId) {
            console.error('➕ ERROR: No current chat ID!');
            return;
        }

        const chats = Storage.getChats();
        const chat = chats[Chat.currentChatId];

        console.log('➕ Chat object before adding agent:', JSON.parse(JSON.stringify(chat)));

        if (!chat.agents) {
            console.log('➕ Initializing agents array');
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

        console.log('➕ New agent created:', newAgent);

        chat.agents.push(newAgent);

        console.log('➕ Chat object after adding agent:', JSON.parse(JSON.stringify(chat)));
        console.log('➕ Agents array now has', chat.agents.length, 'agents');

        // Initialize turns if first agent
        if (!chat.turns) {
            chat.turns = this.DEFAULT_TURNS;
        }

        Storage.saveChats(chats);
        console.log('➕ Chat saved to Storage');

        // Verify it was saved
        const verifyChats = Storage.getChats();
        const verifyChat = verifyChats[Chat.currentChatId];
        console.log('➕ VERIFICATION - Chat agents after save:', verifyChat.agents);

        this.updateAgentSelectorUI();

        console.log('✅ Agent added successfully:', newAgent);
    },

    /**
     * Update turns setting for current chat
     */
    updateTurns(turns) {
        if (!Chat.currentChatId) return;

        const validTurns = Math.max(this.MIN_TURNS, Math.min(this.MAX_TURNS, turns));

        const chats = Storage.getChats();
        const chat = chats[Chat.currentChatId];
        chat.turns = validTurns;

        Storage.saveChats(chats);
        console.log('Turns updated to:', validTurns);
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
                <span class="agent-name">${this.escapeHtml(agent.name)}</span>
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
                    <input type="text" id="editAgentName" value="${this.escapeHtml(agent.name)}" />
                </div>
                <div class="form-group">
                    <label for="editAgentPrompt">System Prompt:</label>
                    <select id="editAgentPrompt">
                        ${promptArray.map(p =>
                            `<option value="${p.id}" ${p.id === agent.systemPromptId ? 'selected' : ''}>
                                ${this.escapeHtml(p.name)}
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

        console.log('Agent updated:', chat.agents[agentIndex]);
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

        console.log('Agent deleted');
    },

    /**
     * Orchestrate multi-agent conversation
     * Called by Chat.sendMessage after user message is sent
     */
    async orchestrateAgentTurns(userMessage) {
        console.log('🤖 orchestrateAgentTurns called');
        console.log('🤖 User message:', userMessage);
        console.log('🤖 Chat.currentChatId:', Chat.currentChatId);

        // Build full agents list: Active system prompt (Agent 1) + Added agents (Agent 2+)
        const agents = [];

        // Agent 1: Active system prompt (if exists)
        const activePromptId = Storage.getActiveSystemPromptId();
        const systemPrompts = Storage.getSystemPrompts();

        if (activePromptId && systemPrompts[activePromptId]) {
            agents.push({
                id: 'agent_active_prompt',
                name: systemPrompts[activePromptId].name || 'Assistant',
                systemPromptId: activePromptId,
                color: this.AGENT_COLORS[0]  // First color from palette
            });
            console.log('🤖 Agent 1 (Active Prompt):', systemPrompts[activePromptId].name);
        }

        // Agent 2+: Added agents from chat
        const addedAgents = this.getCurrentAgents();

        // Re-assign colors to added agents to ensure unique colors across all agents
        const agentsWithUniqueColors = addedAgents.map((agent, index) => ({
            ...agent,
            color: this.AGENT_COLORS[(agents.length + index) % this.AGENT_COLORS.length]
        }));

        agents.push(...agentsWithUniqueColors);

        const turns = this.getCurrentTurns();

        console.log('🤖 Total agents in conversation:', agents.length);
        console.log('🤖 Agents:', agents.map(a => a.name));
        console.log('🤖 Turns configured:', turns);

        if (agents.length === 0) {
            console.warn('🤖 No agents configured - orchestration exiting');
            return; // No agents configured
        }

        if (agents.length === 1) {
            console.log('🤖 Only 1 agent - initial response already covered this, skipping orchestration');
            return; // Initial Claude response already handled single agent
        }

        // Disable input during agent conversation
        this.setInputEnabled(false);

        try {
            for (let turn = 1; turn <= turns; turn++) {
                console.log(`🤖 === Turn ${turn} of ${turns} ===`);

                for (let i = 0; i < agents.length; i++) {
                    // Skip Agent 1 on Turn 1 - initial Claude response already handled it
                    if (i === 0 && turn === 1) {
                        console.log(`🤖 Agent 1 (${agents[i].name}) - already responded as initial Claude`);
                        continue;
                    }

                    const agent = agents[i];
                    console.log(`🤖 Agent ${i + 1}/${agents.length}: ${agent.name}`);

                    // Update placeholder with progress
                    this.setInputEnabled(false, {
                        turn: turn,
                        totalTurns: turns,
                        agentName: agent.name
                    });

                    // Get context for this agent
                    // First agent after initial response uses user message, others use previous agent response
                    const isFirstInSequence = (i === 1 && turn === 1);
                    const context = this.buildAgentContext(agent, isFirstInSequence ? userMessage : null);

                    // Create streaming message bubble with agent badge
                    const streamingBubble = UI.addStreamingMessage(false, agent);

                    try {
                        // Get agent's system prompt
                        const systemPrompts = Storage.getSystemPrompts();
                        const systemPrompt = systemPrompts[agent.systemPromptId]?.content || '';

                        console.log(`🤖 System prompt for ${agent.name}:`, systemPrompt ? `Found (${systemPrompt.length} chars)` : 'MISSING!');
                        console.log(`🤖 Context for ${agent.name}:`, context);

                        // Call API with agent's context
                        const response = await API.sendMessage(
                            context.lastMessage,
                            context.history,
                            systemPrompt,
                            [], // No files for agent-to-agent
                            null // No screenshot for agent-to-agent
                        );

                        // Process streaming response
                        let fullResponse = '';
                        for await (const data of API.streamResponse(response)) {
                            if (data.error) {
                                throw new Error(data.error);
                            }

                            if (data.chunk) {
                                fullResponse += data.chunk;
                                UI.updateStreamingMessage(streamingBubble, fullResponse);
                            }

                            if (data.done) {
                                // Complete the streaming message
                                UI.updateStreamingMessage(streamingBubble, fullResponse, true);
                                // Save agent response to chat history
                                Chat.saveMessageToHistory(fullResponse, false, [], agent, turn);
                            }
                        }

                    } catch (error) {
                        console.error('Agent response error:', error);
                        UI.updateStreamingMessage(streamingBubble, 'Error: ' + error.message, true);
                    }
                }
            }
        } finally {
            // Re-enable input after conversation
            this.setInputEnabled(true);
        }
    },

    /**
     * Build context for an agent's API call
     * Returns summarized history + full previous response
     */
    buildAgentContext(agent, userMessage) {
        if (!Chat.currentChatId) {
            return { lastMessage: '', history: [] };
        }

        // Read from Chat.currentMessages (in-memory) instead of Storage
        // This ensures we see messages that were just added during orchestration
        const messages = Chat.getCurrentMessages();

        // If this is first agent responding to user, use user message
        if (userMessage) {
            return {
                lastMessage: userMessage,
                history: this.summarizeHistory(messages)
            };
        }

        // Get the last assistant message (from previous agent)
        const lastAssistantMessage = [...messages].reverse().find(m => !m.isUser);
        const lastMessage = lastAssistantMessage ? lastAssistantMessage.content : '';

        return {
            lastMessage: lastMessage,
            history: this.summarizeHistory(messages.slice(0, -1)) // Exclude last message
        };
    },

    /**
     * Summarize chat history for agent context
     * Takes last 10 messages and condenses them
     */
    summarizeHistory(messages) {
        const recentMessages = messages.slice(-10);

        return recentMessages.map(msg => ({
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.content.length > 500 ? msg.content.substring(0, 500) + '...' : msg.content
        }));
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
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
