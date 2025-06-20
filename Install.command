#!/bin/bash

# Plaud Chat - Installation Script
# This script installs the required Python dependencies for Plaud Chat

echo "🚀 Installing Plaud Chat Dependencies..."
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Error: backend directory not found!"
    echo "   Make sure this script is in the same folder as the backend directory."
    echo ""
    echo "Press any key to exit..."
    read -n 1
    exit 1
fi

# Check if requirements.txt exists
if [ ! -f "$BACKEND_DIR/requirements.txt" ]; then
    echo "❌ Error: requirements.txt not found in backend directory!"
    echo ""
    echo "Press any key to exit..."
    read -n 1
    exit 1
fi

echo "📁 Found backend directory: $BACKEND_DIR"
echo "📄 Found requirements.txt"
echo ""

# Check for Python 3
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
elif command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version 2>&1 | grep -o "Python 3")
    if [ "$PYTHON_VERSION" = "Python 3" ]; then
        PYTHON_CMD="python"
        PIP_CMD="pip"
    else
        echo "❌ Error: Python 3 is required but not found!"
        echo "   Please install Python 3 from https://python.org"
        echo ""
        echo "Press any key to exit..."
        read -n 1
        exit 1
    fi
else
    echo "❌ Error: Python is not installed!"
    echo "   Please install Python 3 from https://python.org"
    echo ""
    echo "Press any key to exit..."
    read -n 1
    exit 1
fi

echo "🐍 Using Python: $PYTHON_CMD"
echo "📦 Using pip: $PIP_CMD"
echo ""

# Navigate to backend directory
cd "$BACKEND_DIR"

echo "⚡ Installing dependencies..."
echo ""

# Install requirements
if $PIP_CMD install -r requirements.txt; then
    echo ""
    echo "✅ Installation completed successfully!"
    echo ""
    echo "🎉 Plaud Chat is ready to use!"
    echo ""
    echo "Next steps:"
    echo "1. Double-click Plaud.app to launch the application"
    echo "2. Add your Anthropic API key in Settings (⚙️)"
    echo "3. Start chatting with Claude!"
    echo ""
else
    echo ""
    echo "❌ Installation failed!"
    echo ""
    echo "Troubleshooting:"
    echo "• Make sure you have an internet connection"
    echo "• Try running: $PIP_CMD install --upgrade pip"
    echo "• You might need to install with: $PIP_CMD install --user -r requirements.txt"
    echo ""
fi

echo "Press any key to close..."
read -n 1