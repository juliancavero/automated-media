import * as fs from 'fs';
import { Logger } from '@nestjs/common';

/**
 * Creates a directory if it doesn't exist
 * @param dir Directory path to create
 * @param logger Optional logger to record results
 */
export function ensureDirectoryExists(dir: string, logger?: Logger): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    if (logger) {
      logger.log(`Created directory at: ${dir}`);
    }
  }
}

/**
 * Safe way to clean up files and directories
 * @param filePath Path to file or directory to remove
 * @param recursive Whether to recursively remove directories (defaults to true)
 * @param logger Optional logger to record results
 */
export function safeRemove(
  filePath: string,
  recursive: boolean = true,
  logger?: Logger,
): boolean {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive, force: true });
      } else {
        fs.unlinkSync(filePath);
      }

      if (logger) {
        logger.log(`Successfully removed: ${filePath}`);
      }
      return true;
    }
    return false;
  } catch (error) {
    if (logger) {
      logger.error(`Failed to remove ${filePath}: ${error.message}`);
    }
    return false;
  }
}
