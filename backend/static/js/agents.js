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

    // Multi-agent document editing orchestration state
    isCollaborating: false,
    pendingEdits: [],           // Edits collected from all agents during collaboration
    originalDocumentHTML: null, // Document state before collaboration (for final diff)
    workingDocumentHTML: null,  // Current working state after waypoints
    collaborationLog: [],       // Log of changes for context summaries

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

        // Initialize turns if first agent
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

        const validTurns = Math.max(this.MIN_TURNS, Math.min(this.MAX_TURNS, turns));

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
     * Orchestrate multi-agent conversation
     * Called by Chat.sendMessage after user message is sent
     */
    async orchestrateAgentTurns(userMessage, agent1Edits = []) {
        // Build full agents list: Active system prompt (Agent 1) + Added agents (Agent 2+)
        const agents = [];

        // Agent 1: Active system prompt (if exists)
        const activePromptId = Storage.getActiveSystemPromptId();
        const systemPrompts = Storage.getSystemPrompts();

        let agent1 = null;
        if (activePromptId && systemPrompts[activePromptId]) {
            agent1 = {
                id: 'agent_active_prompt',
                name: systemPrompts[activePromptId].name || 'Assistant',
                systemPromptId: activePromptId,
                color: this.AGENT_COLORS[0]  // First color from palette
            };
            agents.push(agent1);
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

        if (agents.length === 0) {
            return; // No agents configured
        }

        if (agents.length === 1) {
            return; // Initial Claude response already handled single agent
        }

        // Check if we're in document editing collaboration mode
        const documentOpen = Documents && Documents.currentDocumentId;
        console.log(`[Collab] Document open: ${documentOpen}, Document ID: ${Documents?.currentDocumentId}`);

        if (documentOpen) {
            this.isCollaborating = true;
            this.pendingEdits = [];
            this.collaborationLog = [];
            console.log(`[Collab] Starting collaboration mode`);

            // Save original document state for final diff
            if (Documents.squireEditor) {
                this.originalDocumentHTML = Documents.squireEditor.getHTML();
                this.workingDocumentHTML = this.originalDocumentHTML;
                console.log(`[Collab] Saved original document: ${this.originalDocumentHTML.length} bytes`);
            } else {
                console.warn(`[Collab] No squire editor found!`);
            }

            // Add Agent 1's edits (passed from chat.js) with attribution
            console.log(`[Collab] Agent 1 edits received: ${agent1Edits ? agent1Edits.length : 0}`);
            if (agent1Edits && agent1Edits.length > 0 && agent1) {
                const attributedEdits = agent1Edits.map(edit => ({
                    ...edit,
                    agentId: agent1.id,
                    agentName: agent1.name,
                    agentColor: agent1.color
                }));
                this.pendingEdits.push(...attributedEdits);
                console.log(`[Collab] Collected ${agent1Edits.length} edits from ${agent1.name}`);

                // Apply Agent 1's edits to working document (first waypoint)
                this.applyWaypoint(agent1Edits, agent1);
            }
        } else {
            console.log(`[Collab] Document not open, skipping collaboration mode`);
        }

        // Disable input during agent conversation
        this.setInputEnabled(false);

        try {
            for (let turn = 1; turn <= turns; turn++) {
                for (let i = 0; i < agents.length; i++) {
                    // Skip Agent 1 on Turn 1 - initial Claude response already handled it
                    if (i === 0 && turn === 1) {
                        continue;
                    }

                    const agent = agents[i];

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
                        let agentSystemPrompt = systemPrompts[agent.systemPromptId]?.content || '';

                        // If document is open, add document context for this agent
                        let filesData = [];
                        if (this.isCollaborating && Documents && Documents.currentDocumentId) {
                            console.log(`[Collab] Adding document context for ${agent.name}`);
                            console.log(`[Collab] Collaboration log has ${this.collaborationLog.length} entries`);

                            // Get working document (with previous agents' edits applied)
                            const docFile = this.getWorkingDocumentAsFile();
                            if (docFile) {
                                filesData.push(docFile);
                                console.log(`[Collab] Document file attached: ${docFile.name} (${docFile.size} bytes)`);
                            } else {
                                console.warn(`[Collab] Failed to get working document file!`);
                            }

                            // Add document editing instructions with collaboration context
                            agentSystemPrompt = this.appendDocumentEditingInstructions(agentSystemPrompt, agent);
                            console.log(`[Collab] System prompt updated with doc editing instructions`);
                        } else {
                            console.log(`[Collab] NOT adding document context. isCollaborating=${this.isCollaborating}, docId=${Documents?.currentDocumentId}`);
                        }

                        // Call API with agent's context
                        const response = await API.sendMessage(
                            context.lastMessage,
                            context.history,
                            agentSystemPrompt,
                            filesData,
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

                                // Collect document edits if in collaboration mode
                                if (this.isCollaborating && Documents && Documents.currentDocumentId) {
                                    console.log(`[Collab] Parsing edits from ${agent.name}'s response...`);
                                    console.log(`[Collab] Response contains <document_edit>: ${fullResponse.includes('<document_edit>')}`);

                                    const changes = Documents.parseClaudeEditResponse(fullResponse);
                                    console.log(`[Collab] Parsed ${changes ? changes.length : 0} changes`);

                                    if (changes && changes.length > 0) {
                                        // Add agent attribution to each edit
                                        const attributedEdits = changes.map(edit => ({
                                            ...edit,
                                            agentId: agent.id,
                                            agentName: agent.name,
                                            agentColor: agent.color
                                        }));
                                        this.pendingEdits.push(...attributedEdits);
                                        console.log(`[Collab] Collected ${changes.length} edits from ${agent.name}. Total pending: ${this.pendingEdits.length}`);

                                        // Apply waypoint: update working document for next agent
                                        this.applyWaypoint(changes, agent);
                                    } else {
                                        console.log(`[Collab] No document edits found in ${agent.name}'s response`);
                                    }
                                }
                            }
                        }

                    } catch (error) {
                        console.error('Agent response error:', error);
                        UI.updateStreamingMessage(streamingBubble, 'Error: ' + error.message, true);
                    }
                }
            }

            // After all turns complete, finalize collaboration
            if (this.isCollaborating && this.pendingEdits.length > 0) {
                this.finalizeCollaboration();
            }
        } finally {
            // Re-enable input after conversation
            this.setInputEnabled(true);
            this.isCollaborating = false;
            // Note: collaboration state is cleaned up in finalizeCollaboration()
            // Only clean up here if finalization didn't happen (e.g., no edits)
            if (this.originalDocumentHTML) {
                this.cleanupCollaborationState();
            }
        }
    },

    /**
     * Finalize multi-agent document editing collaboration
     * Computes diff between original and final, presents for review
     */
    finalizeCollaboration() {
        console.log(`[Collab] Finalizing collaboration with ${this.pendingEdits.length} total edits from ${this.collaborationLog.length} agents`);
        console.log(`[Collab] Original doc: ${this.originalDocumentHTML ? this.originalDocumentHTML.length : 0} bytes`);
        console.log(`[Collab] Working doc: ${this.workingDocumentHTML ? this.workingDocumentHTML.length : 0} bytes`);
        console.log(`[Collab] Docs are different: ${this.originalDocumentHTML !== this.workingDocumentHTML}`);

        if (!this.originalDocumentHTML || !this.workingDocumentHTML) {
            console.warn('[Collab] Missing original or working document HTML');
            this.pendingEdits = [];
            return;
        }

        // Compute diff between original and final working document
        const diffChanges = this.computeDocumentDiff(this.originalDocumentHTML, this.workingDocumentHTML);

        if (diffChanges.length === 0) {
            Chat.addSystemMessage('Collaboration complete. No changes were made to the document.');
            this.cleanupCollaborationState();
            return;
        }

        // Add collaborative attribution to changes
        const attributedChanges = this.addCollaborativeAttribution(diffChanges);

        // Build summary of contributing agents
        const agentNames = this.collaborationLog.map(entry => entry.agentName);
        const uniqueAgents = [...new Set(agentNames)];
        const agentSummary = uniqueAgents.join(', ');

        // Present changes in review pane (respects auto-accept toggle)
        Documents.applyClaudeEdits(attributedChanges);

        Chat.addSystemMessage(
            `Collaboration complete. ${attributedChanges.length} change${attributedChanges.length !== 1 ? 's' : ''} proposed by ${uniqueAgents.length} agent${uniqueAgents.length !== 1 ? 's' : ''} (${agentSummary}). Review them in the editor.`
        );

        this.cleanupCollaborationState();
    },

    /**
     * Clean up collaboration state after finalization
     */
    cleanupCollaborationState() {
        this.pendingEdits = [];
        this.originalDocumentHTML = null;
        this.workingDocumentHTML = null;
        this.collaborationLog = [];
    },

    /**
     * Compute diff between original and final document
     * Returns change objects that transform original → final
     */
    computeDocumentDiff(originalHTML, finalHTML) {
        const changes = [];
        const changeId = () => `ch_collab_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // Parse both documents
        const originalDiv = document.createElement('div');
        originalDiv.innerHTML = originalHTML;
        const finalDiv = document.createElement('div');
        finalDiv.innerHTML = finalHTML;

        // Build maps of elements by data-edit-id
        const originalById = new Map();
        const finalById = new Map();

        originalDiv.querySelectorAll('[data-edit-id]').forEach(el => {
            originalById.set(el.dataset.editId, el);
        });
        finalDiv.querySelectorAll('[data-edit-id]').forEach(el => {
            finalById.set(el.dataset.editId, el);
        });

        // Find modified elements (same id, different content)
        originalById.forEach((originalEl, id) => {
            const finalEl = finalById.get(id);
            if (finalEl) {
                // Element exists in both - check if modified
                if (originalEl.outerHTML !== finalEl.outerHTML) {
                    changes.push({
                        id: changeId(),
                        type: 'modify',
                        targetId: id,
                        originalContent: originalEl.outerHTML,
                        newContent: finalEl.outerHTML,
                        status: 'pending'
                    });
                }
            } else {
                // Element deleted
                changes.push({
                    id: changeId(),
                    type: 'delete',
                    targetId: id,
                    originalContent: originalEl.outerHTML,
                    status: 'pending'
                });
            }
        });

        // Find added elements (in final but not in original)
        finalById.forEach((finalEl, id) => {
            if (!originalById.has(id)) {
                // New element - find anchor
                const prevSibling = finalEl.previousElementSibling;
                const nextSibling = finalEl.nextElementSibling;

                const change = {
                    id: changeId(),
                    type: 'add',
                    newContent: finalEl.outerHTML,
                    status: 'pending'
                };

                // Try to anchor to a known element
                if (prevSibling && prevSibling.dataset?.editId && originalById.has(prevSibling.dataset.editId)) {
                    change.insertAfter = originalById.get(prevSibling.dataset.editId).outerHTML;
                    change.anchorTargetId = prevSibling.dataset.editId;
                } else if (nextSibling && nextSibling.dataset?.editId && originalById.has(nextSibling.dataset.editId)) {
                    change.insertBefore = originalById.get(nextSibling.dataset.editId).outerHTML;
                    change.anchorTargetId = nextSibling.dataset.editId;
                }

                changes.push(change);
            }
        });

        console.log(`Computed ${changes.length} diff changes (${changes.filter(c => c.type === 'add').length} adds, ${changes.filter(c => c.type === 'modify').length} modifies, ${changes.filter(c => c.type === 'delete').length} deletes)`);

        return changes;
    },

    /**
     * Add collaborative attribution to diff changes
     * Marks which agent(s) contributed to each change
     */
    addCollaborativeAttribution(changes) {
        // For collaborative mode, use a blended color and note all contributors
        const contributingAgents = this.collaborationLog.map(entry => ({
            name: entry.agentName,
            color: entry.agentColor
        }));

        // Use first agent's color as primary, but note it's collaborative
        const primaryAgent = contributingAgents[0] || { name: 'Agents', color: '#8b5cf6' };

        return changes.map(change => ({
            ...change,
            agentId: 'collaborative',
            agentName: contributingAgents.length > 1
                ? `${contributingAgents.map(a => a.name).join(' + ')}`
                : primaryAgent.name,
            agentColor: primaryAgent.color,
            _collaborative: true,
            _contributingAgents: contributingAgents
        }));
    },

    /**
     * Merge edits from multiple agents
     * Auto-merges compatible edits, marks conflicts
     */
    mergeEdits(edits) {
        if (!edits || edits.length === 0) return [];

        // Group edits by target (targetId or originalContent)
        const editsByTarget = new Map();

        edits.forEach(edit => {
            const key = edit.targetId || this.computeEditKey(edit);
            if (!editsByTarget.has(key)) {
                editsByTarget.set(key, []);
            }
            editsByTarget.get(key).push(edit);
        });

        const merged = [];

        editsByTarget.forEach((targetEdits, key) => {
            if (targetEdits.length === 1) {
                // No conflict - single edit for this target
                merged.push(targetEdits[0]);
            } else {
                // Multiple edits for same target - try to auto-merge
                const resolution = this.resolveEditConflict(targetEdits);
                if (resolution.merged) {
                    merged.push(resolution.edit);
                } else {
                    // Cannot auto-merge - mark as conflict and include all
                    targetEdits.forEach((edit, idx) => {
                        merged.push({
                            ...edit,
                            _conflict: true,
                            _conflictGroup: key,
                            _conflictIndex: idx + 1,
                            _conflictTotal: targetEdits.length
                        });
                    });
                }
            }
        });

        return merged;
    },

    /**
     * Compute a key for an edit based on its content
     */
    computeEditKey(edit) {
        if (edit.originalContent) {
            // Normalize and hash the original content
            return 'content:' + this.normalizeContent(edit.originalContent);
        }
        if (edit.insertAfter) {
            return 'insertAfter:' + this.normalizeContent(edit.insertAfter);
        }
        if (edit.insertBefore) {
            return 'insertBefore:' + this.normalizeContent(edit.insertBefore);
        }
        // Fallback to unique ID
        return 'unique:' + edit.id;
    },

    /**
     * Normalize content for comparison
     */
    normalizeContent(content) {
        if (!content) return '';
        return content.toLowerCase().replace(/\s+/g, ' ').trim();
    },

    /**
     * Try to resolve a conflict between multiple edits on the same target
     */
    resolveEditConflict(edits) {
        // Strategy 1: Same result = no conflict
        if (this.editsProduceSameResult(edits)) {
            return { merged: true, edit: edits[0] };
        }

        // Strategy 2: Different types can coexist (e.g., add doesn't conflict with modify)
        const types = new Set(edits.map(e => e.type));
        if (types.size > 1 && !types.has('delete')) {
            // Different non-delete operations - include all
            return { merged: false };
        }

        // Strategy 3: If one is more recent, prefer it (based on array order = response order)
        // Last agent has the "final say" in pipeline mode
        // For now, prefer the last edit (most refined)
        return { merged: true, edit: edits[edits.length - 1] };
    },

    /**
     * Check if all edits produce the same result
     */
    editsProduceSameResult(edits) {
        if (edits.length < 2) return true;
        const first = this.normalizeContent(edits[0].newContent);
        return edits.every(e => this.normalizeContent(e.newContent) === first);
    },

    /**
     * Append document editing instructions to an agent's system prompt
     * Enables the agent to propose document edits using the same format as Agent 1
     */
    appendDocumentEditingInstructions(systemPrompt, agent) {
        // Build collaboration context summary
        let collaborationContext = '';
        if (this.collaborationLog.length > 0) {
            collaborationContext = `

PREVIOUS EDITS (already applied to the document you're seeing):
${this.collaborationLog.map(entry => `- ${entry.agentName}: ${entry.summary}`).join('\n')}

Build upon these changes. The document you see already includes them.`;
        }

        const documentEditingInstructions = `

DOCUMENT EDITING CAPABILITY:
You are collaborating with other agents to edit a document. The document HTML is provided as a file attachment.
${this.collaborationLog.length > 0 ? 'Previous agents have already made edits which are reflected in the document.' : 'You are the first to edit this document.'}
${collaborationContext}

EDIT FORMAT:
Wrap all edits in a single <document_edit> block. Use these change types:

1. ADD content:
   <change type="add" insertAfter="<element>..." OR insertBefore="<element>...">
   <new>[new HTML content]</new>
   </change>

2. DELETE content:
   <change type="delete">
   <original>[exact HTML to remove]</original>
   </change>

3. MODIFY content:
   <change type="modify">
   <original>[exact original HTML]</original>
   <new>[replacement HTML]</new>
   </change>

IMPORTANT:
- Match the EXACT HTML from the current document (including tags and attributes like data-edit-id)
- Use data-edit-id attributes for precise targeting when available:
  <change type="modify" targetId="e-abc123">...</change>
  <change type="add" insertAfter-id="e-abc123">...</change>
- Build upon previous agents' work - improve, refine, or add to their changes
- Keep edits focused and purposeful`;

        return systemPrompt ? systemPrompt + documentEditingInstructions : documentEditingInstructions;
    },

    /**
     * Get the working document (with waypoint edits applied) as a file attachment
     */
    getWorkingDocumentAsFile() {
        if (!this.workingDocumentHTML || !Documents || !Documents.currentDocumentId) {
            console.log('getWorkingDocumentAsFile: Missing working doc or document context');
            return null;
        }

        const currentDocument = Documents.documents[Documents.currentDocumentId];
        if (!currentDocument) {
            console.log('getWorkingDocumentAsFile: Current document not found');
            return null;
        }

        // Ensure element IDs are assigned to the working document
        let htmlWithIds = this.workingDocumentHTML;
        if (typeof ElementIds !== 'undefined') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.workingDocumentHTML;
            ElementIds.ensureIds(tempDiv);
            htmlWithIds = tempDiv.innerHTML;
            this.workingDocumentHTML = htmlWithIds; // Update stored HTML with IDs
        }

        const documentTitle = currentDocument.title || 'Untitled Document';
        const base64Content = btoa(unescape(encodeURIComponent(htmlWithIds)));

        console.log(`getWorkingDocumentAsFile: Returning ${htmlWithIds.length} bytes for "${documentTitle}"`);

        return {
            id: `doc_context_working_${currentDocument.id}`,
            name: documentTitle,
            type: 'text/html',
            size: htmlWithIds.length,
            data: `data:text/html;base64,${base64Content}`
        };
    },

    /**
     * Apply a waypoint: update working document with agent's edits
     * Creates a checkpoint that subsequent agents will build upon
     */
    applyWaypoint(edits, agent) {
        if (!edits || edits.length === 0 || !this.workingDocumentHTML) {
            return;
        }

        console.log(`Applying waypoint: ${edits.length} edits from ${agent.name}`);

        // Use ClaudeChanges to reconstruct the document with these edits
        // Mark all edits as accepted for reconstruction
        const acceptedEdits = edits.map(edit => ({
            ...edit,
            status: 'accepted'
        }));

        try {
            // Reconstruct document with edits applied
            const updatedHTML = ClaudeChanges.reconstructDocument(this.workingDocumentHTML, acceptedEdits);
            this.workingDocumentHTML = updatedHTML;

            // Generate summary for collaboration log
            const summary = this.generateEditSummary(edits);
            this.collaborationLog.push({
                agentId: agent.id,
                agentName: agent.name,
                agentColor: agent.color,
                editCount: edits.length,
                summary: summary
            });

            console.log(`Waypoint applied. Summary: ${summary}`);
        } catch (error) {
            console.error('Failed to apply waypoint:', error);
            // Continue without updating working document
        }
    },

    /**
     * Generate a brief summary of edits for collaboration context
     */
    generateEditSummary(edits) {
        const counts = { add: 0, delete: 0, modify: 0 };
        edits.forEach(edit => {
            if (counts[edit.type] !== undefined) {
                counts[edit.type]++;
            }
        });

        const parts = [];
        if (counts.add > 0) parts.push(`added ${counts.add} element${counts.add > 1 ? 's' : ''}`);
        if (counts.modify > 0) parts.push(`modified ${counts.modify} element${counts.modify > 1 ? 's' : ''}`);
        if (counts.delete > 0) parts.push(`deleted ${counts.delete} element${counts.delete > 1 ? 's' : ''}`);

        return parts.join(', ') || 'made changes';
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
    }
};
