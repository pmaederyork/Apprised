from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import models after db is defined to avoid circular imports
from .user import User
from .chat import Chat
from .document import Document
from .system_prompt import SystemPrompt
from .agent import Agent

__all__ = ['db', 'User', 'Chat', 'Document', 'SystemPrompt', 'Agent']
