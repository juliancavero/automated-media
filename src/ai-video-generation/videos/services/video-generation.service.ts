import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { Image } from '../../images/schemas/image.schema';
import { Audio } from '../../audios/schemas/audio.schema';
import { CloudinaryService } from 'src/external/cloudinary/cloudinary.service';
import { AiService } from 'src/external/ai/ai.service';
import { VideoService } from './video.service';
import { Languages } from 'src/ai-video-generation/types';
import { getExtensionFromUrl } from '../helpers/getExtensionFromUrl';
import { downloadFile } from '../helpers/downloadFile';
import {
  addBackgroundMusic,
  concatAudiosWithSilence,
  createSilenceFile,
  getFileDuration,
  mergeAudios,
  mergeEveryting,
} from '../helpers/ffmpeg';

// URL de las imágenes de "To Be Continued" y "The End"
// Commented out for now
/* const toBeContinuedUrl =
  'https://res.cloudinary.com/dkequ9kzt/image/upload/v1745508219/automated-media/k4ytllsqujwdymbomfnn.png';
const theEndUrl =
  'https://res.cloudinary.com/dkequ9kzt/image/upload/v1745512154/automated-media/fkuedi0iqajs36lh2kmg.png';

 */
interface VideoOptions {
  duration?: number; // Duración en segundos por imagen (solo usado si no hay audios)
  format?: string; // Formato del video (mp4, avi, etc.)
  addToBeContinued?: boolean; // Agregar "To Be Continued" al final del video
  addTheEnd?: boolean; // Agregar "The End" al final del video
}

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);
  private readonly DEFAULT_VIDEO_OPTIONS: VideoOptions = {
    duration: 5,
    format: 'mp4',
    addToBeContinued: false,
    addTheEnd: false,
  };

  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly videoService: VideoService,
    private readonly aiService: AiService,
  ) {
    this.logger.log('VideoGenerationService inicializado');
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
    lang: Languages,
    options?: VideoOptions,
  ): Promise<string> {
    const videoOptions = { ...this.DEFAULT_VIDEO_OPTIONS, ...options };

    try {
      this.logger.log(
        `Creando video con ${imagenes.length} imágenes y ${audios.length} audios`,
      );

      // Obtener la ruta de la música de fondo según el tipo de video
      const backgroundMusicPath =
        await this.videoService.getMusicByVideoId(videoId);
      this.logger.log(`Usando música de fondo: ${backgroundMusicPath}`);

      // Obtener el video para determinar el tipo y el volumen adecuado para la música
      const video = await this.videoService.findById(videoId);
      const musicVolume = this.videoService.getMusicVolumeByType(
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
      const existingVideo = await this.videoService.findById(videoId);
      const newStatus =
        existingVideo?.status === 'uploaded' ? 'uploaded' : 'finished';

      const videoResult = await this.videoService.setVideoUrl(
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
          video?.lang as Languages,
        );
        await this.videoService.setVideoDescription(videoId, description);
        this.logger.log('Descripción del video generada exitosamente');
      } catch (descriptionError) {
        this.logger.error(
          'Error al generar la descripción del video:',
          descriptionError,
        );
        // No interrumpimos el flujo principal si falla la generación de la descripción
      }

      // logger con emojis
      this.logger.verbose('🎥✨ Video generado exitosamente 🎥✨');
      this.logger.verbose('🎥✨ Video generado exitosamente 🎥✨');

      return videoResult.url ?? '';
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

          const imageExt = getExtensionFromUrl(imagen.url);
          const imageFilePath = path.join(
            tempDir,
            `image_${index}.${imageExt}`,
          );

          // Descargar la imagen desde la URL
          const imageData = await downloadFile(imagen.url);
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

          const audioExt = getExtensionFromUrl(audio.url);
          const audioFilePath = path.join(
            tempDir,
            `audio_${index}.${audioExt}`,
          );

          // Descargar el audio desde la URL
          const audioData = await downloadFile(audio.url);
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
          const duration = await getFileDuration(audioFile.path);
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
      await createSilenceFile(silenceFilePath);

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
      await concatAudiosWithSilence(audioListFile, concatAudioPath);

      // Verificar duración del audio concatenado final
      const finalAudioDuration = await getFileDuration(concatAudioPath);
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

      if (backgroundMusicExists && backgroundMusicPath) {
        // Si tenemos música de fondo, mezclar con el audio narrado
        try {
          // Primero obtenemos la duración del audio concatenado
          const concatDuration = await getFileDuration(concatAudioPath);

          // Nueva estrategia: más simple y directa para evitar problemas de compatibilidad
          // Primero crear una versión de la música con volumen reducido y duración ajustada
          const lowVolumeMusic = path.join(tempDir, 'background_music_low.mp3');
          tempFiles.push(lowVolumeMusic);

          await addBackgroundMusic(
            backgroundMusicPath,
            lowVolumeMusic,
            musicVolume,
            concatDuration,
          );

          // Ahora una mezcla simple usando un comando más básico
          await mergeAudios(concatAudioPath, lowVolumeMusic, finalAudioPath);

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

      // Crear archivo de segmentos para las imágenes
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

      await mergeEveryting(segmentsFile, finalAudioPath, baseVideoPath);

      // Usar el video base como video final
      fs.copyFileSync(baseVideoPath, outputVideoPath);

      // Verificar que el video se generó correctamente
      const videoStats = await promisify(fs.stat)(outputVideoPath);
      this.logger.log(
        `Video generado: ${outputVideoPath}, tamaño: ${videoStats.size} bytes`,
      );

      // Verificar duración del video final
      const videoDuration = await getFileDuration(outputVideoPath);
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
}
