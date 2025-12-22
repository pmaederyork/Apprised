/**
 * API communication utilities
 */
const API = {
    currentAbortController: null,
    
    async sendMessage(message, history, systemPrompt, files = [], screenshotData = null) {
        // Check if API key is available before making request
        const hasApiKey = await Settings.checkApiKeyBeforeRequest();
        if (!hasApiKey) {
            throw new Error('API key required');
        }

        // Create new AbortController for this request
        this.currentAbortController = new AbortController();

        // Get tools configuration
        const tools = Tools.getToolsConfig();

        // Get API key for request
        const apiKey = await Settings.getApiKeyForRequest();

        // Prepare message content - include screenshot if present
        let messageContent = message;
        if (screenshotData) {
            messageContent = [
                { type: "text", text: message },
                {
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: "image/jpeg",
                        data: screenshotData.split(',')[1] // Remove data:image/jpeg;base64, prefix
                    }
                }
            ];
        }

        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
        };

        const response = await fetch('/chat', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ 
                message: messageContent,
                history: history.slice(-10), // Send last 10 messages for context (text only)
                systemPrompt: systemPrompt,
                tools: tools.length > 0 ? tools : undefined,
                files: files.length > 0 ? files : undefined
            }),
            signal: this.currentAbortController.signal
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid API key. Please check your API key in Settings.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
    },

    interrupt() {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
    },

    async *streamResponse(response) {
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
                        yield data;
                    } catch (parseError) {
                        console.error('Parse error:', parseError);
                    }
                }
            }
        }
    }
};