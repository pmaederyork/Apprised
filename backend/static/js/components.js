/**
 * Reusable UI components
 */
const Components = {
    // Create a sidebar list item with actions
    createListItem(config) {
        const { 
            text, 
            isActive = false, 
            actions = [], 
            onClick, 
            onNameEdit,
            className = 'item',
            maxLength = 30 
        } = config;

        const item = document.createElement('div');
        item.className = `${className} ${isActive ? 'active' : ''}`;
        
        const content = document.createElement('div');
        content.className = `${className}-content`;
        
        const textSpan = document.createElement('span');
        textSpan.textContent = text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
        textSpan.style.flex = '1';
        textSpan.style.overflow = 'hidden';
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = `${className}-actions`;
        
        // Create action buttons
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = `${className}-action-btn`;
            
            // Special handling for "Use" button
            if (action.isUseButton) {
                btn.classList.add('use-btn');
                if (action.isActive) {
                    btn.classList.add('active');
                }
            }
            
            btn.innerHTML = action.icon;
            btn.title = action.title;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                action.onClick();
            });
            actionsDiv.appendChild(btn);
        });
        
        content.appendChild(textSpan);
        item.appendChild(content);
        item.appendChild(actionsDiv);
        
        if (onClick) {
            item.addEventListener('click', onClick);
        }
        
        // Add double-click to edit functionality
        if (onNameEdit) {
            textSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.startInlineEdit(textSpan, text, onNameEdit);
            });
        }
        
        return item;
    },

    // Create a collapsible section
    createCollapsibleSection(config) {
        const { title, isCollapsed = false, onToggle, actions = [] } = config;

        const section = document.createElement('div');
        section.className = 'collapsible-section';

        const header = document.createElement('div');
        header.className = 'section-header';
        
        const titleContainer = document.createElement('div');
        titleContainer.style.display = 'flex';
        titleContainer.style.alignItems = 'center';
        titleContainer.style.gap = '8px';
        
        const icon = document.createElement('span');
        icon.className = `collapse-icon ${isCollapsed ? 'collapsed' : ''}`;
        icon.textContent = '▼';
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'section-title';
        titleSpan.style.margin = '0';
        titleSpan.textContent = title;
        
        titleContainer.appendChild(icon);
        titleContainer.appendChild(titleSpan);
        
        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '8px';
        
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = action.className || 'btn';
            btn.innerHTML = action.icon;
            btn.title = action.title;
            btn.addEventListener('click', action.onClick);
            actionsDiv.appendChild(btn);
        });
        
        header.appendChild(titleContainer);
        header.appendChild(actionsDiv);
        
        const content = document.createElement('div');
        content.className = `section-content ${isCollapsed ? 'collapsed' : ''}`;
        
        header.addEventListener('click', () => {
            const isCurrentlyCollapsed = content.classList.contains('collapsed');
            content.classList.toggle('collapsed');
            icon.classList.toggle('collapsed');
            if (onToggle) {
                onToggle(!isCurrentlyCollapsed);
            }
        });
        
        section.appendChild(header);
        section.appendChild(content);
        
        return { section, content };
    },

    // Create action button
    createActionButton(config) {
        const { icon, title, className = 'btn', onClick } = config;
        
        const btn = document.createElement('button');
        btn.className = className;
        btn.innerHTML = icon;
        btn.title = title;
        
        if (onClick) {
            btn.addEventListener('click', onClick);
        }
        
        return btn;
    },

    // Start inline editing for list item names
    startInlineEdit(textSpan, originalText, onNameEdit) {
        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalText;
        input.className = 'inline-edit-input';
        
        // Replace span with input
        textSpan.style.display = 'none';
        textSpan.parentNode.insertBefore(input, textSpan);
        
        // Focus and select all text
        input.focus();
        input.select();
        
        // Save function
        const saveEdit = () => {
            const newName = input.value.trim() || originalText || 'Untitled';
            
            // Update text span
            textSpan.textContent = newName.length > 30 ? newName.substring(0, 27) + '...' : newName;
            
            // Replace input with span
            input.remove();
            textSpan.style.display = '';
            
            // Call the edit callback with the new name
            if (onNameEdit && newName !== originalText) {
                onNameEdit(newName);
            }
        };
        
        // Cancel function
        const cancelEdit = () => {
            // Replace input with span (keep original text)
            input.remove();
            textSpan.style.display = '';
        };
        
        // Event handlers
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
        
        input.addEventListener('blur', saveEdit);
    }
};