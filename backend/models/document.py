from . import db
from datetime import datetime, timezone


class Document(db.Model):
    __tablename__ = 'documents'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    client_id = db.Column(db.String(255), nullable=False)  # Original localStorage ID (doc_xxx)

    title = db.Column(db.String(500), default='New Document.html')
    content = db.Column(db.Text)  # HTML content from Squire editor
    drive_file_id = db.Column(db.String(255))  # Google Drive link if synced

    created_at = db.Column(db.BigInteger, nullable=False)  # Unix timestamp
    last_modified = db.Column(db.BigInteger, nullable=False)  # Unix timestamp
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('user_id', 'client_id', name='uq_document_user_client'),
        db.Index('ix_documents_user_modified', 'user_id', 'last_modified'),
    )

    def to_dict(self):
        return {
            'client_id': self.client_id,
            'title': self.title,
            'content': self.content or '',
            'driveFileId': self.drive_file_id,
            'createdAt': self.created_at,
            'lastModified': self.last_modified
        }

    @classmethod
    def from_dict(cls, data, user_id):
        now = int(datetime.now(timezone.utc).timestamp() * 1000)
        return cls(
            user_id=user_id,
            client_id=data.get('client_id') or data.get('id'),
            title=data.get('title', 'New Document.html'),
            content=data.get('content', ''),
            drive_file_id=data.get('driveFileId'),
            created_at=data.get('createdAt') or data.get('created_at') or now,
            last_modified=data.get('lastModified') or data.get('last_modified') or now
        )

    def __repr__(self):
        return f'<Document {self.client_id}: {self.title}>'
