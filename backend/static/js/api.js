/**
 * API communication utilities
 */
const API = {
    async sendMessage(message, history, systemPrompt, files = []) {
        // Check if API key is available before making request
        if (!Settings.checkApiKeyBeforeRequest()) {
            throw new Error('API key required');
        }

        // Get tools configuration
        const tools = Tools.getToolsConfig();
        
        // Get API key for request
        const apiKey = Settings.getApiKeyForRequest();
        
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify({ 
                message: message,
                history: history.slice(-10), // Send last 10 messages for context
                systemPrompt: systemPrompt,
                tools: tools.length > 0 ? tools : undefined,
                files: files.length > 0 ? files : undefined
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid API key. Please check your API key in Settings.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
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