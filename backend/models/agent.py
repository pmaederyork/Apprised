from . import db
from datetime import datetime, timezone


class Agent(db.Model):
    __tablename__ = 'agents'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    client_id = db.Column(db.String(255), nullable=False)

    name = db.Column(db.String(255), nullable=False)
    system_prompt_id = db.Column(db.String(255))  # References client_id of system_prompt
    color = db.Column(db.String(50))
    sort_order = db.Column(db.Integer, default=0)

    created_at = db.Column(db.BigInteger, nullable=False)  # Unix timestamp
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('user_id', 'client_id', name='uq_agent_user_client'),
    )

    def to_dict(self):
        return {
            'client_id': self.client_id,
            'name': self.name,
            'systemPromptId': self.system_prompt_id,
            'color': self.color,
            'sortOrder': self.sort_order,
            'createdAt': self.created_at
        }

    @classmethod
    def from_dict(cls, data, user_id):
        now = int(datetime.now(timezone.utc).timestamp() * 1000)
        return cls(
            user_id=user_id,
            client_id=data.get('client_id') or data.get('id'),
            name=data.get('name', 'Agent'),
            system_prompt_id=data.get('systemPromptId') or data.get('system_prompt_id'),
            color=data.get('color'),
            sort_order=data.get('sortOrder') or data.get('sort_order') or 0,
            created_at=data.get('createdAt') or data.get('created_at') or now
        )

    def __repr__(self):
        return f'<Agent {self.client_id}: {self.name}>'
