import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

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

  /**
   * Crea un video a partir de una lista de URLs de imágenes usando audios de la carpeta /public/audios
   * @param imagenes Lista de URLs de imágenes
   * @param options Opciones de configuración del video
   * @returns Promise<Buffer> Buffer con los datos del video generado
   */
  async crearVideo(
    imagenes: string[],
    options?: VideoOptions,
  ): Promise<Buffer> {
    const videoOptions = { ...this.DEFAULT_VIDEO_OPTIONS, ...options };
    const tempDir = path.join(process.cwd(), 'temp');
    const imageDir = path.join(tempDir, 'images', `job_${Date.now()}`);
    const videoPath = path.join(
      tempDir,
      `video_${Date.now()}.${videoOptions.format}`,
    );

    // Directorio de audios
    const publicDir = path.join(process.cwd(), 'public');
    const audiosDir = path.join(publicDir, 'audios');

    // Crear directorios necesarios
    this.ensureDirectoryExists(tempDir);
    this.ensureDirectoryExists(imageDir);
    this.ensureDirectoryExists(publicDir);
    this.ensureDirectoryExists(audiosDir);

    const downloadedImages: string[] = [];
    let audioFiles: string[] = [];

    try {
      // Obtener archivos de audio de la carpeta /public/audios
      audioFiles = this.getAudioFilesFromDirectory(audiosDir);
      this.logger.log(`Archivos de audio encontrados: ${audioFiles.length}`);

      // Descargar todas las imágenes
      await Promise.all(
        imagenes.map(async (imageUrl, index) => {
          const imageName = `image${index + 1}.jpg`;
          const imagePath = path.join(imageDir, imageName);
          await this.downloadImage(imageUrl, imagePath);
          downloadedImages.push(imagePath);
        }),
      );

      // Generar el video
      await this.generateVideo(
        downloadedImages,
        audioFiles,
        videoPath,
        tempDir,
        videoOptions,
      );

      // Leer el archivo de video como buffer
      const videoBuffer = fs.readFileSync(videoPath);

      // Limpiar archivos temporales (solo las imágenes y el video, no los audios porque los necesitamos para futuros videos)
      this.limpiarArchivosTemporales(
        [...downloadedImages, videoPath],
        imageDir,
      );

      // Eliminar directorios temporales específicos de este trabajo
      if (fs.existsSync(imageDir)) fs.rmdirSync(imageDir, { recursive: true });

      return videoBuffer;
    } catch (error) {
      this.logger.error('Error al crear el video:', error);
      throw error;
    }
  }

  /**
   * Obtiene los archivos de audio .mp3 de un directorio
   * @param directory Directorio donde buscar archivos de audio
   * @returns Array de rutas de archivos de audio
   */
  private getAudioFilesFromDirectory(directory: string): string[] {
    try {
      if (!fs.existsSync(directory)) {
        this.logger.warn(`El directorio ${directory} no existe`);
        return [];
      }

      // Leer todos los archivos del directorio
      const files = fs.readdirSync(directory);

      // Filtrar solo archivos .mp3
      const audioFiles = files
        .filter((file) => file.toLowerCase().endsWith('.mp3'))
        .map((file) => path.join(directory, file));

      if (audioFiles.length === 0) {
        this.logger.warn(`No se encontraron archivos .mp3 en ${directory}`);
      }

      return audioFiles;
    } catch (error) {
      this.logger.error(`Error al leer directorio de audios: ${error.message}`);
      return [];
    }
  }

  /**
   * Asegura que un directorio exista, creándolo si es necesario
   */
  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Descarga una imagen desde una URL y la guarda en el sistema de archivos
   */
  private async downloadImage(
    imageUrl: string,
    imagePath: string,
  ): Promise<void> {
    return this.downloadFile(imageUrl, imagePath);
  }

  /**
   * Descarga un archivo desde una URL y lo guarda en el sistema de archivos
   */
  private async downloadFile(fileUrl: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(fileUrl);
      const protocol = url.protocol === 'https:' ? https : http;

      protocol
        .get(fileUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `Failed to download file. Status code: ${response.statusCode}`,
              ),
            );
            return;
          }

          const fileStream = fs.createWriteStream(filePath);
          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });
        })
        .on('error', (error) => {
          fs.unlink(filePath, () => reject(error));
        });
    });
  }

  /**
   * Obtiene la duración de un archivo de audio en segundos
   */
  private async getAudioDuration(audioPath: string): Promise<number> {
    try {
      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
          if (err) {
            this.logger.error(
              `Error obteniendo duración con ffprobe: ${err.message}`,
            );
            resolve(this.DEFAULT_VIDEO_OPTIONS.duration); // Usar duración por defecto en caso de error
          } else {
            const duration = metadata.format.duration;
            resolve(duration);
          }
        });
      });
    } catch (error) {
      this.logger.error(
        `Error obteniendo duración del audio: ${error.message}`,
      );
      return this.DEFAULT_VIDEO_OPTIONS.duration; // Usar duración por defecto en caso de error
    }
  }

  /**
   * Genera un video a partir de imágenes utilizando ffmpeg, sincronizando cada imagen con su audio correspondiente
   */
  private async generateVideo(
    imagePaths: string[],
    audioPaths: string[],
    videoPath: string,
    publicDir: string,
    options: VideoOptions,
  ): Promise<void> {
    if (audioPaths.length === 0) {
      // Si no hay audios, usar el método original con duración fija por imagen
      return this.generateVideoWithFixedDuration(
        imagePaths,
        [],
        videoPath,
        publicDir,
        options,
      );
    }

    // Crear directorio temporal para segmentos
    const segmentsDir = path.join(publicDir, 'segments');
    this.ensureDirectoryExists(segmentsDir);

    try {
      const segments: { input: string; duration: number }[] = [];
      const segmentFilePaths: string[] = [];

      // Para cada audio, crear un segmento de video con su imagen correspondiente
      for (let i = 0; i < audioPaths.length; i++) {
        // Usar la última imagen disponible si no hay suficientes imágenes
        const imageIndex = Math.min(i, imagePaths.length - 1);
        const imagePath = imagePaths[imageIndex];
        const audioPath = audioPaths[i];

        // Obtener duración del audio
        const audioDuration = await this.getAudioDuration(audioPath);

        // Crear segmento de video
        const segmentPath = path.join(segmentsDir, `segment_${i}.mp4`);
        await this.createVideoSegment(
          imagePath,
          audioPath,
          segmentPath,
          audioDuration,
        );

        segments.push({
          input: segmentPath,
          duration: audioDuration,
        });
        segmentFilePaths.push(segmentPath);
      }

      // Concatenar todos los segmentos en un solo video
      await this.concatenateSegments(
        segmentFilePaths,
        videoPath,
        options.format,
      );

      // Limpiar archivos temporales
      for (const segmentPath of segmentFilePaths) {
        if (fs.existsSync(segmentPath)) {
          fs.unlinkSync(segmentPath);
        }
      }
      if (fs.existsSync(segmentsDir)) {
        fs.rmdirSync(segmentsDir);
      }

      return;
    } catch (error) {
      this.logger.error(`Error generando video: ${error.message}`);
      throw error;
    }
  }

  /**
   * Crear un segmento de video con una imagen y un audio
   */
  private async createVideoSegment(
    imagePath: string,
    audioPath: string,
    outputPath: string,
    duration: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(imagePath)
        .inputOptions(['-loop 1', `-t ${duration}`])
        .input(audioPath)
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-c:a aac', // Use AAC codec for audio
          '-b:a 192k', // Set audio bitrate to ensure quality
          '-shortest',
          `-t ${duration}`,
          '-map 0:v:0', // Map video from first input
          '-map 1:a:0', // Map audio from second input
        ])
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg segmento iniciado: ${commandLine}`);
        })
        .on('error', (err) => {
          this.logger.error(`Error en FFmpeg segmento: ${err.message}`);
          reject(err);
        })
        .on('end', () => {
          this.logger.log(`Segmento creado exitosamente: ${outputPath}`);
          resolve();
        })
        .output(outputPath)
        .run();
    });
  }

  /**
   * Concatenar múltiples segmentos de video en uno solo
   */
  private async concatenateSegments(
    segmentPaths: string[],
    outputPath: string,
    format: string = 'mp4',
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Verify if we have segments to concatenate
      if (segmentPaths.length === 0) {
        reject(new Error('No hay segmentos para concatenar'));
        return;
      }

      // Check if segments exist
      for (const segmentPath of segmentPaths) {
        if (!fs.existsSync(segmentPath)) {
          reject(new Error(`Segment file not found: ${segmentPath}`));
          return;
        }
      }

      const command = ffmpeg();

      // Crear una lista de concatanación para ffmpeg
      const concatList = segmentPaths.map((p) => `file '${p}'`).join('\n');
      const concatFilePath = path.join(
        path.dirname(segmentPaths[0]),
        'concat_list.txt',
      );
      fs.writeFileSync(concatFilePath, concatList);

      command
        .input(concatFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          '-c:v copy', // Copy video stream without re-encoding
          '-c:a aac', // Use AAC codec for audio
          '-b:a 192k', // Set audio bitrate
          '-movflags +faststart', // Optimize for web playback
        ])
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg concatenación iniciada: ${commandLine}`);
        })
        .on('error', (err) => {
          this.logger.error(`Error en FFmpeg concatenación: ${err.message}`);
          if (fs.existsSync(concatFilePath)) {
            fs.unlinkSync(concatFilePath);
          }
          reject(err);
        })
        .on('end', () => {
          this.logger.log(`Video concatenado exitosamente: ${outputPath}`);
          if (fs.existsSync(concatFilePath)) {
            fs.unlinkSync(concatFilePath);
          }

          // Verify the output file has audio
          this.verifyVideoHasAudio(outputPath)
            .then((hasAudio) => {
              if (!hasAudio) {
                this.logger.warn(
                  'El video generado no tiene audio o el stream de audio está corrupto',
                );
              }
              resolve();
            })
            .catch((error) => {
              this.logger.error(`Error verificando audio: ${error.message}`);
              resolve(); // Still resolve to continue the process
            });
        })
        .output(outputPath)
        .run();
    });
  }

  /**
   * Verificar si un archivo de video tiene audio
   */
  private async verifyVideoHasAudio(videoPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          this.logger.error(`Error al verificar audio: ${err.message}`);
          resolve(false);
          return;
        }

        // Check if the video has audio streams
        const hasAudio = metadata.streams.some(
          (stream) => stream.codec_type === 'audio',
        );
        if (!hasAudio) {
          this.logger.warn(
            'No se encontraron streams de audio en el video generado',
          );
        } else {
          this.logger.log('Video generado con audio correctamente');
        }

        resolve(hasAudio);
      });
    });
  }

  /**
   * Método original para generar video con duración fija por imagen (sin sincronización con audio)
   */
  private async generateVideoWithFixedDuration(
    imagePaths: string[],
    audioPaths: string[],
    videoPath: string,
    publicDir: string,
    options: VideoOptions,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Configurar cada imagen como entrada
      imagePaths.forEach((imagePath) => {
        command
          .input(imagePath)
          .loop(options.duration || this.DEFAULT_VIDEO_OPTIONS.duration);
      });

      // Si hay audios, agregarlos al comando
      if (audioPaths.length > 0) {
        // Agregar todos los audios como inputs
        audioPaths.forEach((audioPath) => {
          command.input(audioPath);
        });

        // Preparar filtro complejo para mezclar imágenes y audios
        let complexFilter = '';

        // Crear un filtro para concatenar las imágenes
        const imageInputs = imagePaths.map((_, i) => `[${i}:v]`).join('');
        complexFilter += `${imageInputs}concat=n=${imagePaths.length}:v=1:a=0[vout];`;

        // Crear un filtro para concatenar los audios (si hay más de uno)
        if (audioPaths.length > 1) {
          const audioInputs = audioPaths
            .map((_, i) => `[${imagePaths.length + i}:a]`)
            .join('');
          complexFilter += `${audioInputs}concat=n=${audioPaths.length}:v=0:a=1[aout]`;
        }

        command.complexFilter(complexFilter);

        // Mapear las salidas
        command.map('[vout]');
        if (audioPaths.length > 1) {
          command.map('[aout]');
        } else if (audioPaths.length === 1) {
          command.map(`[${imagePaths.length}:a]`);
        }
      }

      command
        .outputOptions([
          '-c:v libx264', // Use H.264 codec for video
          '-pix_fmt yuv420p', // Set pixel format for compatibility
          '-c:a aac', // Use AAC codec for audio
          '-b:a 192k', // Set audio bitrate
          '-shortest', // End when shortest input stream ends
        ])
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg proceso iniciado: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.debug(`FFmpeg progreso: ${JSON.stringify(progress)}`);
        })
        .on('error', (err) => {
          this.logger.error('Error en FFmpeg: ' + err.message);
          reject(err);
        })
        .on('end', () => {
          this.logger.log(`Video generado exitosamente en: ${videoPath}`);

          // Verify the output file has audio
          this.verifyVideoHasAudio(videoPath)
            .then((hasAudio) => {
              if (!hasAudio && audioPaths.length > 0) {
                this.logger.warn(
                  'El video generado no tiene audio o el stream de audio está corrupto',
                );
              }
              resolve();
            })
            .catch(() => {
              resolve(); // Still resolve to continue the process
            });
        })
        .output(videoPath)
        .format(options.format)
        .run();
    });
  }

  /**
   * Limpia los archivos temporales creados durante el proceso
   */
  async limpiarArchivosTemporales(
    filePaths: string[],
    imageDir: string,
    audioDir?: string,
  ): Promise<void> {
    try {
      // Eliminar cada archivo descargado
      for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Eliminar el directorio de imágenes si está vacío
      if (fs.existsSync(imageDir) && fs.readdirSync(imageDir).length === 0) {
        fs.rmdirSync(imageDir);
      }

      // Eliminar el directorio de audios si está vacío y existe
      if (
        audioDir &&
        fs.existsSync(audioDir) &&
        fs.readdirSync(audioDir).length === 0
      ) {
        fs.rmdirSync(audioDir);
      }
    } catch (error) {
      this.logger.warn('Error al limpiar archivos temporales:', error);
    }
  }
}
