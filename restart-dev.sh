#!/bin/bash

# Restart Dev Servers Script
# Kills all running dev servers and restarts them

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Restart Dev Servers Script          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"

# Get the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Function to kill processes on a specific port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}  → Killing processes on port $port (PIDs: $pids)${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        return 0
    fi
    return 1
}

# Function to kill node processes related to this project
kill_node_processes() {
    local killed=false
    
    # Kill vite dev server processes
    if pkill -f "vite dev" 2>/dev/null; then
        echo -e "${YELLOW}  → Killed 'vite dev' processes${NC}"
        killed=true
    fi
    
    if pkill -f "node.*vite" 2>/dev/null; then
        echo -e "${YELLOW}  → Killed vite node processes${NC}"
        killed=true
    fi
    
    if [ "$killed" = true ]; then
        sleep 1
    fi
}

# Step 1: Stop existing servers
echo -e "${YELLOW}Step 1: Stopping existing dev servers...${NC}"

PORTS_KILLED=0
kill_port 5173 && PORTS_KILLED=$((PORTS_KILLED + 1))  # Vite default port
kill_port 3000 && PORTS_KILLED=$((PORTS_KILLED + 1))  # Common dev port
kill_port 8080 && PORTS_KILLED=$((PORTS_KILLED + 1))  # Common dev port

kill_node_processes

if [ $PORTS_KILLED -eq 0 ]; then
    echo -e "${GREEN}  ✓ No servers found running${NC}\n"
else
    echo -e "${GREEN}  ✓ Stopped $PORTS_KILLED server(s)${NC}\n"
fi

# Wait for ports to be released
sleep 2

# Step 2: Start the dev server
echo -e "${YELLOW}Step 2: Starting dev server...${NC}"
echo -e "${BLUE}  Command: npm run dev${NC}"
echo -e "${BLUE}  URL: http://localhost:5173${NC}\n"

# Start the dev server in foreground (so user can see output and Ctrl+C to stop)
exec npm run dev

