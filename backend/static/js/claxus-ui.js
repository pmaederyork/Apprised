/**
 * Claxus UI rendering utilities
 * Creates visual elements for tool indicators, agent badges, confirmations, etc.
 */
const ClaxusUI = {
    statusElement: null,

    // Tool icon mapping
    TOOL_ICONS: {
        'mcp__claxus__delegate': ['→', 'Delegating'],
        'mcp__browser': ['⊞', 'Browsing'],
        'mcp__filesystem': ['📁', 'File System'],
        'Bash': ['$', 'Terminal'],
        'Read': ['📖', 'Reading'],
        'Write': ['✎', 'Writing'],
        'Grep': ['🔍', 'Searching'],
        'WebSearch': ['🌐', 'Web Search'],
        'WebFetch': ['⬇', 'Fetching'],
        'default': ['🔧', 'Tool']
    },

    /**
     * Create tool use indicator
     */
    createToolIndicator(toolName, toolInput, options = {}) {
        const div = document.createElement('div');
        div.className = options.replay ? 'claxus-tool-indicator' : 'claxus-tool-indicator claxus-working';

        const [icon, displayName] = this.resolveToolName(toolName);
        const description = this.describeToolInput(toolName, toolInput);

        const spinner = options.replay ? '' : '<span class="claxus-spinner"></span>';
        div.innerHTML = `${spinner}<span class="tool-icon">${icon}</span> <strong>${displayName}</strong> ${description ? `› ${description}` : ''}`;

        return div;
    },

    /**
     * Create tool status indicator
     */
    createToolStatusIndicator(content) {
        const div = document.createElement('div');
        div.className = 'claxus-tool-status';
        div.textContent = content;
        return div;
    },

    /**
     * Create agent badge
     */
    createAgentBadge(agentType, options = {}) {
        const span = document.createElement('span');
        span.className = options.replay ? 'claxus-agent-badge' : 'claxus-agent-badge claxus-working';
        const spinner = options.replay ? '' : '<span class="claxus-spinner"></span>';
        span.innerHTML = `${spinner}${agentType} Agent`;
        return span;
    },

    /**
     * Create routing indicator
     */
    createRoutingIndicator(agent, confidence, options = {}) {
        const div = document.createElement('div');
        div.className = options.replay ? 'claxus-routing' : 'claxus-routing claxus-working';

        const confidencePercent = Math.round((confidence || 0) * 100);
        const spinner = options.replay ? '' : '<span class="claxus-spinner"></span>';
        div.innerHTML = `${spinner}→ <strong>${agent}</strong> <span class="confidence">(${confidencePercent}%)</span>`;

        return div;
    },

    /**
     * Create completion badge
     */
    createCompletionBadge(durationMs, success = true) {
        const span = document.createElement('span');
        span.className = success ? 'claxus-completion' : 'claxus-completion error';

        const icon = success ? '✓' : '✗';
        const duration = this.formatDuration(durationMs);

        span.textContent = `${icon} ${duration}`;

        return span;
    },

    /**
     * Create context stats display
     */
    createContextStatsDisplay(stats) {
        const div = document.createElement('div');
        div.className = 'claxus-context-stats';

        const inputTokens = stats.input_tokens || 0;
        const outputTokens = stats.output_tokens || 0;
        const totalTokens = inputTokens + outputTokens;

        div.innerHTML = `
            <div class="stats-label">Tokens:</div>
            <div class="stats-bar">
                <div class="stats-input" style="width: ${(inputTokens / totalTokens * 100)}%"></div>
                <div class="stats-output" style="width: ${(outputTokens / totalTokens * 100)}%"></div>
            </div>
            <div class="stats-text">${inputTokens} in / ${outputTokens} out</div>
        `;

        return div;
    },

    /**
     * Create confirmation dialog
     */
    createConfirmationDialog(data) {
        const card = document.createElement('div');
        card.className = 'claxus-confirmation';
        card.setAttribute('data-confirmation-id', data.confirmation_id);

        const header = document.createElement('div');
        header.className = 'confirmation-header';
        header.textContent = data.action_type || 'Confirmation Required';

        const summary = document.createElement('div');
        summary.className = 'confirmation-summary';
        summary.textContent = data.summary || 'Please approve or deny this action';

        const actions = document.createElement('div');
        actions.className = 'claxus-confirmation-actions';

        const approveBtn = document.createElement('button');
        approveBtn.className = 'confirm-approve';
        approveBtn.textContent = 'Approve';
        approveBtn.addEventListener('click', () => {
            if (timeoutId) clearTimeout(timeoutId);
            Claxus.sendConfirmation(data.confirmation_id, true);
            approveBtn.disabled = true;
            denyBtn.disabled = true;
            statusText.textContent = 'Approved';
            statusText.style.color = '#10b981';
        });

        const denyBtn = document.createElement('button');
        denyBtn.className = 'confirm-deny';
        denyBtn.textContent = 'Deny';
        denyBtn.addEventListener('click', () => {
            if (timeoutId) clearTimeout(timeoutId);
            Claxus.sendConfirmation(data.confirmation_id, false);
            approveBtn.disabled = true;
            denyBtn.disabled = true;
            statusText.textContent = 'Denied';
            statusText.style.color = '#ef4444';
        });

        const statusText = document.createElement('span');
        statusText.className = 'confirmation-status';

        actions.appendChild(approveBtn);
        actions.appendChild(denyBtn);
        actions.appendChild(statusText);

        card.appendChild(header);
        card.appendChild(summary);

        // Add preview if present
        if (data.preview) {
            const preview = document.createElement('div');
            preview.className = 'confirmation-preview';
            preview.textContent = data.preview;
            card.appendChild(preview);
        }

        card.appendChild(actions);

        // Handle timeout if specified
        let timeoutId = null;
        if (data.timeout_seconds && data.timeout_seconds > 0) {
            timeoutId = setTimeout(() => {
                approveBtn.disabled = true;
                denyBtn.disabled = true;
                statusText.textContent = 'Timed out';
                statusText.style.color = '#6b7280';
                card.classList.add('timed-out');
            }, data.timeout_seconds * 1000);
        }

        return card;
    },

    /**
     * Remove spinners from all working indicators
     */
    clearSpinners() {
        document.querySelectorAll('.claxus-working').forEach(el => {
            el.classList.remove('claxus-working');
            const spinner = el.querySelector('.claxus-spinner');
            if (spinner) spinner.remove();
        });
    },

    /**
     * Create interrupted indicator
     */
    createInterruptedIndicator() {
        const div = document.createElement('div');
        div.className = 'claxus-interrupted';
        div.textContent = 'Interrupted';
        return div;
    },

    /**
     * Show status line at bottom of chat
     */
    showStatus(text) {
        if (!this.statusElement) {
            this.statusElement = document.createElement('div');
            this.statusElement.className = 'claxus-status-line';
            this.statusElement.innerHTML = `
                <span class="status-text">${text}</span>
                <span class="claxus-status-dots">
                    <span>.</span><span>.</span><span>.</span>
                </span>
            `;

            if (UI.elements.chatMessages) {
                UI.elements.chatMessages.appendChild(this.statusElement);
                UI.autoScroll();
            }
        } else {
            const textEl = this.statusElement.querySelector('.status-text');
            if (textEl) {
                textEl.textContent = text;
            }
        }
    },

    /**
     * Hide status line
     */
    hideStatus() {
        if (this.statusElement && this.statusElement.parentNode) {
            this.statusElement.remove();
            this.statusElement = null;
        }
    },

    /**
     * Format duration in milliseconds to human readable
     */
    formatDuration(ms) {
        if (!ms || ms < 0) return '0s';

        if (ms < 1000) {
            return `${ms}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        } else {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
        }
    },

    /**
     * Resolve tool name to icon and display name
     */
    resolveToolName(toolName) {
        return this.TOOL_ICONS[toolName] || this.TOOL_ICONS.default;
    },

    /**
     * Describe tool input for display
     */
    describeToolInput(toolName, toolInput) {
        if (!toolInput) return '';

        try {
            const input = typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput;

            // Extract meaningful summaries based on tool type
            switch (toolName) {
                case 'Bash':
                    return input.command ? this.truncate(input.command, 50) : '';
                case 'Read':
                case 'Write':
                    return input.file_path ? this.truncate(input.file_path, 50) : '';
                case 'Grep':
                    return input.pattern ? `"${this.truncate(input.pattern, 30)}"` : '';
                case 'WebSearch':
                    return input.query ? this.truncate(input.query, 40) : '';
                case 'WebFetch':
                    return input.url ? this.truncate(input.url, 40) : '';
                default:
                    // Generic: try to extract any string value
                    const values = Object.values(input).filter(v => typeof v === 'string');
                    return values.length > 0 ? this.truncate(values[0], 40) : '';
            }
        } catch (error) {
            // If parsing fails, just truncate the raw input
            return this.truncate(String(toolInput), 40);
        }
    },

    /**
     * Truncate text with ellipsis
     */
    truncate(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    },

    // ===== File Browser Helpers =====

    /**
     * Create a file/directory list item
     */
    createFileItem(entry, onClick) {
        const div = document.createElement('div');
        div.className = 'claxus-file-item';

        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = entry.type === 'directory' ? '\uD83D\uDCC1' : '\uD83D\uDCC4';

        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = entry.name;

        div.appendChild(icon);
        div.appendChild(name);

        if (entry.size !== undefined && entry.type !== 'directory') {
            const size = document.createElement('span');
            size.className = 'file-size';
            size.textContent = this.formatFileSize(entry.size);
            div.appendChild(size);
        }

        if (onClick) {
            div.addEventListener('click', onClick);
        }

        return div;
    },

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
};
