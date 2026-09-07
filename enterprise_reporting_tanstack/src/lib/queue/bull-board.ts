/**
 * Bull Board Integration
 * Provides configuration for Bull Board UI (custom implementation)
 */

import { BULL_BOARD_CONFIG } from "./config";

/**
 * Get the Bull Board base path
 */
export function getBullBoardBasePath(): string {
  return BULL_BOARD_CONFIG.routePrefix;
}

/**
 * Check if authentication is enabled for Bull Board
 */
export function isBullBoardAuthEnabled(): boolean {
  return !!(BULL_BOARD_CONFIG.username && BULL_BOARD_CONFIG.password);
}

/**
 * Get Bull Board credentials (for validation)
 */
export function getBullBoardCredentials(): { username: string; password: string } {
  return {
    username: BULL_BOARD_CONFIG.username,
    password: BULL_BOARD_CONFIG.password,
  };
}
