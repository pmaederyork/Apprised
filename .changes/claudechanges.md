

🔴 CRITICAL CRASH CAUSES
1. Exponential Nested Loops in Document Reconstruction
File: claude-changes.js (Lines 126-238) The Problem:
acceptedChanges.forEach(change => {
    // For EACH change, search through ALL DOM nodes
    // using 4 different matching strategies
    findNodeBySignature() // Loops through all candidates
        → Strategy 1: Loop through nodes
        → Strategy 2: Loop through nodes AGAIN
        → Strategy 3: Loop through nodes AGAIN
        → Strategy 4: Loop through nodes AGAIN
});
Time Complexity: O(n²) to O(n³)
50 changes × 100 nodes × 4 strategies = 20,000 operations
200 changes × 500 nodes × 4 strategies = 400,000 operations ⚠️ CRASH
2. Repeated Full DOM Replacement on Every Accept/Reject
File: claude-changes.js (Lines 443-495, 516-568) The Problem: Every single accept/reject triggers:
Full document reconstruction
Complete innerHTML replacement (destroys ALL DOM nodes)
Re-rendering ALL remaining changes (creates new DOM nodes)
localStorage save
Impact: Accepting 100 changes = 100 full reconstructions + creating/destroying thousands of DOM nodes = memory exhaustion.
3. Memory Leak from Orphaned DOM Nodes
File: documents.js (Lines 1881-2015) The Problem:
// Only removes indicators, NOT wrapper divs
document.querySelectorAll('.claude-change-number').forEach(el => el.remove());

// Then creates NEW wrappers without proper cleanup
changes.forEach((change, index) => {
    const changeElement = document.createElement('div'); // NEW NODE
    const numberIndicator = document.createElement('span'); // NEW NODE
});
Old wrapper divs accumulate in memory because they're not explicitly removed before replacement.
4. Unbounded Cached Signature Growth
File: documents.js (Lines 1916-1990) The Problem:
change._cachedSignature = {
    innerHTML: originalNode.innerHTML || '', // Can be 1-5KB
    outerHTML: originalNode.outerHTML || ''  // Can be 5-10KB
};
Memory Usage:
200 changes × 10KB cached HTML = 2MB in memory
Plus the original changes object = 3-4MB total
Exceeds browser memory limits for single objects
5. Synchronous localStorage Blocking Main Thread
File: claude-changes.js (Lines 478-483) The Problem:
// SYNCHRONOUS operation on every accept/reject
Storage.saveClaudeChanges(this.documentId, {
    changes: this.changes // Serializes entire array to JSON
});
Impact:
Serializing 200 changes with cached signatures = 50-100ms blocked thread
Accepting 100 changes sequentially = 5-10 seconds of frozen UI
Browser marks tab as unresponsive
6. Quadruple Content Matching with Expensive Regex
File: documents.js (Lines 2044-2117) The Problem:
// Each match attempt performs regex replacements on HTML strings
normalizeHTML(node.innerHTML)  // Strategy 1
normalizeHTML(node.outerHTML)  // Strategy 2
normalizeHTML(node.outerHTML, true)  // Strategy 3
// Plus recursive tree traversal // Strategy 4
Impact: 200 changes × 100 nodes × 4 strategies = 80,000 regex operations
CRASH SEQUENCE
When user accepts many changes:
CPU Spike → Nested loops consume 100% CPU for seconds
Memory Churn → Thousands of DOM nodes created/destroyed rapidly
Main Thread Blocking → localStorage writes freeze UI
Memory Exhaustion → Cached signatures + orphaned nodes exceed limits
Browser Crash → Tab/browser becomes unresponsive
PROPOSED SOLUTIONS
I recommend implementing these fixes in priority order:
Phase 1: Critical Fixes (Prevent Crashes)
Batch Accept/Reject Operations
Replace per-change reconstruction with single batch operation
Only reconstruct once after all changes processed
Estimated Impact: 100x performance improvement
Remove Cached Signature Storage
Store lightweight hash/fingerprint instead of full HTML
Use only textContent + tagName for matching
Estimated Impact: Reduce memory usage by 80%
Debounce localStorage Writes
Queue changes and write once after 500ms inactivity
Use requestIdleCallback for background serialization
Estimated Impact: Eliminate UI freezing
Phase 2: Performance Optimizations
Cache Normalized HTML
Compute normalized signatures once, reuse across searches
Clear cache after reconstruction completes
Estimated Impact: Reduce regex operations by 75%
DOM Node Cleanup
Explicitly remove old wrapper divs before creating new ones
Use DocumentFragment for batch insertions
Estimated Impact: Prevent memory leaks
Add Progress Indicators
Show "Processing changes..." modal for >50 changes
Break operations into chunks with setTimeout()
Estimated Impact: Better UX, prevents browser timeout
Phase 3: User Protection
Add Change Limits
Warn if >100 changes detected
Suggest breaking edits into smaller batches
Add "Accept Next 25" button for large sets


