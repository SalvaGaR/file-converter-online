# FILE CONVERTER ONLINE

A full-stack web application for converting and compressing images, video, and audio files directly in the browser.

## Features

- **Image conversion & compression** – Convert between JPEG, PNG, WebP, AVIF, GIF, and TIFF with configurable quality.
- **Video conversion & compression** – Convert between MP4, WebM, MKV, AVI, and MOV with optional bitrate and resolution settings.
- **Audio conversion** – Convert between MP3, OGG, FLAC, AAC, M4A, and WAV with optional bitrate settings.
- **Minimalist Brutalism UI** – High-contrast black-and-white design, thick borders, and no unnecessary styling.
- **Secure file handling** – Files are validated by MIME type, stored temporarily with UUID-based names, and deleted after download.

## Tech Stack

| Layer    | Technology                      |
|----------|---------------------------------|
| Frontend | HTML, CSS, Vanilla JavaScript   |
| Backend  | Node.js, Express                |
| Images   | [sharp](https://sharp.pixelplumbing.com/) |
| Video/Audio | [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) (requires FFmpeg installed) |
| Upload   | multer                          |

## Prerequisites

- **Node.js** v18 or later
- **FFmpeg** installed and available on `PATH`
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
3. Choose the target format and configure optional compression/quality settings.
4. Click **CONVERT**.
5. Once conversion is complete, click **DOWNLOAD CONVERTED FILE**.

## Project Structure

```
file-converter-online/
├── server.js          # Express backend – upload, convert, download
├── package.json
├── public/
│   ├── index.html     # Single-page UI
│   ├── style.css      # Minimalist Brutalism styles
│   └── app.js         # Frontend logic (drag-and-drop, XHR upload, progress)
├── uploads/           # Temporary upload storage (auto-created, auto-cleaned)
└── outputs/           # Temporary output storage (auto-created, auto-cleaned)
```

## Security Notes

- File uploads are limited to **500 MB**.
- Only allowed MIME types are accepted (images, video, audio).
- Upload and output files are stored under UUID-based names, preventing directory traversal.
- Output files are deleted from the server immediately after download.

## License

MIT
