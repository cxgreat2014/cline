#!/bin/bash

# Cline Web Application Development Stop Script
# This script stops the development servers

set -e

echo "🛑 Stopping Cline Web Application Development Environment"
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

# Stop tmux session if it exists
stop_tmux_session() {
    if command -v tmux &> /dev/null; then
        if tmux has-session -t cline-web 2>/dev/null; then
            print_status "Stopping tmux session 'cline-web'..."
            tmux kill-session -t cline-web
            print_success "tmux session stopped"
        else
            print_status "No tmux session 'cline-web' found"
        fi
    fi
}

# Stop background processes
stop_background_processes() {
    # Stop server process
    if [ -f ".server.pid" ]; then
        SERVER_PID=$(cat .server.pid)
        if kill -0 $SERVER_PID 2>/dev/null; then
            print_status "Stopping server process (PID: $SERVER_PID)..."
            kill $SERVER_PID
            print_success "Server process stopped"
        else
            print_warning "Server process not running"
        fi
        rm .server.pid
    fi
    
    # Stop client process
    if [ -f ".client.pid" ]; then
        CLIENT_PID=$(cat .client.pid)
        if kill -0 $CLIENT_PID 2>/dev/null; then
            print_status "Stopping client process (PID: $CLIENT_PID)..."
            kill $CLIENT_PID
            print_success "Client process stopped"
        else
            print_warning "Client process not running"
        fi
        rm .client.pid
    fi
}

# Kill processes by port
kill_by_port() {
    local port=$1
    local service=$2
    
    local pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ ! -z "$pid" ]; then
        print_status "Killing $service process on port $port (PID: $pid)..."
        kill -9 $pid 2>/dev/null || true
        print_success "$service process killed"
    else
        print_status "No process found on port $port"
    fi
}

# Main cleanup function
main() {
    print_status "Stopping development servers..."
    
    # Try to stop tmux session first
    stop_tmux_session
    
    # Stop background processes
    stop_background_processes
    
    # Force kill processes on specific ports if they're still running
    print_status "Checking for remaining processes on ports 3000 and 8000..."
    kill_by_port 3000 "Frontend"
    kill_by_port 8000 "Backend"
    
    # Clean up any remaining Node.js processes related to our project
    print_status "Cleaning up any remaining Node.js processes..."
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    pkill -f "tsx watch" 2>/dev/null || true
    
    print_success "🎉 All development servers stopped successfully!"
    print_status "Logs are preserved in the logs/ directory"
}

# Run main function
main
