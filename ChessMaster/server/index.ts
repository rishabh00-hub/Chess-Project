// Load environment variables as early as possible so other modules see them
import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";

const app = express();

// Enable CORS for development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow GitHub Codespaces URLs and localhost during development
  if (origin && (
    origin.includes('.github.dev') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  )) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Basic request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  if (res.headersSent) return next(err);
  res.status(status).json({ message });
});

async function main() {
  const port = process.env.PORT || 5000; // Backend running on port 5000

  // Register API routes
  const httpServer = await registerRoutes(app);

  // If running the client separately (developer preference), skip embedding Vite
  if (process.env.SEPARATE_CLIENT === 'true') {
    // Do not call setupVite or serveStatic — backend will only expose API routes.
    log('SEPARATE_CLIENT=true -> skipping Vite middleware (backend will serve API only)');
  } else if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(app);
  }

  httpServer.listen(port, '0.0.0.0', () => {
    log(`Server running at http://0.0.0.0:${port}`);
  });
}

main().catch(console.error);
