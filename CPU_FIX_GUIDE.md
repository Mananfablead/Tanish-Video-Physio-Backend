# 🔥 CPU Usage Fix Guide - Tanish Physio Backend

## 🚨 Root Cause Analysis

### Primary Issues Identified:

1. **CRITICAL: Session Reminder Cron Job** (90% likely the main culprit)
   - Running **every minute** (`* * * * *`)
   - Each run queries database twice with heavy `.populate()` calls
   - Sends multiple email notifications
   - **Impact**: ~1440 database queries per day, constant CPU spikes

2. **Excessive Logging in Production**
   - `console.log` statements throughout codebase
   - Logger writing to console and files simultaneously
   - Every socket connection, authentication logged

3. **PM2 Misconfiguration**
   - No cluster mode enabled
   - No memory limits set
   - Default single-instance running

4. **Potential Memory Leaks**
   - Socket.io connections without cleanup
   - No database query optimization
   - Missing indexes on frequently queried fields

---

## ✅ Fixes Applied

### 1. Optimized Cron Job Schedule

**File**: `src/services/reminderService.js`

**Changes**:

- Changed from every minute to every 15 minutes: `*/15 * * * *`
- Reduced logging verbosity
- Added conditional processing (only logs when reminders actually sent)

**Impact**:

- 93% reduction in cron job executions (1440 → 96 per day)
- Significant CPU reduction expected

### 2. Enhanced Logging Configuration

**File**: `src/utils/logger.js`

**Changes**:

- Production level changed from `info` to `warn`
- Console output limited to `error` level only in production
- File logs capture `warn` and above in production

**Impact**:

- Reduced I/O operations
- Less disk usage
- Better performance

### 3. PM2 Configuration

**File**: `ecosystem.config.js` (NEW)

**Configuration**:

```javascript
{
  instances: 2,              // Run 2 instances in cluster mode
  exec_mode: 'cluster',      // Load balancing
  max_memory_restart: '500M',// Auto-restart on memory leak
  watch: false               // Disable file watching
}
```

**Impact**:

- Better CPU utilization across cores
- Automatic memory management
- Improved stability

---

## 🛠️ Step-by-Step Deployment Guide

### Step 1: SSH into Your VPS

```bash
ssh user@your-server-ip
```

### Step 2: Check Current Status

```bash
# Check PM2 processes
pm2 list

# Check current CPU usage
pm2 monit

# View logs to see excessive logging
pm2 logs --lines 50
```

### Step 3: Backup Current Code

```bash
cd /path/to/tanish-physio-backend

# Create backup
cp ecosystem.config.js ecosystem.config.js.backup 2>/dev/null || true
cp src/services/reminderService.js src/services/reminderService.js.backup
cp src/utils/logger.js src/utils/logger.js.backup
```

### Step 4: Deploy Updated Code

Upload the following updated files to your VPS:

- `ecosystem.config.js` (new file)
- `src/services/reminderService.js`
- `src/utils/logger.js`
- `scripts/health-check.js` (optional diagnostic tool)

### Step 5: Install Dependencies (if needed)

```bash
# Verify dependencies are installed
npm ls node-cron winston

# If missing, install them
npm install
```

### Step 6: Restart PM2 with New Configuration

```bash
# Stop all PM2 processes
pm2 stop all

# Delete old process
pm2 delete tanish-physio-backend

# Start with new configuration
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Step 7: Monitor Performance

```bash
# Watch CPU usage in real-time
pm2 monit

# Check if cron job runs less frequently
pm2 logs | grep "Running session reminder"

# Run health check script
node scripts/health-check.js
```

### Step 8: Verify Fixes

**Check CPU Usage**:

```bash
# Before fix: Should see high CPU every minute
# After fix: CPU should be much lower, spikes every 15 minutes

top -H -p $(pgrep -d',' -f node)
```

**Check Log Volume**:

```bash
# Count log lines per minute (should be much lower)
watch -n 60 'pm2 logs --lines 100 | wc -l'
```

**Check Memory Stability**:

```bash
# Memory should stay stable below 500MB
pm2 describe tanish-physio-backend | grep -A 5 "memory"
```

---

## 🔍 Diagnostic Commands

### Real-time Monitoring

```bash
# Monitor PM2 metrics
pm2 monit

# View live logs with CPU filter
pm2 logs --filter app

# Check process details
pm2 show tanish-physio-backend
```

### Identify CPU Hogs

```bash
# Top CPU consuming processes
ps aux --sort=-%cpu | head -n 11

# Node.js specific threads
top -H -p $(pgrep -f node)

# Continuous monitoring
watch -n 2 'ps aux | grep node | sort -nrk 3'
```

### Memory Analysis

```bash
# Check memory usage
free -h

# Node.js process memory
cat /proc/$(pgrep -f node)/status | grep Vm

