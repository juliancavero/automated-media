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
import { AiService } from 'src/external/ai/ai.service';

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const toBeContinuedUrl =
  'https://res.cloudinary.com/dkequ9kzt/image/upload/v1745508219/automated-media/k4ytllsqujwdymbomfnn.png';
const theEndUrl =
  'https://res.cloudinary.com/dkequ9kzt/image/upload/v1745512154/automated-media/fkuedi0iqajs36lh2kmg.png';
interface VideoOptions {
  duration?: number; // Duración en segundos por imagen (solo usado si no hay audios)
  format?: string; // Formato del video (mp4, avi, etc.)
  addToBeContinued?: boolean; // Agregar "To Be Continued" al final del video
  addTheEnd?: boolean; // Agregar "The End" al final del video
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly DEFAULT_VIDEO_OPTIONS: VideoOptions = {
    duration: 5,
    format: 'mp4',
    addToBeContinued: false,
    addTheEnd: false,
  };

  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly videoGenerationService: VideoGenerationService,
    private readonly aiService: AiService,
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

      // Obtener la ruta de la música de fondo según el tipo de video
      const backgroundMusicPath =
        await this.videoGenerationService.getMusicByVideoId(videoId);
      this.logger.log(`Usando música de fondo: ${backgroundMusicPath}`);

      // Obtener el video para determinar el tipo y el volumen adecuado para la música
      const video = await this.videoGenerationService.findById(videoId);
      const musicVolume = this.videoGenerationService.getMusicVolumeByType(
        video?.type || 'basic',
      );
      this.logger.log(
        `Usando volumen de música: ${musicVolume} para tipo: ${video?.type}`,
      );

      // Generar el video utilizando los datos en memoria
      const videoBuffer = await this.generateVideo(
        imagenes,
        audios,
        videoOptions,
        backgroundMusicPath,
        musicVolume,
      );

      this.logger.log(`Video generado exitosamente`);
      // Subir el video a Cloudinary
      const uploadResult = await this.cloudinaryService.upload(videoBuffer);

      if (!uploadResult?.url) {
        throw new Error('Error al subir el video a Cloudinary');
      }

      // Guardar el video en la base de datos
      const existingVideo = await this.videoGenerationService.findById(videoId);
      const newStatus =
        existingVideo?.status === 'uploaded' ? 'uploaded' : 'finished';

      const videoResult = await this.videoGenerationService.setVideoUrl(
        videoId,
        uploadResult.url,
        uploadResult.public_id,
        newStatus,
      );
      if (!videoResult) {
        this.logger.error('Error al guardar el video en la base de datos');
        throw new Error('Error al guardar el video en la base de datos');
      }

      // Generar descripción del video con IA
      try {
        this.logger.log('Generando descripción del video con IA...');
        const description = await this.aiService.generateVideoDescription(
          uploadResult.url,
        );
        await this.videoGenerationService.setVideoDescription(
          videoId,
          description,
        );
        this.logger.log('Descripción del video generada exitosamente');
      } catch (descriptionError) {
        this.logger.error(
          'Error al generar la descripción del video:',
          descriptionError,
        );
        // No interrumpimos el flujo principal si falla la generación de la descripción
      }

