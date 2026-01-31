#!/usr/bin/env python3

import anthropic
from flask import Flask, render_template, request, jsonify, Response, redirect, url_for, make_response
from werkzeug.middleware.proxy_fix import ProxyFix
import json
import os
import base64
import logging
import sys
from datetime import datetime, timedelta, timezone
from functools import wraps
from dotenv import load_dotenv
from authlib.integrations.flask_client import OAuth
import jwt
import requests
from flask_migrate import Migrate
from models import db, User, Chat, Document, SystemPrompt, Agent

# Load environment variables
load_dotenv()

# Configure logging to stdout for serverless environment
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

app = Flask(__name__,
            static_folder='static',
            template_folder='templates')

# Trust proxy headers (for Railway, Vercel, etc.)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Configuration
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['SESSION_TYPE'] = 'filesystem'  # Enable Flask sessions for Authlib
app.config['SESSION_COOKIE_NAME'] = 'oauth_session'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['GOOGLE_CLIENT_ID'] = os.getenv('GOOGLE_CLIENT_ID')
app.config['GOOGLE_CLIENT_SECRET'] = os.getenv('GOOGLE_CLIENT_SECRET')
app.config['APP_URL'] = os.getenv('APP_URL', 'http://localhost:5000')

# Database configuration
database_url = os.getenv('DATABASE_URL', '')
if database_url.startswith('postgres://'):
    # Railway uses postgres:// but SQLAlchemy requires postgresql+psycopg://
    database_url = database_url.replace('postgres://', 'postgresql+psycopg://', 1)
elif database_url.startswith('postgresql://'):
    # Use psycopg3 driver
    database_url = database_url.replace('postgresql://', 'postgresql+psycopg://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url or 'sqlite:///dev.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db.init_app(app)
migrate = Migrate(app, db)

# Initialize OAuth
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=app.config['GOOGLE_CLIENT_ID'],
    client_secret=app.config['GOOGLE_CLIENT_SECRET'],
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile https://www.googleapis.com/auth/drive.file',
        'prompt': 'select_account',
        'access_type': 'offline'  # Get refresh token for long-term access
    }
)

# API keys are now stored client-side in localStorage

# Redirect apex domain to www
@app.before_request
def redirect_to_www():
    host = request.host.split(':')[0]  # Remove port if present
    if host == 'apprised.ai':
        return redirect(request.url.replace('://apprised.ai', '://www.apprised.ai'), code=301)

# Add request logging
@app.before_request
def log_request():
    logging.info(f"{request.method} {request.path} from {request.remote_addr}")

@app.after_request
def log_response(response):
    logging.info(f"Response {response.status_code} for {request.method} {request.path}")
    return response

@app.after_request
def add_security_headers(response):
    """Add security headers to all responses"""
    # Check if we're in production (not localhost)
    is_production = 'localhost' not in app.config.get('APP_URL', '') and '127.0.0.1' not in app.config.get('APP_URL', '')

    # Content Security Policy - allows self and required external domains
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://apis.google.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.anthropic.com https://accounts.google.com https://www.googleapis.com; "
        "font-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self' https://accounts.google.com; "
        "frame-src https://accounts.google.com https://drive.google.com https://docs.google.com; "
        "frame-ancestors 'none';"
    )

    # Only upgrade to HTTPS in production
    if is_production:
        csp += " upgrade-insecure-requests;"

    response.headers['Content-Security-Policy'] = csp

    # Additional security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

    # HSTS header (only add in production/HTTPS)
    # response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    return response

