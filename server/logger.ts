import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for readable logs
const logFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
  if (stack) {
    // Error with stack trace
    return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`;
  }
  return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
});

// Create the logger
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // File transport for errors (rotating daily)
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '10m',
      maxFiles: '7d', // Keep 7 days of logs
      zippedArchive: false
    }),
    // File transport for all logs (rotating daily)
    new DailyRotateFile({
      filename: path.join(logsDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '7d', // Keep 7 days of logs
      zippedArchive: false
    })
  ],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '7d'
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '7d'
    })
  ]
});

// Helper functions for common logging scenarios
export const logError = (message: string, error?: Error | any) => {
  if (error) {
    logger.error(message, { error: error.stack || error });
  } else {
    logger.error(message);
  }
};

export const logInfo = (message: string, data?: any) => {
  if (data) {
    logger.info(message, { data });
  } else {
    logger.info(message);
  }
};

export const logWarn = (message: string, data?: any) => {
  if (data) {
    logger.warn(message, { data });
  } else {
    logger.warn(message);
  }
};

// Get latest log file for download
export const getLatestLogFile = (): string | null => {
  try {
    const files = fs.readdirSync(logsDir);
    const logFiles = files
      .filter(file => file.startsWith('app-') && file.endsWith('.log'))
      .sort((a, b) => b.localeCompare(a)); // Sort descending by date
    
    return logFiles.length > 0 ? path.join(logsDir, logFiles[0]) : null;
  } catch (error) {
    console.error('Error getting latest log file:', error);
    return null;
  }
};

// Get combined log content for download (last 7 days)
export const getCombinedLogs = (): string => {
  try {
    const files = fs.readdirSync(logsDir);
    const logFiles = files
      .filter(file => file.startsWith('app-') && file.endsWith('.log'))
      .sort((a, b) => b.localeCompare(a)); // Sort descending by date
    
    let combinedLogs = '';
    
    // Add header
    combinedLogs += `Stock Monitor Error Log\n`;
    combinedLogs += `Generated: ${new Date().toISOString()}\n`;
    combinedLogs += `System: ${process.platform} ${process.arch}\n`;
    combinedLogs += `Node Version: ${process.version}\n`;
    combinedLogs += `===================================\n\n`;
    
    // Combine logs from last 7 days (or up to 3 files max for size)
    const filesToInclude = logFiles.slice(0, 3);
    
    for (const file of filesToInclude) {
      const filePath = path.join(logsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        combinedLogs += `=== ${file} ===\n`;
        combinedLogs += content;
        combinedLogs += `\n\n`;
      } catch (err) {
        combinedLogs += `=== ${file} (Error reading file) ===\n\n`;
      }
    }
    
    return combinedLogs;
  } catch (error) {
    return `Error generating log file: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};