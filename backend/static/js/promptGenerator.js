/**
 * System Prompt Generator Module
 * Handles AI-powered generation of system prompts from natural language descriptions
 */
const PromptGenerator = {
    state: {
        isGenerating: false,
        isCollapsed: false
    },

    /**
     * Initialize the prompt generator
     */
    init() {
        this.bindEvents();
        console.log('PromptGenerator initialized');
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Generate button
        const generateBtn = document.getElementById('generatePromptBtn');
        generateBtn?.addEventListener('click', () => {
            this.generatePrompt();
        });

        // Clear button
        const clearBtn = document.getElementById('clearDescriptionBtn');
        clearBtn?.addEventListener('click', () => {
            this.clearDescription();
        });

        // Collapse toggle
        const generatorHeader = document.getElementById('generatorHeader');
        generatorHeader?.addEventListener('click', () => {
            this.toggleCollapse();
        });

        // Keyboard shortcuts - Ctrl/Cmd+Enter to generate
        const descriptionInput = document.getElementById('promptDescriptionInput');
        descriptionInput?.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.generatePrompt();
            }
        });
    },

    /**
     * Generate system prompt from description
     */
    async generatePrompt() {
        const descriptionInput = document.getElementById('promptDescriptionInput');
        const generateBtn = document.getElementById('generatePromptBtn');
        const statusDiv = document.getElementById('generatorStatus');
        const textarea = document.getElementById('systemPromptTextarea');

        const description = descriptionInput?.value?.trim();

        if (!description) {
            this.showStatus('Please enter a description first.', 'error');
            return;
        }

        if (this.state.isGenerating) {
            return; // Prevent double-generation
        }

        try {
            this.state.isGenerating = true;
            generateBtn.disabled = true;
            generateBtn.textContent = '⏳ Generating...';
            this.showStatus('Generating your system prompt...', 'loading');

            // Call API to generate prompt and name
            const result = await this.callGenerationAPI(description);

            // Update the title field with generated name
            const titleInput = document.getElementById('editorTitle');
            if (titleInput && result.name) {
                titleInput.value = result.name;
                // Trigger save and sidebar update
                if (typeof SystemPrompts !== 'undefined' && SystemPrompts.saveName) {
                    SystemPrompts.saveName();
                }
            }

            // Insert prompt into textarea
            if (textarea) {
                textarea.value = result.prompt;
                // Trigger save through SystemPrompts module
                if (typeof SystemPrompts !== 'undefined' && SystemPrompts.saveContent) {
                    SystemPrompts.saveContent();
                }
            }

            this.showStatus('✓ System prompt generated successfully!', 'success');

            // Auto-hide status after 3 seconds
            setTimeout(() => {
                if (statusDiv) {
                    statusDiv.style.display = 'none';
                }
            }, 3000);

            // Clear description input
            if (descriptionInput) {
                descriptionInput.value = '';
            }

        } catch (error) {
            console.error('Prompt generation error:', error);
            this.showStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.state.isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.innerHTML = '✨ Generate';
        }
    },

    /**
     * Call the Anthropic API to generate a system prompt
     */
    async callGenerationAPI(description) {
        // Get API key from localStorage
        const apiKey = Storage.getApiKey();
        if (!apiKey) {
            throw new Error('API key not found. Please add your API key in Settings.');
        }

        // Build the meta-prompt for generating system prompts
        const generationSystemPrompt = `You are an expert at crafting system prompts for AI assistants. Given a user's description of what they want an AI agent to do, generate a clear, comprehensive, and well-structured system prompt.

Guidelines:
- Start with a clear role definition
- Include relevant expertise areas
- Specify the agent's communication style and tone
- Add any constraints or guidelines for behavior
- Be specific but concise (aim for 100-300 words)
- Use markdown formatting (headers, lists, bold) for clarity
- Focus on the "why" and "how" the agent should behave

IMPORTANT: First, generate a concise 1-3 word name for the agent wrapped in XML tags like this:
<agent_name>Name Here</agent_name>

Then on a new line, write the complete system prompt.`;

        const userMessage = `Create a system prompt for an AI agent with this description:\n\n"${description}"`;;

        // Get selected model
        const model = Storage.getSetting('model', 'claude-sonnet-4-5-20250929');

        // Call the /chat endpoint
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify({
                message: userMessage,
                history: [],
                systemPrompt: generationSystemPrompt,
                tools: undefined,
                files: undefined,
                model: model
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid API key. Please check your API key in Settings.');
            }
            throw new Error(`Generation failed with status ${response.status}`);
        }

        // Stream the response
        let generatedPrompt = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.chunk) {
                            generatedPrompt += data.chunk;
                        }
                        if (data.error) {
                            throw new Error(data.error);
                        }
                    } catch (parseError) {
                        // Skip invalid JSON lines
                        if (parseError.message.includes('Unexpected')) {
                            continue;
                        }
                        console.error('Parse error:', parseError);
                    }
                }
            }
        }

        if (!generatedPrompt) {
            throw new Error('No content generated');
        }

        // Extract agent name from XML tags
        let agentName = null;
        let cleanedPrompt = generatedPrompt;

        const nameMatch = generatedPrompt.match(/<agent_name>(.*?)<\/agent_name>/s);
        if (nameMatch) {
            agentName = nameMatch[1].trim();
            // Remove the XML tags and any surrounding whitespace from the prompt
            cleanedPrompt = generatedPrompt.replace(/<agent_name>.*?<\/agent_name>\s*/s, '').trim();
        }

        return {
            name: agentName,
            prompt: cleanedPrompt
        };
    },

    /**
     * Clear the description input
     */
    clearDescription() {
        const descriptionInput = document.getElementById('promptDescriptionInput');
        if (descriptionInput) {
            descriptionInput.value = '';
            descriptionInput.focus();
        }

        const statusDiv = document.getElementById('generatorStatus');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
    },

    /**
     * Show status message
     */
    showStatus(message, type) {
        const statusDiv = document.getElementById('generatorStatus');
        if (!statusDiv) return;

        statusDiv.textContent = message;
        statusDiv.className = `generator-status ${type}`;
        statusDiv.style.display = 'block';
    },

    /**
     * Toggle collapse state
     */
    toggleCollapse() {
        const content = document.getElementById('generatorContent');
        const icon = document.getElementById('generatorCollapse');

        if (!content || !icon) return;

        this.state.isCollapsed = !this.state.isCollapsed;

        if (this.state.isCollapsed) {
            content.classList.add('collapsed');
            icon.classList.add('collapsed');
        } else {
            content.classList.remove('collapsed');
            icon.classList.remove('collapsed');
        }
    }
};