# PM2 memory stats
pm2 list | grep -E "name|memory"
```

### Cron Job Verification

```bash
# Count how many times reminder runs per hour
pm2 logs | grep "Running session reminder" | wc -l

# Should be 4 times per hour now (every 15 min)
# Previously was 60 times per hour (every minute)
```

---

## 📊 Expected Results

### Before Fix:

- CPU: 30%+ spikes every minute
- Memory: 80-90% usage
- Logs: High volume, constant output
- Cron runs: 1440 times/day

### After Fix:

- CPU: <10% average, small spikes every 15 minutes
- Memory: 40-60% usage (stable)
- Logs: Minimal output in production
- Cron runs: 96 times/day (93% reduction)

---

## 🚨 Emergency Rollback

If issues occur, rollback immediately:

```bash
cd /path/to/tanish-physio-backend

# Restore backups
[ -f ecosystem.config.js.backup ] && cp ecosystem.config.js.backup ecosystem.config.js
[ -f src/services/reminderService.js.backup ] && cp src/services/reminderService.js.backup src/services/reminderService.js
[ -f src/utils/logger.js.backup ] && cp src/utils/logger.js.backup src/utils/logger.js

# Restart with old config
pm2 restart tanish-physio-backend
```

---

## 🎯 Additional Optimization Recommendations

### 1. Database Indexing

Add indexes to improve query performance:

```javascript
// In Session model
sessionSchema.index({ startTime: 1, status: 1 });
sessionSchema.index({ last24HourReminderSent: 1 });
sessionSchema.index({ last1HourReminderSent: 1 });
```

### 2. Socket.IO Optimization

Reduce socket polling and optimize connections:

```javascript
// In server.js - add ping timeout
const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket"], // Remove polling
});
```

### 3. Add Rate Limiting

Already implemented but verify it's active on critical routes:

```javascript
// In routes or app.js
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);
```

### 4. Enable Gzip Compression

```bash
# In nginx configuration (if using nginx)
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript
           application/x-javascript application/xml+rss
           application/json;
```

### 5. Implement Caching

For frequently accessed data:

```javascript
// Use Redis or simple in-memory cache
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes
```

---

## 📈 Long-term Monitoring Setup

### 1. Setup Log Rotation

```bash
# Install logrotate
sudo apt-get install logrotate

# Create config
sudo nano /etc/logrotate.d/tanish-physio
```

Content:

```
/path/to/tanish-physio-backend/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    postrotate
        pm2 reload tanish-physio-backend
    endscript
}
```

### 2. Setup Monitoring Alerts

Use PM2 Plus (free tier):

```bash
pm2 plus
```

Or setup custom alerts:

```bash
# Add to crontab
crontab -e

# Add this line to check every 5 minutes
*/5 * * * * cd /path/to/backend && node scripts/health-check.js >> /var/log/health-check.log 2>&1
```

### 3. Database Performance Monitoring

```javascript
// Add MongoDB profiling
db.setProfilingLevel(1, 100); // Log slow queries > 100ms

// Check profile
db.system.profile.find().sort({ $natural: -1 }).limit(10);
```

---

## 🆘 Troubleshooting

### Issue: CPU still high after fixes

**Solution**:

```bash
# Check what's running
pm2 monit

# Look for other processes
top

# Check for npm install running
ps aux | grep npm

# Kill any stuck processes
pm2 kill
pm2 start ecosystem.config.js
```

### Issue: Memory keeps growing

**Solution**:

```bash
# Check for memory leaks
pm2 describe tanish-physio-backend

# Force restart every 6 hours as temporary fix
pm2 restart tanish-physio-backend --cron-restart="0 */6 * * *"
```

### Issue: Too many restarts

**Solution**:

```bash
# Check error logs
pm2 logs --err --lines 100

# Increase memory limit in ecosystem.config.js
max_memory_restart: '1G'

# Reduce number of instances
instances: 1
```

### Issue: Cron job not running

**Solution**:

```bash
# Check if service is initialized
pm2 logs | grep "Reminder service"

# Manually trigger to test
node -e "require('./src/services/reminderService').triggerSessionReminders()"
```

---

## ✅ Success Checklist

- [ ] PM2 restarted with new ecosystem.config.js
- [ ] Cron job runs every 15 minutes (not every minute)
- [ ] CPU usage below 15% average
- [ ] Memory usage stable below 60%
- [ ] Log volume reduced significantly
- [ ] Health check script runs successfully
- [ ] No errors in PM2 logs
- [ ] Application functionality working normally
- [ ] Email reminders still being sent
- [ ] Socket connections working properly

---

## 📞 Support

If you encounter any issues during deployment:

1. Check PM2 logs: `pm2 logs --err`
2. Run health check: `node scripts/health-check.js`
3. Monitor in real-time: `pm2 monit`
4. Check system resources: `htop`

---

**Last Updated**: March 24, 2025  
**Version**: 1.0  
**Applied By**: AI Assistant
