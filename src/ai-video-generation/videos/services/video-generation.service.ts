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
import { Languages, Status } from 'src/ai-video-generation/types';
import { getExtensionFromUrl } from '../helpers/getExtensionFromUrl';
import { downloadFile } from '../helpers/downloadFile';
import {
  addBackgroundMusic,
  concatAudiosWithSilence,
  createSilenceFile,
  getFileDuration,
  mergeAudios,
  mergeGeneratedVideoClipsWithAudio,
  applyKenBurnsToImage,
} from '../helpers/ffmpeg';

const shouldGenerateDescription = true; // Cambiar a false para desactivar la generación de descripción

interface VideoOptions {
  format?: string; // Formato del video (mp4, avi, etc.)
  addToBeContinued?: boolean; // Agregar "To Be Continued" al final del video
  addTheEnd?: boolean; // Agregar "The End" al final del video
}

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);
  private readonly DEFAULT_VIDEO_OPTIONS: VideoOptions = {
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

      const backgroundMusicPath =
        await this.videoService.getMusicByVideoId(videoId);
      this.logger.log(`Usando música de fondo: ${backgroundMusicPath}`);

      const video = await this.videoService.findById(videoId);
      const musicVolume = this.videoService.getMusicVolumeByType(
        video?.type || 'basic',
      );
      this.logger.log(
        `Usando volumen de música: ${musicVolume} para tipo: ${video?.type}`,
      );

      const videoBuffer = await this.generateVideo(
        imagenes,
        audios,
        videoOptions,
        backgroundMusicPath,
        musicVolume,
      );

      this.logger.log(`Video generado exitosamente`);
      const uploadResult = await this.cloudinaryService.upload(videoBuffer);

      if (!uploadResult?.url) {
        throw new Error('Error al subir el video a Cloudinary');
      }

      const existingVideo = await this.videoService.findById(videoId);
      const newStatus =
        existingVideo?.status === Status.UPLOADED
          ? Status.UPLOADED
          : Status.PENDING;

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

      if (shouldGenerateDescription) {
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
        }
      }

      this.logger.verbose('🎥✨ Video generado exitosamente 🎥✨');
      return videoResult.url ?? '';
    } catch (error) {
      this.logger.error('Error al crear el video:', error);
      throw error;
    }
  }

  private async generateVideo(
    imagenes: Image[],
    audios: Audio[],
    options: VideoOptions,
    backgroundMusicPath?: string,
    musicVolume: number = 0.2,
  ): Promise<Buffer> {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `video-gen-kb-pan-${Date.now()}-`),
    );
    const tempFiles: string[] = [];

    try {
      this.logger.log(
        `Directorio temporal para generación de vídeo: ${tempDir}`,
      );

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

      imageFileInfos.sort((a, b) => a.order - b.order);
      audioFileInfos.sort((a, b) => a.order - b.order);

      const outputVideoPath = path.join(
        tempDir,
        `output_final_video.${options.format}`,
      );
      tempFiles.push(outputVideoPath);

      const audioDurations = await Promise.all(
        audioFileInfos.map(async (audioFile) => {
          try {
            return await getFileDuration(audioFile.path);
          } catch (err) {
            this.logger.error(
              `Error obteniendo duración de ${audioFile.path}: ${err.message}. Usando 0s.`,
            );
            return 0;
          }
        }),
      );

      const silenceFilePath = path.join(tempDir, 'silence_1s.mp3');
      tempFiles.push(silenceFilePath);
      await createSilenceFile(silenceFilePath);
      // Obtener la duración real del archivo de silencio podría ser más robusto,
      // pero createSilenceFile lo genera con 1s.
      const silenceSegmentDuration = 1;

      const audioListFile = path.join(tempDir, 'audiolist_for_concat.txt');
      let audioListContent = '';
      const resolvedSilenceFilePath = path
        .resolve(silenceFilePath)
        .replace(/\\/g, '/');

      if (audioFileInfos.length === 0 && imagenes.length > 0) {
        // Caso: Hay imágenes pero no audios. Crear un vídeo solo con imágenes y silencio.
        // Podríamos querer un comportamiento específico aquí, como un vídeo de N segundos por imagen.
        // Por ahora, esto resultará en un vídeo muy corto o vacío si no hay audios.
        // Para añadir un silencio final incluso sin audios, se necesitaría lógica adicional.
        // Por ahora, nos enfocamos en el caso con audios.
        this.logger.warn(
          'No hay audios, el video podría ser muy corto o estar vacío si no se maneja explícitamente.',
        );
      }

      audioFileInfos.forEach((audioFile) => {
        audioListContent += `file '${path.resolve(audioFile.path).replace(/\\/g, '/')}'\n`;
        // Añadir un segmento de silencio DESPUÉS de CADA audio.
        // El último silencio actuará como el silencio final del vídeo.
        audioListContent += `file '${resolvedSilenceFilePath}'\n`;
      });

      // Si no hay audios, pero queremos un final con la última imagen y silencio (si hay imágenes)
      // Esto es un caso más complejo si no hay `audioFileInfos` para iterar.
      // La lógica actual asume que si hay audios, habrá un silencio final.
      // Si `audioFileInfos` está vacío, `audioListContent` estará vacío.

      await promisify(fs.writeFile)(audioListFile, audioListContent);
      tempFiles.push(audioListFile);

      const concatenatedNarrationsPath = path.join(
        tempDir,
        'narrations_concatenated.mp3',
      );
      tempFiles.push(concatenatedNarrationsPath);

      // Solo intentar concatenar si hay contenido en audioListFile
      let narrationsDuration = 0;
      if (audioListContent.trim() !== '') {
        await concatAudiosWithSilence(
          audioListFile,
          concatenatedNarrationsPath,
        );
        narrationsDuration = await getFileDuration(concatenatedNarrationsPath);
      } else if (imageFileInfos.length > 0) {
        // Si no hay audios pero sí imágenes, podríamos querer crear un audio de puro silencio
        // para que el video tenga alguna duración con la imagen final.
        // Por ahora, si no hay audios, narrationsDuration será 0.
        // Esto significa que el video final podría no tener audio si no hay `audioFileInfos`.
        // Para el problema original (final abrupto CON audios), esto está cubierto.
        this.logger.log(
          'No hay contenido de audio para concatenar. La narración estará vacía.',
        );
        // Creamos un archivo de narraciones vacío o con un silencio mínimo si es necesario
        // para que ffmpeg no falle más adelante si espera un archivo de audio.
        // Opcionalmente, copiar el archivo de silencio para que haya *algo* de audio.
        fs.copyFileSync(silenceFilePath, concatenatedNarrationsPath); // Usar un silencio como base
        narrationsDuration = silenceSegmentDuration; // Duración del silencio base
      }

      const finalAudioTrackPath = path.join(tempDir, 'final_audio_track.mp3');
      tempFiles.push(finalAudioTrackPath);

      let backgroundMusicAvailable = false;
      if (backgroundMusicPath) {
        try {
          await promisify(fs.access)(backgroundMusicPath);
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
          narrationsDuration, // La duración de la narración ya incluye todos los silencios
        );
        await mergeAudios(
          concatenatedNarrationsPath,
          lowVolumeMusicPath,
          finalAudioTrackPath,
        );
      } else {
        // Si no hay narración (o es solo un silencio base) o no hay música de fondo,
        // usar la narración (o el silencio base) como pista final.
        fs.copyFileSync(concatenatedNarrationsPath, finalAudioTrackPath);
      }

      const videoClipsForConcatenation: string[] = [];
      let lastDirection: number | null = null;

      // Si no hay audios, pero sí imágenes, generamos un clip por imagen con una duración por defecto.
      if (audioFileInfos.length === 0 && imageFileInfos.length > 0) {
        this.logger.log(
          'Generando clips de vídeo solo con imágenes y duración de silencio por defecto.',
        );
        for (let i = 0; i < imageFileInfos.length; i++) {
          const imageToUse = imageFileInfos[i];
          // Cada imagen se mostrará por la duración de un segmento de silencio.
          // Si es la última imagen, se mostrará por la duración del silencio final (que es `silenceSegmentDuration`).
          const imageClipDuration = silenceSegmentDuration;

          if (imageClipDuration > 0) {
            const kenBurnsClipPath = path.join(
              tempDir,
              `kb_video_clip_${i}.mp4`,
            );
            let direction: number;
            do {
              direction = Math.floor(Math.random() * 4) + 1;
            } while (direction === lastDirection);
            lastDirection = direction;

            try {
              await applyKenBurnsToImage(
                imageToUse.path,
                kenBurnsClipPath,
                imageClipDuration,
                direction as 1 | 2 | 3 | 4,
              );
              videoClipsForConcatenation.push(kenBurnsClipPath);
              tempFiles.push(kenBurnsClipPath);
            } catch (kenBurnsError) {
              this.logger.error(
                `Error al aplicar Ken Burns a la imagen ${imageToUse.path} (sin audio): ${kenBurnsError.message}. Clip omitido.`,
              );
            }
          }
        }
      } else {
        // Generar clips de vídeo basados en la duración de los audios y silencios
        for (let i = 0; i < audioFileInfos.length; i++) {
          const imageToUse =
            imageFileInfos[Math.min(i, imageFileInfos.length - 1)];
          // La duración del clip de imagen es la duración del audio MÁS el silencio que le sigue.
          const imageClipDuration = audioDurations[i] + silenceSegmentDuration;

          if (imageClipDuration > 0) {
            const kenBurnsClipPath = path.join(
              tempDir,
              `kb_video_clip_${i}.mp4`,
            );
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
                direction as 1 | 2 | 3 | 4,
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
      }

      if (videoClipsForConcatenation.length === 0) {
        if (imageFileInfos.length > 0) {
          this.logger.warn(
            'No se generaron clips de vídeo con Ken Burns, pero hay imágenes. Se intentará crear un vídeo estático si es posible o se lanzará error.',
          );
          // Podríamos intentar crear un video con la primera imagen y el audio final si existe.
          // O simplemente lanzar el error como antes. Por simplicidad, mantenemos el error.
          throw new Error(
            'Fallo al generar clips de vídeo individuales con efecto Ken Burns, y no hay clips para concatenar.',
          );
        } else {
          this.logger.error(
            'No se generaron clips de vídeo con Ken Burns (y no hay imágenes). No se puede crear el vídeo final.',
          );
          throw new Error(
            'Fallo al generar clips de vídeo individuales con efecto Ken Burns.',
          );
        }
      }

      const videoListFile = path.join(tempDir, 'videolist_for_concat.txt');
      const videoListContent = videoClipsForConcatenation
        .map(
          (clipPath) => `file '${path.resolve(clipPath).replace(/\\/g, '/')}'`,
        )
        .join('\n');
      await promisify(fs.writeFile)(videoListFile, videoListContent);
      tempFiles.push(videoListFile);

      const tempFinalVideoPath = path.join(
        tempDir,
        `temp_final_video.${options.format}`,
      );
      tempFiles.push(tempFinalVideoPath);

      // Asegurarse de que finalAudioTrackPath existe y tiene contenido,
      // incluso si es solo silencio, para que ffmpeg no falle.
      if (
        !fs.existsSync(finalAudioTrackPath) ||
        fs.statSync(finalAudioTrackPath).size === 0
      ) {
        this.logger.warn(
          `El archivo finalAudioTrackPath (${finalAudioTrackPath}) está vacío o no existe. Usando un archivo de silencio como fallback para la pista de audio.`,
        );
        // Crear un archivo de silencio si no existe o está vacío
        await createSilenceFile(
          finalAudioTrackPath,
          narrationsDuration > 0 ? narrationsDuration : silenceSegmentDuration,
        ); // Usar duración de narración o 1s
        if (narrationsDuration === 0) {
          this.logger.error(
            'La duración de la narración y del segmento de silencio es 0. El video podría no tener audio o fallar.',
          );
        }
      }

      await mergeGeneratedVideoClipsWithAudio(
        videoListFile,
        finalAudioTrackPath, // Este audio ya incluye todos los silencios, incluido el final
        tempFinalVideoPath,
      );

      fs.copyFileSync(tempFinalVideoPath, outputVideoPath);
      return await promisify(fs.readFile)(outputVideoPath);
    } catch (error) {
      this.logger.error(
        'Error detallado en generateVideo (Paneo Ken Burns):',
        error.stack,
      );
      throw error;
    } finally {
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
      try {
        if (fs.existsSync(tempDir)) {
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
