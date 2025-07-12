import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpegPath = ffmpegInstaller.path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

@Injectable()
export class FFmpegConverterService {
  private readonly logger = new Logger(FFmpegConverterService.name);

  async convertWebmToMp4(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        reject(new Error(`Input file does not exist: ${inputPath}`));
        return;
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.logger.log(`Converting ${inputPath} to ${outputPath}`);

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        // Redimensionar a formato vertical 1080x1920 con máxima calidad
        .videoFilter([
          'scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos', // Mejor escalado
          'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
        ])
        .outputOptions([
          '-preset',
          'veryslow', // Máxima calidad de compresión
          '-crf',
          '15', // Calidad superior
          '-pix_fmt',
          'yuv420p',
          '-profile:v',
          'high',
          '-level',
          '4.2',
          '-movflags',
          '+faststart',
          '-b:a',
          '192k', // Bitrate de audio superior
          '-ar',
          '48000', // Sample rate superior
          '-ac',
          '2', // Stereo
          '-af',
          'volume=1.2',
          '-x264opts',
          'ref=4:bframes=4:subq=8:trellis=2:me=umh:merange=32',
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.log(
            `Conversion progress: ${Math.round(progress.percent ?? 0)}%`,
          );
        })
        .on('end', () => {
          this.logger.log(`Conversion completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`Conversion error: ${err.message}`);
          reject(new Error(err.message));
        })
        .run();
    });
  }

  async convertWebmToMp4WithSystemAudio(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        reject(new Error(`Input file does not exist: ${inputPath}`));
        return;
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.logger.log(
        `Converting ${inputPath} to ${outputPath} with system audio`,
      );

      // Intentar capturar audio del sistema usando PulseAudio
      const command = ffmpeg()
        .input(inputPath) // Video input
        .videoCodec('libx264')
        .audioCodec('aac')
        // Redimensionar a formato vertical 1080x1920
        .videoFilter([
          'scale=1080:1920:force_original_aspect_ratio=decrease',
          'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
        ])
        .outputOptions([
          '-preset',
          'medium',
          '-crf',
          '18',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          '-b:a',
          '128k',
          '-ar',
          '44100',
          '-ac',
          '2',
        ]);

      // Intentar añadir audio del sistema si está disponible
      try {
        // Verificar si hay dispositivos de audio disponibles
        command
          .input('pulse') // PulseAudio input for system audio
          .inputOptions(['-f', 'pulse', '-i', 'default'])
          .complexFilter([
            '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[audio_out]',
          ])
          .outputOptions(['-map', '0:v', '-map', '[audio_out]']);
      } catch (error) {
        this.logger.warn(
          'System audio not available, using video audio only',
          error,
        );
      }

      command
        .output(outputPath)
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.log(
            `Conversion progress: ${Math.round(progress.percent ?? 0)}%`,
          );
        })
        .on('end', () => {
          this.logger.log(`Conversion completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`Conversion error: ${err.message}`);
          // Si falla con audio del sistema, intentar sin él
          if (
            err.message.includes('pulse') ||
            err.message.includes('PulseAudio')
          ) {
            this.logger.warn('Falling back to video audio only');
            this.convertWebmToMp4(inputPath, outputPath)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error(err.message));
          }
        })
        .run();
    });
  }

  async convertWebmToMp4Keep720x1280(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        reject(new Error(`Input file does not exist: ${inputPath}`));
        return;
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.logger.log(
        `Converting ${inputPath} to ${outputPath} maintaining 720x1280`,
      );

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        // Mantener el tamaño original 720x1280 sin redimensionar
        .outputOptions([
          '-preset',
          'medium',
          '-crf',
          '18',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          '-b:a',
          '128k',
          '-ar',
          '44100',
          '-ac',
          '2',
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.log(
            `Conversion progress: ${Math.round(progress.percent ?? 0)}%`,
          );
        })
        .on('end', () => {
          this.logger.log(`Conversion completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`Conversion error: ${err.message}`);
          reject(new Error(err.message));
        })
        .run();
    });
  }

  async convert420x640To720x1280(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        reject(new Error(`Input file does not exist: ${inputPath}`));
        return;
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.logger.log(`Converting ${inputPath} from 420x640 to 720x1280`);

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        // Escalar de 420x640 a 720x1280 (proporción perfecta 9:16)
        .videoFilter('scale=720:1280')
        .outputOptions([
          '-preset',
          'medium',
          '-crf',
          '18',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          '-b:a',
          '128k',
          '-ar',
          '44100',
          '-ac',
          '2',
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.log(
            `Conversion progress: ${Math.round(progress.percent ?? 0)}%`,
          );
        })
        .on('end', () => {
          this.logger.log(`Conversion completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`Conversion error: ${err.message}`);
          reject(new Error(err.message));
        })
        .run();
    });
  }

  async convert500x869To720x1280(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        reject(new Error(`Input file does not exist: ${inputPath}`));
        return;
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.logger.log(`Converting ${inputPath} from 500x869 to 720x1280`);

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        // Escalar de 500x869 a 720x1280 manteniendo proporción y añadiendo padding
        .videoFilter([
          'scale=720:1280:force_original_aspect_ratio=decrease',
          'pad=720:1280:(ow-iw)/2:(oh-ih)/2:black',
        ])
        .outputOptions([
          '-preset',
          'medium',
          '-crf',
          '18',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          '-b:a',
          '128k',
          '-ar',
          '44100',
          '-ac',
          '2',
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.log(
            `Conversion progress: ${Math.round(progress.percent ?? 0)}%`,
          );
        })
        .on('end', () => {
          this.logger.log(`Conversion completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`Conversion error: ${err.message}`);
          reject(new Error(err.message));
        })
        .run();
    });
  }

  async keep500x869Size(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        reject(new Error(`Input file does not exist: ${inputPath}`));
        return;
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.logger.log(`Converting ${inputPath} maintaining 500x869 size`);

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        // Mantener el tamaño original 500x869 con máxima calidad
        .outputOptions([
          '-preset',
          'veryslow', // Máxima calidad de compresión
          '-crf',
          '15', // Calidad superior (15 es muy alta calidad)
          '-pix_fmt',
          'yuv420p',
          '-profile:v',
          'high', // Perfil de video alto
          '-level',
          '4.2', // Nivel de codificación alto
          '-movflags',
          '+faststart',
          '-b:a',
          '192k', // Bitrate de audio superior
          '-ar',
          '48000', // Sample rate de audio superior
          '-ac',
          '2', // Stereo
          '-af',
          'volume=1.2', // Aumentar ligeramente el volumen
          '-x264opts',
          'ref=4:bframes=4:subq=8:trellis=2:me=umh:merange=32', // Opciones x264 de alta calidad
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.log(
            `Conversion progress: ${Math.round(progress.percent ?? 0)}%`,
          );
        })
        .on('end', () => {
          this.logger.log(`Conversion completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`Conversion error: ${err.message}`);
          reject(new Error(err.message));
        })
        .run();
    });
  }

  async keep500x869SizeHighQuality(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        reject(new Error(`Input file does not exist: ${inputPath}`));
        return;
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.logger.log(
        `Converting ${inputPath} maintaining 500x869 size with highest quality`,
      );

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        // Mantener el tamaño original 500x869 con configuración óptima
        .outputOptions([
          '-preset',
          'veryslow', // Máxima calidad de compresión
          '-crf',
          '12', // Calidad casi sin pérdida
          '-pix_fmt',
          'yuv420p',
          '-profile:v',
          'high', // Perfil de video alto
          '-level',
          '4.2', // Nivel de codificación alto
          '-movflags',
          '+faststart',
          '-b:a',
          '256k', // Bitrate de audio muy alto
          '-ar',
          '48000', // Sample rate de audio superior
          '-ac',
          '2', // Stereo
          '-af',
          'volume=1.2,acompressor=threshold=-20dB:ratio=3:attack=3:release=200', // Mejora de audio
          '-x264opts',
          'ref=5:bframes=5:subq=10:trellis=2:me=umh:merange=64:direct=auto:partitions=all', // Opciones x264 óptimas
          '-bf',
          '5', // Más B-frames para mejor compresión
          '-g',
          '30', // GOP size
          '-keyint_min',
          '15', // Keyframe interval
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.log(
            `Conversion progress: ${Math.round(progress.percent ?? 0)}%`,
          );
        })
        .on('end', () => {
          this.logger.log(`Conversion completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`Conversion error: ${err.message}`);
          reject(new Error(err.message));
        })
        .run();
    });
  }

  async convertMobileVertical1080x1920(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        reject(new Error(`Input file does not exist: ${inputPath}`));
        return;
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.logger.log(
        `Converting ${inputPath} to mobile vertical 1080x1920 format`,
      );

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        // Escalar a 1080x1920 manteniendo orientación vertical móvil
        .videoFilter('scale=1080:1920:flags=lanczos')
        .outputOptions([
          '-preset',
          'slow', // Buena calidad con tiempo razonable
          '-crf',
          '18', // Calidad alta
          '-pix_fmt',
          'yuv420p',
          '-profile:v',
          'high',
          '-level',
          '4.2',
          '-movflags',
          '+faststart',
          '-b:a',
          '192k', // Bitrate de audio alto
          '-ar',
          '48000', // Sample rate superior
          '-ac',
          '2', // Stereo
          '-af',
          'volume=1.2', // Aumentar volumen ligeramente
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.log(
            `Conversion progress: ${Math.round(progress.percent ?? 0)}%`,
          );
        })
        .on('end', () => {
          this.logger.log(
            `Mobile vertical conversion completed: ${outputPath}`,
          );
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`Mobile vertical conversion error: ${err.message}`);
          reject(new Error(err.message));
        })
        .run();
    });
  }
}
