import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import { execSync } from 'child_process';
import { v4 as uuid } from 'uuid';
import { AiService } from '../ai/ai.service';

/**
 * TODO
 * - Los subtítulos no tienen el aspecto original de TikTok.
 * - El texto está muy espaciado.
 * - El texto no está 100% alineado verticalmente.
 * - Los timestamps de la transcripción no son precisos del todo.
 * - La transcripción con IA tarda mucho y la respuesta es muy larga.
 */

// Updated interfaces to match Whisper output format
interface TranscriptionSegment {
  timestamps: {
    from: string;
    to: string;
  };
  offsets: {
    from: number;
    to: number;
  };
  text: string;
}

interface WhisperOutput {
  systeminfo: string;
  model: {
    type: string;
    multilingual: boolean;
    vocab: number;
    // Other model properties
  };
  params: {
    model: string;
    language: string;
    translate: boolean;
  };
  result: {
    language: string;
  };
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
    // Asegura que la carpeta base exista
    const baseTempDir = path.join(process.cwd(), 'tmp-workdir');
    fs.mkdirSync(baseTempDir, { recursive: true });

    // Luego crea un subdirectorio temporal
    const tempDir = fs.mkdtempSync(path.join(baseTempDir, 'subs-'));
    const inputPath = path.join(tempDir, `${uuid()}-${originalName}`);
    const audioPath = inputPath.replace(/\.\w+$/, '.wav');
    const outputPath = inputPath.replace(/\.\w+$/, '_subtitled.mp4');

    // Guardar el buffer como archivo temporal
    fs.writeFileSync(inputPath, fileBuffer);

