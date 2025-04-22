import { Logger } from '@nestjs/common';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

const logger = new Logger('AWSConfig');

/**
 * Sets up AWS configuration based on environment variables or credentials file
 */
export function setupAWSConfig(): boolean {
  // Enable loading AWS config from credentials file
  process.env.AWS_SDK_LOAD_CONFIG = '1';

  try {
    // Check if AWS credentials are in environment variables
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      logger.log('AWS credentials found in environment variables');
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
    const stsClient = new STSClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    // Try to get the caller identity to verify credentials
    const command = new GetCallerIdentityCommand({});
    const response = await stsClient.send(command);

    logger.log(`AWS configuration valid. Account ID: ${response.Account}`);
    return true;
  } catch (error) {
    logger.error(
      `AWS credentials validation failed: ${error.message}`,
      error.stack,
    );
    return false;
  }
}
