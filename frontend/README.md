# Still frontend

Minimal React interface for the ADHD Brain API.

## Run locally

Start the API from the repository root:

```bash
npm run dev
```

Then start the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

The frontend opens at `http://localhost:5173` and talks to the API at
`http://localhost:3000`.

To use a different API URL, copy `.env.example` to `.env` and change
`VITE_API_URL`.
