# FILE MANIPULATOR — Project Context

## Overview

A full-stack, client-server hybrid file converter and manipulator. The application emphasizes **client-side processing** to reduce server load, using WebAssembly and JavaScript libraries for audio, video, image, PDF, and office document handling.

## Architecture

| Layer     | Technology                                       |
|-----------|--------------------------------------------------|
| Frontend  | Vanilla JS, HTML5, CSS3 (Brutalist design)       |
| Backend   | Node.js, Express, Multer, Sharp, fluent-ffmpeg   |
| Client-side Libraries | WaveSurfer.js, FFmpeg.wasm, PDF.js, pdf-lib, Cropper.js, JSZip, Mammoth.js, SheetJS |

## File Structure

```
public/
  index.html   — Single-page UI with upload, edit/preview, options, and result sections
  app.js       — Main frontend logic: file detection, conversion orchestration, FFmpeg.wasm
  panels.js    — Panel renderers for each file type (image, audio, video, PDF, office, generic)
  style.css    — Minimalist brutalism: black & white, thick borders, system fonts
server.js      — Express backend with Sharp (images) and FFmpeg (video/audio) conversion
```

## File Categories

| Category | Formats                          | Client-side Engine          |
|----------|----------------------------------|-----------------------------|
| Image    | JPEG, PNG, WebP, AVIF, GIF, TIFF | Canvas API + Cropper.js     |
| Audio    | MP3, OGG, FLAC, AAC, M4A, WAV   | WaveSurfer.js + FFmpeg.wasm |
| Video    | MP4, WebM, MKV, AVI, MOV        | FFmpeg.wasm                 |
| PDF      | Extract, Merge, Compress, Images | PDF.js + pdf-lib            |
| Office   | DOCX, XLSX, XLS                  | Mammoth.js + SheetJS        |
| Generic  | Any file                         | JSZip, Base64               |

## Key Features

- **Audio**: WaveSurfer.js waveform (black on white) with spectrogram toggle, real-time playback counter, bidirectional trim sync between visual region and numeric inputs
- **Video**: HTML5 video preview, metadata display (duration, resolution, bitrate), real-time estimated output size based on selected bitrate
- **Image**: Cropper.js with visual crop, 90° rotation, horizontal/vertical flip
- **PDF**: PDF.js hi-DPI rendering (devicePixelRatio scaling), page navigation (prev/next), compress, extract, merge, convert to images
- **Office**: Mammoth.js renders DOCX as HTML preview, SheetJS renders Excel sheets as HTML tables, DOCX-to-PDF conversion via Mammoth + pdf-lib
- **General**: Customizable output filename, all libraries loaded via CDN

## State Management

- `resetState()` clears all media (destroys WaveSurfer, Cropper, stops video, clears previews), revokes blob URLs, and resets UI
- `cleanupPanels()` handles per-panel resource cleanup (object URLs, WaveSurfer, Cropper instances, video element, PDF/office previews)

## CDN Libraries (loaded in `<head>` with `defer`)

- WaveSurfer.js 6.6.4 (+ regions and spectrogram plugins)
- FFmpeg.wasm 0.11.6
- PDF.js 3.11.174
- pdf-lib 1.17.1
- JSZip 3.10.1
- Cropper.js 1.5.13
- Mammoth.js 1.6.0
- SheetJS (XLSX) 0.18.5

## Running

```bash
npm install
npm start        # Production (port 3000)
npm run dev      # Development with nodemon
```