The crashes aren't primarily from the Claude Changes review system itself - they happen BEFORE the user even gets to the review stage:
🔴 PRIMARY CULPRIT: Massive Document Editing Instructions
The Issue:
When a document is open, the system injects 341 lines (~30KB) of editing instructions into EVERY chat message
Generic requests like "revise document to align with XYZ" trigger Claude to generate 100-200 changes
Response becomes 50-100KB+ of XML
Browser crashes during streaming/parsing
🔴 SECONDARY CULPRIT: No Response Size Protection
The Issue:
api.js streams responses with no size limits
fullResponse string accumulates unbounded in memory
Large responses (100+ changes) crash the browser before parsing even begins
🔴 TERTIARY CULPRIT: Blocking Synchronous Parsing
The Issue:
parseClaudeEditResponse() uses regex loops on potentially 200+ changes
Runs synchronously, blocking UI thread for 10+ seconds
Browser shows "Page Unresponsive" dialog
🔴 QUATERNARY CULPRIT: localStorage Quota Exhaustion
The Issue:
Long chats with document edits accumulate massive history
No size checking before saving
Exceeds 5MB localStorage limit
Silent failures or crashes
PROPOSED IMPLEMENTATION PLAN
Claude’s Plan
Fix Claude Changes Crash Issues
Phase 1: Critical Crash Prevention (30-45 min)
1. Add Response Size Limits (api.js)
Add 500KB response size cap in streaming handler
Track accumulated bytes during streaming
Throw user-friendly error if exceeded
Impact: Prevents 90% of "generic edit request" crashes
2. Limit Change Count in Instructions (chat.js)
Add explicit instruction: "Maximum 20 changes per response"
Guide Claude to break large edits into rounds
Impact: Prevents oversized responses from being generated
3. Make Change Parsing Async (documents.js)
Batch parse changes with setTimeout() every 20 changes
Show "Processing changes..." progress indicator
Yield to event loop to prevent UI freezing
Impact: Prevents browser "Page Unresponsive" dialogs
Phase 2: Performance & Stability (45-60 min)
4. Add localStorage Size Monitoring (storage.js)
Check available quota before saving
Show warning at 80% capacity
Auto-archive old chats if needed
Impact: Prevents silent failures in long sessions
5. Optimize Document Instructions (chat.js)
Reduce from 341 lines to ~80 lines
Remove redundant examples
Keep concise syntax reference only
Impact: Reduces every request payload by ~20KB
6. Batch Change Rendering (documents.js)
Render changes in batches of 10 using requestAnimationFrame
Show progress overlay for >30 changes
Impact: Prevents memory churn from DOM manipulation
Phase 3: User Protection (15-20 min)
7. Add Change Count Warnings (documents.js)
Detect when >50 changes parsed
Show warning: "Large change set detected. Review may be slow."
Offer "Accept Next 20" button for batch operations
Files to Modify:
backend/static/js/api.js (streaming + size limits)
backend/static/js/chat.js (instruction optimization)
backend/static/js/documents.js (async parsing + batched rendering)
backend/static/js/storage.js (quota monitoring)
backend/static/css/editor-changes.css (progress indicator styling)