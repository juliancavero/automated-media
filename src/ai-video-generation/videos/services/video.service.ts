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
   * @param imagenes Array de Image
   * @param audios Array de Audio
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
      const existingVideo = await this.videoGenerationService.findById(videoId);
      const newStatus = existingVideo?.status === 'uploaded' ? 'uploaded' : 'finished';

      const video = await this.videoGenerationService.setVideoUrl(
        videoId,
        uploadResult.url,
        uploadResult.public_id,
        newStatus
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

      // Calcular duración total de todos los audios
      let totalAudioDuration = 0;
      const audioDurations = await Promise.all(
        audioFiles.map(async (audioFile) => {
          const duration = await this.getAudioDuration(audioFile.path);
          totalAudioDuration += duration;
          return duration;
        })
      );

      this.logger.log(`Duración total de audio: ${totalAudioDuration} segundos`);

      // Crear un archivo de silencio de 1 segundo
      const silenceFilePath = path.join(tempDir, 'silence.mp3');
      tempFiles.push(silenceFilePath);

      // Generar un archivo de silencio de 1 segundo
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input('anullsrc')
          .inputFormat('lavfi')
          .audioFrequency(44100)
          .audioBitrate('192k')
          .audioChannels(2)
          .duration(1)
          .output(silenceFilePath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Enfoque mejorado: Preparar para un proceso de dos etapas
      // 1. Primero concatenamos todos los audios con silencios
      // 2. Luego creamos un video con las imágenes sincronizadas al audio

      // Archivo con lista de audios para concatenar (incluyendo silencios)
      const audioListFile = path.join(tempDir, 'audiolist.txt');
      let audioListContent = '';

      // Añadir cada audio seguido por un silencio (excepto el último)
      audioFiles.forEach((audioFile, index) => {
        audioListContent += `file '${audioFile.path}'\n`;

        // Añadir silencio después de cada audio excepto el último
        if (index < audioFiles.length - 1) {
          audioListContent += `file '${silenceFilePath}'\n`;
        }
      });

      await promisify(fs.writeFile)(audioListFile, audioListContent);
      tempFiles.push(audioListFile);

      // Archivo temporal para audio concatenado
      const concatAudioPath = path.join(tempDir, 'concat_audio.mp3');
      tempFiles.push(concatAudioPath);

      // Primero concatenar todos los audios con silencios intercalados
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(audioListFile)
          .inputOptions('-f', 'concat', '-safe', '0')
          .outputOptions('-c:a', 'libmp3lame', '-b:a', '192k')
          .output(concatAudioPath)
          .on('end', resolve)
          .on('error', (err) => {
            this.logger.error('Error al concatenar audios:', err);
            reject(err);
          })
          .run();
      });

      // Verificar duración del audio concatenado final
      const finalAudioDuration = await this.getAudioDuration(concatAudioPath);
      this.logger.log(`Duración del audio concatenado: ${finalAudioDuration} segundos`);

      // Calcular cuánto tiempo debe mostrarse cada imagen
      const totalSilenceDuration = Math.max(0, audioFiles.length - 1); // 1 segundo por cada silencio
      const totalDuration = finalAudioDuration;
      const silenceCount = audioFiles.length - 1;

      // Crear archivo de segmentos para las imágenes
      const segmentsFile = path.join(tempDir, 'segments.txt');
      let segmentsContent = '';

      let currentPosition = 0;
      for (let i = 0; i < audioFiles.length; i++) {
        const imageFile = imageFiles[Math.min(i, imageFiles.length - 1)];
        const audioDuration = audioDurations[i];

        // Añadir imagen con la duración del audio correspondiente
        segmentsContent += `file '${imageFile.path}'\n`;
        segmentsContent += `duration ${audioDuration}\n`;

        currentPosition += audioDuration;

        // Añadir silencio si no es el último audio
        if (i < audioFiles.length - 1) {
          segmentsContent += `file '${imageFile.path}'\n`;
          segmentsContent += `duration 1\n`;
          currentPosition += 1;
        }
      }

      // Añadir la última imagen una vez más (necesario para el último segmento)
      if (imageFiles.length > 0) {
        segmentsContent += `file '${imageFiles[Math.min(audioFiles.length - 1, imageFiles.length - 1)].path}'\n`;
      }

      await promisify(fs.writeFile)(segmentsFile, segmentsContent);
      tempFiles.push(segmentsFile);

      // Crear el video final con las imágenes y el audio concatenado
      await new Promise<void>((resolve, reject) => {
        // Establecer un tiempo de espera máximo para el proceso
        const timeoutDuration = 3600000; // 1 hora en milisegundos
        let ffmpegCommand = ffmpeg()
          .input(segmentsFile)
          .inputOptions('-f', 'concat', '-safe', '0')
          .input(concatAudioPath)
          .outputOptions([
            '-pix_fmt', 'yuv420p',
            '-c:v', 'libx264',
            '-preset', 'medium', // Balance entre velocidad y calidad
            '-profile:v', 'high',
            '-crf', '23', // Calidad visual (menor número = mejor calidad)
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ar', '44100', // Sample rate de audio
            '-s', '720x1280', // Cambiado a formato 9:16 (vertical)
            '-r', '30',
            '-shortest',
            '-max_muxing_queue_size', '9999' // Evita errores de buffer para videos largos
          ])
          .output(outputVideoPath)
          .outputOption('-threads', '0'); // Usar todos los núcleos disponibles

        // Variable para almacenar el proceso de ffmpeg
        let ffmpegProcess = null;

        // Crear un timeout para abortar el proceso si toma demasiado tiempo
        const timeoutId = setTimeout(() => {
          this.logger.warn('El proceso de FFmpeg está tomando demasiado tiempo, abortando');
          if (ffmpegCommand && typeof ffmpegCommand.kill === 'function') {
            ffmpegCommand.kill();
          }
          reject(new Error('El proceso de FFmpeg ha excedido el tiempo máximo permitido'));
        }, timeoutDuration);

        ffmpegCommand
          .on('start', (commandLine) => {
            this.logger.log(`Ejecutando comando FFmpeg: ${commandLine}`);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              this.logger.log(`Progreso: ${Math.floor(progress.percent)}%`);
            } else if (progress.frames) {
              this.logger.log(`Frames procesados: ${progress.frames}`);
            }
          })
          .on('end', () => {
            clearTimeout(timeoutId); // Limpiar el timeout ya que terminó correctamente
            this.logger.log('Video generado exitosamente');
            resolve();
          })
          .on('error', (err) => {
            clearTimeout(timeoutId); // Limpiar el timeout ya que terminó con error
            this.logger.error('Error al generar el video:', err);
            reject(err);
          })
          .run();
      });

      // Verificar que el video se generó correctamente
      const videoStats = await promisify(fs.stat)(outputVideoPath);
      this.logger.log(`Video generado: ${outputVideoPath}, tamaño: ${videoStats.size} bytes`);

      // Verificar duración del video final
      const videoDuration = await this.getVideoDuration(outputVideoPath);
      this.logger.log(`Duración del video final: ${videoDuration} segundos`);

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
          this.logger.error(`Error al obtener duración de audio: ${err.message}`);
          return reject(err);
        }

        const duration =
          metadata.format.duration || this.DEFAULT_VIDEO_OPTIONS.duration;
        resolve(duration);
      });
    });
  }

  /**
   * Obtiene la duración de un archivo de video usando ffprobe
   */
  private getVideoDuration(videoFilePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoFilePath, (err, metadata) => {
        if (err) {
          this.logger.error(`Error al obtener duración de video: ${err.message}`);
          return reject(err);
        }

        const duration = metadata.format.duration || 0;
        resolve(duration);
      });
    });
  }
}
