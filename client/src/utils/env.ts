/**
 * Centralized environment detection utility
 * Provides unified methods to detect desktop app environment
 */
import { useHashLocation } from 'wouter/use-hash-location';

/**
 * Detects if the application is running in an Electron desktop environment
 * @returns true if running in desktop app, false if running in web browser
 */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && 
         ('electronAPI' in window || navigator.userAgent.includes('Electron'));
}

/**
 * Detects if the application is running in a web browser environment
 * @returns true if running in web browser, false if running in desktop app
 */
export function isWebApp(): boolean {
  return !isDesktopApp();
}

/**
 * Gets the appropriate routing hook for the current environment
 * - Desktop apps use hash routing to avoid 404 errors
 * - Web apps use regular history routing
 * @returns the routing hook function or undefined for default history routing
 */
export function getRoutingHook() {
  if (isDesktopApp()) {
    // Return hash location hook for desktop apps
    return useHashLocation;
  }
  // Return undefined for default history routing in web apps
  return undefined;
}

/**
 * Environment information object
 */
export const ENV = {
  isDesktop: isDesktopApp(),
  isWeb: isWebApp(),
  routingHook: getRoutingHook(),
} as const;