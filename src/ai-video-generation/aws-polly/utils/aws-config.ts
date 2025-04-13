import { Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';

const logger = new Logger('AWSConfig');

/**
 * Sets up AWS configuration based on environment variables or credentials file
 */
export function setupAWSConfig(): boolean {
  // Enable loading AWS config from credentials file
  process.env.AWS_SDK_LOAD_CONFIG = '1';

  try {
    // Try to configure from environment variables first
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      logger.log('Configuring AWS SDK using environment variables');
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
      });
      return true;
    }

    logger.warn(
      'AWS credentials not found in environment variables or credentials file',
    );
    return false;
  } catch (error) {
    logger.error(`Error configuring AWS SDK: ${error.message}`, error.stack);
    return false;
  }
}

/**
 * Validates AWS configuration is working by making a test call
 */
export async function validateAWSConfig(): Promise<boolean> {
  try {
    // Create a test STS client
    const sts = new AWS.STS();

    // Try to get the caller identity to verify credentials
    const data = await sts.getCallerIdentity().promise();
    logger.log(`AWS configuration valid. Account ID: ${data.Account}`);
    return true;
  } catch (error) {
    logger.error(
      `AWS credentials validation failed: ${error.message}`,
      error.stack,
    );
    return false;
  }
}
