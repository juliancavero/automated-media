import fs from 'fs';

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

export const createSilenceFile = async (filePath: string): Promise<void> => {
  return await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input('anullsrc')
      .inputFormat('lavfi')
      .audioFrequency(44100)
      .audioBitrate('192k')
      .audioChannels(2)
      .duration(1)
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
  return await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(audioListFile)
      .inputOptions('-f', 'concat', '-safe', '0')
      .outputOptions('-c:a', 'libmp3lame', '-b:a', '192k')
      .output(concatAudioPath)
      .on('end', resolve)
      .on('error', (err) => {
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
  return await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(backgroundMusicPath)
      .audioFilters(`volume=${musicVolume}`) // Usar el volumen específico para el tipo de video
      .duration(concatDuration)
      .outputOptions(['-c:a', 'libmp3lame', '-b:a', '128k'])
      .output(lowVolumeMusic)
      .on('end', resolve)
      .on('error', (err) => {
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
  return await new Promise<void>((resolve, reject) => {
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
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        // Si falla, usar el audio original
        fs.copyFileSync(concatAudioPath, finalAudioPath);
        resolve();
      })
      .run();
  });
};

export const mergeEveryting = async (
  segmentsFile: string,
  finalAudioPath: string,
  baseVideoPath: string,
): Promise<void> => {
  return await new Promise<void>((resolve, reject) => {
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
        console.error('Error merging videos:', err);
        reject(err);
      })
      .run();
  });
};

/**
 * Obtiene la duración de un archivo de video usando ffprobe
 */
export function getFileDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      const duration = metadata.format.duration || 0;
      resolve(duration);
    });
  });
}
