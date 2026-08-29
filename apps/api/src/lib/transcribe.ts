import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import OpenAI from "openai";

import { prisma } from "./prisma";

// 15-minute chunks at 64kbps mono comfortably clear Whisper's 25MB-per-file
// limit (~7.2MB/chunk) with plenty of headroom, while keeping the number of
// API calls for a ~60-90 min episode small (4-6 chunks).
const CHUNK_SECONDS = 15 * 60;

export const isTranscriptionConfigured = Boolean(process.env.OPENAI_API_KEY);

let openai: OpenAI | undefined;
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 10 * 60 * 1000 });
  }
  return openai;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download audio (HTTP ${res.status})`);
  }
  await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(destPath));
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, args);
    let stderr = "";
    proc.stderr.on("data", (chunk) => (stderr += chunk));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`))));
  });
}

function probeDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobeStatic.path, ["-v", "error", "-show_entries", "format=duration", "-of", "json", filePath]);
    let stdout = "";
    proc.on("error", reject);
    proc.stdout.on("data", (chunk) => (stdout += chunk));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error("ffprobe failed to read duration"));
      try {
        resolve(Math.round(parseFloat(JSON.parse(stdout).format.duration)));
      } catch (err) {
        reject(err);
      }
    });
  });
}

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

// Downloads the episode's audio, splits it into Whisper-sized chunks,
// transcribes each in order via the OpenAI API, and stores the combined
// result as TranscriptSegment rows (replacing any from a previous attempt —
// this makes retrying a FAILED episode safe to re-run). Updates
// transcriptStatus throughout so the admin panel can show progress.
export async function transcribeEpisode(episodeId: string): Promise<void> {
  const episode = await prisma.episode.findUniqueOrThrow({ where: { id: episodeId } });
  const sourceUrl = episode.transcriptAudioUrl ?? episode.audioUrl;

  await prisma.episode.update({
    where: { id: episodeId },
    data: { transcriptStatus: "PROCESSING", transcriptError: null },
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "footy-feed-transcribe-"));
  try {
    const rawPath = path.join(tmpDir, "raw-audio");
    await downloadFile(sourceUrl, rawPath);

    const durationSeconds = await probeDurationSeconds(rawPath);

    const chunkPattern = path.join(tmpDir, "chunk-%03d.mp3");
    await runFfmpeg([
      "-y",
      "-i",
      rawPath,
      "-vn",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "64k",
      "-f",
      "segment",
      "-segment_time",
      String(CHUNK_SECONDS),
      "-reset_timestamps",
      "1",
      chunkPattern,
    ]);

    const chunkFiles = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("chunk-"))
      .sort();
    if (chunkFiles.length === 0) {
      throw new Error("ffmpeg produced no audio chunks — source file may be invalid or empty");
    }

    const client = getOpenAI();
    const allSegments: { startSeconds: number; endSeconds: number; text: string }[] = [];

    for (let i = 0; i < chunkFiles.length; i++) {
      const chunkPath = path.join(tmpDir, chunkFiles[i]);
      const offsetSeconds = i * CHUNK_SECONDS;

      const transcription = (await client.audio.transcriptions.create({
        file: fs.createReadStream(chunkPath),
        model: "whisper-1",
        response_format: "verbose_json",
      })) as unknown as { segments?: WhisperSegment[] };

      for (const seg of transcription.segments ?? []) {
        const text = seg.text.trim();
        if (!text) continue;
        allSegments.push({
          startSeconds: offsetSeconds + seg.start,
          endSeconds: offsetSeconds + seg.end,
          text,
        });
      }

      // Free disk space as we go rather than holding every chunk until the end.
      fs.unlinkSync(chunkPath);
    }

    await prisma.$transaction([
      prisma.transcriptSegment.deleteMany({ where: { episodeId } }),
      prisma.transcriptSegment.createMany({
        data: allSegments.map((s) => ({ ...s, episodeId })),
      }),
      prisma.episode.update({
        where: { id: episodeId },
        data: {
          transcriptStatus: "READY",
          durationSeconds: episode.durationSeconds ?? durationSeconds,
        },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.episode.update({
      where: { id: episodeId },
      data: { transcriptStatus: "FAILED", transcriptError: message.slice(0, 500) },
    });
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
