import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { Image } from '../../images/schemas/image.schema';
import { Audio } from '../../audios/schemas/audio.schema';
import axios from 'axios';
import { CloudinaryService } from 'src/external/cloudinary/cloudinary.service';
import { VideoGenerationService } from './video-generation.service';

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

interface VideoOptions {
  duration: number; // Duración en segundos por imagen (solo usado si no hay audios)
  format?: string; // Formato del video (mp4, avi, etc.)
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly DEFAULT_VIDEO_OPTIONS: VideoOptions = {
    duration: 5,
    format: 'mp4',
  };

  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly videoGenerationService: VideoGenerationService,
  ) {
    this.logger.log('VideoService inicializado');
  }

  /**
   * Crea un video a partir de arrays de imágenes y audios generados
   * @param imagenes Array de GeneratedImage
   * @param audios Array de StoredAudio
   * @param options Opciones de configuración del video
   * @returns Promise<Buffer> Buffer con los datos del video generado
   */
  async crearVideo(
    videoId: string,
    imagenes: Image[],
    audios: Audio[],
    options?: VideoOptions,
  ): Promise<string> {
    const videoOptions = { ...this.DEFAULT_VIDEO_OPTIONS, ...options };

    try {
      this.logger.log(
        `Creando video con ${imagenes.length} imágenes y ${audios.length} audios`,
      );

      // Generar el video utilizando los datos en memoria
      const videoBuffer = await this.generateVideo(
        imagenes,
        audios,
        videoOptions,
      );

      this.logger.log(`Video generado exitosamente`);
      // Subir el video a Cloudinary
      const uploadResult = await this.cloudinaryService.upload(videoBuffer);

      if (!uploadResult?.url) {
        throw new Error('Error al subir el video a Cloudinary');
      }

      // Guardar el video en la base de datos
      const video = await this.videoGenerationService.setVideoUrl(
        videoId,
        uploadResult.url,
        uploadResult.public_id,
      );
      if (!video) {
        this.logger.error('Error al guardar el video en la base de datos');
        throw new Error('Error al guardar el video en la base de datos');
      }

      return video.url ?? '';
    } catch (error) {
      this.logger.error('Error al crear el video:', error);
      throw error;
    }
  }

  /**
   * Descarga un archivo desde una URL
   * @param url URL del archivo a descargar
   * @returns Buffer con los datos del archivo
   */
  private async downloadFile(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Error al descargar archivo desde ${url}:`, error);
      throw new Error(`No se pudo descargar el archivo desde ${url}`);
    }
  }

  /**
   * Extrae la extensión de archivo de una URL
   * @param url URL del archivo
   * @returns Extensión del archivo
   */
  private getExtensionFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const extension = path.extname(pathname).substring(1);
      return extension || 'jpg'; // Default to jpg if no extension found
    } catch (error) {
      return 'jpg'; // Default to jpg on error
    }
  }

  /**
   * Genera un video combinando imágenes y audios
   * @param imagenes Array de imágenes generadas
   * @param audios Array de audios almacenados
   * @param options Opciones de configuración del video
   * @returns Buffer con los datos del video generado
   */
  private async generateVideo(
    imagenes: Image[],
    audios: Audio[],
    options: VideoOptions,
  ): Promise<Buffer> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-gen-'));
    const tempFiles: string[] = [];

    try {
      this.logger.log(`Creando archivos temporales en: ${tempDir}`);

      // Crear archivos temporales para las imágenes
      const imageFiles = await Promise.all(
        imagenes.map(async (imagen, index) => {
          if (!imagen.url) {
            throw new Error(`La imagen ${index} no tiene URL`);
          }

          const imageExt = this.getExtensionFromUrl(imagen.url);
          const imageFilePath = path.join(
            tempDir,
            `image_${index}.${imageExt}`,
          );

          // Descargar la imagen desde la URL
          const imageData = await this.downloadFile(imagen.url);
          await promisify(fs.writeFile)(imageFilePath, imageData);
          tempFiles.push(imageFilePath);
          return { path: imageFilePath, order: imagen.order };
        }),
      );

      // Crear archivos temporales para los audios
      const audioFiles = await Promise.all(
        audios.map(async (audio, index) => {
          if (!audio.url) {
            throw new Error(`El audio ${index} no tiene URL`);
          }

          const audioExt = this.getExtensionFromUrl(audio.url);
          const audioFilePath = path.join(
            tempDir,
            `audio_${index}.${audioExt}`,
          );

          // Descargar el audio desde la URL
          const audioData = await this.downloadFile(audio.url);
          await promisify(fs.writeFile)(audioFilePath, audioData);
          tempFiles.push(audioFilePath);
          return { path: audioFilePath, order: audio.order };
        }),
      );

      // Ordenar archivos por orden
      imageFiles.sort((a, b) => a.order - b.order);
      audioFiles.sort((a, b) => a.order - b.order);

      // Archivo de salida del video
      const outputVideoPath = path.join(tempDir, `output.${options.format}`);
      tempFiles.push(outputVideoPath);

      // Enfoque simplificado: crear un archivo de texto para cada imagen con su duración
      const segmentsFile = path.join(tempDir, 'segments.txt');
      let segmentsContent = '';

      // Crear el contenido del archivo de segmentos
      for (let i = 0; i < Math.min(imageFiles.length, audioFiles.length); i++) {
        const imageFile = imageFiles[i];
        const audioFile = audioFiles[i];

        // Obtener la duración del audio correspondiente
        const audioDuration = await this.getAudioDuration(audioFile.path);

        // Añadir entrada al archivo de segmentos
        segmentsContent += `file '${imageFile.path}'\n`;
        segmentsContent += `duration ${audioDuration}\n`;
      }

      // Añadir la última imagen una vez más (necesario para el último segmento)
      if (imageFiles.length > 0) {
        segmentsContent += `file '${imageFiles[imageFiles.length - 1].path}'\n`;
      }

      // Escribir archivo de segmentos
      await promisify(fs.writeFile)(segmentsFile, segmentsContent);
      tempFiles.push(segmentsFile);

      // Crear archivo con lista de audios para concatenar
      const audioListFile = path.join(tempDir, 'audiolist.txt');
      let audioListContent = '';

      audioFiles.forEach((audioFile) => {
        audioListContent += `file '${audioFile.path}'\n`;
      });

      await promisify(fs.writeFile)(audioListFile, audioListContent);
      tempFiles.push(audioListFile);

      // Archivo temporal para audio concatenado
      const concatAudioPath = path.join(tempDir, 'concat_audio.mp3');
      tempFiles.push(concatAudioPath);

      // Primero concatenar todos los audios
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(audioListFile)
          .inputOptions('-f', 'concat', '-safe', '0')
          .outputOptions('-c', 'copy')
          .output(concatAudioPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Luego crear el video con las imágenes y el audio concatenado
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(segmentsFile)
          .inputOptions('-f', 'concat', '-safe', '0')
          .input(concatAudioPath)
          .outputOptions([
            '-pix_fmt',
            'yuv420p',
            '-c:v',
            'libx264', // Especifica el codec de video
            '-c:a',
            'aac', // Especifica el codec de audio
            '-b:a',
            '192k', // Bitrate de audio
            '-s',
            '1280x720', // Resolución de video (720p)
            '-r',
            '30', // Framerate
            '-shortest', // Termina cuando el stream más corto termina
          ])
          .output(outputVideoPath)
          .on('progress', (progress) => {
            if (progress.percent) {
              this.logger.log(`Progreso: ${Math.floor(progress.percent)}%`);
            }
          })
          .on('end', () => {
            this.logger.log('Video generado exitosamente');
            resolve();
          })
          .on('error', (err) => {
            this.logger.error('Error al generar el video:', err);
            reject(err);
          })
          .run();
      });

      // Leer el video generado como buffer
      return await promisify(fs.readFile)(outputVideoPath);
    } catch (error) {
      this.logger.error('Error en generateVideo:', error);
      throw error;
    } finally {
      // Limpiar archivos temporales
      for (const file of tempFiles) {
        try {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        } catch (err) {
          this.logger.warn(
            `No se pudo eliminar el archivo temporal: ${file}`,
            err,
          );
        }
      }

      // Eliminar directorio temporal
      try {
        fs.rmdirSync(tempDir);
      } catch (err) {
        this.logger.warn(
          `No se pudo eliminar el directorio temporal: ${tempDir}`,
          err,
        );
      }
    }
  }

  /**
   * Obtiene la duración de un archivo de audio usando ffprobe
   */
  private getAudioDuration(audioFilePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioFilePath, (err, metadata) => {
        if (err) {
          return reject(err);
        }

        const duration =
          metadata.format.duration || this.DEFAULT_VIDEO_OPTIONS.duration;
        resolve(duration);
      });
    });
  }
}
