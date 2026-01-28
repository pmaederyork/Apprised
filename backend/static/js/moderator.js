/**
 * Moderator Module - Multi-Agent Orchestration
 * Intercepts multi-agent messages, decides routing, delegates to agents, and produces final document edits
 */
const Moderator = {
    initialized: false,

    // Collaboration state (moved from agents.js)
    isCollaborating: false,
    pendingEdits: [],
    originalDocumentHTML: null,
    workingDocumentHTML: null,
    collaborationLog: [],

    // Moderator config
    MODERATOR_COLOR: '#6b7280', // Grey
    MODERATOR_NAME: 'Moderator',

    init() {
        if (this.initialized) return;
        this.initialized = true;
        console.log('Moderator module initialized');
    },

    /**
     * Main entry point - called from chat.js for multi-agent conversations
     * Intercepts the user message, decides routing, and orchestrates agents
     */
    async intercept(userMessage, filesData, screenshot) {
        const agents = Agents.getFullAgentsList();
        if (agents.length < 2) {
            console.log('[Moderator] Less than 2 agents, skipping moderation');
            return;
        }

        const documentOpen = Documents && Documents.currentDocumentId;
        console.log(`[Moderator] Intercepting message. Agents: ${agents.length}, Document open: ${documentOpen}`);

        // Disable input during moderation
        Agents.setInputEnabled(false);

        try {
            // Analyze user request
            const decision = await this.analyzeRequest(userMessage, documentOpen, agents);
            console.log(`[Moderator] Decision:`, decision);

            if (decision.action === 'direct') {
                // Handle formatting/simple edits directly
                await this.handleDirectEdit(userMessage, filesData);
            } else {
                // Delegate to agents - show friendly announcement first
                const turns = this.determineTurns(decision.turns);
                const agentNames = agents.map(a => a.name).join(' and ');

                // Show Moderator's announcement
                Chat.addSystemMessage(`Moderator: I'll have ${agentNames} collaborate on this. ${turns > 1 ? `They'll discuss for ${turns} rounds.` : ''}`);

                await this.delegateToAgents(userMessage, agents, turns, decision.agentTask, filesData);
            }
        } finally {
            Agents.setInputEnabled(true);
        }
    },

    /**
     * Analyze user request and decide how to handle it (silent - no UI)
     * Returns: { action: 'direct'|'delegate', turns?: number, agentTask?: string }
     */
    async analyzeRequest(userMessage, hasDocument, agents) {
        const agentNames = agents.map(a => a.name).join(', ');
        const turnsConfig = Agents.getCurrentTurns();

        // Check if there's prior chat history
        const messages = Chat.getCurrentMessages();
        const hasPriorChat = messages.length > 1;
        const priorChatSummary = hasPriorChat
            ? `There is prior conversation history (${messages.length - 1} previous messages) that agents can reference.`
            : 'This is the start of the conversation.';

        const moderatorPrompt = `You are a MODERATOR coordinating a team of AI agents: ${agentNames}.

Analyze the user's request and decide how to handle it:

1. DIRECT (you handle it yourself) - Use for:
   - Simple formatting changes (bold, italic, font size, alignment)
   - Synthesize/summarize existing chat and add to document (no new ideas needed)
   - Extract and compile information that's already been discussed

2. DELEGATE (agents collaborate) - Use for:
   - Generate NEW content or ideas
   - Creative work, brainstorming, or discussion
   - "Discuss then add" or "collaborate on" requests
   - Anything requiring multiple perspectives or new thinking

KEY DISTINCTION:
- "Synthesize this chat and add to doc" = DIRECT (you compile existing discussion)
- "Generate ideas about X then add to doc" = DELEGATE (agents create new content)
- "Discuss X and then add the results" = DELEGATE (agents need to collaborate first)

TURNS (only for delegate, when turnsConfig is auto):
- Default to 1 turn unless the task clearly needs discussion
- Use 2+ turns only if user explicitly wants collaboration/debate OR the task is complex enough to benefit from back-and-forth

Current state:
- Document open: ${hasDocument ? 'YES' : 'NO'}
- ${priorChatSummary}
- Agents available: ${agentNames}
- User's configured turns: ${turnsConfig === 'auto' ? 'Auto (default to 1 unless discussion needed)' : turnsConfig}

User's request: "${userMessage}"

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "action": "direct" or "delegate",
  "turns": <number, only if delegate and turnsConfig is auto - default 1>,
  "agentTask": "<what to tell agents, only if delegate>",
  "reasoning": "<brief explanation>"
}`;

        try {
            const systemPrompt = `You are a coordination moderator. Analyze requests and output JSON only.`;

            // Silent API call - no streaming to UI
            const response = await API.sendMessage(
                moderatorPrompt,
                [],
                systemPrompt,
                [],
                null
            );

            let fullResponse = '';
            for await (const data of API.streamResponse(response)) {
                if (data.error) {
                    throw new Error(data.error);
                }
                if (data.chunk) {
                    fullResponse += data.chunk;
                }
            }

            // Parse JSON from response
            const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const decision = JSON.parse(jsonMatch[0]);
                return {
                    action: decision.action || 'delegate',
                    turns: decision.turns,
                    agentTask: decision.agentTask || userMessage,
                    reasoning: decision.reasoning
                };
            }

            // Default to delegate if parsing fails
            return { action: 'delegate', agentTask: userMessage };

        } catch (error) {
            console.error('[Moderator] Analysis failed:', error);
            return { action: 'delegate', agentTask: userMessage };
        }
    },

    /**
     * Determine number of turns based on config and decision
     */
    determineTurns(decisionTurns) {
        const configTurns = Agents.getCurrentTurns();

        if (configTurns === 'auto') {
            // Use moderator's decision, default to 1
            return decisionTurns || 1;
        }

        // Use configured turns
        return parseInt(configTurns) || 1;
    },

    /**
     * Handle direct formatting edits without delegating to agents
     */
    async handleDirectEdit(userMessage, filesData) {
        console.log('[Moderator] Handling direct edit');

        // Get document context
        let docFile = null;
        if (Documents && Documents.currentDocumentId && Documents.squireEditor) {
            const currentDocument = Documents.documents[Documents.currentDocumentId];
            if (currentDocument) {
                const html = Documents.squireEditor.getHTML();
                const base64Content = btoa(unescape(encodeURIComponent(html)));
                docFile = {
                    id: `doc_context_${currentDocument.id}`,
                    name: currentDocument.title || 'Document',
                    type: 'text/html',
                    size: html.length,
                    data: `data:text/html;base64,${base64Content}`
                };
            }
        }

        const allFiles = docFile ? [...filesData, docFile] : filesData;

        // Get system prompt with document editing instructions
        const systemPrompts = Storage.getSystemPrompts();
        const activePromptId = Storage.getActiveSystemPromptId();
        let systemPrompt = activePromptId && systemPrompts[activePromptId] ?
            systemPrompts[activePromptId].content : '';

        // Add simplified document editing instructions for moderator
        systemPrompt = this.appendModeratorDocEditInstructions(systemPrompt);

        const moderatorAgent = {
            id: 'moderator',
            name: this.MODERATOR_NAME,
            color: this.MODERATOR_COLOR,
            isModerator: true
        };

        const streamingBubble = UI.addStreamingMessage(false, moderatorAgent);

        try {
            const response = await API.sendMessage(
                userMessage,
                Chat.getCurrentMessages(),
                systemPrompt,
                allFiles,
                null
            );

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
                    UI.updateStreamingMessage(streamingBubble, fullResponse, true);
                    Chat.saveMessageToHistory(fullResponse, false, [], moderatorAgent);

                    // Parse and apply document edits
                    if (Documents && Documents.currentDocumentId) {
                        const changes = Documents.parseClaudeEditResponse(fullResponse);
                        if (changes && changes.length > 0) {
                            // Add moderator attribution
                            const attributedChanges = changes.map(change => ({
                                ...change,
                                agentId: 'moderator',
                                agentName: this.MODERATOR_NAME,
                                agentColor: this.MODERATOR_COLOR
                            }));
                            Documents.applyClaudeEdits(attributedChanges);
                            Chat.addSystemMessage(`${changes.length} change${changes.length !== 1 ? 's' : ''} proposed. Review in the editor.`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[Moderator] Direct edit failed:', error);
            UI.updateStreamingMessage(streamingBubble, `Error: ${error.message}`, true);
        }
    },

    /**
     * Delegate task to agents for collaboration
     */
    async delegateToAgents(userMessage, agents, turns, agentTask, filesData) {
        console.log(`[Moderator] Delegating to ${agents.length} agents for ${turns} turns`);
        console.log(`[Moderator] Agent task: ${agentTask}`);

        // Check if we're in document editing collaboration mode
        const documentOpen = Documents && Documents.currentDocumentId;

        if (documentOpen) {
            this.isCollaborating = true;
            this.pendingEdits = [];
            this.collaborationLog = [];

            // Save original document state for final diff
            if (Documents.squireEditor) {
                if (typeof ElementIds !== 'undefined') {
                    ElementIds.ensureIds(Documents.squireEditor.getRoot());
                }
                this.originalDocumentHTML = Documents.squireEditor.getHTML();
                this.workingDocumentHTML = this.originalDocumentHTML;
                console.log(`[Moderator] Saved original document: ${this.originalDocumentHTML.length} bytes`);
            }
        }

        try {
            // Run through all agent turns
            for (let turn = 1; turn <= turns; turn++) {
                for (let i = 0; i < agents.length; i++) {
                    const agent = agents[i];

                    // Update placeholder with progress
                    Agents.setInputEnabled(false, {
                        turn: turn,
                        totalTurns: turns,
                        agentName: agent.name
                    });

                    // Build context for this agent
                    const isFirstAgent = (i === 0 && turn === 1);
                    const context = this.buildAgentContext(agent, isFirstAgent ? agentTask : null);

                    // Create streaming message bubble with agent badge
                    const streamingBubble = UI.addStreamingMessage(false, agent);

                    try {
                        // Get agent's system prompt
                        const systemPrompts = Storage.getSystemPrompts();
                        let agentSystemPrompt = systemPrompts[agent.systemPromptId]?.content || '';

                        // Inject multi-agent context with moderator awareness
                        agentSystemPrompt = this.appendAgentInstructions(
                            agentSystemPrompt,
                            agent,
                            agents,
                            turn,
                            i,
                            turns,
                            agentTask
                        );

                        // If document is open, add document context
                        let agentFiles = [...filesData];
                        if (this.isCollaborating && Documents && Documents.currentDocumentId) {
                            const docFile = this.getWorkingDocumentAsFile();
                            if (docFile) {
                                agentFiles.push(docFile);
                            }

                            agentSystemPrompt = this.appendDocumentEditingInstructions(agentSystemPrompt, agent);
                        }

                        // Call API with agent's context
                        const response = await API.sendMessage(
                            context.lastMessage,
                            context.history,
                            agentSystemPrompt,
                            agentFiles,
                            null
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
                                UI.updateStreamingMessage(streamingBubble, fullResponse, true);
                                Chat.saveMessageToHistory(fullResponse, false, [], agent, turn);

                                // Collect document edits if in collaboration mode
                                if (this.isCollaborating && Documents && Documents.currentDocumentId) {
                                    const changes = this.parseSimplifiedEdits(fullResponse);

                                    if (changes.length > 0) {
                                        const attributedEdits = changes.map(edit => ({
                                            ...edit,
                                            agentId: agent.id,
                                            agentName: agent.name,
                                            agentColor: agent.color
                                        }));
                                        this.pendingEdits.push(...attributedEdits);

                                        // Apply waypoint: update working document for next agent
                                        this.applyWaypoint(changes, agent);
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
            const docsAreDifferent = this.originalDocumentHTML !== this.workingDocumentHTML;
            if (this.isCollaborating && docsAreDifferent) {
                await this.finalizeCollaboration();
            } else if (this.isCollaborating) {
                Chat.addSystemMessage('Collaboration complete. No changes were made to the document.');
            }
        } finally {
            this.isCollaborating = false;
            if (this.originalDocumentHTML) {
                this.cleanupCollaborationState();
            }
        }
    },

    /**
     * Append agent instructions with moderator awareness
     */
    appendAgentInstructions(systemPrompt, currentAgent, allAgents, turn, agentIndex, totalTurns, agentTask) {
        if (allAgents.length < 2) {
            return systemPrompt;
        }

        const otherAgents = allAgents
            .filter((a, idx) => idx !== agentIndex)
            .map(a => a.name)
            .join(', ');

        // Determine previous speaker
        let previousSpeaker = 'the Moderator';
        if (turn === 1 && agentIndex === 0) {
            previousSpeaker = 'the Moderator';
        } else if (agentIndex > 0) {
            previousSpeaker = allAgents[agentIndex - 1].name;
        } else {
            previousSpeaker = allAgents[allAgents.length - 1].name;
        }

        // Check if there's prior chat history to reference
        const messages = Chat.getCurrentMessages();
        const hasPriorChat = messages.length > 1; // More than just the current user message

        const agentContext = `
You are ${currentAgent.name}, working under a MODERATOR who coordinates this conversation.

The Moderator has assigned this task: "${agentTask}"

You have ${totalTurns} round${totalTurns > 1 ? 's' : ''} to discuss with: ${otherAgents}.
This is round ${turn} of ${totalTurns}.
${previousSpeaker !== 'the Moderator' ? `You are responding to ${previousSpeaker}'s message.` : ''}
${hasPriorChat ? `
CONTEXT: You have access to the conversation history. If the task involves synthesizing, summarizing, or building on earlier discussion, USE that chat context as source material.` : ''}

RULES:
- Give one response as ${currentAgent.name}, then stop
- Focus on the assigned task
- Your work goes to a SCRATCHPAD that the Moderator will review
- The Moderator handles final document formatting
- End with a statement, not a question
- Stay on topic
- Keep your response conversational - do NOT paste raw HTML, XML, or scratchpad content into chat`;

        return systemPrompt ? agentContext + '\n\n' + systemPrompt : agentContext;
    },

    /**
     * Append document editing instructions for agents (simplified format)
     */
    appendDocumentEditingInstructions(systemPrompt, agent) {
        // Check if there's prior chat to synthesize from
        const messages = Chat.getCurrentMessages();
        const hasPriorChat = messages.length > 1;

        const documentEditingInstructions = `

COLLABORATIVE DOCUMENT EDITING:

You're working on a shared document with other agents. The attached "[SCRATCHPAD]" file shows the current working state.
${this.collaborationLog.length > 0 ? `
Previous agents' changes (in scratchpad, NOT yet shown to user):
${this.collaborationLog.map(entry => `- ${entry.agentName}: ${entry.summary}`).join('\n')}` : ''}
${hasPriorChat ? `
CHAT HISTORY AVAILABLE: You have access to the earlier conversation. If the task involves synthesizing, summarizing, or capturing discussion points, USE the chat history as your source material - extract key ideas, decisions, and content from previous messages.` : ''}

WHAT YOU CAN DO:
1. DISCUSS the document and previous agents' changes
2. BUILD ON their work with your own edits
3. EXPLAIN your reasoning so other agents understand
${hasPriorChat ? '4. SYNTHESIZE ideas from the chat history into document content' : ''}

TO MAKE EDITS, use this simplified format:

<edits>
  <edit action="modify" target="[data-edit-id]">new content here</edit>
  <edit action="delete" target="[data-edit-id]"/>
  <edit action="add" after="[data-edit-id]">new content here</edit>
</edits>

RULES:
- Copy data-edit-id values EXACTLY from the scratchpad (they are UUIDs like "a1b2c3d4-e5f6-7890-...")
- Keep HTML simple: <p>text</p>, <h2>heading</h2>, <ul><li>item</li></ul>
- To add at end of document, use the last element's data-edit-id as the "after" anchor
- Edits are OPTIONAL - you can just discuss without editing
- The Moderator will unify all changes for user review
- IMPORTANT: Do NOT display scratchpad content or <edits> XML in your response. Keep your chat message conversational - discuss ideas, not raw HTML or XML. The edits block should be separate from your discussion.`;

        return systemPrompt ? systemPrompt + documentEditingInstructions : documentEditingInstructions;
    },

    /**
     * Append moderator-specific document editing instructions
     * Uses the same full instructions as single agents for consistency
     */
    appendModeratorDocEditInstructions(systemPrompt) {
        // Use shared full document editing instructions (same as single agents)
        const instructions = DocumentEditingInstructions.getFull(true);
        return systemPrompt ? systemPrompt + instructions : instructions;
    },

    /**
     * Finalize multi-agent collaboration
     * Moderator produces unified edits from the scratchpad
     */
    async finalizeCollaboration() {
        console.log(`[Moderator] Finalizing collaboration with ${this.pendingEdits.length} edits`);

        if (!this.originalDocumentHTML || !this.workingDocumentHTML) {
            console.warn('[Moderator] Missing document HTML');
            this.pendingEdits = [];
            return;
        }

        if (this.originalDocumentHTML === this.workingDocumentHTML) {
            Chat.addSystemMessage('Collaboration complete. No changes were made to the document.');
            this.cleanupCollaborationState();
            return;
        }

        // Show preparing message
        Chat.addSystemMessage('Moderator is preparing final changes...');

        // Build summary of contributing agents
        const uniqueAgents = [...new Set(this.collaborationLog.map(e => e.agentName))];

        // Spawn orchestrator to produce unified edits
        const changes = await this.spawnOrchestratorAgent(
            this.originalDocumentHTML,
            this.workingDocumentHTML
        );

        if (!changes || changes.length === 0) {
            Chat.addSystemMessage('Collaboration complete. Could not produce unified changes.');
            this.cleanupCollaborationState();
            return;
        }

        // Add collaborative attribution
        const attributedChanges = this.addCollaborativeAttribution(changes);

        // Present changes in review pane
        Documents.applyClaudeEdits(attributedChanges);

        Chat.addSystemMessage(
            `Collaboration complete. ${attributedChanges.length} change${attributedChanges.length !== 1 ? 's' : ''} proposed by ${uniqueAgents.length} agent${uniqueAgents.length !== 1 ? 's' : ''} (${uniqueAgents.join(', ')}). Review in the editor.`
        );

        this.cleanupCollaborationState();
    },

    /**
     * Spawn orchestrator agent to produce unified document edits
     */
    async spawnOrchestratorAgent(originalHTML, finalHTML) {
        console.log('[Moderator/Orchestrator] Starting...');

        const orchestratorPrompt = `You are a document editing orchestrator. Compare ORIGINAL and FINAL documents and produce edit commands.

ORIGINAL DOCUMENT:
\`\`\`html
${originalHTML}
\`\`\`

FINAL DOCUMENT:
\`\`\`html
${finalHTML}
\`\`\`

CRITICAL RULES:
1. For targetId and insertAfter-id, use ONLY IDs from the ORIGINAL document
2. IDs that appear ONLY in the FINAL document (new content) CANNOT be used as anchors
3. Copy IDs EXACTLY as they appear - they are UUIDs

OUTPUT FORMAT - produce a <document_edit> block:

MODIFY:
<change type="modify" targetId="[ID from ORIGINAL]">
<original>[element from original]</original>
<new>[element from final]</new>
</change>

DELETE:
<change type="delete" targetId="[ID from ORIGINAL]">
<original>[element being removed]</original>
</change>

ADD (after an element - for content FOLLOWING a section):
<change type="add" insertAfter-id="[ID from ORIGINAL]">
<new>[new content - DO NOT include data-edit-id on new elements]</new>
</change>

ADD (before an element - for headers/content ABOVE a section):
<change type="add" insertBefore-id="[ID from ORIGINAL]">
<new>[new content - DO NOT include data-edit-id on new elements]</new>
</change>

POSITIONING GUIDANCE:
- Use insertBefore-id when adding headers or content that should appear ABOVE existing content
- Use insertAfter-id when adding content that should follow existing content
- For inserting at the VERY START of the document, use insertBefore-id with the FIRST element's ID
- For inserting at the END of the document, use insertAfter-id with the LAST element's ID

Output ONLY the <document_edit> block, no explanation:`;

        try {
            const systemPrompts = Storage.getSystemPrompts();
            const activePromptId = Storage.getActiveSystemPromptId();
            let systemPrompt = activePromptId && systemPrompts[activePromptId] ?
                systemPrompts[activePromptId].content : '';

            systemPrompt = `You are a document editing orchestrator. Output structured <document_edit> XML only.\n\n${systemPrompt}`;

            const response = await API.sendMessage(
                orchestratorPrompt,
                [],
                systemPrompt,
                [],
                null
            );

            let fullResponse = '';
            for await (const data of API.streamResponse(response)) {
                if (data.error) {
                    throw new Error(data.error);
                }

                if (data.chunk) {
                    fullResponse += data.chunk;
                }

                if (data.done) {
                    console.log('[Moderator/Orchestrator] Response complete');
                    const changes = Documents.parseClaudeEditResponse(fullResponse);
                    console.log(`[Moderator/Orchestrator] Parsed ${changes ? changes.length : 0} changes`);
                    return changes || [];
                }
            }

            return [];
        } catch (error) {
            console.error('[Moderator/Orchestrator] Failed:', error);
            return [];
        }
    },

    /**
     * Add collaborative attribution to changes
     */
    addCollaborativeAttribution(changes) {
        const seenNames = new Set();
        const contributingAgents = [];
        for (const entry of this.collaborationLog) {
            if (!seenNames.has(entry.agentName)) {
                seenNames.add(entry.agentName);
                contributingAgents.push({
                    name: entry.agentName,
                    color: entry.agentColor
                });
            }
        }

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
     * Build context for an agent's API call
     */
    buildAgentContext(agent, userMessage) {
        if (!Chat.currentChatId) {
            return { lastMessage: '', history: [] };
        }

        const messages = Chat.getCurrentMessages();

        if (userMessage) {
            return {
                lastMessage: userMessage,
                history: this.summarizeHistory(messages)
            };
        }

        const lastAssistantMessage = [...messages].reverse().find(m => !m.isUser);
        const lastMessage = lastAssistantMessage ? lastAssistantMessage.content : '';

        return {
            lastMessage: lastMessage,
            history: this.summarizeHistory(messages.slice(0, -1))
        };
    },

    /**
     * Summarize chat history for agent context
     * Preserves more content from recent messages for better synthesis
     */
    summarizeHistory(messages) {
        const recentMessages = messages.slice(-15); // Increased from 10 to 15

        return recentMessages.map((msg, index) => {
            // Keep more content from recent messages (last 5 get full content up to 2000 chars)
            // Older messages get truncated more aggressively
            const isRecent = index >= recentMessages.length - 5;
            const maxLength = isRecent ? 2000 : 800;

            return {
                role: msg.isUser ? 'user' : 'assistant',
                content: msg.content.length > maxLength
                    ? msg.content.substring(0, maxLength) + '...'
                    : msg.content,
                // Include agent info if available (helps with attribution during synthesis)
                ...(msg.agentName && { agentName: msg.agentName })
            };
        });
    },

    /**
     * Get working document as file attachment
     */
    getWorkingDocumentAsFile() {
        if (!this.workingDocumentHTML || !Documents || !Documents.currentDocumentId) {
            return null;
        }

        const currentDocument = Documents.documents[Documents.currentDocumentId];
        if (!currentDocument) {
            return null;
        }

        let htmlWithIds = this.workingDocumentHTML;
        if (typeof ElementIds !== 'undefined') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.workingDocumentHTML;
            ElementIds.ensureIds(tempDiv);
            htmlWithIds = tempDiv.innerHTML;
            this.workingDocumentHTML = htmlWithIds;
        }

        const documentTitle = currentDocument.title || 'Untitled Document';
        const base64Content = btoa(unescape(encodeURIComponent(htmlWithIds)));

        return {
            id: `doc_context_working_${currentDocument.id}`,
            name: `[SCRATCHPAD] ${documentTitle}`,
            type: 'text/html',
            size: htmlWithIds.length,
            data: `data:text/html;base64,${base64Content}`
        };
    },

    /**
     * Parse simplified <edits> format from agent response
     */
    parseSimplifiedEdits(response) {
        const edits = [];

        const editsMatch = response.match(/<edits>([\s\S]*?)<\/edits>/i);
        if (!editsMatch) {
            return edits;
        }

        const editsContent = editsMatch[1];
        const editRegex = /<edit\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/edit>)/gi;
        let match;

        while ((match = editRegex.exec(editsContent)) !== null) {
            const attributes = match[1];
            const content = match[2] || '';

            const actionMatch = attributes.match(/action\s*=\s*["']([^"']+)["']/i);
            const targetMatch = attributes.match(/target\s*=\s*["']([^"']+)["']/i);
            const afterMatch = attributes.match(/after\s*=\s*["']([^"']+)["']/i);
            const beforeMatch = attributes.match(/before\s*=\s*["']([^"']+)["']/i);

            const action = actionMatch ? actionMatch[1].toLowerCase() : null;

            if (!action) {
                console.warn('Edit missing action attribute:', match[0]);
                continue;
            }

            const edit = {
                action: action,
                target: targetMatch ? targetMatch[1] : null,
                after: afterMatch ? afterMatch[1] : null,
                before: beforeMatch ? beforeMatch[1] : null,
                content: content.trim()
            };

            if ((action === 'modify' || action === 'delete') && !edit.target) {
                console.warn('Modify/delete edit missing target:', match[0]);
                continue;
            }

            if (action === 'add' && !edit.after && !edit.before) {
                console.warn('Add edit missing after/before anchor:', match[0]);
                continue;
            }

            edits.push(edit);
        }

        console.log(`Parsed ${edits.length} simplified edits`);
        return edits;
    },

    /**
     * Apply simplified edits to HTML
     */
    applySimplifiedEdits(html, edits) {
        if (!edits || edits.length === 0) {
            return html;
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        for (const edit of edits) {
            try {
                if (edit.action === 'modify' && edit.target) {
                    const element = tempDiv.querySelector(`[data-edit-id="${edit.target}"]`);
                    if (element) {
                        const newContent = document.createElement('div');
                        newContent.innerHTML = edit.content;

                        if (newContent.children.length === 1) {
                            const newElement = newContent.children[0];
                            newElement.setAttribute('data-edit-id', edit.target);
                            element.replaceWith(newElement);
                        } else if (newContent.childNodes.length > 0) {
                            element.innerHTML = edit.content;
                        }
                    } else {
                        console.warn(`Could not find element with data-edit-id="${edit.target}" for modify`);
                    }

                } else if (edit.action === 'delete' && edit.target) {
                    const element = tempDiv.querySelector(`[data-edit-id="${edit.target}"]`);
                    if (element) {
                        element.remove();
                    } else {
                        console.warn(`Could not find element with data-edit-id="${edit.target}" for delete`);
                    }

                } else if (edit.action === 'add') {
                    const anchorId = edit.after || edit.before;
                    const anchorElement = tempDiv.querySelector(`[data-edit-id="${anchorId}"]`);

                    if (anchorElement) {
                        const newContent = document.createElement('div');
                        newContent.innerHTML = edit.content;

                        if (typeof ElementIds !== 'undefined') {
                            ElementIds.ensureIds(newContent);
                        }

                        const fragment = document.createDocumentFragment();
                        while (newContent.firstChild) {
                            fragment.appendChild(newContent.firstChild);
                        }

                        if (edit.after) {
                            anchorElement.after(fragment);
                        } else {
                            anchorElement.before(fragment);
                        }
                    } else {
                        console.warn(`Could not find anchor element with data-edit-id="${anchorId}" for add`);
                    }
                }
            } catch (error) {
                console.error(`Failed to apply edit:`, edit, error);
            }
        }

        return tempDiv.innerHTML;
    },

    /**
     * Apply a waypoint: update working document with agent's edits
     */
    applyWaypoint(edits, agent) {
        if (!edits || edits.length === 0 || !this.workingDocumentHTML) {
            return;
        }

        console.log(`Applying waypoint: ${edits.length} edits from ${agent.name}`);

        try {
            const updatedHTML = this.applySimplifiedEdits(this.workingDocumentHTML, edits);
            this.workingDocumentHTML = updatedHTML;

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
        }
    },

    /**
     * Generate a brief summary of edits
     */
    generateEditSummary(edits) {
        const counts = { add: 0, delete: 0, modify: 0 };
        edits.forEach(edit => {
            const action = edit.action || edit.type;
            if (counts[action] !== undefined) {
                counts[action]++;
            }
        });

        const parts = [];
        if (counts.add > 0) parts.push(`added ${counts.add} element${counts.add > 1 ? 's' : ''}`);
        if (counts.modify > 0) parts.push(`modified ${counts.modify} element${counts.modify > 1 ? 's' : ''}`);
        if (counts.delete > 0) parts.push(`deleted ${counts.delete} element${counts.delete > 1 ? 's' : ''}`);

        return parts.join(', ') || 'made changes';
    },

    /**
     * Clean up collaboration state
     */
    cleanupCollaborationState() {
        this.pendingEdits = [];
        this.originalDocumentHTML = null;
        this.workingDocumentHTML = null;
        this.collaborationLog = [];
    }
};