# JWT Helper Functions
def create_jwt_token(user_id):
    """Create a JWT token with only user_id reference (tokens stored in database)"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(days=7)  # 7 day expiration
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def decode_jwt_token(token):
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_current_user():
    """Get current user from database via JWT user_id"""
    token = request.cookies.get('auth_token')
    if not token:
        return None

    payload = decode_jwt_token(token)
    if not payload or 'user_id' not in payload:
        return None

    # Lookup user from database
    user = User.query.get(payload['user_id'])
    if not user:
        return None

    return user

def get_current_user_dict():
    """Get current user as dictionary (for backward compatibility)"""
    user = get_current_user()
    if not user:
        return None
    return user.to_dict()

def get_google_token_with_auto_refresh():
    """Get Google token from database and auto-refresh if expired"""
    import time

    user = get_current_user()
    if not user:
        return None, False

    # Check if user has tokens
    if not user.access_token:
        return None, False

    current_time = time.time()
    expires_at = user.token_expires_at or 0

    # Check if token expires within 5 minutes (300 seconds grace period)
    if expires_at < current_time + 300:
        logging.info("Access token expired or expiring soon, refreshing...")

        if not user.refresh_token:
            logging.error("No refresh token available")
            return None, False

        # Attempt to refresh the token
        try:
            token_url = 'https://oauth2.googleapis.com/token'
            refresh_data = {
                'client_id': app.config['GOOGLE_CLIENT_ID'],
                'client_secret': app.config['GOOGLE_CLIENT_SECRET'],
                'refresh_token': user.refresh_token,
                'grant_type': 'refresh_token'
            }

            refresh_response = requests.post(token_url, data=refresh_data)

            if refresh_response.status_code == 200:
                new_token_data = refresh_response.json()

                # Update user in database with new tokens
                user.access_token = new_token_data['access_token']
                user.token_expires_at = current_time + new_token_data.get('expires_in', 3600)
                db.session.commit()

                logging.info("Token refreshed successfully and saved to database")
                return {
                    'access_token': user.access_token,
                    'refresh_token': user.refresh_token,
                    'expires_at': user.token_expires_at,
                    'scope': user.token_scope
                }, True
            else:
                logging.error(f"Token refresh failed: {refresh_response.status_code}")
                return None, False

        except Exception as e:
            logging.error(f"Token refresh error: {e}")
            db.session.rollback()
            return None, False

    # Token is still valid - return from database
    return {
        'access_token': user.access_token,
        'refresh_token': user.refresh_token,
        'expires_at': user.token_expires_at,
        'scope': user.token_scope
    }, False

def login_required(f):
    """Decorator to require authentication for endpoints"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if user is None:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Initialize client without API key - will be set per request
# Enable PDF support and 1M token context window
default_headers = {"anthropic-beta": "pdfs-2024-09-25,context-1m-2025-08-07"}

def extract_message_text(message):
    """Extract text content from message (handles both string and array formats)"""
    if isinstance(message, str):
        return message
    elif isinstance(message, list):
        # Find text part in array format (from screenshare)
        for part in message:
            if part.get('type') == 'text':
                return part.get('text', '')
        return ''
    return str(message)  # Fallback

def process_files(files):
    """Process file attachments and return content parts and text content."""
    content_parts = []
    text_files_content = ""
    
    for file_data in files:
        file_type = file_data.get('type', '')
        base64_data = file_data.get('data', '').split(',')[1] if ',' in file_data.get('data', '') else file_data.get('data', '')
        
        if file_type.startswith('image/'):
            # Handle images (PNG, JPEG, GIF, WebP, SVG)
            content_parts.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": file_type,
                    "data": base64_data
                }
            })
        elif file_type == 'application/pdf':
            # Handle PDFs (only PDF is supported for document type)
            content_parts.append({
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": file_type,
                    "data": base64_data
                }
            })
        elif file_type in [
            'text/csv',
            'text/plain',
            'text/html',
            'application/json',
            'text/javascript',
            'text/x-python',
            'text/markdown'
        ]:
            # Handle text-based files by extracting content and including as text
            try:
                file_content = base64.b64decode(base64_data).decode('utf-8')
                text_files_content += f"--- File: {file_data.get('name', 'unknown')} ({file_type}) ---\n{file_content}\n--- End of File ---\n\n"
            except Exception as e:
                print(f"Error processing text file {file_data.get('name', 'unknown')}: {e}")
    
    return content_parts, text_files_content

# Authentication Routes
@app.route('/auth/login')
def auth_login():
    """Initiate Google OAuth login"""
    redirect_uri = url_for('auth_callback', _external=True)
    logging.info(f"OAuth redirect_uri: {redirect_uri}")
    logging.info(f"Request headers: {dict(request.headers)}")
    return google.authorize_redirect(redirect_uri)

