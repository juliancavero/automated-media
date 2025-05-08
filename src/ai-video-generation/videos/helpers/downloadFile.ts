import axios from 'axios';

/**
 * Descarga un archivo desde una URL
 * @param url URL del archivo a descargar
 * @returns Buffer con los datos del archivo
 */
export async function downloadFile(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`No se pudo descargar el archivo desde ${url}`);
  }
}
