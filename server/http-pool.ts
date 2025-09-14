import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';

/**
 * Optimized HTTP connection pool for web scraping
 * Reuses connections and implements proper resource management
 */
export class HttpConnectionPool {
  private static instance: HttpConnectionPool;
  private axiosInstance: AxiosInstance;
  private httpAgent: http.Agent;
  private httpsAgent: https.Agent;

  private constructor() {
    // Create persistent HTTP agents with connection pooling
    this.httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 10,        // Max concurrent connections per host
      maxFreeSockets: 5,     // Max idle connections per host
      timeout: 60000,        // Connection timeout
      keepAliveMsecs: 30000  // Keep-alive timeout
    });

    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 60000,
      keepAliveMsecs: 30000,
      // Security settings
      secureProtocol: 'TLSv1_2_method',
      rejectUnauthorized: true
    });

    // Create reusable axios instance with optimized configuration
    this.axiosInstance = axios.create({
      timeout: 30000,
      maxRedirects: 5,
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
      // Optimize for performance
      validateStatus: (status: number) => status < 500,
      maxContentLength: 50 * 1024 * 1024, // 50MB max response size
      maxBodyLength: 10 * 1024 * 1024,     // 10MB max request body
      // Enable automatic decompression
      decompress: true
    });

    // Add request interceptor for monitoring
    this.axiosInstance.interceptors.request.use(
      (config: any) => {
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for metrics
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const endTime = Date.now();
        const startTime = (response.config as any).metadata?.startTime || endTime;
        const duration = endTime - startTime;
        
        if (duration > 5000) {
          console.warn(`[HttpPool] Slow request detected: ${response.config.url} took ${duration}ms`);
        }
        
        return response;
      },
      (error) => {
        const endTime = Date.now();
        const startTime = (error.config as any)?.metadata?.startTime || endTime;
        const duration = endTime - startTime;
        
        console.error(`[HttpPool] Request failed after ${duration}ms:`, {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });
        
        return Promise.reject(error);
      }
    );

    console.log('[HttpPool] Connection pool initialized with optimized settings');
  }

  static getInstance(): HttpConnectionPool {
    if (!HttpConnectionPool.instance) {
      HttpConnectionPool.instance = new HttpConnectionPool();
    }
    return HttpConnectionPool.instance;
  }

  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  getStats(): {
    httpSockets: number;
    httpFreeSockets: number;
    httpsPending: number;
    httpsFreeSockets: number;
  } {
    const httpSockets = Object.keys((this.httpAgent as any).sockets || {}).reduce(
      (total, key) => total + ((this.httpAgent as any).sockets[key]?.length || 0), 0
    );
    
    const httpFreeSockets = Object.keys((this.httpAgent as any).freeSockets || {}).reduce(
      (total, key) => total + ((this.httpAgent as any).freeSockets[key]?.length || 0), 0
    );

    const httpsPending = Object.keys((this.httpsAgent as any).requests || {}).reduce(
      (total, key) => total + ((this.httpsAgent as any).requests[key]?.length || 0), 0
    );

    const httpsFreeSockets = Object.keys((this.httpsAgent as any).freeSockets || {}).reduce(
      (total, key) => total + ((this.httpsAgent as any).freeSockets[key]?.length || 0), 0
    );

    return {
      httpSockets,
      httpFreeSockets, 
      httpsPending,
      httpsFreeSockets
    };
  }

  /**
   * Clean up idle connections to free resources
   */
  cleanup(): void {
    console.log('[HttpPool] Cleaning up idle connections...');
    
    // Destroy idle HTTP connections
    const httpFreeSockets = (this.httpAgent as any).freeSockets || {};
    Object.keys(httpFreeSockets).forEach(key => {
      if (httpFreeSockets[key]) {
        httpFreeSockets[key].forEach((socket: any) => socket.destroy());
        httpFreeSockets[key] = [];
      }
    });

    // Destroy idle HTTPS connections
    const httpsFreeSockets = (this.httpsAgent as any).freeSockets || {};
    Object.keys(httpsFreeSockets).forEach(key => {
      if (httpsFreeSockets[key]) {
        httpsFreeSockets[key].forEach((socket: any) => socket.destroy());
        httpsFreeSockets[key] = [];
      }
    });
  }

  /**
   * Completely destroy the connection pool
   */
  destroy(): void {
    console.log('[HttpPool] Destroying connection pool...');
    
    // Destroy all HTTP connections
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
    
    console.log('[HttpPool] Connection pool destroyed');
  }
}

// Export singleton instance
export const httpPool = HttpConnectionPool.getInstance();