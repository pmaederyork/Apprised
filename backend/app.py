#!/usr/bin/env python3

import anthropic
from flask import Flask, render_template, request, jsonify, Response
import json
import setproctitle
import os
import signal
import threading
import time
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Set the process name to "Plaud" for Activity Monitor
setproctitle.setproctitle("Plaud")

app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')

client = anthropic.Anthropic(
    api_key=os.getenv('ANTHROPIC_API_KEY'),
    default_headers={
        "anthropic-beta": "pdfs-2024-09-25"
    }
)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
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
                content_parts = []
                text_files_content = ""
                
                # Process files
                for file_data in msg_files:
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
                            import base64
                            file_content = base64.b64decode(base64_data).decode('utf-8')
                            text_files_content += f"--- File: {file_data.get('name', 'unknown')} ({file_type}) ---\n{file_content}\n--- End of File ---\n\n"
                        except Exception as e:
                            print(f"Error processing text file {file_data.get('name', 'unknown')}: {e}")
                
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
            content_parts = []
            text_files_content = ""
            
            # Process files
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
                        import base64
                        file_content = base64.b64decode(base64_data).decode('utf-8')
                        text_files_content += f"--- File: {file_data.get('name', 'unknown')} ({file_type}) ---\n{file_content}\n--- End of File ---\n\n"
                    except Exception as e:
                        print(f"Error processing text file {file_data.get('name', 'unknown')}: {e}")
            
            # Add text content (any text files + original question)
            final_text = text_files_content + question if text_files_content else question
            content_parts.append({
                "type": "text",
                "text": final_text
            })
            
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
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 1000,
                    "messages": messages
                }
                
                # Add system prompt if provided
                if system_prompt:
                    api_params["system"] = system_prompt
                
                # Add tools if provided
                if tools:
                    api_params["tools"] = tools
                
                with client.messages.stream(**api_params) as stream:
                    for text in stream.text_stream:
                        # Send each chunk as a JSON object
                        yield f"data: {json.dumps({'chunk': text})}\n\n"
                
                # Send end marker
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return Response(generate(), mimetype='text/plain')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Health check endpoint
@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'app': 'Plaud Chat'})

# Shutdown endpoint
@app.route('/shutdown', methods=['POST'])
def shutdown():
    def shutdown_server():
        time.sleep(1)  # Give time for response to be sent
        os.kill(os.getpid(), signal.SIGTERM)
    
    # Start shutdown in a separate thread
    thread = threading.Thread(target=shutdown_server)
    thread.daemon = True
    thread.start()
    
    return jsonify({'status': 'shutting down', 'message': 'Plaud is closing...'})

if __name__ == "__main__":
    app.run(debug=True, host='127.0.0.1', port=5000)