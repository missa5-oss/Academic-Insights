# Academic-Insights (Academica)

A React-based web application for extracting, analyzing, and comparing university tuition data using AI-powered web research. Built for the Carey Business School at Johns Hopkins University.

## Features

- **AI-Powered Tuition Extraction** - Automatically extract tuition data from official university websites using Google Gemini AI with Search grounding
- **Project Management** - Organize research by creating projects with multiple school/program targets
- **Market Analysis Dashboard** - Visualize tuition data with charts, statistics, and AI-generated executive summaries
- **Historical Price Tracking** - Track tuition changes over time with version history
- **AI Chat Assistant** - Ask questions about extracted data with context-aware responses
- **Data Export** - Export results to CSV or JSON for external analysis

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Express.js, Node.js
- **Database**: Neon PostgreSQL (serverless)
- **AI**: Google Gemini API with Search & Maps grounding
- **Charts**: Recharts

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))
- Neon PostgreSQL account ([Sign up](https://console.neon.tech))

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/academic-insights.git
cd academic-insights

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### Configuration

1. Create `.env.local` in the project root:
```
VITE_API_URL=http://localhost:3001
```

2. Create `server/.env`:
```
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
PORT=3001
```

### Running the App

```bash
# Terminal 1: Start the backend (must start first)
npm run server

# Terminal 2: Start the frontend
npm run dev
```

The app will be available at http://localhost:5173

## Documentation

- [CLAUDE.md](CLAUDE.md) - Comprehensive technical documentation
- [CHANGELOG.md](CHANGELOG.md) - Version history and release notes
- [docs/](docs/) - Additional documentation and guides

## Project Structure

```
/
├── App.tsx                  # Router configuration
├── pages/                   # Page components
│   ├── Dashboard.tsx        # Project listing
│   ├── ProjectDetail.tsx    # Main extraction interface
│   └── AdminPanel.tsx       # Admin dashboard
├── components/              # Reusable components
├── context/                 # React Context providers
├── services/                # API services
├── server/                  # Express.js backend
│   ├── routes/              # API endpoints
│   └── middleware/          # Express middleware
└── types.ts                 # TypeScript definitions
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend development server |
| `npm run build` | Build frontend for production |
| `npm run server` | Start backend API server |
| `npm run test:run` | Run tests once |
| `npm run test` | Run tests in watch mode |

## Security

- API keys are secured on the backend only (never exposed to frontend)
- Rate limiting: 500 req/15min (general), 100 req/15min (AI endpoints)
- Input validation on all API endpoints
- CORS configured for allowed origins
- Security headers via Helmet.js

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `npm run test:run`
4. Create a pull request

## License

Internal use only - Carey Business School, Johns Hopkins University

## Version

Current: v1.4.0

See [CHANGELOG.md](CHANGELOG.md) for version history.
