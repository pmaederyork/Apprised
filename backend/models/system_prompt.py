from . import db
from datetime import datetime, timezone


class SystemPrompt(db.Model):
    __tablename__ = 'system_prompts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    client_id = db.Column(db.String(255), nullable=False)  # Original localStorage ID (prompt_xxx)

    name = db.Column(db.String(255), default='New Agent')
    content = db.Column(db.Text)  # System prompt content
    sort_order = db.Column(db.Integer, default=0)

    created_at = db.Column(db.BigInteger, nullable=False)  # Unix timestamp
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('user_id', 'client_id', name='uq_system_prompt_user_client'),
    )

    def to_dict(self):
        return {
            'client_id': self.client_id,
            'name': self.name,
            'content': self.content or '',
            'sortOrder': self.sort_order,
            'createdAt': self.created_at,
            'updated_at': int(self.updated_at.timestamp() * 1000) if self.updated_at else self.created_at
        }

    @classmethod
    def from_dict(cls, data, user_id):
        now = int(datetime.now(timezone.utc).timestamp() * 1000)
        return cls(
            user_id=user_id,
            client_id=data.get('client_id') or data.get('id'),
            name=data.get('name', 'New Agent'),
            content=data.get('content', ''),
            sort_order=data.get('sortOrder') or data.get('sort_order') or 0,
            created_at=data.get('createdAt') or data.get('created_at') or now
        )

    def __repr__(self):
        return f'<SystemPrompt {self.client_id}: {self.name}>'
