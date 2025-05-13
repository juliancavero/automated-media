import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { Image } from '../../images/schemas/image.schema'; // Ajusta la ruta según tu estructura
import { Audio } from '../../audios/schemas/audio.schema'; // Ajusta la ruta según tu estructura
// Asumo que CloudinaryService y AiService no son directamente necesarios en generateVideo
// import { CloudinaryService } from 'src/external/cloudinary/cloudinary.service';
// import { AiService } from 'src/external/ai/ai.service';
import { VideoService } from './video.service'; // Ajusta la ruta según tu estructura
import { getExtensionFromUrl } from '../helpers/getExtensionFromUrl'; // Ajusta la ruta
import { downloadFile } from '../helpers/downloadFile'; // Ajusta la ruta
import {
  addBackgroundMusic,
  concatAudiosWithSilence,
  createSilenceFile,
  getFileDuration,
  mergeAudios,
  applyKenBurnsToImage, // Importar la función actualizada
  mergeGeneratedVideoClipsWithAudio,
} from '../helpers/ffmpegtest'; // Ajusta la ruta según tu estructura

interface VideoOptions {
  format?: string;
  addToBeContinued?: boolean;
  addTheEnd?: boolean;
}

@Injectable()
export class VideoTestService {
  private readonly logger = new Logger(VideoTestService.name);
  private readonly DEFAULT_VIDEO_OPTIONS: VideoOptions = {
    format: 'mp4',
    addToBeContinued: false,
    addTheEnd: false,
  };

  constructor(private readonly videoService: VideoService) {
    this.logger.log(
      'VideoTestService (Ken Burns Panning Version) inicializado',
    );
  }

  async createBufferVideo(
    videoId: string,
    imagenes: Image[],
    audios: Audio[],
    options?: VideoOptions,
  ): Promise<Buffer> {
    const videoOptions = { ...this.DEFAULT_VIDEO_OPTIONS, ...options };

    this.logger.log(
      `Creando video ID ${videoId} con ${imagenes.length} imágenes y ${audios.length} audios (Efecto Paneo Ken Burns)`,
    );

    if (imagenes.length === 0) {
      this.logger.error(
        'No se proporcionaron imágenes. No se puede generar el vídeo.',
      );
      throw new Error('Se requiere al menos una imagen para generar el vídeo.');
    }
    if (audios.length === 0) {
      this.logger.error(
        'No se proporcionaron audios. No se puede generar el vídeo.',
      );
      throw new Error('Se requiere al menos un audio para generar el vídeo.');
    }

    try {
      const backgroundMusicPath =
        await this.videoService.getMusicByVideoId(videoId);

      const videoInfo = await this.videoService.findById(videoId);
      const musicVolume = this.videoService.getMusicVolumeByType(
        videoInfo?.type || 'basic',
      );

      const videoBuffer = await this.generateVideo(
        imagenes,
        audios,
        videoOptions,
        backgroundMusicPath,
        musicVolume,
      );

      this.logger.log(
        `Video con efecto de paneo Ken Burns generado exitosamente para ID ${videoId}`,
      );
      return videoBuffer;
    } catch (error) {
      this.logger.error(
        `Error al crear el video con paneo Ken Burns para ID ${videoId}:`,
        error.stack,
      );
      throw error; // Re-lanzar el error para que sea manejado por el llamador
    }
  }

