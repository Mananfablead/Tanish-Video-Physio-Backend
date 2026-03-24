# 🚀 Quick Start - Deploy CPU Fixes

## ⚡ One-Command Deployment

After uploading files to your VPS:

```bash
cd /path/to/tanish-physio-backend
chmod +x deploy-fix.sh
./deploy-fix.sh
```

That's it! The script will:

- ✅ Create backups
- ✅ Stop old processes
- ✅ Start with optimized configuration
- ✅ Setup PM2 auto-start

---

## 📋 Manual Deployment (Alternative)

If you prefer manual deployment:

### 1. Upload these files to your VPS:

- `ecosystem.config.js` (new)
- `src/services/reminderService.js` (updated)
- `src/utils/logger.js` (updated)
- `scripts/health-check.js` (new)
- `scripts/monitor.js` (new)

### 2. SSH into your VPS:

```bash
ssh user@your-server-ip
cd /path/to/tanish-physio-backend
```

### 3. Restart PM2:

```bash
pm2 stop all
pm2 delete tanish-physio-backend
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

---

## 🔍 Verify the Fix is Working

### Check Cron Job Frequency (CRITICAL!)

Before fix: Runs every minute (60 times/hour)
After fix: Runs every 15 minutes (4 times/hour)

```bash
# Watch logs in real-time
pm2 logs --lines 100 | grep "Running session reminder"

# Count how many times it ran in last hour
pm2 logs | grep "Running session reminder" | wc -l
```

**Expected**: Should see only 4 runs per hour now (was 60 before)

### Monitor Resources

```bash
# Real-time monitoring
pm2 monit

# Or use our custom monitor
npm run monitor

# Check health
npm run health-check
```

### Expected Improvements

| Metric        | Before | After  | Improvement   |
| ------------- | ------ | ------ | ------------- |
| CPU Avg       | 30%+   | <15%   | **~50-70% ↓** |
| Memory        | 80-90% | 40-60% | **~40-50% ↓** |
| Cron Runs/Day | 1440   | 96     | **93% ↓**     |
| Log Volume    | High   | Low    | **~80% ↓**    |

---

## 🛠️ Useful Commands

### Daily Monitoring

```bash
# Check current status
pm2 list

# View errors only
pm2 logs --err

# Monitor resources
pm2 monit

# Run health check
npm run health-check
```

### Troubleshooting

```bash
# If CPU still high, check what's running
top -H -p $(pgrep -d',' -f node)

# Check for stuck npm install processes
ps aux | grep npm

# Force restart if needed
pm2 kill
pm2 start ecosystem.config.js
```

### Logs Management

```bash
# Clear old logs
pm2 flush

# View live logs
pm2 logs

# View last 50 lines
pm2 logs --lines 50
```

---

## 📊 What Was Fixed?

### 1. Cron Job Optimization

**Before**: Session reminders ran **every minute**

```javascript
cron.schedule('* * * * *', ...) // 1440 runs/day
```

**After**: Session reminders run **every 15 minutes**

```javascript
cron.schedule('*/15 * * * *', ...) // 96 runs/day
```

**Impact**: 93% reduction in database queries and CPU usage

### 2. Logging Optimization

**Before**: Logged everything to console and files

```javascript
level: "info"; // Logged info, warn, error
```

**After**: Only log warnings and errors

```javascript
level: "warn"; // Only warn and error
```

**Impact**: Reduced I/O operations and disk usage

### 3. PM2 Configuration

**Before**: Single instance, no limits

```javascript
// Default settings
```

**After**: Cluster mode, memory limits

```javascript
{
  instances: 2,
  exec_mode: 'cluster',
  max_memory_restart: '500M'
}
```

**Impact**: Better resource utilization and stability

---

## 🎯 Success Criteria

Your deployment is successful when:

- [ ] `pm2 list` shows process as "online"
- [ ] CPU usage is below 15% average
- [ ] Memory usage is stable at 40-60%
- [ ] Cron job runs every 15 minutes (not every minute)
- [ ] No errors in `pm2 logs --err`
- [ ] Application works normally (test booking, etc.)
- [ ] Email reminders still being sent

---

## 🆘 Emergency Rollback

If something goes wrong:

```bash
cd /path/to/tanish-physio-backend

# Restore backups
cp src/services/reminderService.js.backup.* src/services/reminderService.js
cp src/utils/logger.js.backup.* src/utils/logger.js

# Restart with old config
pm2 restart tanish-physio-backend
```

---

## 📞 Need Help?

### Diagnostic Commands

```bash
# Full system diagnostics
npm run health-check

# Real-time monitoring
npm run monitor

# Check PM2 details
pm2 show tanish-physio-backend

# View error logs
tail -f logs/error.log

# Check cron activity
grep "Running session reminder" logs/combined.log
```

### Common Issues

**Issue**: Process keeps restarting

```bash
# Check why
pm2 logs --err --lines 100

# Increase memory limit
nano ecosystem.config.js
# Change: max_memory_restart: '1G'

pm2 restart tanish-physio-backend
```

**Issue**: Reminders not being sent

```bash
# Manually trigger to test
node -e "require('./src/services/reminderService').triggerSessionReminders()"

# Check logs
pm2 logs | grep -i reminder
```

**Issue**: Can't connect to database

```bash
# Check MongoDB connection
mongosh --eval "db.adminCommand('ping')"

# Restart PM2
pm2 restart tanish-physio-backend
```

---

## 📈 Long-term Maintenance

### Weekly Checks

```bash
# Check disk space
df -h

# Check log file sizes
du -sh logs/*

# Rotate logs if needed
pm2 flush
```

### Monthly Tasks

```bash
# Update dependencies
npm update

# Clean npm cache
npm cache clean --force

# Restart PM2 for fresh start
pm2 restart all
```

---

## 🎉 That's It!

Your server should now be running optimally. Monitor for the first hour to ensure:

1. CPU stays below 15%
2. Memory is stable
3. Cron runs every 15 minutes
4. No errors in logs

**Expected CPU Pattern**:

- Baseline: 2-5%
- During cron (every 15 min): 10-15% spike
- After cron completes: Back to baseline

**Expected Memory Pattern**:

- Stable at 300-500MB
- Occasional spikes during heavy operations
- Auto-restart if exceeds 500MB limit

---

**Last Updated**: March 24, 2025  
**Deployment Time**: ~5 minutes  
**Difficulty**: Easy