@app.route('/auth/callback')
def auth_callback():
    """Handle Google OAuth callback - creates/updates user in database"""
    try:
        token = google.authorize_access_token()
        user_info = token.get('userinfo')

        if not user_info:
            return redirect('/?error=auth_failed')

        google_id = user_info['sub']

        # Find or create user in database
        user = User.query.filter_by(google_id=google_id).first()

        if user:
            # Update existing user
            user.email = user_info['email']
            user.name = user_info.get('name', '')
            user.picture = user_info.get('picture', '')
            user.access_token = token.get('access_token')
            # Only update refresh_token if we got a new one (Google doesn't always return it)
            if token.get('refresh_token'):
                user.refresh_token = token.get('refresh_token')
            user.token_expires_at = token.get('expires_at')
            user.token_scope = token.get('scope', '')
            user.last_login = datetime.now(timezone.utc)
            logging.info(f"Updated existing user: {user.email}")
        else:
            # Create new user
            user = User(
                google_id=google_id,
                email=user_info['email'],
                name=user_info.get('name', ''),
                picture=user_info.get('picture', ''),
                access_token=token.get('access_token'),
                refresh_token=token.get('refresh_token'),
                token_expires_at=token.get('expires_at'),
                token_scope=token.get('scope', '')
            )
            db.session.add(user)
            logging.info(f"Created new user: {user.email}")

        db.session.commit()

        # Create JWT token with only user_id
        jwt_token = create_jwt_token(user.id)

        # Create response and set cookie
        response = make_response(redirect('/'))
        response.set_cookie(
            'auth_token',
            jwt_token,
            max_age=60*60*24*7,  # 7 days
            httponly=True,
            secure=request.is_secure,  # HTTPS only in production
            samesite='Lax'
        )

        return response

    except Exception as e:
        logging.error(f"OAuth callback error: {e}")
        db.session.rollback()
        return redirect('/?error=auth_failed')

@app.route('/auth/logout')
def auth_logout():
    """Logout user, revoke tokens, and clear session"""
    user = get_current_user()

    if user and user.access_token:
        # Try to revoke Google token (best effort)
        try:
            revoke_url = f"https://oauth2.googleapis.com/revoke?token={user.access_token}"
            requests.post(revoke_url)
            logging.info(f"Revoked Google token for user: {user.email}")
        except Exception as e:
            logging.warning(f"Failed to revoke Google token: {e}")

        # Clear tokens from database
        try:
            user.access_token = None
            user.refresh_token = None
            user.token_expires_at = None
            user.token_scope = None
            db.session.commit()
            logging.info(f"Cleared tokens from database for user: {user.email}")
        except Exception as e:
            logging.error(f"Failed to clear tokens from database: {e}")
            db.session.rollback()

    response = make_response(redirect('/'))
    response.set_cookie('auth_token', '', max_age=0)
    return response

@app.route('/auth/status')
def auth_status():
    """Check if user is authenticated and get user info"""
    user = get_current_user()
    if user:
        return jsonify({
            'authenticated': True,
            'user': {
                'email': user.email,
                'name': user.name,
                'picture': user.picture or ''
            }
        })
    return jsonify({'authenticated': False})

@app.route('/')
def index():
    """Serve landing page or app based on authentication"""
    user = get_current_user()
    if user:
        return render_template('app.html')
    else:
        return render_template('landing.html')

@app.route('/privacy')
def privacy():
    """Serve privacy policy page"""
    return render_template('privacy.html')

@app.route('/terms')
def terms():
    """Serve terms and conditions page"""
    return render_template('terms.html')