    try {
      await this.extractAudio(inputPath, audioPath);
      const segments = await this.runWhisperInDocker(inputPath, language);

      // Split segments into three parts
      const segmentLength = segments.length;
      const segment1 = segments.slice(0, Math.floor(segmentLength / 3));
      const segment2 = segments.slice(
        Math.floor(segmentLength / 3),
        Math.floor((2 * segmentLength) / 3),
      );
      const segment3 = segments.slice(Math.floor((2 * segmentLength) / 3));

      // Refine each segment with AI
      const correctedSegment1 = await this.aiService.refineTranscriptions(
        realTexts,
        segment1,
      );
      await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds

      const correctedSegment2 = await this.aiService.refineTranscriptions(
        realTexts,
        segment2,
      );
      await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds

      const correctedSegment3 = await this.aiService.refineTranscriptions(
        realTexts,
        segment3,
      );
      await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds

      // Concatenate the corrected segments
      const correctedSegments = [
        ...correctedSegment1,
        ...correctedSegment2,
        ...correctedSegment3,
      ];

      const filters = this.generateSegmentDrawTextFilters(
        correctedSegments,
        'assets/fonts/Anton-Regular.ttf',
      );
      await this.applyDrawTextFilters(inputPath, outputPath, filters);

      const finalBuffer = fs.readFileSync(outputPath);
      return finalBuffer;
    } finally {
      // Limpieza de archivos temporales
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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

    // Ensure mnt directory exists
    fs.mkdirSync(whisperMntDir, { recursive: true });

    // Copy input file to whisper-docker/mnt for proper Docker mounting
    const fileName = path.basename(inputPath);
    const targetPath = path.join(whisperMntDir, fileName);
    fs.copyFileSync(inputPath, targetPath);

    // Now use the file inside the mnt directory
    const inputFileName = fileName; // Just the filename, since script runs from whisper-docker dir

    // Ensure the script is executable
    execSync(`chmod +x ${scriptPath}`);

    // Remove any old output.json if it exists
    if (fs.existsSync(outputJsonPath)) {
      fs.unlinkSync(outputJsonPath);
    }

    // Run the Whisper Docker transcription with the file from the mnt directory
    if (!fs.existsSync(outputJsonPath)) {
      execSync(
        `cd ${whisperDir} && ./copy-and-transcription.sh mnt/${inputFileName} ${language}`,
        {
          stdio: 'inherit',
        },
      );
    }

    // Wait for output.json to be available and readable
    const maxRetries = 10; // 30 seconds timeout
    let retries = 0;

    while (retries < maxRetries) {
      if (fs.existsSync(outputJsonPath)) {
        try {
          // Try to read the file to ensure it's complete
          const fileContent = fs.readFileSync(outputJsonPath, 'utf-8');

          // If we can parse it as JSON, it's ready
          const outputData: WhisperOutput = JSON.parse(fileContent);

          if (outputData && outputData.transcription) {
            console.log(
              `Successfully read output.json after ${retries} retries`,
            );
            return outputData.transcription;
          }
        } catch (error) {
          console.log(
            `File exists but not ready yet, retry ${retries + 1}: ${error.message}`,
          );
        }
      } else {
        console.log(
          `Waiting for output.json to be created, retry ${retries + 1}`,
        );
      }

      // Wait for 1 second before checking again
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
    // Crear un archivo de filtros temporal para manejar cadenas largas
    const filterFile = path.join(path.dirname(input), 'filters.txt');
    fs.writeFileSync(filterFile, filters.join(',\n'), 'utf8');

    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .inputOptions([`-filter_complex_script ${filterFile}`])
        .outputOptions('-c:a copy')
        .on('end', () => {
          // Limpiar el archivo de filtros
          try {
            fs.unlinkSync(filterFile);
          } catch (e) {
            console.warn(
              'No se pudo eliminar el archivo de filtros temporal',
              e,
            );
          }
          resolve();
        })
        .on('error', (err) => {
          try {
            fs.unlinkSync(filterFile);
          } catch (e) {
            console.warn(
              'No se pudo eliminar el archivo de filtros temporal',
              e,
            );
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
    // Vertical position for the baseline of the text. Adjusted as needed.
    // This position will now represent the BOTTOM edge of the text bounding box.
    const bottomPosition = 980;
    // Number of words to group together on a single line.
    const groupSize = 3;

    // Helper function to escape special characters in text for FFmpeg drawtext filter.
    const escapeText = (text: string): string =>
      text
        .replace(/\\/g, '\\\\') // Escape backslashes first
        .replace(/'/g, "\\'") // Escape single quotes
        .replace(/:/g, '\\:') // Escape colons
        .replace(/\n/g, ' '); // Replace newlines with spaces

    // Process segments in groups to form lines of subtitles.
    for (let i = 0; i < segments.length; i += groupSize) {
      const group = segments.slice(i, i + groupSize);
      if (group.length === 0) continue;

      // Extract and format words and their timing offsets for the current group.
      const groupWords = group.map(
        (s) =>
          s.text
            .trim() // Remove leading/trailing whitespace.
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove common punctuation.
            .toUpperCase(), // Convert to uppercase as seen in the example image.
      );
      const wordOffsets = group.map((s) => ({
        start: s.offsets.from / 1000, // Convert milliseconds to seconds.
        end: s.offsets.to / 1000, // Convert milliseconds to seconds.
      }));

      // Estimate character width and spacing for horizontal positioning.
      // These values are approximations and may need fine-tuning based on
      // the actual font metrics to achieve precise spacing and centering.
      const estimatedCharWidth = 28; // Estimated width per character (adjust based on font).
      // Adjusted spacing to better balance separation and prevent excessive overlap.
      // You might need to fine-tune this value.
      const spacing = 10; // Increased spacing slightly

      // Calculate the estimated total width of the full line text for centering.
      // This calculation is used to determine the starting X position for the entire line.
      let estimatedTotalWidth = 0;
      for (let k = 0; k < groupWords.length; k++) {
        estimatedTotalWidth += groupWords[k].length * estimatedCharWidth;
        if (k < groupWords.length - 1) {
          estimatedTotalWidth += spacing;
        }
      }

      // Calculate the base X position to center the entire text line.
      const baseX = `(w-${estimatedTotalWidth})/2`;

      // Determine the start and end time for the entire group (line) display.
      const groupStart = wordOffsets[0].start;
      const groupEnd = wordOffsets[wordOffsets.length - 1].end;

      let offsetX = 0; // This will be the starting X for the current word relative to the group's start X

      // Iterate through each word in the group to create its drawtext filters.
      for (let j = 0; j < groupWords.length; j++) {
        const word = escapeText(groupWords[j]);
        const wordStart = wordOffsets[j].start;
        const wordEnd = wordOffsets[j].end;

        // Calculate the X and Y position for the current word within the line.
        // baseX centers the entire block. offsetX is the position relative to the start of the block.
        const xExpr = `${baseX}+${offsetX}`;
        // Align the BOTTOM of the text bounding box to the bottomPosition.
        // This is the standard approach for approximating baseline alignment with drawtext.
        const yExpr = `${bottomPosition}-text_h`;

        // Determine if the current word is the one being highlighted.
        // This assumes highlighting is indicated by defined wordStart and wordEnd times.
        const isHighlighted = wordStart !== undefined && wordEnd !== undefined;

        if (isHighlighted) {
          // Layer 1: Red Background Box (only for highlighted word)
          // This filter draws a transparent version of the text with a solid red box
          // behind it. It is enabled only during the word's highlight duration.
          // IMPORTANT: This filter is added *first* for highlighted words so it appears behind the text.
          // Use the *exact same* x and y expressions as the white text layer for this word
          // to ensure perfect alignment of the highlight with the text.
          // Modified boxcolor for the requested hex color (ff2c53) and retained reduced opacity (0.7).
          // Note: boxborderw controls border width, not rounded corners. Rounded corners are not supported by box=1.
          filters.push(
            `drawtext=fontfile='${fontPath}':text='${word}':enable='between(t,${wordStart},${wordEnd})':x=${xExpr}:y=${yExpr}:fontsize=${fontSize}:fontcolor=0x00000000:box=1:boxcolor=0xff2c53@0.7:boxborderw=10`,
          );
        }

        // Layer 2: White Text with Black Outline (for all words in the group duration)
        // This filter draws the actual white text with a black outline.
        // It is enabled for the entire duration the word's group is displayed.
        // This is the base layer for the word's text.
        // For highlighted words, this filter is added *after* the red box filter.
        filters.push(
          `drawtext=fontfile='${fontPath}':text='${word}':enable='between(t,${groupStart},${groupEnd})':x=${xExpr}:y=${yExpr}:fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black`,
        );

        // Update the horizontal offset for the next word.
        // This needs to be based on the *estimated* width of the current word plus spacing.
        // This estimation affects the spacing between words and the overall centering of the line.
        const estimatedWordWidth = groupWords[j].length * estimatedCharWidth; // Use the same charWidth estimate
        offsetX += estimatedWordWidth + spacing;
      }
    }

    return filters;
  }
}
