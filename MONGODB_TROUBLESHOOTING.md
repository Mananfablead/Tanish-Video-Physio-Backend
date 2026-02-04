# MongoDB Connection Timeout Troubleshooting Guide

## Common Causes & Solutions

### 1. **Network Connectivity Issues**

- **Symptom**: "buffering timed out after 10000ms"
- **Solution**:
  - Check your internet connection
  - Verify firewall settings aren't blocking MongoDB connections
  - Test with `npm run test:db`

### 2. **MongoDB Atlas Cluster Issues**

- **Symptom**: Connection hangs or times out consistently
- **Solution**:
  - Log into MongoDB Atlas dashboard
  - Check if your cluster is "Paused" - resume it if needed
  - Verify cluster status is "Active"
  - Check cluster metrics for any issues

### 3. **IP Whitelist Problems**

- **Symptom**: Connection refused or timeout from specific locations
- **Solution**:
  - In MongoDB Atlas → Network Access → IP Access List
  - Add your current IP address
  - For production servers, add the server's public IP
  - Consider adding `0.0.0.0/0` temporarily for testing (NOT recommended for production)

### 4. **Incorrect Credentials**

- **Symptom**: Authentication failed errors
- **Solution**:
  - Verify username and password in your connection string
  - Check if database user has proper permissions
  - Test credentials with MongoDB Compass

### 5. **Connection String Issues**

- **Symptom**: Various connection errors
- **Solution**:
  - Verify your `.env` file has correct `MONGODB_URI`
  - Ensure the URI format is correct:
    ```
    mongodb+srv://username:password@cluster-url/database-name
    ```

## Diagnostic Commands

### Test Database Connection

```bash
cd tanish-physio-backend
npm run test:db
```

### Check Server Logs

Look for these key log messages:

- 🔄 Attempting to connect to MongoDB...
- ✅ MongoDB Connected Successfully!
- ❌ Connection attempt X failed:

### Manual Connection Test

Use MongoDB Compass or mongosh:

```bash
mongosh "mongodb+srv://username:password@cluster-url/database-name"
```

## Quick Fixes to Try

1. **Restart your server** - Sometimes connections recover automatically
2. **Check MongoDB Atlas dashboard** - Look for any alerts or maintenance
3. **Verify your IP is whitelisted** - This is the most common issue
4. **Test with a local MongoDB instance** temporarily to isolate the issue
5. **Increase timeout values** in `src/config/db.js` if network is slow

## Emergency Fallback

If nothing works, temporarily switch to a local MongoDB instance:

1. Install MongoDB locally
2. Change `.env`:
   ```env
   MONGODB_URI=mongodb://localhost:27017/tanish-physio
   ```
3. Start local MongoDB service
4. Restart your application

## Monitoring

After fixing, monitor for:

- Consistent connection establishment
- No timeout errors in logs
- Application functionality working normally
- Database operations completing successfully

## Need Help?

If issues persist:

1. Run `npm run test:db` and share the output
2. Check MongoDB Atlas logs and metrics
3. Verify all environment variables are set correctly
4. Test from different network locations if possible
