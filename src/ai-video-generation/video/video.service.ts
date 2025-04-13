import { Injectable, Logger } from '@nestjs/common';
import { GeneratedImage } from '../image-generation/schemas/generated-image.schema';
import { StoredAudio } from '../audio/schemas/stored-audio.schema';
import { CloudinaryService } from 'src/automated-media/cloudinary/cloudinary.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

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

  constructor(private readonly cloudinaryService: CloudinaryService) {
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
    imagenes: GeneratedImage[],
    audios: StoredAudio[],
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
      const uploadResult =
        await this.cloudinaryService.uploadVideo(videoBuffer);

      this.logger.log(`Video subido a Cloudinary: ${uploadResult.url}`);
      return uploadResult.url;
    } catch (error) {
      this.logger.error('Error al crear el video:', error);
      throw error;
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
    imagenes: GeneratedImage[],
    audios: StoredAudio[],
    options: VideoOptions,
  ): Promise<Buffer> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-gen-'));
    const tempFiles: string[] = [];

    try {
      this.logger.log(`Creando archivos temporales en: ${tempDir}`);

      // Crear archivos temporales para las imágenes
      const imageFiles = await Promise.all(
        imagenes.map(async (imagen, index) => {
          const imageExt = this.getExtensionFromMimeType(imagen.mimeType);
          const imageFilePath = path.join(
            tempDir,
            `image_${index}.${imageExt}`,
          );
          const imageData = Buffer.from(imagen.imageData, 'base64');
          await promisify(fs.writeFile)(imageFilePath, imageData);
          tempFiles.push(imageFilePath);
          return { path: imageFilePath, order: imagen.order };
        }),
      );

      // Crear archivos temporales para los audios
      const audioFiles = await Promise.all(
        audios.map(async (audio, index) => {
          const audioExt = audio.format || 'mp3';
          const audioFilePath = path.join(
            tempDir,
            `audio_${index}.${audioExt}`,
          );
          const audioData = Buffer.from(audio.audioData, 'base64');
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
   * Obtiene la extensión de archivo a partir del tipo MIME
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
    };

    return mimeMap[mimeType] || 'jpg';
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
