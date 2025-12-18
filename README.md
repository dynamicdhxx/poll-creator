# Poll Creator 📊

A full-stack polling application where users can create polls, share them, and collect votes with real-time results.

## Features

- Create polls with multiple options
- Real-time vote updates via WebSocket
- Anonymous or authenticated voting
- Pre-built poll templates
- Embeddable polls for external sites
- Beautiful dark UI with animated results

## Getting Started

### Prerequisites
- Node.js 18+

### Installation

```bash
cd poll-creator

# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

### Running

```bash
# Terminal 1 - Backend (port 3001)
cd backend
npm start

# Terminal 2 - Frontend (port 3000)
cd frontend
npm run dev
```

Open http://localhost:3000 in your browser.
