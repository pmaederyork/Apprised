#!/usr/bin/env python3

import anthropic
from flask import Flask, render_template, request, jsonify, Response, redirect, url_for, make_response
import json
import os
import base64
import logging
import sys
from datetime import datetime, timedelta
from functools import wraps
from dotenv import load_dotenv
from authlib.integrations.flask_client import OAuth
import jwt

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

# Configuration
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['GOOGLE_CLIENT_ID'] = os.getenv('GOOGLE_CLIENT_ID')
app.config['GOOGLE_CLIENT_SECRET'] = os.getenv('GOOGLE_CLIENT_SECRET')
app.config['APP_URL'] = os.getenv('APP_URL', 'http://localhost:5000')

# Initialize OAuth
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=app.config['GOOGLE_CLIENT_ID'],
    client_secret=app.config['GOOGLE_CLIENT_SECRET'],
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile',
        'prompt': 'select_account'
    }
)

# API keys are now stored client-side in localStorage

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
    # Content Security Policy - allows self and required external domains
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.anthropic.com https://accounts.google.com; "
        "font-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self' https://accounts.google.com; "
        "frame-ancestors 'none'; "
        "upgrade-insecure-requests;"
    )
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
def create_jwt_token(user_data):
    """Create a JWT token for authenticated user"""
    payload = {
        'google_id': user_data['google_id'],
        'email': user_data['email'],
        'name': user_data.get('name', ''),
        'picture': user_data.get('picture', ''),
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
    """Get current user from JWT token in cookie"""
    token = request.cookies.get('auth_token')
    if not token:
        return None
    return decode_jwt_token(token)

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
    return google.authorize_redirect(redirect_uri)

@app.route('/auth/callback')
def auth_callback():
    """Handle Google OAuth callback"""
    try:
        token = google.authorize_access_token()
        user_info = token.get('userinfo')

        if not user_info:
            return redirect('/?error=auth_failed')

        # Create user data
        user_data = {
            'google_id': user_info['sub'],
            'email': user_info['email'],
            'name': user_info.get('name', ''),
            'picture': user_info.get('picture', '')
        }

        # Create JWT token
        jwt_token = create_jwt_token(user_data)

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
        return redirect('/?error=auth_failed')

@app.route('/auth/logout')
def auth_logout():
    """Logout user and clear session"""
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
                'email': user['email'],
                'name': user['name'],
                'picture': user.get('picture', '')
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
                    "model": "claude-sonnet-4-5-20250929",
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

# Health check endpoint
@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'app': 'Apprised Chat'})

# WSGI entry point for Vercel
application = app

if __name__ == "__main__":
    app.run(debug=False, host='127.0.0.1', port=5000)