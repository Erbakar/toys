# Deployment

## Backend

The FastAPI backend is configured for Render with `render.yaml`.

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the repository.
3. Render will create `object-detector-api` from `object-detector-api/Dockerfile`.
4. After the first deploy, copy the service URL, for example:

```txt
https://object-detector-api.onrender.com
```

For detailed natural-language visual comparison, add this backend environment
variable in Render:

```env
OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-4.1-mini
ENABLE_OPENAI_VISION=true
```

Without `OPENAI_API_KEY`, the backend still works with YOLO, color, box, and
embedding comparison, but it will not produce part-level natural-language
findings such as "bebeğin kolu eksik olabilir".

## Frontend Vercel Environment

The frontend is safe to deploy before the backend is public. If `VITE_API_URL`
is missing or still points to `localhost`, the production app uses mock
detection instead of failing with a browser network error.

For a Vercel deploy that opens and completes the photo flow without a public
backend, use:

```env
VITE_USE_MOCK=true
```

For real YOLO detection, first deploy the backend, then set these variables in
Vercel project settings:

```env
VITE_USE_MOCK=false
VITE_API_URL=https://your-render-backend-url.onrender.com
```

Then redeploy the Vercel frontend.

If the real API is temporarily unreachable in production, the app falls back to
mock detection so the upload flow still completes. Check the browser console or
backend logs to diagnose API connectivity.
