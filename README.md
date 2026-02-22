# Stats Map Generator

An interactive web application for visualizing Romanian county-level statistics on publication-ready maps. Supports multiple social media formats (4:5 Instagram posts and 9:16 Stories) with AI-powered data input.

## Features

- **Interactive maps** — Leaflet-based maps showing all 42 Romanian counties with color-coded data values
- **AI data input** — Paste raw data (CSV, tables, descriptions) and GPT-4o-mini parses it into structured county-level data
- **Multiple export formats** — Download high-resolution PNGs for Instagram posts (1080x1350) and Stories (1080x1920)
- **Color palettes** — Red, Blue, Green, Orange, Purple, or custom hue with reverse option
- **Normalization modes** — Linear, logarithmic, or exponential scaling
- **Save/load configs** — Persist configurations with version history to PostgreSQL
- **Undo/redo** — Track up to 50 states
- **Pre-loaded datasets** — Includes Romanian real estate, employment, election, and expenditure data

## Getting Started

### Prerequisites

- Node.js
- A [Neon](https://neon.tech) PostgreSQL database
- An [OpenAI API key](https://platform.openai.com) (for AI data input)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=your_neon_database_url
```

### Running Locally

```bash
# Development with hot reload
npm run dev

# Simple dev server
npm start
```

The app runs at `http://localhost:1234`.

### Production Build

```bash
npm run build
```

Output goes to the `dist/` directory.

## Usage

### 1. Load Data

- Use the **AI Data Input** panel to paste raw data — the AI will parse it into structured county data
- Or import one of the pre-loaded datasets from `src/coreStats/`

### 2. Customize the Map

- Switch between **4:5** (post) and **9:16** (story) formats
- Toggle county codes and values on/off
- Adjust zoom level and label size
- Pick a color palette or set a custom hue
- Choose normalization: None, Logarithmic, or Exponential

### 3. Edit Text

- Click the title, subtitle, or footer to edit inline
- Use the floating toolbar for formatting (bold, italic, underline, alignment, colors)
- Drag text elements vertically using the left edge grip

### 4. Save & Export

- **Save** persists the configuration to the database with version history
- **Download** exports the map as a PNG at the appropriate resolution

## Deployment

The project is configured for [Vercel](https://vercel.com) with serverless API routes in the `api/` directory. Deploy by connecting the repo to Vercel and setting the environment variables.

## Project Structure

```text
src/
  index.html          # Main UI and styles
  index.js            # Core application logic
  ai/chatPanel.js     # OpenAI integration for data parsing
  coreStats/          # Pre-loaded statistical datasets
  maps/               # GeoJSON boundary data for Romania
  utils/              # County name shortener, custom coordinates
api/
  db.js               # Neon PostgreSQL connection
  configs.js          # List/create config endpoints
  configs/[id].js     # Update/delete config endpoints
```

## Tech Stack

- **Frontend** — Vanilla JS, Leaflet (CDN), Parcel bundler
- **Backend** — Vercel serverless functions
- **Database** — Neon PostgreSQL
- **AI** — OpenAI GPT-4o-mini
- **Export** — html2canvas
