import fs from 'fs';

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;
const VIDEO_FPS = 30; // Fotogramas por segundo para los clips de Ken Burns

export const createSilenceFile = async (filePath: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input('anullsrc')
      .inputFormat('lavfi')
      .audioFrequency(44100)
      .audioBitrate('192k')
      .audioChannels(2)
      .duration(1) // 1 segundo de silencio
      .output(filePath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
};

export const concatAudiosWithSilence = async (
  audioListFile: string,
  concatAudioPath: string,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(audioListFile)
      .inputOptions('-f', 'concat', '-safe', '0')
      .outputOptions('-c:a', 'libmp3lame', '-b:a', '192k') // Calidad de audio
      .output(concatAudioPath)
      .on('end', resolve)
      .on('error', (err) => {
        console.error('Error concatenando audios:', err.message);
        reject(err);
      })
      .run();
  });
};

export const addBackgroundMusic = async (
  backgroundMusicPath: string,
  lowVolumeMusic: string,
  musicVolume: number,
  concatDuration: number,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    // Duración extendida para la música de fondo para asegurar cobertura
    const extendedDuration = concatDuration + 10;

    ffmpeg()
      .input(backgroundMusicPath)
      .audioFilters(`volume=${musicVolume}`) // Aplicar volumen
      .duration(extendedDuration) // Limitar duración de la música
      .outputOptions(['-c:a', 'libmp3lame', '-b:a', '128k'])
      .output(lowVolumeMusic)
      .on('end', resolve)
      .on('error', (err) => {
        console.error('Error ajustando música de fondo:', err.message);
        reject(err);
      })
      .run();
  });
};

export const mergeAudios = async (
  concatAudioPath: string,
  lowVolumeMusic: string,
  finalAudioPath: string,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatAudioPath) // Audio principal (narraciones)
      .input(lowVolumeMusic) // Música de fondo
      .outputOptions([
        '-filter_complex',
        '[0:a][1:a]amerge=inputs=2[a]', // Mezclar dos pistas de audio
        '-map',
        '[a]', // Mapear la pista mezclada
        '-c:a',
        'libmp3lame',
        '-q:a',
        '4', // Calidad de audio variable (buena)
        '-shortest', // Finalizar cuando la pista más corta termine
      ])
      .output(finalAudioPath)
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        console.error(
          'Error mezclando audios, usando solo narración:',
          err.message,
        );
        // Fallback: si la mezcla falla, usar solo el audio concatenado original
        fs.copyFileSync(concatAudioPath, finalAudioPath);
        resolve();
      })
      .run();
  });
};

/**
 * Merges pre-generated video clips (with Ken Burns effect) and the final audio track.
 */
export const mergeGeneratedVideoClipsWithAudio = async (
  videoListFile: string,
  finalAudioPath: string,
  outputVideoPath: string,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(videoListFile)
      .inputOptions([
        '-f',
        'concat',
        '-safe',
        '0',
        '-auto_convert',
        '1',
        '-err_detect',
        'ignore_err',
      ])
      .input(finalAudioPath)
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
        `${VIDEO_WIDTH}x${VIDEO_HEIGHT}`,
        '-r',
        VIDEO_FPS.toString(),
        '-max_muxing_queue_size',
        '9999',
        '-shortest',
      ])
      .output(outputVideoPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg comando (merge clips con audio): ' + commandLine);
      })
      .on('end', resolve)
      .on('error', (err, stdout, stderr) => {
        console.error(
          'Error al fusionar clips de vídeo con audio:',
          err.message,
        );
        reject(
          new Error(
            `Fallo al fusionar clips de vídeo: ${err.message} \nstdout: ${stdout}\nstderr: ${stderr}`,
          ),
        );
      })
      .run();
  });
};

/**
 * Obtiene la duración de un archivo de video o audio usando ffprobe.
 * Devuelve la duración en segundos.
 */
export function getFileDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(
          new Error(`ffprobe falló para ${filePath}: ${err.message}`),
        );
      }
      if (!metadata || !metadata.format) {
        return reject(
          new Error(`Formato de metadatos inválido o ausente para ${filePath}`),
        );
      }
      const duration = metadata.format.duration;
      if (typeof duration !== 'number' || isNaN(duration)) {
        resolve(0);
        return;
      }
      resolve(duration);
    });
  });
}

/**
 * Applies Ken Burns effect (panning from left to right) to a single image
 * to create a video clip of a specified duration.
 * Pre-calculates x-increment and y-offset in JS for FFmpeg.
 */
export const applyKenBurnsToImage = async (
  imagePath: string,
  outputPath: string,
  duration: number,
  direction: 1 | 2 | 3 | 4,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const zoomEnd = 1.2; // El nivel final de zoom (ej: 1.2 para un 20% de zoom)

    let xExpression: string;
    let yExpression: string;

    switch (direction) {
      case 1: // Izquierda a Derecha
        xExpression = `(in_w-${VIDEO_WIDTH})*(t/${duration})`;
        yExpression = `(in_h-${VIDEO_HEIGHT})/2`;
        break;
      case 2: // Arriba a Abajo
        xExpression = `(in_w-${VIDEO_WIDTH})/2`;
        yExpression = `(in_h-${VIDEO_HEIGHT})*(t/${duration})`;
        break;
      case 3: // Derecha a Izquierda
        xExpression = `(in_w-${VIDEO_WIDTH})*(1-t/${duration})`;
        yExpression = `(in_h-${VIDEO_HEIGHT})/2`;
        break;
      case 4: // Abajo a Arriba
        xExpression = `(in_w-${VIDEO_WIDTH})/2`;
        yExpression = `(in_h-${VIDEO_HEIGHT})*(1-t/${duration})`;
        break;
      default:
        console.warn(
          `[FFmpeg KenBurns] Dirección inválida: ${direction}. Usando Derecha a Izquierda (3) por defecto.`,
        );
        xExpression = `(in_w-${VIDEO_WIDTH})*(1-t/${duration})`;
        yExpression = `(in_h-${VIDEO_HEIGHT})/2`;
        break;
    }

    // Construir la cadena del filtro de video (vf) para ffmpeg.
    const vf = `
      [0:v]scale=iw*${zoomEnd}:ih*${zoomEnd},format=yuv420p,setsar=1,
      crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:x='${xExpression}':y='${yExpression}'
    `.replace(/\s+/g, '');

    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop', '1'])
      .videoFilter(vf)
      .outputOptions([
        '-t',
        duration.toString(),
        '-r',
        VIDEO_FPS.toString(), // FPS aumentado para mayor suavidad
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'meedium', // Cambiado de 'ultrafast' a 'medium' para un mejor equilibrio calidad/velocidad
        '-crf',
        '24', // Constant Rate Factor (calidad, 18 es buena, más bajo es mejor calidad pero más tamaño)
        '-an',
      ])
      .output(outputPath)
      .on('start', () => {})
      .on('end', () => {
        resolve();
      })
      .on('error', (err, stdout, stderr) => {
        reject(new Error(err.message));
      })
      .run();
  });
};
