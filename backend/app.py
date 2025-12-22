#!/usr/bin/env python3

import anthropic
import openai
from flask import Flask, render_template, request, jsonify, Response
import json
import os
import signal
import threading
import time
import base64
import logging
import sys

# Note: setproctitle removed for Vercel serverless compatibility
# setproctitle.setproctitle("Apprised")

# Configure logging to stdout for serverless environment
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')

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
        "connect-src 'self' https://api.anthropic.com https://api.openai.com; "
        "font-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
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

# Initialize client without API key - will be set per request
default_headers = {"anthropic-beta": "pdfs-2024-09-25"}

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

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    # Get API key from request headers
    api_key = request.headers.get('X-API-Key')
    if not api_key:
        # Fallback to environment variable for backward compatibility
        api_key = os.getenv('ANTHROPIC_API_KEY')
    
    if not api_key:
        return jsonify({'error': 'API key required. Please add your Anthropic API key in Settings.'}), 401
    
    # Get ChatGPT API key from request headers (capture outside generator)
    chatgpt_api_key = request.headers.get('X-ChatGPT-API-Key')
    logging.info(f"ChatGPT API key present: {bool(chatgpt_api_key)}")
    
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
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 20000,
                    "messages": messages
                }
                
                # Add system prompt if provided
                if system_prompt:
                    api_params["system"] = system_prompt
                
                # Add tools if provided
                if tools:
                    api_params["tools"] = tools
                
                # Check for ChatGPT tool - if present, handle non-streaming
                has_chatgpt_tool = any(tool.get('name') == 'chatgpt' for tool in tools)
                logging.info(f"Has ChatGPT tool: {has_chatgpt_tool}, Tools count: {len(tools)}")
                
                if has_chatgpt_tool:
                    # Use non-streaming approach for tool calls
                    response = client.messages.create(**api_params)
                    
                    # Handle tool calls
                    if response.stop_reason == "tool_use":
                        # Find ChatGPT tool calls
                        chatgpt_tool_calls = [block for block in response.content if block.type == "tool_use" and block.name == "chatgpt"]
                        
                        if chatgpt_tool_calls:
                            # Check if ChatGPT API key is available
                            if not chatgpt_api_key:
                                yield f"data: {json.dumps({'error': 'ChatGPT API key required for this request.'})}\n\n"
                                return
                            
                            # Process each ChatGPT tool call
                            tool_results = []
                            for tool_call in chatgpt_tool_calls:
                                try:
                                    tool_input = tool_call.input
                                    prompt = tool_input.get('prompt', '')
                                    show_response = tool_input.get('show_response', False)
                                    
                                    # Call ChatGPT API
                                    chatgpt_client = openai.OpenAI(api_key=chatgpt_api_key)
                                    
                                    # Always use Responses API with web search for ChatGPT
                                    try:
                                        api_params = {
                                            "model": "gpt-4o",
                                            "tools": [{"type": "web_search"}],
                                            "input": f"You have web search capabilities. Use them when you need current information. Provide direct answers based on your search results.\n\n{prompt}"
                                        }
                                        chatgpt_response = chatgpt_client.responses.create(**api_params)
                                        logging.info("ChatGPT Responses API with web search succeeded")
                                    except Exception as e:
                                        logging.error(f"ChatGPT Responses API with web search failed: {str(e)}")
                                        logging.error(f"Error type: {type(e)}")
                                        raise e
                                    
                                    # Handle different response formats
                                    if hasattr(chatgpt_response, 'choices'):
                                        # Chat Completions API response
                                        chatgpt_result = chatgpt_response.choices[0].message.content
                                    else:
                                        # Responses API response - use output attribute
                                        if hasattr(chatgpt_response, 'output'):
                                            chatgpt_result = chatgpt_response.output
                                            logging.info(f"ChatGPT response output type: {type(chatgpt_result)}")
                                            logging.info(f"ChatGPT response output preview: {str(chatgpt_result)[:200]}...")
                                        else:
                                            # Debug unknown response format
                                            logging.error(f"Unknown Responses API format: {type(chatgpt_response)}")
                                            logging.error(f"Available attributes: {dir(chatgpt_response)}")
                                            chatgpt_result = str(chatgpt_response)
                                    
                                    # Show the result to user if requested
                                    if show_response:
                                        chatgpt_display = f"\n\n**ChatGPT Response:**\n{chatgpt_result}\n\n"
                                        yield f"data: {json.dumps({'chunk': chatgpt_display})}\n\n"
                                    
                                    # Add tool result for Claude - ensure it's properly formatted as text
                                    tool_results.append({
                                        "type": "tool_result",
                                        "tool_use_id": tool_call.id,
                                        "content": str(chatgpt_result)  # Ensure it's a string
                                    })
                                    
                                except Exception as e:
                                    error_msg = f"ChatGPT API error: {str(e)}"
                                    logging.error(f"ChatGPT API Error Details: {e}")
                                    tool_results.append({
                                        "type": "tool_result",
                                        "tool_use_id": tool_call.id,
                                        "content": error_msg
                                    })
                            
                            # Continue conversation with tool results
                            if tool_results:
                                # Convert response.content array to proper format for assistant message
                                assistant_content = []
                                for block in response.content:
                                    if block.type == "text":
                                        assistant_content.append({
                                            "type": "text",
                                            "text": block.text
                                        })
                                    elif block.type == "tool_use":
                                        # Include tool use blocks in proper format
                                        assistant_content.append({
                                            "type": "tool_use",
                                            "id": block.id,
                                            "name": block.name,
                                            "input": block.input
                                        })
                                
                                continue_messages = messages + [
                                    {"role": "assistant", "content": assistant_content},
                                    {"role": "user", "content": tool_results}
                                ]
                                
                                continue_params = {
                                    "model": "claude-3-5-sonnet-20241022",
                                    "max_tokens": 4000,
                                    "temperature": 0.7,
                                    "messages": continue_messages
                                }
                                
                                if system_prompt:
                                    continue_params["system"] = system_prompt
                                
                                try:
                                    with client.messages.stream(**continue_params) as continue_stream:
                                        for text in continue_stream.text_stream:
                                            yield f"data: {json.dumps({'chunk': text})}\n\n"
                                except Exception as e:
                                    logging.error(f"Claude continuation error: {e}")
                                    yield f"data: {json.dumps({'error': f'Error processing ChatGPT response: {str(e)}'})}\n\n"
                    else:
                        # No tool calls, stream the response
                        for block in response.content:
                            if block.type == "text":
                                yield f"data: {json.dumps({'chunk': block.text})}\n\n"
                else:
                    # No ChatGPT tool, use normal streaming
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