      return videoResult.url ?? '';
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
   * @param backgroundMusicPath Ruta del archivo de música de fondo
   * @param musicVolume Volumen para la música de fondo
   * @returns Buffer con los datos del video generado
   */
  private async generateVideo(
    imagenes: Image[],
    audios: Audio[],
    options: VideoOptions,
    backgroundMusicPath?: string,
    musicVolume: number = 0.2,
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

      // Preparar la imagen de "To Be Continued" si es necesario
      let toBeContinuedImagePath = '';
      if (options.addToBeContinued) {
        const imageExt = this.getExtensionFromUrl(toBeContinuedUrl);
        toBeContinuedImagePath = path.join(
          tempDir,
          `toBeContinued.${imageExt}`,
        );

        try {
          // Descargar la imagen "To Be Continued"
          const toBeContinuedImageData =
            await this.downloadFile(toBeContinuedUrl);
          await promisify(fs.writeFile)(
            toBeContinuedImagePath,
            toBeContinuedImageData,
          );

          // Verificar que la imagen existe y tiene tamaño
          const fileStats = await promisify(fs.stat)(toBeContinuedImagePath);
          this.logger.log(
            `Imagen "To Be Continued" descargada: ${toBeContinuedImagePath}, tamaño: ${fileStats.size} bytes`,
          );

          if (fileStats.size === 0) {
            throw new Error('La imagen "To Be Continued" tiene tamaño cero');
          }

          tempFiles.push(toBeContinuedImagePath);

          // Convertir PNG a JPG para evitar problemas de transparencia
          const jpgImagePath = path.join(tempDir, `toBeContinued.jpg`);
          tempFiles.push(jpgImagePath);

          await new Promise<void>((resolve, reject) => {
            ffmpeg()
              .input(toBeContinuedImagePath)
              .outputOptions([
                '-vf',
                'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black',
                '-pix_fmt',
                'yuv420p',
              ])
              .output(jpgImagePath)
              .on('end', resolve)
              .on('error', (err) => {
                this.logger.error(
                  `Error al convertir PNG a JPG: ${err.message}`,
                );
                reject(err);
              })
              .run();
          });

          // Usar la imagen convertida
          toBeContinuedImagePath = jpgImagePath;
          this.logger.log(
            'Imagen "To Be Continued" convertida a JPG correctamente',
          );
        } catch (err) {
          this.logger.error(
            `Error al preparar la imagen "To Be Continued": ${err.message}`,
          );
          options.addToBeContinued = false;
        }
      }

      // Preparar la imagen de "The End" si es necesario
      let theEndImagePath = '';
      if (options.addTheEnd) {
        const imageExt = this.getExtensionFromUrl(theEndUrl);
        theEndImagePath = path.join(tempDir, `theEnd.${imageExt}`);

        try {
          // Descargar la imagen "The End"
          const theEndImageData = await this.downloadFile(theEndUrl);
          await promisify(fs.writeFile)(theEndImagePath, theEndImageData);

          // Verificar que la imagen existe y tiene tamaño
          const fileStats = await promisify(fs.stat)(theEndImagePath);
          this.logger.log(
            `Imagen "The End" descargada: ${theEndImagePath}, tamaño: ${fileStats.size} bytes`,
          );

          if (fileStats.size === 0) {
            throw new Error('La imagen "The End" tiene tamaño cero');
          }

          tempFiles.push(theEndImagePath);

          // Convertir PNG a JPG para evitar problemas de transparencia
          const jpgImagePath = path.join(tempDir, `theEnd.jpg`);
          tempFiles.push(jpgImagePath);

          await new Promise<void>((resolve, reject) => {
            ffmpeg()
              .input(theEndImagePath)
              .outputOptions([
                '-vf',
                'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black',
                '-pix_fmt',
                'yuv420p',
              ])
              .output(jpgImagePath)
              .on('end', resolve)
              .on('error', (err) => {
                this.logger.error(
                  `Error al convertir PNG a JPG: ${err.message}`,
                );
                reject(err);
              })
              .run();
          });

          // Usar la imagen convertida
          theEndImagePath = jpgImagePath;
          this.logger.log('Imagen "The End" convertida a JPG correctamente');
        } catch (err) {
          this.logger.error(
            `Error al preparar la imagen "The End": ${err.message}`,
          );
          options.addTheEnd = false;
        }
      }

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
        }),
      );

      this.logger.log(
        `Duración total de audio: ${totalAudioDuration} segundos`,
      );

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

      // Para "To Be Continued" o "The End", necesitamos un silencio de 2 segundos
      let silence2SecPath = '';
      if (options.addToBeContinued || options.addTheEnd) {
        silence2SecPath = path.join(tempDir, 'silence2sec.mp3');
        tempFiles.push(silence2SecPath);

        await new Promise<void>((resolve, reject) => {
          ffmpeg()
            .input('anullsrc')
            .inputFormat('lavfi')
            .audioFrequency(44100)
            .audioBitrate('192k')
            .audioChannels(2)
            .duration(2)
            .output(silence2SecPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        this.logger.log('Silencio de 2 segundos generado para imagen final');
      }

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

      // Modificar el contenido de la lista de audios para incluir el silencio de 2 segundos al final si es necesario
      if (options.addToBeContinued || options.addTheEnd) {
        audioListContent += `file '${silence2SecPath}'\n`;
      }

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
      this.logger.log(
        `Duración del audio concatenado: ${finalAudioDuration} segundos`,
      );

      // Verificar si existe el archivo de música de fondo
      let backgroundMusicExists = false;
      if (backgroundMusicPath) {
        try {
          await promisify(fs.access)(backgroundMusicPath);
          // Verificar que el archivo es un audio válido
          try {
            const musicStats = await promisify(fs.stat)(backgroundMusicPath);
            if (musicStats.size === 0) {
              this.logger.warn(
                `El archivo de música tiene tamaño cero: ${backgroundMusicPath}`,
              );
            } else {
              // Verificar que es un archivo de audio válido
              const musicInfo = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(backgroundMusicPath, (err, info) => {
                  if (err) {
                    reject(err);
                  } else {
                    resolve(info);
                  }
                });
              });
              backgroundMusicExists = true;
              this.logger.log(
                `Archivo de música de fondo encontrado y validado: ${backgroundMusicPath}`,
              );
            }
          } catch (probeErr) {
            this.logger.warn(
              `El archivo de música no es válido: ${backgroundMusicPath} - ${probeErr.message}`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Archivo de música de fondo no encontrado: ${backgroundMusicPath}`,
          );
        }
      }

      // Archivo temporal para audio final (narración + música de fondo)
      const finalAudioPath = path.join(tempDir, 'final_audio.mp3');
      tempFiles.push(finalAudioPath);

      if (backgroundMusicExists) {
        // Si tenemos música de fondo, mezclar con el audio narrado
        try {
          // Primero obtenemos la duración del audio concatenado
          const concatDuration = await this.getAudioDuration(concatAudioPath);

          // Nueva estrategia: más simple y directa para evitar problemas de compatibilidad
          // Primero crear una versión de la música con volumen reducido y duración ajustada
          const lowVolumeMusic = path.join(tempDir, 'background_music_low.mp3');
          tempFiles.push(lowVolumeMusic);

          await new Promise<void>((resolve, reject) => {
            ffmpeg()
              .input(backgroundMusicPath)
              .audioFilters(`volume=${musicVolume}`) // Usar el volumen específico para el tipo de video
              .duration(concatDuration)
              .outputOptions(['-c:a', 'libmp3lame', '-b:a', '128k'])
              .output(lowVolumeMusic)
              .on('stderr', (line) => {
                if (line.includes('Error') || line.includes('error')) {
                  this.logger.warn(`FFmpeg (music): ${line}`);
                }
              })
              .on('end', resolve)
              .on('error', (err) => {
                this.logger.error(`Error al procesar música: ${err.message}`);
                reject(err);
              })
              .run();
          });

          // Ahora una mezcla simple usando un comando más básico
          await new Promise<void>((resolve, reject) => {
            // Usamos un enfoque muy básico: simplemente mezclamos con ffmpeg usando filtro overlay
            ffmpeg()
              .input(concatAudioPath)
              .input(lowVolumeMusic)
              .outputOptions([
                '-filter_complex',
                '[0:a][1:a]amerge=inputs=2[a]',
                '-map',
                '[a]',
                '-c:a',
                'libmp3lame',
                '-q:a',
                '4',
                '-shortest',
              ])
              .output(finalAudioPath)
              .on('stderr', (line) => {
                if (line.includes('Error') || line.includes('error')) {
                  this.logger.warn(`FFmpeg (mix): ${line}`);
                }
              })
              .on('end', () => {
                this.logger.log('Audio mezclado correctamente');
                resolve();
              })
              .on('error', (err) => {
                this.logger.error(`Error en mezcla final: ${err.message}`);
                // Si falla, usar el audio original
                fs.copyFileSync(concatAudioPath, finalAudioPath);
                resolve();
              })
              .run();
          });

          // Verificación final
          if (
            !fs.existsSync(finalAudioPath) ||
            (await promisify(fs.stat)(finalAudioPath)).size === 0
          ) {
            this.logger.warn(
              'Archivo de audio mezclado inválido, usando solo narración',
            );
            fs.copyFileSync(concatAudioPath, finalAudioPath);
          }
        } catch (mixError) {
          this.logger.error(
            `Falló el proceso de mezcla de audio: ${mixError.message}`,
          );
          // Si falla en cualquier punto, usar el audio narrado original
          fs.copyFileSync(concatAudioPath, finalAudioPath);
        }
      } else {
        // Si no hay música de fondo, usar el audio narrado original
        fs.copyFileSync(concatAudioPath, finalAudioPath);
      }

      // Crear archivo de segmentos para las imágenes (sin incluir ToBeContinued)
      const segmentsFile = path.join(tempDir, 'segments.txt');
      let segmentsContent = '';

      for (let i = 0; i < audioFiles.length; i++) {
        const imageFile = imageFiles[Math.min(i, imageFiles.length - 1)];
        const audioDuration = audioDurations[i];

        // Añadir imagen con la duración del audio correspondiente
        segmentsContent += `file '${imageFile.path}'\n`;
        segmentsContent += `duration ${audioDuration}\n`;

        // Añadir silencio si no es el último audio
        if (i < audioFiles.length - 1) {
          segmentsContent += `file '${imageFile.path}'\n`;
          segmentsContent += `duration 1\n`;
        }
      }

      // Añadir la última imagen una vez más (necesario para el último segmento)
      if (imageFiles.length > 0) {
        segmentsContent += `file '${imageFiles[Math.min(audioFiles.length - 1, imageFiles.length - 1)].path}'\n`;
        // No añadimos duración aquí para que sea el último fotograma
      }

      await promisify(fs.writeFile)(segmentsFile, segmentsContent);
      tempFiles.push(segmentsFile);

      // Generar el video base usando el audio final (con música)
      const baseVideoPath = path.join(tempDir, `base_video.${options.format}`);
      tempFiles.push(baseVideoPath);

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(segmentsFile)
          .inputOptions('-f', 'concat', '-safe', '0')
          .input(finalAudioPath) // Usar el audio final con música
          .outputOptions([
            '-pix_fmt',
            'yuv420p',
            '-c:v',
            'libx264',
            '-preset',
            'medium',
            '-profile:v',
            'high',
            '-crf',
            '23',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-ar',
            '44100',
            '-s',
            '720:1280',
            '-r',
            '30',
            '-max_muxing_queue_size',
            '9999',
          ])
          .output(baseVideoPath)
          .on('end', resolve)
          .on('error', (err) => {
            this.logger.error(`Error al generar video base: ${err.message}`);
            reject(err);
          })
          .run();
      });

      // Crear el video final, añadiendo ToBeContinued o TheEnd si es necesario
      if (
        (options.addToBeContinued && toBeContinuedImagePath) ||
        (options.addTheEnd && theEndImagePath)
      ) {
        await new Promise<void>((resolve, reject) => {
          // Obtener la duración del video base
          ffmpeg.ffprobe(baseVideoPath, (err, metadata) => {
            if (err) {
              this.logger.error(
                `Error al obtener duración del video base: ${err.message}`,
              );
              return reject(err);
            }

            const baseDuration = metadata.format.duration;
            const overlayStart = Math.max(0, baseDuration - 2); // Mostrar overlay en los últimos 2 segundos

            let overlayImage = '';
            let overlayType = '';

            if (options.addToBeContinued && toBeContinuedImagePath) {
              overlayImage = toBeContinuedImagePath;
              overlayType = 'To Be Continued';
            } else if (options.addTheEnd && theEndImagePath) {
              overlayImage = theEndImagePath;
              overlayType = 'The End';
            }

            ffmpeg()
              .input(baseVideoPath)
              .input(overlayImage)
              .complexFilter([
                // Overlay de la imagen en los últimos 2 segundos
                `[0:v][1:v]overlay=0:0:enable='between(t,${overlayStart},${baseDuration})'[outv]`,
              ])
              .outputOptions([
                '-map',
                '[outv]',
                '-map',
                '0:a',
                '-c:v',
                'libx264',
                '-preset',
                'medium',
                '-crf',
                '23',
                '-c:a',
                'copy',
              ])
              .output(outputVideoPath)
              .on('end', () => {
                this.logger.log(
                  `Video con "${overlayType}" generado exitosamente`,
                );
                resolve();
              })
              .on('error', (err) => {
                this.logger.error(
                  `Error al añadir "${overlayType}": ${err.message}`,
                );
                // Si falla, usamos el video base
                fs.copyFileSync(baseVideoPath, outputVideoPath);
                resolve();
              })
              .run();
          });
        });
      } else {
        // Si no añadimos ninguna imagen final, simplemente usamos el video base
        fs.copyFileSync(baseVideoPath, outputVideoPath);
      }

      // Verificar que el video se generó correctamente
      const videoStats = await promisify(fs.stat)(outputVideoPath);
      this.logger.log(
        `Video generado: ${outputVideoPath}, tamaño: ${videoStats.size} bytes`,
      );

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
          this.logger.error(
            `Error al obtener duración de audio: ${err.message}`,
          );
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
          this.logger.error(
            `Error al obtener duración de video: ${err.message}`,
          );
          return reject(err);
        }

        const duration = metadata.format.duration || 0;
        resolve(duration);
      });
    });
  }
}