  private async generateVideo(
    imagenes: Image[],
    audios: Audio[],
    options: VideoOptions,
    backgroundMusicPath?: string,
    musicVolume: number = 0.2,
  ): Promise<Buffer> {
    // Crear un directorio temporal único para esta generación de vídeo
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `video-gen-kb-pan-${Date.now()}-`),
    );
    const tempFiles: string[] = []; // Lista para rastrear y limpiar archivos temporales

    try {
      this.logger.log(
        `Directorio temporal para generación de vídeo: ${tempDir}`,
      );

      // Descargar y preparar archivos de imagen
      const imageFileInfos = await Promise.all(
        imagenes.map(async (imagen, index) => {
          if (!imagen.url) {
            this.logger.error(
              `La imagen ${index} (orden ${imagen.order}) no tiene URL.`,
            );
            throw new Error(
              `La imagen ${index} (orden ${imagen.order}) no tiene URL.`,
            );
          }
          const imageExt = getExtensionFromUrl(imagen.url);
          const originalImagePath = path.join(
            tempDir,
            `image_${index}_order${imagen.order}.${imageExt}`,
          );
          const imageData = await downloadFile(imagen.url);
          await promisify(fs.writeFile)(originalImagePath, imageData);
          tempFiles.push(originalImagePath);
          return {
            path: originalImagePath,
            order: imagen.order,
          };
        }),
      );

      // Descargar y preparar archivos de audio
      const audioFileInfos = await Promise.all(
        audios.map(async (audio, index) => {
          if (!audio.url) {
            this.logger.error(
              `El audio ${index} (orden ${audio.order}) no tiene URL.`,
            );
            throw new Error(
              `El audio ${index} (orden ${audio.order}) no tiene URL.`,
            );
          }
          const audioExt = getExtensionFromUrl(audio.url);
          const audioFilePath = path.join(
            tempDir,
            `audio_${index}_order${audio.order}.${audioExt}`,
          );
          const audioData = await downloadFile(audio.url);
          await promisify(fs.writeFile)(audioFilePath, audioData);
          tempFiles.push(audioFilePath);
          return { path: audioFilePath, order: audio.order };
        }),
      );

      // Ordenar imágenes y audios según su propiedad 'order'
      imageFileInfos.sort((a, b) => a.order - b.order);
      audioFileInfos.sort((a, b) => a.order - b.order);

      const outputVideoPath = path.join(
        tempDir,
        `output_final_video.${options.format}`,
      );
      tempFiles.push(outputVideoPath);

      // Obtener duraciones de los archivos de audio individuales
      const audioDurations = await Promise.all(
        audioFileInfos.map(async (audioFile) => {
          try {
            return await getFileDuration(audioFile.path);
          } catch (err) {
            this.logger.error(
              `Error obteniendo duración de ${audioFile.path}: ${err.message}. Usando 0s.`,
            );
            return 0; // Devolver 0 si hay error para robustez
          }
        }),
      );

      // Crear archivo de silencio (1 segundo)
      const silenceFilePath = path.join(tempDir, 'silence_1s.mp3');
      tempFiles.push(silenceFilePath);
      await createSilenceFile(silenceFilePath);

      // Crear lista de audios para concatenar (audio1, silencio, audio2, silencio, ...)
      const audioListFile = path.join(tempDir, 'audiolist_for_concat.txt');
      let audioListContent = '';
      audioFileInfos.forEach((audioFile, index) => {
        // Usar rutas absolutas y normalizadas para FFmpeg
        audioListContent += `file '${path.resolve(audioFile.path).replace(/\\/g, '/')}'\n`;
        if (index < audioFileInfos.length - 1) {
          // Añadir silencio entre audios
          audioListContent += `file '${path.resolve(silenceFilePath).replace(/\\/g, '/')}'\n`;
        }
      });
      await promisify(fs.writeFile)(audioListFile, audioListContent);
      tempFiles.push(audioListFile);

      // Concatenar audios con silencios intercalados
      const concatenatedNarrationsPath = path.join(
        tempDir,
        'narrations_concatenated.mp3',
      );
      tempFiles.push(concatenatedNarrationsPath);
      await concatAudiosWithSilence(audioListFile, concatenatedNarrationsPath);
      const narrationsDuration = await getFileDuration(
        concatenatedNarrationsPath,
      );

      // Preparar audio final (narración + música de fondo si existe)
      const finalAudioTrackPath = path.join(tempDir, 'final_audio_track.mp3');
      tempFiles.push(finalAudioTrackPath);

      let backgroundMusicAvailable = false;
      if (backgroundMusicPath) {
        try {
          await promisify(fs.access)(backgroundMusicPath); // Verificar acceso
          const musicStats = await promisify(fs.stat)(backgroundMusicPath);
          if (musicStats.size > 0) {
            backgroundMusicAvailable = true;
          }
        } catch (err) {
          this.logger.warn(
            `Archivo de música de fondo no encontrado o inválido: ${backgroundMusicPath}. Error: ${err.message}`,
          );
        }
      }

      if (backgroundMusicAvailable && backgroundMusicPath) {
        const lowVolumeMusicPath = path.join(
          tempDir,
          'background_music_adjusted.mp3',
        );
        tempFiles.push(lowVolumeMusicPath);
        await addBackgroundMusic(
          backgroundMusicPath,
          lowVolumeMusicPath,
          musicVolume,
          narrationsDuration,
        );
        await mergeAudios(
          concatenatedNarrationsPath,
          lowVolumeMusicPath,
          finalAudioTrackPath,
        );
      } else {
        fs.copyFileSync(concatenatedNarrationsPath, finalAudioTrackPath); // Usar narración como audio final
      }

      // --- Generar clips de vídeo con efecto Ken Burns (Paneo) ---
      const videoClipsForConcatenation: string[] = [];

      let lastDirection: number | null = null;

      for (let i = 0; i < audioFileInfos.length; i++) {
        // Seleccionar la imagen correspondiente
        const imageToUse =
          imageFileInfos[Math.min(i, imageFileInfos.length - 1)];
        let imageClipDuration = audioDurations[i];

        if (i < audioFileInfos.length - 1) {
          imageClipDuration += 1;
        }

        if (imageClipDuration > 0) {
          const kenBurnsClipPath = path.join(tempDir, `kb_video_clip_${i}.mp4`);

          // Generar dirección aleatoria distinta de la anterior
          let direction: number;
          do {
            direction = Math.floor(Math.random() * 4) + 1; // 1 a 4
          } while (direction === lastDirection);
          lastDirection = direction;

          try {
            await applyKenBurnsToImage(
              imageToUse.path,
              kenBurnsClipPath,
              imageClipDuration,
              direction as 1 | 2 | 3 | 4, // 1=→, 2=↓, 3=←, 4=↑
            );
            videoClipsForConcatenation.push(kenBurnsClipPath);
            tempFiles.push(kenBurnsClipPath);
          } catch (kenBurnsError) {
            this.logger.error(
              `Error al aplicar Ken Burns (Paneo) a la imagen ${imageToUse.path} para el clip ${i}: ${kenBurnsError.message}. Este clip será omitido.`,
            );
          }
        }
      }

      if (videoClipsForConcatenation.length === 0) {
        this.logger.error(
          'No se generaron clips de vídeo con Ken Burns. No se puede crear el vídeo final.',
        );
        throw new Error(
          'Fallo al generar clips de vídeo individuales con efecto Ken Burns.',
        );
      }

      // Crear archivo de lista para concatenar los clips de vídeo con Ken Burns
      const videoListFile = path.join(tempDir, 'videolist_for_concat.txt');
      const videoListContent = videoClipsForConcatenation
        .map(
          (clipPath) => `file '${path.resolve(clipPath).replace(/\\/g, '/')}'`,
        )
        .join('\n');
      await promisify(fs.writeFile)(videoListFile, videoListContent);
      tempFiles.push(videoListFile);

      // Fusionar los clips de vídeo generados (con Ken Burns) y la pista de audio final
      const tempFinalVideoPath = path.join(
        tempDir,
        `temp_final_video.${options.format}`,
      );
      tempFiles.push(tempFinalVideoPath);
      await mergeGeneratedVideoClipsWithAudio(
        videoListFile,
        finalAudioTrackPath,
        tempFinalVideoPath,
      );

      // Copiar al path de salida final (esto es redundante si outputVideoPath ya es el destino)
      fs.copyFileSync(tempFinalVideoPath, outputVideoPath);

      // Leer el vídeo generado como buffer para devolverlo
      return await promisify(fs.readFile)(outputVideoPath);
    } catch (error) {
      this.logger.error(
        'Error detallado en generateVideo (Paneo Ken Burns):',
        error.stack,
      );
      // Asegurarse de que el error se propague para que la transacción/proceso falle si es necesario
      throw error;
    } finally {
      // Limpieza de archivos temporales
      this.logger.log(
        `Iniciando limpieza de archivos temporales de ${tempDir}`,
      );
      for (const file of tempFiles) {
        try {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        } catch (err) {
          this.logger.warn(
            `No se pudo eliminar el archivo temporal: ${file} - ${err.message}`,
          );
        }
      }
      // Eliminar directorio temporal
      try {
        if (fs.existsSync(tempDir)) {
          // Verificar si el directorio aún existe
          fs.rmdirSync(tempDir);
        }
      } catch (err) {
        this.logger.warn(
          `No se pudo eliminar el directorio temporal: ${tempDir} - ${err.message}. Puede requerir limpieza manual.`,
        );
      }
    }
  }
}
