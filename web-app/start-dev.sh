#!/bin/bash

# Cline Web Application Development Startup Script
# This script sets up and starts the development environment

set -e

echo "🚀 Starting Cline Web Application Development Environment"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) is installed"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    print_success "npm $(npm --version) is installed"
}

# Create environment file if it doesn't exist
setup_env() {
    if [ ! -f ".env" ]; then
        print_status "Creating .env file from template..."
        cp .env.example .env
        print_warning "Please edit .env file and add your API keys before starting the server"
        print_warning "Required: ANTHROPIC_API_KEY or OPENAI_API_KEY"
    else
        print_success ".env file already exists"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    if [ ! -d "node_modules" ]; then
        print_status "Installing root dependencies..."
        npm install
    fi
    
    # Install server dependencies
    if [ ! -d "server/node_modules" ]; then
        print_status "Installing server dependencies..."
        cd server && npm install && cd ..
    fi
    
    # Install client dependencies
    if [ ! -d "client/node_modules" ]; then
        print_status "Installing client dependencies..."
        cd client && npm install && cd ..
    fi
    
    print_success "All dependencies installed"
}

# Create data directories
setup_directories() {
    print_status "Setting up directories..."
    
    mkdir -p data
    mkdir -p logs
    mkdir -p uploads
    mkdir -p repositories
    
    print_success "Directories created"
}

# Check if ports are available
check_ports() {
    print_status "Checking if ports are available..."
    
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port 8000 is already in use. Please stop the process or change the port."
    else
        print_success "Port 8000 is available for backend server"
    fi
    
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port 3000 is already in use. Please stop the process or change the port."
    else
        print_success "Port 3000 is available for frontend server"
    fi
}

# Start the development servers
start_servers() {
    print_status "Starting development servers..."
    
    # Check if tmux is available for better terminal management
    if command -v tmux &> /dev/null; then
        print_status "Using tmux for session management..."
        
        # Create new tmux session
        tmux new-session -d -s cline-web
        
        # Split window for server and client
        tmux split-window -h
        
        # Start server in left pane
        tmux send-keys -t cline-web:0.0 'cd server && npm run dev' Enter
        
        # Start client in right pane
        tmux send-keys -t cline-web:0.1 'cd client && npm run dev' Enter
        
        # Attach to session
        print_success "Development servers started in tmux session 'cline-web'"
        print_status "To attach to the session: tmux attach -t cline-web"
        print_status "To detach from session: Ctrl+B then D"
        print_status "To kill session: tmux kill-session -t cline-web"
        
        tmux attach -t cline-web
        
    else
        print_status "tmux not available, starting servers in background..."
        
        # Start server in background
        cd server
        npm run dev > ../logs/server.log 2>&1 &
        SERVER_PID=$!
        cd ..
        
        # Start client in background
        cd client
        npm run dev > ../logs/client.log 2>&1 &
        CLIENT_PID=$!
        cd ..
        
        # Save PIDs for cleanup
        echo $SERVER_PID > .server.pid
        echo $CLIENT_PID > .client.pid
        
        print_success "Development servers started in background"
        print_status "Server PID: $SERVER_PID (log: logs/server.log)"
        print_status "Client PID: $CLIENT_PID (log: logs/client.log)"
        print_status "To stop servers: ./stop-dev.sh"
        
        # Wait a moment for servers to start
        sleep 3
        
        print_success "🎉 Cline Web Application is starting up!"
        print_status "Backend server: http://localhost:8000"
        print_status "Frontend application: http://localhost:3000"
        print_status "API documentation: http://localhost:8000/health"
        
        # Follow logs
        print_status "Following server logs (Ctrl+C to stop)..."
        tail -f logs/server.log logs/client.log
    fi
}

# Main execution
main() {
    print_status "Checking system requirements..."
    check_node
    check_npm
    
    print_status "Setting up environment..."
    setup_env
    setup_directories
    
    print_status "Installing dependencies..."
    install_dependencies
    
    print_status "Checking ports..."
    check_ports
    
    print_status "Starting development environment..."
    start_servers
}

# Handle script interruption
cleanup() {
    print_status "Cleaning up..."
    if [ -f ".server.pid" ]; then
        kill $(cat .server.pid) 2>/dev/null || true
        rm .server.pid
    fi
    if [ -f ".client.pid" ]; then
        kill $(cat .client.pid) 2>/dev/null || true
        rm .client.pid
    fi
    exit 0
}

trap cleanup INT TERM

# Run main function
main
