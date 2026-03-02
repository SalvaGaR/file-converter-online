'use strict';

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories for uploads and converted output
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'outputs');

for (const dir of [UPLOAD_DIR, OUTPUT_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Allowed MIME types grouped by category
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/tiff', 'image/avif',
]);
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4', 'video/x-matroska', 'video/webm',
  'video/quicktime', 'video/x-msvideo', 'video/mpeg',
]);
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac',
  'audio/aac', 'audio/x-m4a',
]);

function isAllowed(mimetype) {
  return (
    ALLOWED_IMAGE_TYPES.has(mimetype) ||
    ALLOWED_VIDEO_TYPES.has(mimetype) ||
    ALLOWED_AUDIO_TYPES.has(mimetype)
  );
}

// Multer storage – keep original extension, store in UPLOAD_DIR
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    if (isAllowed(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limiting ────────────────────────────────────────────────────────────

const convertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many conversion requests. Please try again later.' },
});

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many download requests. Please try again later.' },
});

// ── Image conversion / compression ──────────────────────────────────────────

const IMAGE_FORMAT_MAP = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  tiff: 'tiff',
  avif: 'avif',
};

async function convertImage(inputPath, outputPath, format, quality) {
  let pipeline = sharp(inputPath);

  if (format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality });
  } else if (format === 'png') {
    // compressionLevel 0-9 mapped from quality 1-100
    const level = Math.round((1 - quality / 100) * 9);
    pipeline = pipeline.png({ compressionLevel: level });
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality });
  } else if (format === 'avif') {
    pipeline = pipeline.avif({ quality });
  } else if (format === 'gif') {
    pipeline = pipeline.gif();
  } else if (format === 'tiff') {
    pipeline = pipeline.tiff({ quality });
  } else {
    pipeline = pipeline.toFormat(format);
  }

  await pipeline.toFile(outputPath);
}

// ── Video / Audio conversion / compression ───────────────────────────────────

function buildVideoOptions(targetFormat, videoBitrate, resolution) {
  const opts = { outputOptions: [], audioOptions: [] };

  if (targetFormat === 'mp4') {
    opts.videoCodec = 'libx264';
    opts.audioCodec = 'aac';
  } else if (targetFormat === 'webm') {
    opts.videoCodec = 'libvpx-vp9';
    opts.audioCodec = 'libopus';
  } else if (targetFormat === 'mkv') {
    opts.videoCodec = 'libx264';
    opts.audioCodec = 'aac';
  } else if (targetFormat === 'avi') {
    opts.videoCodec = 'libx264';
    opts.audioCodec = 'mp3';
  } else if (targetFormat === 'mov') {
    opts.videoCodec = 'libx264';
    opts.audioCodec = 'aac';
  }

  if (videoBitrate) opts.outputOptions.push(`-b:v ${videoBitrate}k`);
  if (resolution) opts.outputOptions.push(`-vf scale=${resolution}:-2`);

  return opts;
}

function buildAudioOptions(targetFormat, audioBitrate) {
  const opts = { outputOptions: [] };

  if (targetFormat === 'mp3') {
    opts.audioCodec = 'libmp3lame';
  } else if (targetFormat === 'ogg') {
    opts.audioCodec = 'libvorbis';
  } else if (targetFormat === 'flac') {
    opts.audioCodec = 'flac';
  } else if (targetFormat === 'aac' || targetFormat === 'm4a') {
    opts.audioCodec = 'aac';
  } else if (targetFormat === 'wav') {
    opts.audioCodec = 'pcm_s16le';
  }

  if (audioBitrate) opts.outputOptions.push(`-b:a ${audioBitrate}k`);
  opts.outputOptions.push('-vn'); // strip video

  return opts;
}

function runFfmpeg(inputPath, outputPath, optsBuilder) {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath);

    const { videoCodec, audioCodec, outputOptions } = optsBuilder;
    if (videoCodec) cmd = cmd.videoCodec(videoCodec);
    if (audioCodec) cmd = cmd.audioCodec(audioCodec);
    if (outputOptions && outputOptions.length) cmd = cmd.outputOptions(outputOptions);

    cmd
      .on('error', (err) => reject(err))
      .on('end', () => resolve())
      .save(outputPath);
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.post('/convert', convertLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const inputPath = req.file.path;
  const mimetype = req.file.mimetype;

  let { targetFormat, quality, videoBitrate, audioBitrate, resolution } = req.body;

  // Sanitise / coerce inputs
  targetFormat = (targetFormat || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  quality = Math.min(100, Math.max(1, parseInt(quality, 10) || 80));
  videoBitrate = parseInt(videoBitrate, 10) || null;
  audioBitrate = parseInt(audioBitrate, 10) || null;
  resolution = /^\d+$/.test(resolution || '') ? resolution : null;

  if (!targetFormat) {
    fs.unlink(inputPath, () => {});
    return res.status(400).json({ error: 'targetFormat is required.' });
  }

  const outputFilename = `${uuidv4()}.${targetFormat}`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  try {
    if (ALLOWED_IMAGE_TYPES.has(mimetype)) {
      const fmt = IMAGE_FORMAT_MAP[targetFormat];
      if (!fmt) throw new Error(`Unsupported image output format: ${targetFormat}`);
      await convertImage(inputPath, outputPath, fmt, quality);
    } else if (ALLOWED_VIDEO_TYPES.has(mimetype)) {
      const opts = buildVideoOptions(targetFormat, videoBitrate, resolution);
      await runFfmpeg(inputPath, outputPath, opts);
    } else if (ALLOWED_AUDIO_TYPES.has(mimetype)) {
      const opts = buildAudioOptions(targetFormat, audioBitrate);
      await runFfmpeg(inputPath, outputPath, opts);
    } else {
      throw new Error('Unsupported file type.');
    }

    // Respond with the download token (the output filename)
    res.json({ downloadToken: outputFilename });
  } catch (err) {
    console.error('Conversion error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    // Always remove the uploaded source file
    fs.unlink(inputPath, () => {});
  }
});

app.get('/download/:token', downloadLimiter, (req, res) => {
  const token = req.params.token;

  // Validate token: only allow safe filenames (uuid.ext)
  if (!/^[0-9a-f-]+\.[a-z0-9]+$/.test(token)) {
    return res.status(400).json({ error: 'Invalid download token.' });
  }

  const filePath = path.join(OUTPUT_DIR, token);

  // Ensure the resolved path stays inside OUTPUT_DIR
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(OUTPUT_DIR) + path.sep) &&
      resolved !== path.resolve(OUTPUT_DIR)) {
    return res.status(400).json({ error: 'Invalid download token.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found or already downloaded.' });
  }

  res.download(filePath, token, (err) => {
    if (!err) {
      // Remove file after successful download
      fs.unlink(filePath, () => {});
    }
  });
});

// ── Error handler ────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`File Converter running at http://localhost:${PORT}`);
});
