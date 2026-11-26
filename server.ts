import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTIVE_GEMINI_MODEL,
  ACTIVE_MODEL_LABEL,
  classifyGeminiError,
  generateGeminiCommentary,
  type CommentaryScope,
} from './server/geminiCommentary.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_SCOPES = new Set<CommentaryScope>([
  'global',
  'indonesia',
  'indonesiaNews',
  'china',
  'korea',
  'india',
  'equities',
  'all',
]);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      geminiAvailable: Boolean((process.env.GEMINI_API_KEY || '').trim()),
      model: ACTIVE_GEMINI_MODEL,
      modelLabel: ACTIVE_MODEL_LABEL,
    });
  });

  app.post('/api/gemini/commentary', async (req, res) => {
    const body = req.body as { scope?: unknown; snapshot?: unknown } | undefined;
    const scope = typeof body?.scope === 'string' ? (body.scope as CommentaryScope) : null;

    if (!scope || !VALID_SCOPES.has(scope)) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_SCOPE',
        error: 'Invalid scope parameter. Expected one of: global, indonesia, indonesiaNews, china, korea, india, equities, all.',
      });
      return;
    }

    if (!body?.snapshot || typeof body.snapshot !== 'object' || Array.isArray(body.snapshot)) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_SNAPSHOT',
        error: 'Request must include a valid market snapshot object.',
      });
      return;
    }

    try {
      const result = await generateGeminiCommentary(body.snapshot as Record<string, any>, scope);
      res.json({
        ok: true,
        ...result,
      });
    } catch (err) {
      const mapped = classifyGeminiError(err);
      console.error(`[Gemini Commentary API Error ${mapped.status}]:`, mapped.message);
      res.status(mapped.status).json({
        ok: false,
        code: mapped.code,
        error: mapped.message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (model: ${ACTIVE_GEMINI_MODEL})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Express server:', err);
  process.exit(1);
});
