# Academic-Insights Backend API

Express.js server with Neon PostgreSQL for Academic-Insights data persistence.

## Quick Setup

### 1. Get Your Neon Database

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project (or use existing)
3. Copy your connection string (looks like: `postgresql://user:password@host/database?sslmode=require`)

### 2. Install Dependencies

```bash
cd server
npm install
```

### 3. Configure Environment

Create a `.env` file in the `server/` directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Neon connection string:

```env
DATABASE_URL=postgresql://your-connection-string-here
PORT=3001
```

### 4. Start the Server

```bash
npm run dev
```

The server will:
- Connect to Neon
- Auto-create database tables if they don't exist
- Start listening on `http://localhost:3001`

## API Endpoints

### Projects

- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get single project
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Results

- `GET /api/results` - Get all results (optional: `?project_id=xxx`)
- `GET /api/results/:id` - Get single result
- `POST /api/results` - Create result
- `POST /api/results/bulk` - Bulk create results
- `PUT /api/results/:id` - Update result
- `DELETE /api/results/:id` - Delete result
- `POST /api/results/bulk-delete` - Bulk delete results

### Health Check

- `GET /health` - Server status

## Database Schema

The database auto-creates two tables:

**projects**
- id (TEXT, PRIMARY KEY)
- name, description, created_at, last_run, status, results_count

**extraction_results**
- id (TEXT, PRIMARY KEY)
- project_id (FOREIGN KEY → projects)
- School/program details
- Tuition data
- Confidence score and status
- Source URLs and validation data

## Troubleshooting

**Can't connect to database:**
- Verify DATABASE_URL in `.env` is correct
- Check Neon project is active in console
- Ensure `?sslmode=require` is in connection string

**Port 3001 already in use:**
- Change PORT in `.env` to another port
- Update VITE_API_URL in frontend `.env.local`

**CORS errors:**
- Server has CORS enabled for all origins
- Check server is running on correct port
