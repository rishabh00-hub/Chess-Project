import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config.js";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express) {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: {
        port: 38793,
        host: '0.0.0.0',
        protocol: 'ws'
      }
    }
  });

  app.use(vite.middlewares);
  return vite;
}

export function serveStatic(app: Express): Server | undefined {
  const indexPath = path.resolve(process.cwd(), "dist/index.html");

  if (!fs.existsSync(indexPath)) {
    log("No static build found. Skipping static serving.", "vite");
    return undefined;
  }

  app.use(express.static(path.resolve(process.cwd(), "dist")));

  const indexContent = fs.readFileSync(indexPath, "utf-8");

  app.get("*", (_req, res) => {
    res.send(indexContent);
  });

  log("Serving static build.", "vite");
  return undefined;
}
