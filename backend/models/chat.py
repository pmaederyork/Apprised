from . import db
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime, timezone


class Chat(db.Model):
    __tablename__ = 'chats'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    client_id = db.Column(db.String(255), nullable=False)  # Original localStorage ID (chat_xxx)

    title = db.Column(db.String(500), default='New Chat')
    messages = db.Column(JSONB, nullable=False, default=list)  # Array of message objects
    agents = db.Column(JSONB, default=list)  # Array of agent configs for this chat
    turns = db.Column(db.String(50), default='auto')

    created_at = db.Column(db.BigInteger, nullable=False)  # Unix timestamp (matches frontend)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('user_id', 'client_id', name='uq_chat_user_client'),
        db.Index('ix_chats_user_created', 'user_id', 'created_at'),
    )

    def to_dict(self):
        return {
            'client_id': self.client_id,
            'title': self.title,
            'messages': self.messages or [],
            'agents': self.agents or [],
            'turns': self.turns,
            'created_at': self.created_at,
            'updated_at': int(self.updated_at.timestamp() * 1000) if self.updated_at else self.created_at
        }

    @classmethod
    def from_dict(cls, data, user_id):
        return cls(
            user_id=user_id,
            client_id=data.get('client_id') or data.get('id'),
            title=data.get('title', 'New Chat'),
            messages=data.get('messages', []),
            agents=data.get('agents', []),
            turns=data.get('turns', 'auto'),
            created_at=data.get('created_at') or data.get('createdAt') or int(datetime.now(timezone.utc).timestamp() * 1000)
        )

    def __repr__(self):
        return f'<Chat {self.client_id}: {self.title}>'
