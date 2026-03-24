#!/bin/bash

# Tanish Physio - Cron Services Deployment Script
# This script deploys optimized cron services to your VPS

echo "======================================"
echo "  Cron Services Deployment Script"
echo "======================================"
echo ""

# Configuration
VPS_USER="root"
VPS_IP="your-vps-ip"
BACKEND_PATH="/var/www/backend/tanish-physio-backend"

echo "📋 Pre-deployment Checklist:"
echo ""
read -p "✓ Have you uploaded modified files to VPS? (y/n): " uploaded
if [ "$uploaded" != "y" ]; then
    echo ""
    echo "❌ Please upload these files first:"
    echo "   1. src/utils/serviceInitializer.utils.js"
    echo "   2. src/services/reminderService.js"
    echo "   3. ecosystem.config.js"
    echo ""
    echo "Upload command example:"
    echo "scp src/utils/serviceInitializer.utils.js $VPS_USER@$VPS_IP:$BACKEND_PATH/src/utils/"
    echo "scp src/services/reminderService.js $VPS_USER@$VPS_IP:$BACKEND_PATH/src/services/"
    echo "scp ecosystem.config.js $VPS_USER@$VPS_IP:$BACKEND_PATH/"
    exit 1
fi

echo ""
echo "✅ Files uploaded confirmed!"
echo ""

# Step 1: Generate Admin Token
echo "🔑 Step 1: Generating Admin Token..."
echo ""
echo "Run this on your VPS:"
echo "  cd $BACKEND_PATH"
echo "  node scripts/generateAdminToken.js"
echo ""
read -p "Press Enter after generating the token..."

# Step 2: Update .env with Admin Token
echo ""
echo "📝 Step 2: Update .env file with generated token"
echo ""
echo "Run: nano $BACKEND_PATH/.env"
echo "Add line: ADMIN_TOKEN=your_generated_token_here"
echo ""
read -p "Press Enter after updating .env..."

# Step 3: Restart Services
echo ""
echo "🚀 Step 3: Restarting PM2 Services..."
echo ""
echo "Run these commands on your VPS:"
echo ""
echo "# SSH into VPS"
echo "ssh $VPS_USER@$VPS_IP"
echo ""
echo "# Navigate to backend directory"
echo "cd $BACKEND_PATH"
echo ""
echo "# Stop all services"
echo "pm2 stop all"
echo ""
echo "# Delete all services"
echo "pm2 delete all"
echo ""
echo "# Start backend (with session reminders)"
echo "pm2 start ecosystem.config.js --only tanish-physio-backend"
echo ""
echo "# Wait 5 seconds"
echo "sleep 5"
echo ""
echo "# Start stale payment cleanup"
echo "pm2 start ecosystem.config.js --only stale-payment-cleanup"
echo ""
echo "# Save PM2 process list"
echo "pm2 save"
echo ""
read -p "Press Enter after starting services..."

# Step 4: Verify
echo ""
echo "✅ Step 4: Verify Services"
echo ""
echo "Run: pm2 status"
echo ""
echo "Expected output:"
echo "  ┌─────┬──────────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐"
echo "  │ id  │ name                     │ mode     │ ↺    │ status    │ cpu      │ memory   │"
echo "  ├─────┼──────────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤"
echo "  │ 0   │ tanish-physio-backend    │ cluster  │ ...  │ online    │ ...      │ ...      │"
echo "  │ 1   │ stale-payment-cleanup    │ fork     │ ...  │ online    │ ...      │ ...      │"
echo "  └─────┴──────────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘"
echo ""

# Step 5: Monitor Logs
echo ""
echo "📊 Step 5: Monitor Logs"
echo ""
echo "# Check session reminders"
echo "pm2 logs tanish-physio-backend --lines 50 | grep 'reminder'"
echo ""
echo "# Check payment cleanup"
echo "pm2 logs stale-payment-cleanup --lines 50"
echo ""

echo "======================================"
echo "  ✅ Deployment Complete!"
echo "======================================"
echo ""
echo "Next Steps:"
echo "1. Wait 15 minutes for first session reminder run"
echo "2. Wait 1 minute for first payment cleanup run"
echo "3. Monitor logs regularly"
echo "4. Check CRON_SERVICES_OPTIMIZATION.md for troubleshooting"
echo ""
echo "Happy automating! 🎉"
