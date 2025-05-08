import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import { execSync } from 'child_process';
import { v4 as uuid } from 'uuid';
import { AiService } from '../ai/ai.service';
import { SimplifiedTranscriptionSegment, TranscriptionSegment } from '../types';

/**
 * TODO
 * - Los subtítulos no tienen el aspecto original de TikTok.
 * - El texto está muy espaciado.
 * - El texto no está 100% alineado verticalmente.
 * - Los timestamps de la transcripción no son precisos del todo.
 * - La transcripción con IA tarda mucho y la respuesta es muy larga.
 */

interface WhisperOutput {
  systeminfo: string;
  model: { type: string; multilingual: boolean; vocab: number };
  params: { model: string; language: string; translate: boolean };
  result: { language: string };
  transcription: TranscriptionSegment[];
}

@Injectable()
export class SubtitlesService {
  constructor(private readonly aiService: AiService) {}

  async generateTikTokSubsFromBuffer(
    fileBuffer: Buffer,
    originalName: string,
    language: string = 'en',
    realTexts: string[] = [],
  ): Promise<Buffer> {
    const tempDir = this.createTempDir();
    const inputPath = path.join(tempDir, `${uuid()}-${originalName}`);
    const audioPath = inputPath.replace(/\.\w+$/, '.wav');
    const outputPath = inputPath.replace(/\.\w+$/, '_subtitled.mp4');

    fs.writeFileSync(inputPath, fileBuffer);

    try {
      await this.extractAudio(inputPath, audioPath);
      const segments = await this.runWhisperInDocker(inputPath, language);

      const simplifiedSegments = this.simplifySegments(segments);
      const correctedSegmentsSimple = await this.refineSegmentsWithAI(
        simplifiedSegments,
        realTexts,
      );
      const correctedSegments = this.mapCorrectedTextsToOriginalSegments(
        segments,
        correctedSegmentsSimple,
      );

      const filters = this.generateSegmentDrawTextFilters(
        correctedSegments,
        'assets/fonts/Anton-Regular.ttf',
      );
      await this.applyDrawTextFilters(inputPath, outputPath, filters);

      return fs.readFileSync(outputPath);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private createTempDir(): string {
    const baseTempDir = path.join(process.cwd(), 'tmp-workdir');
    fs.mkdirSync(baseTempDir, { recursive: true });
    return fs.mkdtempSync(path.join(baseTempDir, 'subs-'));
  }

  private simplifySegments(
    segments: TranscriptionSegment[],
  ): SimplifiedTranscriptionSegment[] {
    return segments.map((s) => ({
      from: s.offsets.from,
      to: s.offsets.to,
      text: s.text,
    }));
  }

  private async refineSegmentsWithAI(
    simplifiedSegments: SimplifiedTranscriptionSegment[],
    realTexts: string[],
  ): Promise<SimplifiedTranscriptionSegment[]> {
    const segments = this.splitIntoThree(simplifiedSegments);
    const correctedSegments = await Promise.all(
      segments.map(async (segment) => {
        const correctedSegment = await this.aiService.refineTranscriptions(
          realTexts,
          segment,
        );
        await new Promise((resolve) => setTimeout(resolve, 15000));
        return correctedSegment;
      }),
    );

    return correctedSegments.flat();
  }

  private splitIntoThree<T>(array: T[]): [T[], T[], T[]] {
    const length = array.length;
    const third = Math.floor(length / 3);
    return [
      array.slice(0, third),
      array.slice(third, 2 * third),
      array.slice(2 * third),
    ];
  }

  private mapCorrectedTextsToOriginalSegments(
    segments: TranscriptionSegment[],
    correctedSegmentsSimple: SimplifiedTranscriptionSegment[],
  ): TranscriptionSegment[] {
    return segments.map((originalSegment) => {
      const matchingSegment = correctedSegmentsSimple.find(
        (correctedSegment) =>
          correctedSegment.from === originalSegment.offsets.from &&
          correctedSegment.to === originalSegment.offsets.to,
      );

      return {
        ...originalSegment,
        text: matchingSegment ? matchingSegment.text : originalSegment.text,
      };
    });
  }

  private async extractAudio(
    inputPath: string,
    audioPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .format('wav')
        .save(audioPath)
        .on('end', () => resolve())
        .on('error', reject);
    });
  }

