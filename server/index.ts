import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { logger, logError, logInfo } from "./logger";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
      logInfo(`API Request: ${req.method} ${path}`, { statusCode: res.statusCode, duration });
    }
  });

  next();
});

// Add process-level error handlers to prevent crashes during development
process.on('uncaughtException', (err) => {
  logError('Uncaught Exception - Server continuing', err);
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Promise Rejection - Server continuing', { reason, promise });
  console.error('Unhandled Promise Rejection:', reason);
});

(async () => {
  const server = await registerRoutes(app);

  // Downloads route for installer files
  app.use('/downloads', express.static(path.join(__dirname, '..', 'downloads'), {
    dotfiles: 'deny',
    index: false,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours cache
    setHeaders: (res, filePath) => {
      const fileName = path.basename(filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      logInfo(`Installer download started: ${fileName}`);
    }
  }));

  // Helper function to parse semantic version from filename
  function parseVersion(filename: string): { major: number; minor: number; patch: number; filename: string } | null {
    const match = filename.match(/Stock-Monitor-Setup-(\d+)\.(\d+)\.(\d+)\.exe$/i);
    if (match) {
      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10), 
        patch: parseInt(match[3], 10),
        filename
      };
    }
    return null;
  }

  // Helper function to compare semantic versions
  function compareVersions(a: ReturnType<typeof parseVersion>, b: ReturnType<typeof parseVersion>): number {
    if (!a || !b) return 0;
    
    if (a.major !== b.major) return b.major - a.major;
    if (a.minor !== b.minor) return b.minor - a.minor;
    return b.patch - a.patch;
  }

  // Latest version redirect for Windows installer
  app.get('/downloads/latest/windows', (req: Request, res: Response) => {
    const downloadsDir = path.join(__dirname, '..', 'downloads');
    
    try {
      if (!fs.existsSync(downloadsDir)) {
        logError('Downloads directory not found', new Error('Downloads directory missing'));
        return res.status(404).json({ 
          error: 'Download not available',
          message: 'Installer files are not currently hosted. Please check back later or contact support.' 
        });
      }

      // Get all .exe files and parse versions
      const files = fs.readdirSync(downloadsDir)
        .filter(file => file.endsWith('.exe') && file.toLowerCase().includes('setup'));

      if (files.length === 0) {
        logError('No installer files found in downloads directory', new Error('No exe files found'));
        return res.status(404).json({ 
          error: 'Download not available',
          message: 'No Windows installer is currently available. Please check back later.' 
        });
      }

      // Parse versions and find the latest
      const versioned = files.map(parseVersion).filter(Boolean);
      const unversioned = files.filter(file => !parseVersion(file));

      let latestFile: string;

      if (versioned.length > 0) {
        // Sort by semantic version (highest first)
        versioned.sort(compareVersions);
        latestFile = versioned[0]!.filename;
        logInfo(`Found ${versioned.length} versioned installers, selected: ${latestFile}`);
      } else {
        // Fallback to modification time for non-versioned files
        const filesWithStats = unversioned.map(file => ({
          filename: file,
          mtime: fs.statSync(path.join(downloadsDir, file)).mtime
        }));
        filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        latestFile = filesWithStats[0].filename;
        logInfo(`No versioned installers found, using newest by mtime: ${latestFile}`);
      }

      logInfo(`Redirecting to latest Windows installer: ${latestFile}`);
      res.redirect(`/downloads/${latestFile}`);
    } catch (error) {
      logError('Error processing latest download request', error);
      res.status(500).json({ 
        error: 'Server error',
        message: 'Unable to process download request. Please try again later.' 
      });
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the error to file
    logError(`Express Error: ${message}`, err);

    res.status(status).json({ message });
    // Don't re-throw after responding - this crashes the process
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    logInfo(`Stock Monitor server started on port ${port}`);
  });
})();
