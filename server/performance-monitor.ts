import os from 'os';
import { getWorkerPool, isWorkerPoolInitialized } from './worker-pool';
import { httpPool } from './http-pool';
import { storage } from './storage';

export interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    heap: {
      used: number;
      total: number;
    };
    external: number;
  };
  workers: {
    poolSize: number;
    busyWorkers: number;
    queuedTasks: number;
    pendingTasks: number;
  };
  http: {
    httpSockets: number;
    httpFreeSockets: number;
    httpsPending: number;
    httpsFreeSockets: number;
  };
  storage: {
    users: number;
    settings: number;
    subscriptions: number;
    memoryUsage: string;
  };
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 1000; // Keep last 1000 measurements
  private monitorInterval: NodeJS.Timeout | null = null;
  private cpuStartMeasurement: any = null;
  private cpuLastTimestamp: bigint = process.hrtime.bigint();

  private constructor() {
    this.initializeCpuMeasurement();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeCpuMeasurement(): void {
    this.cpuStartMeasurement = process.cpuUsage();
    this.cpuLastTimestamp = process.hrtime.bigint();
  }

  private calculateCpuUsage(): number {
    if (!this.cpuStartMeasurement) {
      this.initializeCpuMeasurement();
      return 0;
    }

    const currentTimestamp = process.hrtime.bigint();
    const elapsedTimeNs = currentTimestamp - this.cpuLastTimestamp;
    const elapsedTimeUs = Number(elapsedTimeNs / 1000n); // Convert to microseconds
    
    const cpuUsage = process.cpuUsage(this.cpuStartMeasurement);
    const totalCpu = cpuUsage.user + cpuUsage.system;
    const usage = elapsedTimeUs > 0 ? (totalCpu / elapsedTimeUs) * 100 : 0;
    
    // Reset measurement for next calculation
    this.cpuStartMeasurement = process.cpuUsage();
    this.cpuLastTimestamp = currentTimestamp;
    
    return Math.min(100, Math.max(0, usage));
  }

  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    const memUsage = process.memoryUsage();
    const workerStats = isWorkerPoolInitialized() ? getWorkerPool().getStats() : {
      poolSize: 0,
      busyWorkers: 0,
      queuedTasks: 0,
      pendingTasks: 0
    };
    const httpStats = httpPool.getStats();
    const storageStats = await storage.getStats();

    return {
      timestamp: Date.now(),
      cpu: {
        usage: this.calculateCpuUsage(),
        cores: os.cpus().length,
        loadAverage: os.loadavg()
      },
      memory: {
        used: memUsage.rss,
        total: os.totalmem(),
        heap: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal
        },
        external: memUsage.external
      },
      workers: workerStats,
      http: httpStats,
      storage: storageStats
    };
  }

  startMonitoring(intervalMs = 5000): void {
    if (this.monitorInterval) {
      this.stopMonitoring();
    }

    console.log(`[PerformanceMonitor] Starting monitoring with ${intervalMs}ms interval`);
    
    this.monitorInterval = setInterval(async () => {
      const metrics = await this.getCurrentMetrics();
      this.metricsHistory.push(metrics);
      
      // Trim history to prevent memory bloat
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
      }
      
      // Log warnings for high resource usage
      this.checkResourceUsage(metrics);
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log('[PerformanceMonitor] Monitoring stopped');
    }
  }

  private checkResourceUsage(metrics: PerformanceMetrics): void {
    const memoryUsagePercent = (metrics.memory.used / metrics.memory.total) * 100;
    const heapUsagePercent = (metrics.memory.heap.used / metrics.memory.heap.total) * 100;
    
    if (metrics.cpu.usage > 80) {
      console.warn(`[PerformanceMonitor] High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`);
    }
    
    if (memoryUsagePercent > 80) {
      console.warn(`[PerformanceMonitor] High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
    }
    
    if (heapUsagePercent > 90) {
      console.warn(`[PerformanceMonitor] High heap usage: ${heapUsagePercent.toFixed(1)}%`);
    }
    
    if (metrics.workers.queuedTasks > 50) {
      console.warn(`[PerformanceMonitor] High worker queue: ${metrics.workers.queuedTasks} tasks`);
    }
  }

  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    if (limit && limit < this.metricsHistory.length) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  getAverageMetrics(timeWindowMs = 60000): {
    avgCpuUsage: number;
    avgMemoryUsage: number;
    avgHeapUsage: number;
    workerUtilization: number;
  } {
    const now = Date.now();
    const recentMetrics = this.metricsHistory.filter(
      m => now - m.timestamp <= timeWindowMs
    );
    
    if (recentMetrics.length === 0) {
      return {
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        avgHeapUsage: 0,
        workerUtilization: 0
      };
    }
    
    const avgCpuUsage = recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length;
    
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => 
      sum + (m.memory.used / m.memory.total) * 100, 0
    ) / recentMetrics.length;
    
    const avgHeapUsage = recentMetrics.reduce((sum, m) => 
      sum + (m.memory.heap.used / m.memory.heap.total) * 100, 0
    ) / recentMetrics.length;
    
    const workerUtilization = recentMetrics.reduce((sum, m) => 
      sum + (m.workers.busyWorkers / m.workers.poolSize) * 100, 0
    ) / recentMetrics.length;
    
    return {
      avgCpuUsage,
      avgMemoryUsage,
      avgHeapUsage,
      workerUtilization
    };
  }

  async getResourceSummary(): Promise<string> {
    const current = await this.getCurrentMetrics();
    const averages = this.getAverageMetrics();
    
    return `
Performance Summary:
- CPU: ${current.cpu.usage.toFixed(1)}% (avg: ${averages.avgCpuUsage.toFixed(1)}%) | Cores: ${current.cpu.cores}
- Memory: ${(current.memory.used / 1024 / 1024).toFixed(1)}MB / ${(current.memory.total / 1024 / 1024).toFixed(1)}MB (${averages.avgMemoryUsage.toFixed(1)}%)
- Heap: ${(current.memory.heap.used / 1024 / 1024).toFixed(1)}MB / ${(current.memory.heap.total / 1024 / 1024).toFixed(1)}MB (${averages.avgHeapUsage.toFixed(1)}%)
- Workers: ${current.workers.busyWorkers}/${current.workers.poolSize} busy, ${current.workers.queuedTasks} queued (${averages.workerUtilization.toFixed(1)}% util)
- HTTP Pool: ${current.http.httpSockets + current.http.httpsFreeSockets} connections, ${current.http.httpsPending} pending
- Storage: ${current.storage.users} users, ${current.storage.settings} settings
`.trim();
  }

  destroy(): void {
    this.stopMonitoring();
    this.metricsHistory = [];
    console.log('[PerformanceMonitor] Destroyed and cleaned up');
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();