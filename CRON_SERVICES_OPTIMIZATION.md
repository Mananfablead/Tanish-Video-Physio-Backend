# 🔧 Cron Services Optimization Guide

## ✅ Changes Made

### 1. Session Reminders - ENABLED ✓

**Status:** Now ACTIVE and will run every 15 minutes

**What was changed:**

- ✅ Uncommented `ReminderService.initialize()` in `src/utils/serviceInitializer.utils.js`
- ✅ Enhanced logging with timestamps and performance metrics
- ✅ Added detailed summary of reminders sent (24h & 1h)

**Schedule:** `*/15 * * * *` (Every 15 minutes)

**What it does:**

- Sends 24-hour session reminders to patients and admins
- Sends 1-hour session reminders to patients and admins
- Updates database with reminder timestamps
- Prevents duplicate reminders

---

### 2. Stale Payment Cleanup - AUTO-START ✓

**Status:** Now added to PM2 ecosystem config

**What was changed:**

- ✅ Added new PM2 app: `stale-payment-cleanup`
- ✅ Configured to run every 1 minute
- ✅ Separate log files for better monitoring
- ✅ Resource limits: 200MB max memory

**Schedule:** `* * * * *` (Every 1 minute)

**What it does:**

- Automatically expires stale pending payments (>1 hour old)
- Cleans up expired Razorpay payment records
- Logs processed, updated, and failed counts

---

## 🚀 Deployment Instructions

### Step 1: Generate Admin Token (Required)

Run this command on your server to generate a fresh admin token:

```bash
cd /var/www/backend/tanish-physio-backend
node scripts/generateAdminToken.js
```

Copy the generated token and add it to your `.env` file:

```bash
nano .env
```

Add or update this line:

```
ADMIN_TOKEN=your_generated_token_here
```

---

### Step 2: Deploy Updated Files

Upload these modified files to your VPS:

```bash
# Modified files list:
1. src/utils/serviceInitializer.utils.js  # Enable session reminders
2. src/services/reminderService.js        # Enhanced logging
3. ecosystem.config.js                     # Added stale payment cleanup
```

**Upload to:** `/var/www/backend/tanish-physio-backend/`

---

### Step 3: Restart Services on VPS

SSH into your Hostinger VPS:

```bash
ssh user@your-vps-ip
cd /var/www/backend/tanish-physio-backend
```

#### Option A: Full Restart (Recommended)

```bash
# Stop all PM2 processes
pm2 stop all

# Delete all PM2 processes
pm2 delete all

# Start with new ecosystem config
pm2 start ecosystem.config.js --only tanish-physio-backend

# Wait 5 seconds, then start stale payment cleanup
sleep 5
pm2 start ecosystem.config.js --only stale-payment-cleanup

# Save PM2 process list
pm2 save
```

#### Option B: Quick Restart

```bash
# Just restart backend (will auto-initialize reminders)
pm2 restart tanish-physio-backend

# Start stale payment cleanup
pm2 start stale-payment-cleanup

# Save PM2 process list
pm2 save
```

---

### Step 4: Verify Services are Running

Check if both services are active:

```bash
# List all PM2 processes
pm2 status

# Expected output:
# ┌─────┬──────────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
# │ id  │ name                     │ mode     │ ↺    │ status    │ cpu      │ memory   │
# ├─────┼──────────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
# │ 0   │ tanish-physio-backend    │ cluster  │ ...  │ online    │ ...      │ ...      │
# │ 1   │ stale-payment-cleanup    │ fork     │ ...  │ online    │ ...      │ ...      │
# └─────┴──────────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

---

### Step 5: Monitor Logs

#### Monitor Session Reminders:

```bash
# Watch backend logs for reminder activity
pm2 logs tanish-physio-backend --lines 50

# Look for:
# ✓ "Reminder service initialized successfully"
# ✓ "Session reminders: Every 15 minutes"
# ✓ "Running session reminder job..."
# ✓ "24-hour reminders sent: X"
# ✓ "1-hour reminders sent: X"
```

#### Monitor Stale Payment Cleanup:

```bash
# Watch stale payment cleanup logs
pm2 logs stale-payment-cleanup --lines 50

