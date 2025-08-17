#!/bin/bash

# Northeast India Social Forum - Production Setup Script
# This script helps set up the production environment

set -e  # Exit on any error

echo "🚀 Northeast India Social Forum - Production Setup"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "backend/server.js" ]; then
    print_error "Please run this script from the india-news-app root directory"
    exit 1
fi

echo ""
print_info "Step 1: Environment Setup"
echo "=========================="

# Check if .env.production.template exists
if [ ! -f "backend/.env.production.template" ]; then
    print_error ".env.production.template not found!"
    exit 1
fi

# Copy template to .env if it doesn't exist
if [ ! -f "backend/.env" ]; then
    cp backend/.env.production.template backend/.env
    print_status "Created backend/.env from template"
    print_warning "IMPORTANT: You must edit backend/.env with your actual values!"
else
    print_warning "backend/.env already exists - please verify it has production values"
fi

echo ""
print_info "Step 2: Redis (Upstash) Setup Required"
echo "======================================"
echo "1. Go to: https://console.upstash.com/"
echo "2. Create new Redis database:"
echo "   - Name: neisf-production-cache"
echo "   - Region: Choose closest to your server"
echo "   - Type: Pay as you go"
echo "3. Copy the REST URL and Token to your .env file"
echo ""

echo ""
print_info "Step 3: Required Environment Variables"
echo "====================================="
echo "Edit backend/.env and set these CRITICAL values:"
echo ""
echo "🔴 CRITICAL SETTINGS:"
echo "NODE_ENV=production"
echo "TEST_MODE=false"
echo ""
echo "🔴 REDIS (from Upstash console):"
echo "REDIS_URL=https://your-database-name.upstash.io"
echo "REDIS_TOKEN=your-upstash-rest-token"
echo ""
echo "🔴 DATABASE:"
echo "MONGODB_URI=mongodb+srv://your-atlas-connection"
echo ""
echo "🔴 SECURITY (generate strong secrets):"
echo "JWT_SECRET=your-super-strong-jwt-secret-min-32-chars"
echo "JWT_REFRESH_SECRET=your-super-strong-refresh-secret-min-32-chars"
echo ""

# Check if Node.js and npm are installed
echo ""
print_info "Step 4: Dependencies Check"
echo "=========================="

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found! Please install Node.js 18+"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_status "npm installed: $NPM_VERSION"
else
    print_error "npm not found!"
    exit 1
fi

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 --version)
    print_status "PM2 installed: $PM2_VERSION"
else
    print_warning "PM2 not found. Installing PM2 globally..."
    npm install -g pm2
    print_status "PM2 installed successfully"
fi

# Install backend dependencies
echo ""
print_info "Step 5: Installing Dependencies"
echo "==============================="
cd backend
npm install --production
print_status "Backend dependencies installed"
cd ..

echo ""
print_info "Step 6: Production Deployment Commands"
echo "======================================"
echo "After setting up your .env file, run these commands:"
echo ""
echo "# Navigate to backend directory"
echo "cd backend"
echo ""
echo "# Start with PM2 in production mode"
echo "pm2 start server.js --name neisf --env production"
echo ""
echo "# Save PM2 configuration"
echo "pm2 save"
echo ""
echo "# Setup PM2 startup script (auto-restart on server reboot)"
echo "pm2 startup"
echo ""

echo ""
print_info "Step 7: Post-Deployment Validation"
echo "=================================="
echo "After deployment, run these checks:"
echo ""
echo "# Health check"
echo "curl http://localhost:8080/health"
echo ""
echo "# Verify environment"
echo "node -e \"console.log('NODE_ENV:', process.env.NODE_ENV, 'TEST_MODE:', process.env.TEST_MODE)\""
echo ""
echo "# Check PM2 status"
echo "pm2 status"
echo "pm2 logs neisf"
echo ""

echo ""
print_info "Step 8: Production Load Test"
echo "============================"
echo "Run production smoke test (after deployment):"
echo ""
echo "cd ../load"
echo "TEST_MODE=false k6 run smoke-test.js"
echo ""
echo "Expected results:"
echo "✅ Error Rate: <1% (stricter than CI's 4%)"
echo "✅ p95 Response Time: <500ms"
echo "✅ Cache Hit Rate: >90% for JWT"
echo ""

echo ""
print_warning "CRITICAL SAFETY REMINDERS:"
echo "=========================="
echo "🔴 Verify TEST_MODE=false in production"
echo "🔴 Verify NODE_ENV=production"
echo "🔴 Ensure Redis credentials are correct"
echo "🔴 Test health endpoint before going live"
echo "🔴 Monitor error rates and response times"
echo ""

print_status "Production setup script completed!"
print_info "Next: Edit backend/.env with your actual values, then deploy!"