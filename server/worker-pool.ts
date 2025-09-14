import { Worker } from 'worker_threads';
import { randomUUID } from 'crypto';
import { cpus } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ScrapingTask {
  id: string;
  url: string;
  platform: "amazon" | "walmart";
  maxRetries?: number;
  responseData?: string;
  headers?: Record<string, string>;
}

export interface ScrapingResult {
  id: string;
  success: boolean;
  productName?: string;
  error?: string;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private pendingTasks = new Map<string, {
    resolve: (result: ScrapingResult) => void;
    reject: (error: Error) => void;
    timeout?: NodeJS.Timeout;
  }>();
  private taskQueue: ScrapingTask[] = [];
  private busyWorkers = new Set<Worker>();
  private poolSize: number;
  private workerJsPath: string | null = null;

  constructor(poolSize = Math.max(2, Math.min(8, cpus().length - 1))) {
    this.poolSize = poolSize;
    // Use the pre-made JavaScript worker file
    this.workerJsPath = path.join(__dirname, 'scraping-worker.js');
    this.initializeWorkers();
  }


  private initializeWorkers(): void {
    if (!this.workerJsPath) {
      console.error('[WorkerPool] Worker JS file not compiled yet');
      return;
    }
    
    for (let i = 0; i < this.poolSize; i++) {
      try {
        const worker = new Worker(this.workerJsPath, {
          type: 'module'
        } as any);
        
        worker.on('message', (result) => this.handleWorkerMessage(worker, result));
        worker.on('error', this.handleWorkerError.bind(this));
        worker.on('exit', this.handleWorkerExit.bind(this));
        
        this.workers.push(worker);
        console.log(`[WorkerPool] Worker ${i + 1}/${this.poolSize} initialized`);
      } catch (error) {
        console.error(`[WorkerPool] Failed to create worker ${i + 1}:`, error);
      }
    }
    
    console.log(`[WorkerPool] Initialized with ${this.workers.length} workers (target: ${this.poolSize})`);
  }

  private handleWorkerMessage(worker: Worker, result: ScrapingResult): void {
    const task = this.pendingTasks.get(result.id);
    if (task) {
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      
      this.pendingTasks.delete(result.id);
      
      if (result.success) {
        task.resolve(result);
      } else {
        task.reject(new Error(result.error || 'Unknown worker error'));
      }
    }
    
    // Mark worker as available and process queue
    this.busyWorkers.delete(worker);
    this.processQueue();
  }

  private handleWorkerError(error: Error): void {
    console.error('[WorkerPool] Worker error:', error);
    
    // Clean up any pending tasks for this worker
    Array.from(this.pendingTasks.entries()).forEach(([taskId, task]) => {
      task.reject(new Error(`Worker error: ${error.message}`));
      this.pendingTasks.delete(taskId);
    });
  }

  private handleWorkerExit(code: number): void {
    if (code !== 0) {
      console.error(`[WorkerPool] Worker exited with code ${code}`);
    }
    
    // Restart worker if it crashed
    this.restartWorker();
  }

  private restartWorker(): void {
    if (this.workers.length < this.poolSize && this.workerJsPath) {
      try {
        const worker = new Worker(this.workerJsPath, {
          type: 'module'
        } as any);
        
        worker.on('message', (result) => this.handleWorkerMessage(worker, result));
        worker.on('error', this.handleWorkerError.bind(this));
        worker.on('exit', this.handleWorkerExit.bind(this));
        
        this.workers.push(worker);
        console.log(`[WorkerPool] Worker restarted, pool size: ${this.workers.length}`);
      } catch (error) {
        console.error('[WorkerPool] Failed to restart worker:', error);
      }
    }
  }

  private getAvailableWorker(): Worker | null {
    for (const worker of this.workers) {
      if (!this.busyWorkers.has(worker)) {
        return worker;
      }
    }
    return null;
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0) {
      const worker = this.getAvailableWorker();
      if (!worker) break;
      
      const task = this.taskQueue.shift()!;
      this.executeTask(worker, task);
    }
  }

  private executeTask(worker: Worker, task: ScrapingTask): void {
    this.busyWorkers.add(worker);
    
    // Set task timeout (30 seconds per task)
    const timeout = setTimeout(() => {
      const pendingTask = this.pendingTasks.get(task.id);
      if (pendingTask) {
        pendingTask.reject(new Error('Worker task timeout'));
        this.pendingTasks.delete(task.id);
      }
      this.busyWorkers.delete(worker);
      this.processQueue();
    }, 30000);
    
    // Only attach timeout to existing entry, don't overwrite resolve/reject
    const entry = this.pendingTasks.get(task.id);
    if (entry) {
      entry.timeout = timeout;
    } else {
      // Defensive fallback for edge cases
      this.pendingTasks.set(task.id, {
        resolve: () => {},
        reject: () => {},
        timeout
      });
    }
    
    worker.postMessage(task);
  }

  async scrapeProduct(url: string, platform: "amazon" | "walmart", maxRetries = 3, responseData?: string, headers?: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const taskId = randomUUID();
      const task: ScrapingTask = {
        id: taskId,
        url,
        platform,
        maxRetries,
        responseData,
        headers
      };

      // Update the pending task with the actual resolve/reject functions
      const pendingTask = this.pendingTasks.get(taskId);
      if (pendingTask) {
        pendingTask.resolve = (result: ScrapingResult) => {
          if (result.success && result.productName) {
            resolve(result.productName);
          } else {
            reject(new Error(result.error || 'Failed to scrape product'));
          }
        };
        pendingTask.reject = reject;
      } else {
        // Create new pending task entry
        this.pendingTasks.set(taskId, {
          resolve: (result: ScrapingResult) => {
            if (result.success && result.productName) {
              resolve(result.productName);
            } else {
              reject(new Error(result.error || 'Failed to scrape product'));
            }
          },
          reject
        });
      }

      const worker = this.getAvailableWorker();
      if (worker) {
        this.executeTask(worker, task);
      } else {
        // Queue the task if no workers available
        this.taskQueue.push(task);
        console.log(`[WorkerPool] Task queued, queue size: ${this.taskQueue.length}`);
      }
    });
  }

  getStats(): {
    poolSize: number;
    busyWorkers: number;
    queuedTasks: number;
    pendingTasks: number;
  } {
    return {
      poolSize: this.workers.length,
      busyWorkers: this.busyWorkers.size,
      queuedTasks: this.taskQueue.length,
      pendingTasks: this.pendingTasks.size
    };
  }

  async destroy(): Promise<void> {
    console.log('[WorkerPool] Destroying worker pool...');
    
    // Clear all pending tasks
    Array.from(this.pendingTasks.entries()).forEach(([taskId, task]) => {
      task.reject(new Error('Worker pool shutting down'));
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
    });
    this.pendingTasks.clear();
    this.taskQueue.length = 0;
    
    // Terminate all workers
    await Promise.all(
      this.workers.map(worker => worker.terminate())
    );
    
    this.workers.length = 0;
    this.busyWorkers.clear();
    
    // Worker JS file is permanent, no cleanup needed
    
    console.log('[WorkerPool] Worker pool destroyed');
  }
}

// Singleton worker pool instance
let workerPool: WorkerPool | null = null;

export function getWorkerPool(): WorkerPool {
  if (!workerPool) {
    workerPool = new WorkerPool();
  }
  return workerPool;
}

export function isWorkerPoolInitialized(): boolean {
  return workerPool !== null;
}

export async function destroyWorkerPool(): Promise<void> {
  if (workerPool) {
    await workerPool.destroy();
    workerPool = null;
  }
}