import path from 'path';

export function getExtensionFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const extension = path.extname(pathname).substring(1);
    return extension || 'jpg'; // Default to jpg if no extension found
  } catch (error) {
    return 'jpg'; // Default to jpg on error
  }
}
