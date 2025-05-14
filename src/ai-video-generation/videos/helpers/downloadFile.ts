import axios from 'axios';
import { readFile } from 'fs/promises';
import path from 'path';

const localImages: { url: string; path: string }[] = [];

/**
 * Descarga un archivo desde una URL o lo lee localmente si está disponible
 * @param url URL del archivo a descargar
 * @returns Buffer con los datos del archivo
 */
export async function downloadFile(url: string): Promise<Buffer> {
  // Buscar si la URL existe en localImages
  const localImage = localImages.find((img) => img.url === url);

  if (localImage) {
    try {
      // Si existe localmente, leer el archivo del path especificado
      console.log('Leyendo archivo local:', localImage.path);
      // No usar process.cwd() ya que parece no estar disponible
      const filePath = localImage.path; // Usar la ruta directamente
      console.log('Intentando leer desde:', filePath);
      return await readFile(filePath);
    } catch (localError) {
      console.warn(
        `Error al leer archivo local ${localImage.path}:`,
        localError.message,
      );
      console.log('Intentando descargar desde URL como alternativa...');
      // Si falla la lectura local, intentar descargar desde URL
    }
  }

  // Descargar desde URL (si no existe localmente o falló la lectura local)
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (downloadError) {
    throw new Error(
      `No se pudo descargar el archivo desde ${url}: ${downloadError.message}`,
    );
  }
}
