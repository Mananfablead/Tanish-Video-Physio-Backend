#!/bin/bash

# ============================================
# CPU Fix Deployment Script
# For Tanish Physio Backend
# ============================================

echo "============================================"
echo "🚀 Deploying CPU Performance Fixes"
echo "============================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from backend directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Please run this script from the tanish-physio-backend directory${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Pre-deployment checks...${NC}"
echo ""

# Check PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 is not installed. Install it with: npm install -g pm2${NC}"
    exit 1
fi
echo -e "${GREEN}✓ PM2 is installed${NC}"

# Check Node.js is running
if ! pgrep -f "node.*server.js" > /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js server is not running${NC}"
fi

echo ""
echo -e "${YELLOW}📊 Current PM2 Status:${NC}"
pm2 list
echo ""

# Backup current configuration
echo -e "${YELLOW}🔄 Creating backups...${NC}"

if [ -f "ecosystem.config.js" ]; then
    cp ecosystem.config.js ecosystem.config.js.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✓ Backed up ecosystem.config.js${NC}"
fi

if [ -f "src/services/reminderService.js" ]; then
    cp src/services/reminderService.js src/services/reminderService.js.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✓ Backed up reminderService.js${NC}"
fi

if [ -f "src/utils/logger.js" ]; then
    cp src/utils/logger.js src/utils/logger.js.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✓ Backed up logger.js${NC}"
fi

echo ""
echo -e "${GREEN}✓ All backups created${NC}"
echo ""

# Verify new files exist
echo -e "${YELLOW}📁 Verifying updated files...${NC}"

if [ ! -f "ecosystem.config.js" ]; then
    echo -e "${RED}❌ ecosystem.config.js not found!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ ecosystem.config.js exists${NC}"

if [ ! -f "src/services/reminderService.js" ]; then
    echo -e "${RED}❌ src/services/reminderService.js not found!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ reminderService.js exists${NC}"

if [ ! -f "src/utils/logger.js" ]; then
    echo -e "${RED}❌ src/utils/logger.js not found!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ logger.js exists${NC}"

echo ""
echo -e "${YELLOW}🛑 Stopping PM2 processes...${NC}"
pm2 stop all
sleep 2

echo ""
echo -e "${YELLOW}🗑️  Deleting old process...${NC}"
pm2 delete tanish-physio-backend 2>/dev/null || echo "Process didn't exist, continuing..."
sleep 1

echo ""
echo -e "${YELLOW}🚀 Starting with new configuration...${NC}"
pm2 start ecosystem.config.js --env production
sleep 3

echo ""
echo -e "${YELLOW}💾 Saving PM2 process list...${NC}"
pm2 save

echo ""
echo -e "${YELLOW}⚙️  Setting up PM2 startup (may require sudo)...${NC}"
pm2 startup 2>/dev/null || echo -e "${YELLOW}⚠️  Startup command skipped (run manually if needed)${NC}"

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""

echo "============================================"
echo "📊 New PM2 Status"
echo "============================================"
pm2 list
echo ""

echo "============================================"
echo "🔍 Quick Verification Commands"
echo "============================================"
echo ""
echo "Monitor CPU/Memory usage:"
echo "  pm2 monit"
echo ""
echo "View logs:"
echo "  pm2 logs"
echo ""
echo "Check cron job frequency (should run every 15 min):"
echo "  pm2 logs | grep 'Running session reminder'"
echo ""
echo "Run health check:"
echo "  node scripts/health-check.js"
echo ""
echo "Detailed process info:"
echo "  pm2 show tanish-physio-backend"
echo ""

echo "============================================"
echo "🎯 Expected Improvements"
echo "============================================"
echo ""
echo "• CPU usage: Should drop to <15% average"
echo "• Memory: Should stabilize at 40-60%"
echo "• Cron runs: Reduced from 1440 to 96 per day (93% less)"
echo "• Logging: Minimal console output in production"
echo ""

echo "============================================"
echo "📈 Next Steps"
echo "============================================"
echo ""
echo "1. Monitor for 15-30 minutes to see improved performance"
echo "2. Check that email reminders are still being sent"
echo "3. Verify application functionality is working normally"
echo "4. Review logs for any errors"
echo ""

echo -e "${GREEN}✨ All done! Your server should now be optimized.${NC}"
echo ""
