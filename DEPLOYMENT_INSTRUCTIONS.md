# Deployment Instructions

## For Shared Hosting (cPanel/LiteSpeed)

1. **Upload Files:**

   - Upload the entire `tanish-physio-backend` folder contents to your hosting directory
   - Make sure the `src/` folder is uploaded correctly

2. **Set Node.js Application:**

   - In cPanel, go to "Setup Node.js App"
   - Create a new application
   - Set Application Root: `/home/u378554361/domains/apitanishvideo.fableadtech.in/public_html`
   - Set Application URL: `apitanishvideo.fableadtech.in`
   - Set Application Startup File: `src/server.js`

3. **Install Dependencies:**

   ```bash
   npm install
   ```

4. **Configure Environment:**

   - Copy `.env.example` to `.env`
   - Update environment variables for production

5. **Start Application:**
   - Use the cPanel Node.js interface to start the app
   - Or run: `npm start`

## Alternative: Build Script

Run this locally before uploading:

```bash
# Navigate to backend directory
cd tanish-physio-backend

# Install dependencies
npm install

# Create deployment package
cp deploy-package.json package.json

# Now upload all files including the updated package.json
```

## Troubleshooting

If you still get the error:

1. Verify `src/server.js` exists in your upload
2. Check file permissions (should be 644 for files, 755 for directories)
3. Ensure Node.js version is compatible (v16+ recommended)
4. Check error logs in cPanel
