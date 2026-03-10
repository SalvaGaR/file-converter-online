# FILE MANIPULATOR

A full-stack web application for converting, compressing, and manipulating images, video, audio, PDF, and office files directly in the browser.

## Features

### 🎵 Audio
- Convert between **MP3, OGG, FLAC, AAC, M4A, WAV**
- Optional bitrate configuration with live estimated output size
- **WaveSurfer.js waveform** with draggable trim region
- **Spectrogram** view (frequency over time, rendered by WaveSurfer)
- **Real-time audio spectrum** — live frequency bar visualization using Web Audio API AnalyserNode, animating while audio plays
- Bidirectional sync between visual trim handles and numeric start/end inputs
- Real-time playback counter
- Sample rate, duration, and estimated bitrate metadata

### 🎬 Video
- Convert between **MP4, WebM, MKV, AVI, MOV** via FFmpeg.wasm (client-side)
- Optional video bitrate, audio bitrate, and resolution settings
- Live estimated output size
- Trim by start/end time with range slider sync

### 🖼️ Image
- Convert between **JPEG, PNG, WebP, AVIF, GIF, TIFF**
- Configurable quality/compression
- **Cropper.js** visual crop with drag-and-drop handles
- 90° rotation, horizontal and vertical flip

### 📄 PDF
- Render pages via **PDF.js** (hi-DPI, scales with devicePixelRatio)
- Page navigation (prev / next)
- Compress, extract pages, merge multiple PDFs, convert pages to images

### 📝 Office
- **DOCX** rendered as HTML preview via Mammoth.js
- **XLSX / XLS** rendered as an HTML table via SheetJS
- DOCX-to-PDF conversion via Mammoth + pdf-lib

### 📦 Generic
- Wrap any file in a **ZIP** archive (JSZip)
- Encode to **Base64**
- Customisable output filename

### General
- Minimalist **Brutalist UI** — high-contrast black & white, thick borders, system fonts
- Secure file handling: MIME-type validation, UUID-based filenames, auto-deletion after download
- 500 MB upload limit

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (no bundler) |
| Backend | Node.js, Express, Multer |
| Images (server) | [sharp](https://sharp.pixelplumbing.com/) |
| Video/Audio (server) | [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) |
| Audio preview | [WaveSurfer.js 6.6.4](https://wavesurfer.xyz/) (waveform, spectrogram, regions plugins) |
| Real-time spectrum | Web Audio API `AnalyserNode` + Canvas 2D |
| Video/Audio (client) | [FFmpeg.wasm 0.11.6](https://github.com/ffmpegwasm/ffmpeg.wasm) |
| PDF rendering | [PDF.js 3.11.174](https://mozilla.github.io/pdf.js/) |
| PDF manipulation | [pdf-lib 1.17.1](https://pdf-lib.js.org/) |
| Image crop | [Cropper.js 1.5.13](https://fengyuanchen.github.io/cropperjs/) |
| ZIP | [JSZip 3.10.1](https://stuk.github.io/jszip/) |
| DOCX preview | [Mammoth.js 1.6.0](https://github.com/mwilliamson/mammoth.js) |
| Excel preview | [SheetJS 0.18.5](https://sheetjs.com/) |

## Prerequisites

- **Node.js** v18 or later
- **FFmpeg** installed and available on `PATH` (required for server-side audio/video conversion)
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt install ffmpeg`
  - Windows: download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to `PATH`

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/SalvaGaR/file-converter-online.git
cd file-converter-online

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

The application will be available at **http://localhost:3000**.

For development with auto-restart on file changes:

```bash
npm run dev
```

## Usage

1. Open `http://localhost:3000` in your browser.
2. Drop a file onto the upload zone, or click to browse.
3. A preview panel opens automatically based on the file type.
4. For audio files you can switch between **Waveform**, **Spectrogram**, and **Real-time Spectrum** views using the toggle button.
5. Configure conversion options (format, quality, bitrate, trim, crop, etc.).
6. Click **CONVERT**.
7. Once conversion is complete, click **DOWNLOAD CONVERTED FILE**.

## Project Structure

```
file-converter-online/
├── server.js          # Express backend – upload, convert (sharp / fluent-ffmpeg), download
├── package.json
├── public/
│   ├── index.html     # Single-page UI
│   ├── style.css      # Minimalist Brutalism styles
│   ├── app.js         # Frontend logic: file detection, FFmpeg.wasm conversion, XHR upload
│   └── panels.js      # Panel renderers per file type + real-time spectrum
├── uploads/           # Temporary upload storage (auto-created, auto-cleaned)
└── outputs/           # Temporary output storage (auto-created, auto-cleaned)
```

## Security Notes

- File uploads are limited to **500 MB**.
- Only allowed MIME types are accepted (images, video, audio, PDF, office documents).
- Upload and output files are stored under UUID-based names, preventing directory traversal.
- Output files are deleted from the server immediately after download.

## License

MIT
