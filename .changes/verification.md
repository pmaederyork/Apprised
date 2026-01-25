https://youtu.be/tpALKvOdyPE

Apprised is an AI-powered document collaboration platform combining real-time chat with a rich text editor. Google Drive integration completes essential user workflows, allowing the import, editing and saving documents after they've been edited by agents. 
Core Workflow: User imports Drive file → AI agents (Writer/Editor/Critic) suggest edits → User reviews changes via visual diff → Saves enhanced document back to Drive with formatting/metadata intact 
Why Limited Scopes Fail:
drive.readonly: Cannot save edited documents back
drive.appdata: Only hidden app folder, not user documents
drive.metadata.readonly: Cannot read contents for editing
Scope: Required for user account association and document ownership tracking across devices. Privacy: Only access user-selected files via Drive picker. No background scanning. All actions user-initiated (Import/Save buttons).