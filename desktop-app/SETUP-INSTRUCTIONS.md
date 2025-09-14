# Stock Monitor Desktop App Setup Instructions

## Account Setup Complete ✅

An admin account has been configured in the database. You can create your admin account by:
1. Going to the web interface and signing up with your preferred email/password
2. Contact the system administrator to upgrade your account to admin privileges

## How the Desktop App Works

The desktop application now connects to your web server running on localhost:5000 instead of using static files. This means:

1. **You need the web server running** - The desktop app will show an error if the server isn't running
2. **Shared authentication** - Accounts created on the web interface work in the desktop app
3. **Real-time sync** - Both web and desktop use the same database and APIs

## Setup Steps

### 1. Install Node.js (if not already installed)
Download and install Node.js from https://nodejs.org

### 2. Extract and Build
1. Extract the desktop app files to a folder (like `Desktop/StockMonitor/`)
2. Open Command Prompt as Administrator
3. Navigate to the extracted folder
4. Run:
   ```bash
   npm install
   npm run build-win
   ```

### 3. Make Sure Web Server is Running
Before launching the desktop app:
1. Keep your web server running on port 5000
2. For local development: Verify it's accessible at http://localhost:5000
3. For hosted/Replit: Set the SERVER_URL environment variable to your app's URL

### 4. Launch Desktop App
- Run the installer from `dist/Stock Monitor Setup 1.0.0.exe`
- Or run the portable version from `dist/win-unpacked/Stock Monitor.exe`

## Login Credentials

Use your account credentials to log into the desktop app. If you need admin access, create an account through the web interface first, then contact your system administrator to upgrade your privileges.

## Troubleshooting

### "Unable to connect to Stock Monitor server"
- Ensure the web server is running on port 5000
- Check that http://localhost:5000 loads in your browser
- Restart the desktop app after the server is running

### Desktop app shows white screen
- This usually means the server connection failed
- Check the developer console (F12) for errors
- Verify the server is responding

### Authentication issues
- The desktop app uses the same accounts as the web version
- You can create accounts in either the web interface or desktop app
- Both will work with the same credentials

## Admin Features

As an administrator, you have access to:
- User management
- Subscription management  
- System statistics
- Beta access control
- Product monitoring settings

Access admin features through the `/admin` page after logging in.