# Look for:
# ✓ "Starting Stale Payment Cleanup Cron Job..."
# ✓ "Running stale payment cleanup..."
# ✓ "Cleanup completed successfully!"
# ✓ "Processed: X, Updated: X, Failed: X"
```

---

## 📊 Expected Behavior

### Session Reminders Log Output:

```
📅 Scheduling session reminders: Every 15 minutes
✓ Reminder service initialized successfully
📅 Session reminders: Every 15 minutes (24h & 1h before session)

⏰ [2026-03-24T10:15:00.000Z] Running session reminder job...
📊 Session Reminder Summary:
   ✅ 24-hour reminders sent: 3
   ✅ 1-hour reminders sent: 5
   ⏱️ Total time: 1234ms

✅ Session reminder job completed in 1234ms
```

### Stale Payment Cleanup Log Output:

```
🚀 Starting Stale Payment Cleanup Cron Job...
📡 Backend URL: http://localhost:5000
⏰ Schedule: Every 1 minute
---
✅ Cron job started successfully!
💡 Press Ctrl+C to stop
---

⏰ [24/03/2026, 15:45:32] Running stale payment cleanup...
✅ Cleanup completed successfully!
   📊 Processed: 15
   ✔️ Updated: 8
   ❌ Failed: 0
   ⏰ Expiry Time: 24/03/2026, 14:45:32
```

---

## 🔍 Troubleshooting

### Issue 1: Reminder Service Not Starting

**Check logs:**

```bash
pm2 logs tanish-physio-backend | grep "Reminder service"
```

**Expected:** "✓ Reminder service initialized successfully"

**If not found:** Check `serviceInitializer.utils.js` file is correctly uploaded

---

### Issue 2: Stale Payment Cleanup Not Running

**Check if process exists:**

```bash
pm2 list | grep stale-payment
```

**Check logs:**

```bash
pm2 logs stale-payment-cleanup
```

**Common errors:**

- Missing `ADMIN_TOKEN` in `.env`
- Backend not running on port 5000
- Network/firewall issues

---

### Issue 3: High Memory Usage

**Monitor memory:**

```bash
pm2 status
```

**If memory > 200MB for stale-payment-cleanup:**

```bash
pm2 restart stale-payment-cleanup
```

**If memory > 500MB for backend:**

```bash
pm2 restart tanish-physio-backend
```

---

## 📈 Monitoring Dashboard

Create a quick monitoring script:

```bash
# Create monitor.sh
nano /var/www/backend/monitor.sh
```

```bash
#!/bin/bash
echo "======================================"
echo "  Tanish Physio Services Status"
echo "======================================"
echo ""
pm2 status
echo ""
echo "Last 10 reminder logs:"
pm2 logs tanish-physio-backend --lines 10 --nostream | grep "reminder"
echo ""
echo "Last 10 cleanup logs:"
pm2 logs stale-payment-cleanup --lines 10 --nostream | grep "Cleanup"
echo ""
echo "======================================"
```

Make it executable:

```bash
chmod +x /var/www/backend/monitor.sh
./monitor.sh
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Both PM2 processes show "online" status
- [ ] Backend logs show "Reminder service initialized successfully"
- [ ] Stale payment cleanup logs show successful cleanup runs
- [ ] No error messages in PM2 error logs
- [ ] Memory usage within limits (<500MB backend, <200MB cleanup)
- [ ] Session reminders being sent every 15 minutes
- [ ] Stale payments being cleaned every minute

---

## 🎯 Performance Impact

### Before Optimization:

- ❌ Session reminders: NOT RUNNING
- ❌ Stale payment cleanup: NOT STARTED
- Manual intervention required

### After Optimization:

- ✅ Session reminders: Auto-run every 15 minutes
- ✅ Stale payment cleanup: Auto-run every 1 minute
- Zero manual intervention
- Better cash flow (faster payment expiry)
- Better patient attendance (automated reminders)

---

## 📞 Support

If you face any issues during deployment:

1. Check PM2 logs: `pm2 logs --lines 100`
2. Verify .env configuration: `cat .env | grep ADMIN_TOKEN`
3. Test backend health: `curl http://localhost:5000/api/health`
4. Check MongoDB connection: `pm2 logs tanish-physio-backend | grep MongoDB`

---

**Created:** March 24, 2026  
**Optimized by:** AI Assistant  
**Status:** Production Ready ✅
