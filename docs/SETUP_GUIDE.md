# Neon Database Integration Setup Guide

This guide will help you migrate from localStorage to Neon PostgreSQL in ~15 minutes.

## Step 1: Get Neon Database (5 min)

1. Visit [Neon Console](https://console.neon.tech)
2. Sign up/login (free tier is perfect for personal use)
3. Click "Create Project"
4. Give it a name (e.g., "Academic-Insights")
5. Copy the connection string - it looks like:
   ```
   postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

## Step 2: Install Backend Dependencies (2 min)

```bash
cd /path/to/Academic-Insights
npm run server:install
```

This installs Express, Neon client, and other backend dependencies.

## Step 3: Configure Environment Variables (2 min)

### Backend Configuration

Create `server/.env` file:

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and paste your Neon connection string:

```env
DATABASE_URL=postgresql://your-connection-string-here
PORT=3001
```

### Frontend Configuration

Create `.env.local` in the project root (if you don't have it):

```env
GEMINI_API_KEY=your_existing_gemini_key
VITE_API_URL=http://localhost:3001
```

## Step 4: Start the Backend (1 min)

Open a new terminal:

```bash
npm run server
```

You should see:
```
╔════════════════════════════════════════╗
║   Academic-Insights API Server         ║
║   Running on http://localhost:3001     ║
╚════════════════════════════════════════╝
✅ Database schema initialized successfully
```

If you see this, your database is ready!

## Step 5: Start the Frontend (1 min)

Open another terminal:

```bash
npm run dev
```

## Step 6: Migrate Existing Data (Optional, 2 min)

If you have existing data in localStorage:

1. Login to your app
2. Go to Admin Panel
3. You'll see a purple "Data Migration Tool" card
4. Click "Check for Data" to see your localStorage content
5. Click "Migrate to Database"
6. Wait for success message

That's it! Your data is now in Neon.

## Verification

Test that everything works:

1. **Create a new project** - Should save to database
2. **Refresh the page** - Data should persist
3. **Check Neon Console** - You can query your data:
   ```sql
   SELECT * FROM projects;
   SELECT * FROM extraction_results LIMIT 10;
   ```

## Troubleshooting

### Backend won't start

**"DATABASE_URL environment variable is not set"**
- Make sure `server/.env` exists
- Check that DATABASE_URL is set correctly
- No spaces around the `=` sign

**Port 3001 already in use**
- Change PORT in `server/.env` to 3002
- Update VITE_API_URL in frontend `.env.local` to match

### Frontend shows errors

**"Failed to fetch data from API"**
- Check backend is running (`npm run server`)
- Verify VITE_API_URL in `.env.local`
- Check browser console for specific error
- Try opening http://localhost:3001/health in browser

**CORS errors**
- Shouldn't happen in development
- Make sure both servers are running on localhost

### Migration fails

**"Migration failed"**
- Ensure backend is running first
- Check browser console for error details
- Verify your localStorage has data (open DevTools → Application → Local Storage)

## What Changed?

### Before (localStorage)
- Data stored in browser
- Limited to ~5-10MB
- Lost if you clear browser data
- Only accessible from one device

### After (Neon Database)
- Data stored in cloud
- No practical size limit
- Persists across devices/browsers
- Professional database backup/restore
- Can access from multiple devices (when deployed)

## Next Steps

- The migration component is temporary - you can remove it after migrating
- Consider deploying the backend to Render, Railway, or Fly.io
- Update VITE_API_URL to your deployed backend URL
- Keep your `server/.env` and `.env.local` files secure (they're in .gitignore)

## Need Help?

Check the logs:
- **Backend logs**: Terminal where you ran `npm run server`
- **Frontend logs**: Browser DevTools console
- **Database logs**: Neon Console → Your Project → Operations

Common log locations:
- Connection errors: Backend terminal
- API errors: Browser console Network tab
- Database errors: Backend terminal