  private async runWhisperInDocker(
    inputPath: string,
    language: string = 'en',
  ): Promise<TranscriptionSegment[]> {
    const whisperDir = path.join(process.cwd(), 'whisper-docker');
    const scriptPath = path.join(whisperDir, 'copy-and-transcription.sh');
    const whisperMntDir = path.join(whisperDir, 'mnt');
    const outputJsonPath = path.join(whisperMntDir, 'output.json');

    fs.mkdirSync(whisperMntDir, { recursive: true });

    const fileName = path.basename(inputPath);
    const targetPath = path.join(whisperMntDir, fileName);
    fs.copyFileSync(inputPath, targetPath);

    execSync(`chmod +x ${scriptPath}`);

    if (fs.existsSync(outputJsonPath)) {
      fs.unlinkSync(outputJsonPath);
    }

    if (!fs.existsSync(outputJsonPath)) {
      execSync(
        `cd ${whisperDir} && ./copy-and-transcription.sh mnt/${fileName} ${language}`,
        { stdio: 'inherit' },
      );
    }

    const maxRetries = 10;
    let retries = 0;

    while (retries < maxRetries) {
      if (fs.existsSync(outputJsonPath)) {
        try {
          const fileContent = fs.readFileSync(outputJsonPath, 'utf-8');
          const outputData: WhisperOutput = JSON.parse(fileContent);

          if (outputData?.transcription) {
            console.log(
              `Successfully read output.json after ${retries} retries`,
            );
            return outputData.transcription;
          }
        } catch (error) {
          console.log('.');
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries++;
    }

    throw new Error(`Failed to get whisper output after ${maxRetries} seconds`);
  }

  private async applyDrawTextFilters(
    input: string,
    output: string,
    filters: string[],
  ): Promise<void> {
    const filterFile = path.join(path.dirname(input), 'filters.txt');
    fs.writeFileSync(filterFile, filters.join(',\n'), 'utf8');

    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .inputOptions([`-filter_complex_script ${filterFile}`])
        .outputOptions('-c:a copy')
        .on('end', () => {
          try {
            fs.unlinkSync(filterFile);
          } catch (e) {
            console.warn('Could not delete temporary filter file', e);
          }
          resolve();
        })
        .on('error', (err) => {
          try {
            fs.unlinkSync(filterFile);
          } catch (e) {
            console.warn('Could not delete temporary filter file', e);
          }
          reject(err);
        })
        .save(output);
    });
  }

  public generateSegmentDrawTextFilters(
    segments: TranscriptionSegment[],
    fontPath: string,
  ): string[] {
    const filters: string[] = [];
    const fontSize = 54;
    const bottomPosition = 980;
    const groupSize = 3;

    const escapeText = (text: string): string =>
      text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/:/g, '\\:')
        .replace(/\n/g, ' ');

    for (let i = 0; i < segments.length; i += groupSize) {
      const group = segments.slice(i, i + groupSize);
      if (group.length === 0) continue;

      const groupWords = group.map((s) =>
        s.text
          .trim()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
          .toUpperCase(),
      );
      const wordOffsets = group.map((s) => ({
        start: s.offsets.from / 1000,
        end: s.offsets.to / 1000,
      }));

      const estimatedCharWidth = 28;
      const spacing = 10;

      let estimatedTotalWidth = 0;
      for (let k = 0; k < groupWords.length; k++) {
        estimatedTotalWidth += groupWords[k].length * estimatedCharWidth;
        if (k < groupWords.length - 1) {
          estimatedTotalWidth += spacing;
        }
      }

      const baseX = `(w-${estimatedTotalWidth})/2`;
      const groupStart = wordOffsets[0].start;
      const groupEnd = wordOffsets[wordOffsets.length - 1].end;

      let offsetX = 0;

      for (let j = 0; j < groupWords.length; j++) {
        const word = escapeText(groupWords[j]);
        const wordStart = wordOffsets[j].start;
        const wordEnd = wordOffsets[j].end;

        const xExpr = `${baseX}+${offsetX}`;
        const yExpr = `${bottomPosition}-text_h`;
        const isHighlighted = wordStart !== undefined && wordEnd !== undefined;

        if (isHighlighted) {
          filters.push(
            `drawtext=fontfile='${fontPath}':text='${word}':enable='between(t,${wordStart},${wordEnd})':x=${xExpr}:y=${yExpr}:fontsize=${fontSize}:fontcolor=0x00000000:box=1:boxcolor=0xff2c53@0.7:boxborderw=10`,
          );
        }

        filters.push(
          `drawtext=fontfile='${fontPath}':text='${word}':enable='between(t,${groupStart},${groupEnd})':x=${xExpr}:y=${yExpr}:fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black`,
        );

        const estimatedWordWidth = groupWords[j].length * estimatedCharWidth;
        offsetX += estimatedWordWidth + spacing;
      }
    }

    return filters;
  }
}