# Shutdown endpoint removed for Vercel serverless compatibility
# Serverless functions cannot control their own lifecycle
# @app.route('/shutdown', methods=['POST'])
# def shutdown():
#     def shutdown_server():
#         time.sleep(1)
#         os.kill(os.getpid(), signal.SIGTERM)
#     thread = threading.Thread(target=shutdown_server)
#     thread.daemon = True
#     thread.start()
#     return jsonify({'status': 'shutting down', 'message': 'Apprised is closing...'})

# ChatGPT endpoint
@app.route('/chatgpt', methods=['POST'])
def chatgpt():
    logging.info("ChatGPT endpoint called")
    # Get ChatGPT API key from request headers
    api_key = request.headers.get('X-ChatGPT-API-Key')
    
    if not api_key:
        logging.warning("ChatGPT API key missing")
        return jsonify({'error': 'ChatGPT API key required. Please add your OpenAI API key in Settings.'}), 401
    
    try:
        data = request.get_json()
        prompt = data.get('prompt', '')
        show_response = data.get('show_response', False)
        
        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        
        # Create OpenAI client with the provided API key
        client = openai.OpenAI(api_key=api_key)
        logging.info(f"Calling ChatGPT with prompt length: {len(prompt)}")
        
        # Call ChatGPT API
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        
        chatgpt_response = response.choices[0].message.content
        logging.info("ChatGPT API call successful")
        
        return jsonify({
            'response': chatgpt_response,
            'show_response': show_response
        })
        
    except Exception as e:
        error_message = str(e)
        logging.error(f"ChatGPT API error: {e}")
        # Handle specific OpenAI API errors
        if 'authentication' in error_message.lower() or 'api key' in error_message.lower():
            error_message = 'Invalid ChatGPT API key. Please check your OpenAI API key in Settings.'
        elif 'quota' in error_message.lower() or 'billing' in error_message.lower():
            error_message = 'ChatGPT API usage limit reached. Please check your OpenAI account.'
        return jsonify({'error': error_message}), 500

# WSGI entry point for Vercel
application = app

if __name__ == "__main__":
    app.run(debug=False, host='127.0.0.1', port=5000)