@app.route('/chat', methods=['POST'])
@login_required
def chat():
    # Get API key from request headers (sent from client localStorage)
    api_key = request.headers.get('X-API-Key')

    if not api_key:
        return jsonify({'error': 'API key required. Please add your Anthropic API key.'}), 401

    # Create client with the provided API key
    try:
        client = anthropic.Anthropic(
            api_key=api_key,
            default_headers=default_headers
        )
    except Exception:
        return jsonify({'error': 'Invalid API key format'}), 401
    
    data = request.json
    question = data.get('message', '')
    history = data.get('history', [])
    system_prompt = data.get('systemPrompt', '')
    tools = data.get('tools', [])
    files = data.get('files', [])
    model = data.get('model', 'claude-sonnet-4-5-20250929')
    
    if not question:
        return jsonify({'error': 'No message provided'}), 400
    
    try:
        # Build messages array with history
        messages = []
        
        # Add conversation history
        for msg in history:
            role = "user" if msg.get('isUser') else "assistant"
            
            # Handle files in history
            msg_files = msg.get('files', [])
            if msg_files and role == "user":
                content_parts, text_files_content = process_files(msg_files)
                
                # Add text content (original message + any text files)
                final_text = text_files_content + msg.get('content', '') if text_files_content else msg.get('content', '')
                content_parts.append({
                    "type": "text",
                    "text": final_text
                })
                
                messages.append({
                    "role": role,
                    "content": content_parts
                })
            else:
                messages.append({
                    "role": role,
                    "content": msg.get('content', '')
                })
        
        # Add current question with files
        if files:
            content_parts, text_files_content = process_files(files)
            
            # Extract text from question (handles both string and array)
            question_text = extract_message_text(question)
            final_text = text_files_content + question_text if text_files_content else question_text
            
            # Handle message format (preserve original structure if array)
            if isinstance(question, list):
                # Screenshare case: add files to existing array
                content_parts.extend(question)
            else:
                # Text-only case: add text part
                content_parts.append({"type": "text", "text": final_text})
            
            messages.append({
                "role": "user",
                "content": content_parts
            })
        else:
            messages.append({
                "role": "user",
                "content": question
            })
        
        def generate():
            try:
                # Prepare API call parameters
                api_params = {
                    "model": model,
                    "max_tokens": 20000,
                    "messages": messages
                }
                
                # Add system prompt if provided
                if system_prompt:
                    api_params["system"] = system_prompt
                
                # Add tools if provided
                if tools:
                    api_params["tools"] = tools

                # Use streaming
                with client.messages.stream(**api_params) as stream:
                    for text in stream.text_stream:
                        yield f"data: {json.dumps({'chunk': text})}\n\n"
                
                # Send end marker
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                error_message = str(e)
                logging.error(f"Anthropic API error: {e}")
                # Handle specific Anthropic API errors
                if 'authentication' in error_message.lower() or 'api key' in error_message.lower():
                    error_message = 'Invalid API key. Please check your API key in Settings.'
                elif 'usage' in error_message.lower() or 'quota' in error_message.lower():
                    error_message = 'API usage limit reached. Please check your account.'
                yield f"data: {json.dumps({'error': error_message})}\n\n"
        
        return Response(generate(), mimetype='text/plain')
        
    except Exception as e:
        logging.error(f"Chat endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================
# GOOGLE DRIVE API ENDPOINTS
# ============================================

@app.route('/drive/save', methods=['POST'])
@login_required
def drive_save():
    """Save document to Google Drive"""
    try:
        data = request.json
        document_title = data.get('title')
        document_content = data.get('content')
        drive_file_id = data.get('driveFileId')  # None for new files
        parent_folder_id = data.get('parentFolderId')  # Optional folder for new files

        # Get OAuth token from database (with auto-refresh)
        token, _ = get_google_token_with_auto_refresh()

        if not token:
            return jsonify({'success': False, 'error': 'Not connected to Google Drive'}), 401

        # Prepare file metadata
        metadata = {
            'name': document_title,
            'mimeType': 'application/vnd.google-apps.document'
        }

        # Add parent folder only for new files (not updates)
        if parent_folder_id and not drive_file_id:
            metadata['parents'] = [parent_folder_id]

        if drive_file_id:
            # Update existing file
            url = f'https://www.googleapis.com/upload/drive/v3/files/{drive_file_id}?uploadType=multipart'
            method = 'PATCH'
        else:
            # Create new file
            url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
            method = 'POST'

        # Create multipart request
        boundary = 'drive_boundary_12345'
        body = f"""--{boundary}
Content-Type: application/json; charset=UTF-8

{json.dumps(metadata)}

--{boundary}
Content-Type: text/html; charset=UTF-8

{document_content}

--{boundary}--"""

        headers = {
            'Authorization': f"Bearer {token['access_token']}",
            'Content-Type': f'multipart/related; boundary={boundary}'
        }

        # Encode body as UTF-8 to handle Unicode characters
        response = requests.request(method, url, headers=headers, data=body.encode('utf-8'))

        if response.status_code in [200, 201]:
            file_data = response.json()
            return jsonify({
                'success': True,
                'fileId': file_data['id'],
                'name': file_data['name'],
                'modifiedTime': file_data.get('modifiedTime')
            })
        else:
            logging.error(f"Drive API error: {response.status_code} - {response.text}")
            # Return distinct error types for frontend handling
            if response.status_code == 403:
                return jsonify({
                    'success': False,
                    'error': 'access_denied',
                    'message': 'No access to this file. Re-select it via the file picker to restore access.'
                }), 403
            elif response.status_code == 404:
                return jsonify({
                    'success': False,
                    'error': 'file_not_found',
                    'message': 'File not found in Google Drive. It may have been deleted.'
                }), 404
            else:
                return jsonify({
                    'success': False,
                    'error': 'drive_error',
                    'message': f"Drive API error: {response.status_code}"
                }), response.status_code

    except Exception as e:
        logging.error(f"Drive save error: {e}")
        return jsonify({'success': False, 'error': 'unknown', 'message': str(e)}), 500


@app.route('/drive/import/<file_id>', methods=['GET'])
@login_required
def drive_import(file_id):
    """Import document from Google Drive"""
    try:
        # Get OAuth token from database (with auto-refresh)
        token, _ = get_google_token_with_auto_refresh()

        if not token:
            return jsonify({'success': False, 'error': 'Not connected to Google Drive'}), 401

        # Export file as HTML
        url = f'https://www.googleapis.com/drive/v3/files/{file_id}/export?mimeType=text/html'
        headers = {'Authorization': f"Bearer {token['access_token']}"}

        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            # Get the HTML content
            html_content = response.text

            # Fix UTF-8 encoding issues from Google Drive API
            # Try to fix mojibake by re-encoding (common issue with Google Drive exports)
            try:
                # Attempt latin-1 to UTF-8 conversion to fix encoding issues
                html_content = html_content.encode('latin-1').decode('utf-8')
            except (UnicodeDecodeError, UnicodeEncodeError):
                # If conversion fails, use original content
                # (it might already be correctly encoded)
                pass

            # Also get file metadata for name
            metadata_url = f'https://www.googleapis.com/drive/v3/files/{file_id}?fields=name,modifiedTime'
            metadata_response = requests.get(metadata_url, headers=headers)
            metadata = metadata_response.json()

            response_data = {
                'success': True,
                'content': html_content,
                'name': metadata.get('name', 'Untitled'),
                'modifiedTime': metadata.get('modifiedTime')
            }

            # Create response with explicit UTF-8 encoding
            resp = make_response(jsonify(response_data))
            resp.headers['Content-Type'] = 'application/json; charset=utf-8'
            return resp
        else:
            logging.error(f"Drive API error: {response.status_code} - {response.text}")
            # Return distinct error types for frontend handling
            if response.status_code == 403:
                return jsonify({
                    'success': False,
                    'error': 'access_denied',
                    'message': 'No access to this file. Re-select it via the file picker to restore access.'
                }), 403
            elif response.status_code == 404:
                return jsonify({
                    'success': False,
                    'error': 'file_not_found',
                    'message': 'File not found in Google Drive. It may have been deleted.'
                }), 404
            else:
                return jsonify({
                    'success': False,
                    'error': 'drive_error',
                    'message': f"Drive API error: {response.status_code}"
                }), response.status_code

    except Exception as e:
        logging.error(f"Drive import error: {e}")
        return jsonify({'success': False, 'error': 'unknown', 'message': str(e)}), 500


@app.route('/drive/picker-token', methods=['GET'])
@login_required
def drive_picker_token():
    """Get OAuth token for Google Picker (file selector)"""
    try:
        # Get OAuth token from database (with auto-refresh)
        token, _ = get_google_token_with_auto_refresh()

        if not token:
            return jsonify({'success': False, 'error': 'Not connected to Google Drive'}), 401

        return jsonify({
            'success': True,
            'accessToken': token['access_token']
        })
    except Exception as e:
        logging.error(f"Picker token error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/drive/status', methods=['GET'])
@login_required
def drive_status():
    """Check if user has granted Drive access"""
    try:
        # Get OAuth token from database (with auto-refresh)
        token, _ = get_google_token_with_auto_refresh()
        has_drive_access = False

        if token:
            # Check if token has Drive scope
            scope = token.get('scope', '')
            logging.info(f"Token scope: {scope}")
            # Support both new drive.file scope and legacy full drive scope during transition
            has_drive_access = ('drive.file' in scope or 'drive' in scope.lower()) if scope else False

        logging.info(f"Drive access check: {has_drive_access}")

        return jsonify({
            'success': True,
            'connected': has_drive_access
        })
    except Exception as e:
        logging.error(f"Drive status error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/drive/disconnect', methods=['POST'])
@login_required
def drive_disconnect():
    """Disconnect Google Drive by revoking token and clearing from database"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'Not authenticated'}), 401

        # Try to revoke the Google token (best effort)
        if user.access_token:
            try:
                revoke_url = f"https://oauth2.googleapis.com/revoke?token={user.access_token}"
                requests.post(revoke_url)
                logging.info(f"Google token revoked for user: {user.email}")
            except Exception as e:
                logging.warning(f"Failed to revoke Google token: {e}")

        # Clear tokens from database
        user.access_token = None
        user.refresh_token = None
        user.token_expires_at = None
        user.token_scope = None
        db.session.commit()

        logging.info(f"Google Drive disconnected for user: {user.email}")
        return jsonify({'success': True})

    except Exception as e:
        logging.error(f"Drive disconnect error: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================
# DATA API ENDPOINTS (User-scoped CRUD)
# ============================================

@app.route('/api/user', methods=['GET'])
@login_required
def api_get_user():
    """Get current user info"""
    user = get_current_user()
    return jsonify(user.to_dict())


# --- Chats API ---

@app.route('/api/chats', methods=['GET'])
@login_required
def api_get_chats():
    """Get all chats for current user"""
    user = get_current_user()
    chats = Chat.query.filter_by(user_id=user.id).order_by(Chat.created_at.desc()).all()
    return jsonify([chat.to_dict() for chat in chats])


@app.route('/api/chats/<client_id>', methods=['GET'])
@login_required
def api_get_chat(client_id):
    """Get a specific chat by client_id"""
    user = get_current_user()
    chat = Chat.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not chat:
        return jsonify({'error': 'Chat not found'}), 404
    return jsonify(chat.to_dict())


@app.route('/api/chats', methods=['POST'])
@login_required
def api_create_chat():
    """Create a new chat"""
    user = get_current_user()
    data = request.json

    # Check for duplicate client_id
    existing = Chat.query.filter_by(user_id=user.id, client_id=data.get('client_id') or data.get('id')).first()
    if existing:
        return jsonify({'error': 'Chat with this client_id already exists'}), 409

    chat = Chat.from_dict(data, user.id)
    db.session.add(chat)
    db.session.commit()
    return jsonify(chat.to_dict()), 201


@app.route('/api/chats/<client_id>', methods=['PUT'])
@login_required
def api_update_chat(client_id):
    """Update an existing chat"""
    user = get_current_user()
    chat = Chat.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not chat:
        return jsonify({'error': 'Chat not found'}), 404

    data = request.json
    if 'title' in data:
        chat.title = data['title']
    if 'messages' in data:
        chat.messages = data['messages']
    if 'agents' in data:
        chat.agents = data['agents']
    if 'turns' in data:
        chat.turns = data['turns']

    db.session.commit()
    return jsonify(chat.to_dict())


@app.route('/api/chats/<client_id>', methods=['DELETE'])
@login_required
def api_delete_chat(client_id):
    """Delete a chat"""
    user = get_current_user()
    chat = Chat.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not chat:
        return jsonify({'error': 'Chat not found'}), 404

    db.session.delete(chat)
    db.session.commit()
    return jsonify({'success': True})


# --- Documents API ---

@app.route('/api/documents', methods=['GET'])
@login_required
def api_get_documents():
    """Get all documents for current user"""
    user = get_current_user()
    documents = Document.query.filter_by(user_id=user.id).order_by(Document.last_modified.desc()).all()
    return jsonify([doc.to_dict() for doc in documents])


@app.route('/api/documents/<client_id>', methods=['GET'])
@login_required
def api_get_document(client_id):
    """Get a specific document by client_id"""
    user = get_current_user()
    doc = Document.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not doc:
        return jsonify({'error': 'Document not found'}), 404
    return jsonify(doc.to_dict())


@app.route('/api/documents', methods=['POST'])
@login_required
def api_create_document():
    """Create a new document"""
    user = get_current_user()
    data = request.json

    existing = Document.query.filter_by(user_id=user.id, client_id=data.get('client_id') or data.get('id')).first()
    if existing:
        return jsonify({'error': 'Document with this client_id already exists'}), 409

    doc = Document.from_dict(data, user.id)
    db.session.add(doc)
    db.session.commit()
    return jsonify(doc.to_dict()), 201


@app.route('/api/documents/<client_id>', methods=['PUT'])
@login_required
def api_update_document(client_id):
    """Update an existing document"""
    user = get_current_user()
    doc = Document.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not doc:
        return jsonify({'error': 'Document not found'}), 404

    data = request.json
    if 'title' in data:
        doc.title = data['title']
    if 'content' in data:
        doc.content = data['content']
    if 'driveFileId' in data:
        doc.drive_file_id = data['driveFileId']
    if 'lastModified' in data:
        doc.last_modified = data['lastModified']

    db.session.commit()
    return jsonify(doc.to_dict())


@app.route('/api/documents/<client_id>', methods=['DELETE'])
@login_required
def api_delete_document(client_id):
    """Delete a document"""
    user = get_current_user()
    doc = Document.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not doc:
        return jsonify({'error': 'Document not found'}), 404

    db.session.delete(doc)
    db.session.commit()
    return jsonify({'success': True})


# --- System Prompts API ---

@app.route('/api/system-prompts', methods=['GET'])
@login_required
def api_get_system_prompts():
    """Get all system prompts for current user"""
    user = get_current_user()
    prompts = SystemPrompt.query.filter_by(user_id=user.id).order_by(SystemPrompt.sort_order).all()
    return jsonify([p.to_dict() for p in prompts])


@app.route('/api/system-prompts/<client_id>', methods=['GET'])
@login_required
def api_get_system_prompt(client_id):
    """Get a specific system prompt by client_id"""
    user = get_current_user()
    prompt = SystemPrompt.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not prompt:
        return jsonify({'error': 'System prompt not found'}), 404
    return jsonify(prompt.to_dict())


@app.route('/api/system-prompts', methods=['POST'])
@login_required
def api_create_system_prompt():
    """Create a new system prompt"""
    user = get_current_user()
    data = request.json

    existing = SystemPrompt.query.filter_by(user_id=user.id, client_id=data.get('client_id') or data.get('id')).first()
    if existing:
        return jsonify({'error': 'System prompt with this client_id already exists'}), 409

    prompt = SystemPrompt.from_dict(data, user.id)
    db.session.add(prompt)
    db.session.commit()
    return jsonify(prompt.to_dict()), 201


@app.route('/api/system-prompts/<client_id>', methods=['PUT'])
@login_required
def api_update_system_prompt(client_id):
    """Update an existing system prompt"""
    user = get_current_user()
    prompt = SystemPrompt.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not prompt:
        return jsonify({'error': 'System prompt not found'}), 404

    data = request.json
    if 'name' in data:
        prompt.name = data['name']
    if 'content' in data:
        prompt.content = data['content']
    if 'sortOrder' in data:
        prompt.sort_order = data['sortOrder']

    db.session.commit()
    return jsonify(prompt.to_dict())


@app.route('/api/system-prompts/<client_id>', methods=['DELETE'])
@login_required
def api_delete_system_prompt(client_id):
    """Delete a system prompt"""
    user = get_current_user()
    prompt = SystemPrompt.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not prompt:
        return jsonify({'error': 'System prompt not found'}), 404

    db.session.delete(prompt)
    db.session.commit()
    return jsonify({'success': True})


# --- Agents API ---

@app.route('/api/agents', methods=['GET'])
@login_required
def api_get_agents():
    """Get all agents for current user"""
    user = get_current_user()
    agents = Agent.query.filter_by(user_id=user.id).order_by(Agent.sort_order).all()
    return jsonify([a.to_dict() for a in agents])


@app.route('/api/agents/<client_id>', methods=['GET'])
@login_required
def api_get_agent(client_id):
    """Get a specific agent by client_id"""
    user = get_current_user()
    agent = Agent.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not agent:
        return jsonify({'error': 'Agent not found'}), 404
    return jsonify(agent.to_dict())


@app.route('/api/agents', methods=['POST'])
@login_required
def api_create_agent():
    """Create a new agent"""
    user = get_current_user()
    data = request.json

    existing = Agent.query.filter_by(user_id=user.id, client_id=data.get('client_id') or data.get('id')).first()
    if existing:
        return jsonify({'error': 'Agent with this client_id already exists'}), 409

    agent = Agent.from_dict(data, user.id)
    db.session.add(agent)
    db.session.commit()
    return jsonify(agent.to_dict()), 201


@app.route('/api/agents/<client_id>', methods=['PUT'])
@login_required
def api_update_agent(client_id):
    """Update an existing agent"""
    user = get_current_user()
    agent = Agent.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not agent:
        return jsonify({'error': 'Agent not found'}), 404

    data = request.json
    if 'name' in data:
        agent.name = data['name']
    if 'systemPromptId' in data:
        agent.system_prompt_id = data['systemPromptId']
    if 'color' in data:
        agent.color = data['color']
    if 'sortOrder' in data:
        agent.sort_order = data['sortOrder']

    db.session.commit()
    return jsonify(agent.to_dict())


@app.route('/api/agents/<client_id>', methods=['DELETE'])
@login_required
def api_delete_agent(client_id):
    """Delete an agent"""
    user = get_current_user()
    agent = Agent.query.filter_by(user_id=user.id, client_id=client_id).first()
    if not agent:
        return jsonify({'error': 'Agent not found'}), 404

    db.session.delete(agent)
    db.session.commit()
    return jsonify({'success': True})


# --- Sync Status API ---

@app.route('/api/sync-status', methods=['GET'])
@login_required
def api_sync_status():
    """Get the latest updated_at timestamp for each data type.
    Used by client polling to detect changes from other devices.
    """
    user = get_current_user()

    # Get max updated_at for each type using SQL aggregation
    from sqlalchemy import func

    # Get latest timestamps (or 0 if no data)
    chat_latest = db.session.query(func.max(Chat.updated_at)).filter(Chat.user_id == user.id).scalar()
    doc_latest = db.session.query(func.max(Document.updated_at)).filter(Document.user_id == user.id).scalar()
    prompt_latest = db.session.query(func.max(SystemPrompt.updated_at)).filter(SystemPrompt.user_id == user.id).scalar()
    agent_latest = db.session.query(func.max(Agent.updated_at)).filter(Agent.user_id == user.id).scalar()

    # Convert to Unix timestamps (milliseconds) or 0 if no data
    def to_timestamp(dt):
        if dt is None:
            return 0
        return int(dt.timestamp() * 1000)

    return jsonify({
        'chats': to_timestamp(chat_latest),
        'documents': to_timestamp(doc_latest),
        'systemPrompts': to_timestamp(prompt_latest),
        'agents': to_timestamp(agent_latest)
    })


# Health check endpoint
@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'app': 'Apprised Chat'})

# WSGI entry point for Vercel
application = app

if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0', port=5000)