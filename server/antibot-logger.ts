import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Create anti-bot logs directory
const antiBotLogsDir = path.join(process.cwd(), 'logs', 'antibot');
if (!fs.existsSync(antiBotLogsDir)) {
  fs.mkdirSync(antiBotLogsDir, { recursive: true });
}

// Request rate tracking
interface RequestRateTracker {
  platform: 'amazon' | 'walmart';
  successCount: number;
  failureCount: number;
  blockCount: number;
  totalRequests: number;
  avgResponseTime: number;
  lastRequest: number;
  requestTimes: number[];
}

class AntiBotLogger {
  private logger: winston.Logger;
  private requestTracker = new Map<string, RequestRateTracker>();
  private configLogger: winston.Logger;
  private statsLogger: winston.Logger;
  
  constructor() {
    // Human-readable format for anti-bot events
    const antiBotFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
      if (meta.type === 'DETECTION_EVENT') {
        return this.formatDetectionEvent(timestamp, meta);
      } else if (meta.type === 'REQUEST_STATS') {
        return this.formatRequestStats(timestamp, meta);
      }
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    });

    // Detection events logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        antiBotFormat
      ),
      transports: [
        // Console for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            antiBotFormat
          ),
          silent: process.env.NODE_ENV === 'test'
        }),
        // Anti-bot detection events (rotating daily)
        new DailyRotateFile({
          filename: path.join(antiBotLogsDir, 'detection-events-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '30d', // Keep 30 days for analysis
          zippedArchive: false
        })
      ]
    });

    // Configuration and settings logger
    this.configLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, message, ...meta }) => {
          return this.formatConfigEvent(timestamp, message, meta);
        })
      ),
      transports: [
        new DailyRotateFile({
          filename: path.join(antiBotLogsDir, 'configuration-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '5m',
          maxFiles: '30d'
        })
      ]
    });

    // Request statistics logger
    this.statsLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, message, ...meta }) => {
          return this.formatStatsEvent(timestamp, message, meta);
        })
      ),
      transports: [
        new DailyRotateFile({
          filename: path.join(antiBotLogsDir, 'request-stats-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '30d'
        })
      ]
    });

    this.logSystemInfo();
    this.startPeriodicStatsLogging();
  }

  private formatDetectionEvent(timestamp: string, meta: any): string {
    const { antiBot, url, userAgent, headers } = meta;
    
    let output = '\\n' + '='.repeat(80) + '\\n';
    output += `🚨 ANTI-BOT DETECTION EVENT\\n`;
    output += `Time: ${timestamp}\\n`;
    output += `Platform: ${antiBot.platform.toUpperCase()}\\n`;
    output += `Detection Type: ${antiBot.detectionType.toUpperCase()}\\n`;
    output += `Confidence Level: ${(antiBot.confidence * 100).toFixed(1)}%\\n`;
    output += `Response Code: ${antiBot.responseCode}\\n`;
    output += `Response Time: ${antiBot.responseTime}ms\\n`;
    output += '\\n';
    
    output += `📍 REQUEST DETAILS:\\n`;
    output += `URL: ${url}\\n`;
    output += `User Agent: ${userAgent}\\n`;
    
    if (headers && Object.keys(headers).length > 0) {
      output += `Headers Used:\\n`;
      Object.entries(headers).forEach(([key, value]) => {
        if (key !== 'User-Agent') { // Already shown above
          output += `  ${key}: ${value}\\n`;
        }
      });
    }
    output += '\\n';
    
    output += `💡 SUGGESTED ACTION:\\n`;
    output += `${antiBot.suggestedAction}\\n`;
    output += '\\n';
    
    if (antiBot.details && Object.keys(antiBot.details).length > 0) {
      output += `🔍 TECHNICAL DETAILS:\\n`;
      Object.entries(antiBot.details).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          output += `  ${key}: [${value.join(', ')}]\\n`;
        } else {
          output += `  ${key}: ${value}\\n`;
        }
      });
      output += '\\n';
    }
    
    if (antiBot.rawResponse && antiBot.rawResponse.length > 0) {
      output += `📄 RESPONSE SAMPLE (First 500 chars):\\n`;
      output += `${antiBot.rawResponse.substring(0, 500)}${antiBot.rawResponse.length > 500 ? '...' : ''}\\n`;
      output += '\\n';
    }
    
    output += '='.repeat(80) + '\\n';
    
    return output;
  }

  private formatRequestStats(timestamp: string, meta: any): string {
    const { platform, success, responseTime, responseCode, userAgent } = meta;
    
    return `[${timestamp}] REQUEST: ${platform.toUpperCase()} | ` +
           `Status: ${success ? 'SUCCESS' : 'FAILED'} | ` +
           `Code: ${responseCode} | ` +
           `Time: ${responseTime}ms | ` +
           `UA: ${userAgent.substring(0, 50)}...`;
  }

  private formatConfigEvent(timestamp: string, message: string, meta: any): string {
    let output = `\\n[${timestamp}] CONFIGURATION UPDATE: ${message}\\n`;
    
    if (meta.settings) {
      output += `Settings Applied:\\n`;
      Object.entries(meta.settings).forEach(([key, value]) => {
        output += `  ${key}: ${JSON.stringify(value)}\\n`;
      });
    }
    
    if (meta.userAgents) {
      output += `User Agents Pool (${meta.userAgents.length} total):\\n`;
      meta.userAgents.slice(0, 3).forEach((ua: string, index: number) => {
        output += `  ${index + 1}. ${ua}\\n`;
      });
      if (meta.userAgents.length > 3) {
        output += `  ... and ${meta.userAgents.length - 3} more\\n`;
      }
    }
    
    return output;
  }

  private formatStatsEvent(timestamp: string, message: string, meta: any): string {
    let output = `\\n[${timestamp}] ${message}\\n`;
    
    if (meta.stats) {
      Object.entries(meta.stats).forEach(([platform, stats]: [string, any]) => {
        output += `\\n📊 ${platform.toUpperCase()} STATISTICS:\\n`;
        output += `  Total Requests: ${stats.totalRequests}\\n`;
        output += `  Success Rate: ${((stats.successCount / stats.totalRequests) * 100).toFixed(1)}%\\n`;
        output += `  Failure Rate: ${((stats.failureCount / stats.totalRequests) * 100).toFixed(1)}%\\n`;
        output += `  Block Rate: ${((stats.blockCount / stats.totalRequests) * 100).toFixed(1)}%\\n`;
        output += `  Average Response Time: ${stats.avgResponseTime.toFixed(0)}ms\\n`;
        
        if (stats.requestTimes.length > 0) {
          const recentRequests = stats.requestTimes.slice(-10);
          output += `  Recent Response Times: [${recentRequests.join('ms, ')}ms]\\n`;
        }
      });
    }
    
    return output;
  }

  private logSystemInfo(): void {
    const systemInfo = {
      timestamp: new Date().toISOString(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      cpus: os.cpus().length,
      hostname: os.hostname()
    };

    this.configLogger.info('Anti-Bot Logging System Initialized', {
      type: 'SYSTEM_INFO',
      system: systemInfo
    });
  }

  private startPeriodicStatsLogging(): void {
    // Log request statistics every 10 minutes
    setInterval(() => {
      if (this.requestTracker.size > 0) {
        const stats: Record<string, any> = {};
        this.requestTracker.forEach((tracker, platform) => {
          stats[platform] = { ...tracker };
        });
        
        this.statsLogger.info('Periodic Request Statistics', {
          type: 'PERIODIC_STATS',
          stats
        });
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  // Public methods for logging events
  logDetectionEvent(antiBot: any, url: string, userAgent: string, headers: Record<string, string>): void {
    this.logger.warn('Anti-bot detection triggered', {
      type: 'DETECTION_EVENT',
      antiBot,
      url,
      userAgent,
      headers
    });
  }

  logRequestAttempt(platform: 'amazon' | 'walmart', success: boolean, responseTime: number, responseCode: number, userAgent: string): void {
    // Update request tracker
    if (!this.requestTracker.has(platform)) {
      this.requestTracker.set(platform, {
        platform,
        successCount: 0,
        failureCount: 0,
        blockCount: 0,
        totalRequests: 0,
        avgResponseTime: 0,
        lastRequest: Date.now(),
        requestTimes: []
      });
    }

    const tracker = this.requestTracker.get(platform)!;
    tracker.totalRequests++;
    tracker.lastRequest = Date.now();
    tracker.requestTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (tracker.requestTimes.length > 100) {
      tracker.requestTimes = tracker.requestTimes.slice(-100);
    }
    
    // Update average response time
    tracker.avgResponseTime = tracker.requestTimes.reduce((a, b) => a + b, 0) / tracker.requestTimes.length;
    
    if (success) {
      tracker.successCount++;
    } else {
      tracker.failureCount++;
      if (responseCode === 403 || responseCode === 429) {
        tracker.blockCount++;
      }
    }

    this.logger.info('Request completed', {
      type: 'REQUEST_STATS',
      platform,
      success,
      responseTime,
      responseCode,
      userAgent
    });
  }

  logConfigurationChange(message: string, settings?: any, userAgents?: string[]): void {
    this.configLogger.info(message, {
      type: 'CONFIG_CHANGE',
      settings,
      userAgents
    });
  }

  // Get current request statistics
  getRequestStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.requestTracker.forEach((tracker, platform) => {
      stats[platform] = { ...tracker };
    });
    return stats;
  }

  // Get log file paths for admin submission
  getLogFilePaths(): { detectionEvents: string; configuration: string; requestStats: string; directory: string } {
    const today = new Date().toISOString().split('T')[0];
    return {
      detectionEvents: path.join(antiBotLogsDir, `detection-events-${today}.log`),
      configuration: path.join(antiBotLogsDir, `configuration-${today}.log`),
      requestStats: path.join(antiBotLogsDir, `request-stats-${today}.log`),
      directory: antiBotLogsDir
    };
  }

  // Generate combined log for admin submission
  async generateAdminReport(): Promise<string> {
    const today = new Date().toISOString().split('T')[0];
    const stats = this.getRequestStats();
    
    let report = `STOCK MONITOR - ANTI-BOT DETECTION REPORT\\n`;
    report += `Generated: ${new Date().toISOString()}\\n`;
    report += `System: ${os.platform()} ${os.arch()}\\n`;
    report += `Node Version: ${process.version}\\n`;
    report += `${'='.repeat(60)}\\n\\n`;
    
    // Current statistics
    report += `CURRENT SESSION STATISTICS:\\n`;
    if (Object.keys(stats).length > 0) {
      Object.entries(stats).forEach(([platform, data]: [string, any]) => {
        report += `\\n${platform.toUpperCase()}:\\n`;
        report += `  Total Requests: ${data.totalRequests}\\n`;
        report += `  Success Rate: ${((data.successCount / data.totalRequests) * 100).toFixed(1)}%\\n`;
        report += `  Block Rate: ${((data.blockCount / data.totalRequests) * 100).toFixed(1)}%\\n`;
        report += `  Avg Response Time: ${data.avgResponseTime.toFixed(0)}ms\\n`;
      });
    } else {
      report += `No requests made in current session.\\n`;
    }
    
    report += `\\n${'='.repeat(60)}\\n`;
    report += `\\nLOG FILE LOCATIONS:\\n`;
    const logPaths = this.getLogFilePaths();
    report += `Detection Events: ${logPaths.detectionEvents}\\n`;
    report += `Configuration: ${logPaths.configuration}\\n`;
    report += `Request Stats: ${logPaths.requestStats}\\n`;
    report += `Log Directory: ${logPaths.directory}\\n`;
    
    report += `\\n${'='.repeat(60)}\\n`;
    report += `Please include the above log files when submitting to support.\\n`;
    
    return report;
  }
}

// Singleton instance
let antiBotLogger: AntiBotLogger | null = null;

export function getAntiBotLogger(): AntiBotLogger {
  if (!antiBotLogger) {
    antiBotLogger = new AntiBotLogger();
  }
  return antiBotLogger;
}

// Convenience functions for use in workers
export function logAntiBotEvent(antiBot: any, url: string, userAgent: string, headers: Record<string, string>): void {
  getAntiBotLogger().logDetectionEvent(antiBot, url, userAgent, headers);
}

export function logScrapingRequest(platform: 'amazon' | 'walmart', success: boolean, responseTime: number, responseCode: number, userAgent: string): void {
  getAntiBotLogger().logRequestAttempt(platform, success, responseTime, responseCode, userAgent);
}

export function logConfigurationChange(message: string, settings?: any, userAgents?: string[]): void {
  getAntiBotLogger().logConfigurationChange(message, settings, userAgents);
}

export function initAntiBotLogger(): AntiBotLogger {
  return getAntiBotLogger();
}