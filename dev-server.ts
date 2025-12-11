import express from "express";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createServer() {
  const app = express();

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  
  // Multer setup for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });
  
  // Apply different body parsers based on content type
  app.use((req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data with multer
      upload.array('evidence', 5)(req, res, next);
    } else {
      // Handle JSON and URL-encoded data
      express.json({ limit: "10mb" })(req, res, () => {
        express.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
      });
    }
  });

  // API Routes - use unified router (matches production)
  app.all("/api/*", async (req, res) => {
    try {
      const filePath = join(__dirname, "./api/index.ts");
      const module = await import(`file://${filePath}?update=${Date.now()}`);
      const handler = module.default;

      // Convert Express req/res to Vercel-style
      const vercelReq = {
        method: req.method,
        headers: req.headers,
        body: req.body,
        query: { ...req.query, ...req.params },
        cookies: req.cookies,
        url: req.url,
      };

      // Custom response object that matches Vercel API
      const vercelRes = {
        status: (code: number) => {
          res.status(code);
          return vercelRes;
        },
        json: (data: any) => {
          res.json(data);
          return vercelRes;
        },
        send: (data: any) => {
          res.send(data);
          return vercelRes;
        },
        setHeader: (key: string, value: string | string[]) => {
          res.setHeader(key, value);
          return vercelRes;
        },
        end: () => {
          res.end();
          return vercelRes;
        },
      };

      await handler(vercelReq, vercelRes);
    } catch (error: unknown) {
      console.error(`Error in API router:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res
        .status(500)
        .json({ error: "Internal server error", details: errorMessage });
    }
  });

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  // Use vite's middleware for frontend
  app.use(vite.middlewares);

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`\n🚀 Dev server running at http://localhost:${port}`);
    console.log(`   - Frontend: Vite HMR enabled`);
    console.log(`   - API: Serverless functions loaded\n`);
  });
}

createServer().catch((err) => {
  console.error("Failed to start dev server:", err);
  process.exit(1);
});
