# MongoDB Connection Fix for Reminder Service

## Problem

The session reminder cron job was experiencing `MongoNotConnectedError` errors when trying to retrieve email credentials from the database. The error occurred because:

1. The `triggerReminders.js` script was designed to run once and close the database connection
2. When managed by PM2, the script runs continuously but the connection was being closed after the first execution
3. Subsequent cron job executions (every 30 minutes) failed because the database connection was no longer active

## Root Cause

```javascript
// OLD CODE - Problem: Closing DB connection after single execution
async function main() {
  await connectDB();
  await triggerReminders();
  // ❌ This closed the connection, breaking cron jobs
  await mongoose.connection.close();
}
```

## Solution Implemented

### 1. Modified `triggerReminders.js`

- **Keep database connection open** for continuous cron job execution
- **Initialize reminder service** to start cron jobs properly
- **Removed connection closing** logic that was breaking the cron scheduler

```javascript
// NEW CODE - Solution: Keep DB connection open
async function main() {
  await connectDB();

  // Initialize the reminder service cron jobs
  const { default: ReminderService } =
    await import("../src/services/reminderService.js");
  ReminderService.initialize();

  console.log("✅ Reminder service started with cron jobs");
  console.log("📊 Service status:", ReminderService.getStatus());

  // ✅ Keep the process running - don't close DB connection
  // The cron jobs will continue to run
}
```

### 2. Enhanced `credentialsManager.js`

Added automatic reconnection logic when database connection is lost:

```javascript
// Auto-reconnect on database errors
if (
  error.name === "MongoNotConnectedError" ||
  error.message.includes("connect")
) {
  console.error("⚠️ Database connection lost. Attempting to reconnect...");
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("✅ Database reconnected successfully");
      // Retry fetching credentials
      return await getEmailCredentials();
    }
  } catch (reconnectError) {
    console.error(
      "❌ Failed to reconnect to database:",
      reconnectError.message,
    );
  }
}
```

### 3. Enhanced `reminderService.js`

Added database connection check before each cron job execution:

```javascript
// Check database connection before processing reminders
const mongoose = require("mongoose");
if (mongoose.connection.readyState !== 1) {
  console.error("❌ Database not connected. Attempting to reconnect...");
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Database reconnected successfully");
  } catch (error) {
    console.error("❌ Failed to reconnect to database:", error.message);
    throw new Error("Database connection lost");
  }
}
```

## Files Modified

1. **`scripts/triggerReminders.js`**
   - Removed database connection closing logic
   - Added proper service initialization
   - Changed from one-time execution to continuous service mode

2. **`src/utils/credentialsManager.js`**
   - Added auto-reconnect logic in `getEmailCredentials()`
   - Added auto-reconnect logic in `getWhatsAppCredentials()`
   - Improved error handling for database connection issues

3. **`src/services/reminderService.js`**
   - Added database connection check in `scheduleSessionReminders()`
   - Automatic reconnection attempt before processing reminders

## Testing

After deploying these changes:

1. **Restart the PM2 process:**

   ```bash
   pm2 restart session-reminders
   ```

2. **Monitor logs:**

   ```bash
   pm2 logs session-reminders --lines 100
   ```

3. **Expected behavior:**
   - Service starts and connects to database
   - Cron job runs every 30 minutes
   - If database disconnects, automatic reconnection occurs
   - No more `MongoNotConnectedError` errors

## Monitoring

Check the logs at:

- `/var/www/backend/logs/reminder-error.log`
- `/var/www/backend/logs/reminder-out.log`

Look for:

- ✅ "Reminder service started with cron jobs"
- ✅ "Database connected successfully"
- ✅ "Session reminder job completed"
- ⚠️ Any reconnection attempts (indicates network issues)

## Prevention

To prevent similar issues in the future:

1. **Always keep database connections open** for long-running services
2. **Implement auto-reconnect logic** for all database operations
3. **Add connection health checks** before critical operations
4. **Use connection pooling** provided by Mongoose
5. **Monitor connection state** in production environments

## Related Memory

This fix addresses the issue documented in memory: "Node.js cron job missed execution fix" which noted problems with node-cron missing executions when database connections weren't properly maintained.
