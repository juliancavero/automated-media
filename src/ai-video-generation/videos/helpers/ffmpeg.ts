const fs = require('fs');

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;
const VIDEO_FPS = 30;

export const createSilenceFile = async (
  filePath: string,
  duration: number = 1,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    if (duration <= 0) {
      console.warn(
        `createSilenceFile: La duración solicitada es ${duration}. Se usará 0.01s en su lugar.`,
      );
      duration = 0.01;
    }
    ffmpeg()
      .input('anullsrc')
      .inputFormat('lavfi')
      .audioFrequency(44100)
      .audioBitrate('192k')
      .audioChannels(2)
      .duration(duration)
      .output(filePath)
      .on('end', resolve)
      .on('error', (err: Error) => {
        console.error(
          `Error creando archivo de silencio (${duration}s) en ${filePath}:`,
          err.message,
        );
        reject(err);
      })
      .run();
  });
};

export const concatAudiosWithSilence = async (
  audioListFile: string,
  concatAudioPath: string,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const listContent = fs.readFileSync(audioListFile, 'utf-8');
    if (listContent.trim() === '') {
      console.warn(
        'El archivo de lista de audios para concatenar está vacío. Se creará un archivo de audio con un breve silencio.',
      );
      createSilenceFile(concatAudioPath, 0.01).then(resolve).catch(reject);
      return;
    }

    ffmpeg()
      .input(audioListFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c:a',
        'libmp3lame',
        '-b:a',
        '192k',
        '-ar',
        '44100',
        '-ac',
        '2',
      ])
      .output(concatAudioPath)
      .on('end', resolve)
      .on('error', (err: Error) => {
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
  concatDuration: number, // This is the target duration for the background music
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    if (concatDuration <= 0) {
      console.warn(
        `addBackgroundMusic: La duración de la narración es ${concatDuration}. La música de fondo podría no procesarse como se espera o ser muy corta.`,
      );
      // Create a very short silent file if target duration is invalid
      createSilenceFile(lowVolumeMusic, 0.01).then(resolve).catch(reject);
      return;
    }

    ffmpeg()
      .input(backgroundMusicPath)
      .inputOptions([
        '-stream_loop',
        '-1', // Loop the background music input indefinitely
      ])
      .audioFilters(`volume=${musicVolume}`) // Apply volume adjustment
      .outputOptions([
        '-t',
        concatDuration.toString(), // Set the output duration to match narration
        '-c:a',
        'libmp3lame',
        '-b:a',
        '128k',
        '-ar',
        '44100',
        '-ac',
        '2',
      ])
      .output(lowVolumeMusic)
      .on('end', resolve)
      .on('error', (err: Error) => {
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
    const concatAudioExists =
      fs.existsSync(concatAudioPath) && fs.statSync(concatAudioPath).size > 0;
    const lowVolumeMusicExists =
      fs.existsSync(lowVolumeMusic) && fs.statSync(lowVolumeMusic).size > 0;

    if (!concatAudioExists && !lowVolumeMusicExists) {
      console.warn(
        'Ambos audios (narración y música) están vacíos o no existen. Creando silencio para finalAudioPath.',
      );
      createSilenceFile(finalAudioPath, 0.01).then(resolve).catch(reject);
      return;
    }
    if (!concatAudioExists) {
      console.warn(
        'El audio de narración está vacío o no existe. Usando solo música de fondo si está disponible.',
      );
      ffmpeg()
        .input(lowVolumeMusic)
        .outputOptions([
          '-c:a',
          'libmp3lame',
          '-b:a',
          '192k',
          '-ar',
          '44100',
          '-ac',
          '2',
        ])
        .output(finalAudioPath)
        .on('end', resolve)
        .on('error', (err: Error) => {
          console.error(
            'Error al procesar música de fondo (fallback en mergeAudios):',
            err.message,
          );
          reject(err);
        })
        .run();
      return;
    }
    if (!lowVolumeMusicExists) {
      console.warn(
        'La música de fondo está vacía o no existe. Usando solo narración.',
      );
      ffmpeg()
        .input(concatAudioPath)
        .outputOptions([
          '-c:a',
          'libmp3lame',
          '-b:a',
          '192k',
          '-ar',
          '44100',
          '-ac',
          '2',
        ])
        .output(finalAudioPath)
        .on('end', resolve)
        .on('error', (err: Error) => {
          console.error(
            'Error al procesar narración (fallback en mergeAudios):',
            err.message,
          );
          reject(err);
        })
        .run();
      return;
    }

    const filterComplex =
      '[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[aud0];' +
      '[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[aud1];' +
      '[aud0][aud1]amix=inputs=2:duration=first:dropout_transition=0[a]';

    ffmpeg()
      .input(concatAudioPath)
      .input(lowVolumeMusic)
      .complexFilter(filterComplex)
      .outputOptions([
        '-map',
        '[a]',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '192k',
        '-ar',
        '44100',
        '-ac',
        '2',
      ])
      .output(finalAudioPath)
      .on('end', () => {
        resolve();
      })
      .on('error', (err: Error) => {
        console.error(
          'Error mezclando audios. Fallback: usando solo narración concatenada:',
          err.message,
        );
        try {
          ffmpeg()
            .input(concatAudioPath)
            .outputOptions([
              '-c:a',
              'libmp3lame',
              '-b:a',
              '192k',
              '-ar',
              '44100',
              '-ac',
              '2',
            ])
            .output(finalAudioPath)
            .on('end', resolve)
            .on('error', (copyErr: Error) => {
              console.error(
                'Error en fallback al procesar narración:',
                copyErr.message,
              );
              reject(copyErr);
            })
            .run();
        } catch (copyError: any) {
          console.error(
            'Excepción en fallback al procesar narración:',
            copyError.message,
          );
          reject(copyError);
        }
      })
      .run();
  });
};

export const mergeGeneratedVideoClipsWithAudio = async (
  videoListFile: string,
  finalAudioPath: string,
  outputVideoPath: string,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const videoListContent = fs.readFileSync(videoListFile, 'utf-8');
    if (videoListContent.trim() === '') {
      console.error(
        'El archivo de lista de videos para concatenar está vacío. No se puede generar el video final.',
      );
      return reject(new Error('Lista de clips de vídeo vacía.'));
    }

    if (
      !fs.existsSync(finalAudioPath) ||
      fs.statSync(finalAudioPath).size === 0
    ) {
      console.warn(
        `El archivo de audio final ${finalAudioPath} está vacío o no existe. Se intentará generar video sin audio o con un silencio corto.`,
      );
    }

    ffmpeg()
      .input(videoListFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
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
        '-ac',
        '2',
        '-s',
        `${VIDEO_WIDTH}x${VIDEO_HEIGHT}`,
        '-r',
        VIDEO_FPS.toString(),
        '-max_muxing_queue_size',
        '9999',
        '-shortest',
      ])
      .output(outputVideoPath)
      .on('end', resolve)
      .on('error', (err: Error, stdout: string, stderr: string) => {
        console.error(
          'Error al fusionar clips de vídeo con audio:',
          err.message,
        );
        console.error('FFmpeg stdout:', stdout);
        console.error('FFmpeg stderr:', stderr);
        reject(
          new Error(
            `Fallo al fusionar clips de vídeo: ${err.message} \nstdout: ${stdout}\nstderr: ${stderr}`,
          ),
        );
      })
      .run();
  });
};

export function getFileDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      return resolve(0);
    }
    ffmpeg.ffprobe(filePath, (err: Error, metadata: any) => {
      if (err) {
        return resolve(0);
      }
      if (!metadata || !metadata.format) {
        return resolve(0);
      }
      const duration = metadata.format.duration;
      if (typeof duration !== 'number' || isNaN(duration) || duration < 0) {
        resolve(0);
        return;
      }
      resolve(duration);
    });
  });
}

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
        'medium', // Cambiado de 'ultrafast' a 'medium' para un mejor equilibrio calidad/velocidad
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
