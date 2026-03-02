'use strict';

// ── Format maps ───────────────────────────────────────────────────────────────

const IMAGE_FORMATS = ['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff'];
const VIDEO_FORMATS = ['mp4', 'webm', 'mkv', 'avi', 'mov'];
const AUDIO_FORMATS = ['mp3', 'ogg', 'flac', 'aac', 'm4a', 'wav'];

const IMAGE_MIME_PREFIXES = ['image/'];
const VIDEO_MIME_PREFIXES = ['video/'];
const AUDIO_MIME_PREFIXES = ['audio/'];

function getFileCategory(mimeType) {
  if (!mimeType) return 'generic';
  if (mimeType === 'application/pdf') return 'pdf';
  if (IMAGE_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) return 'image';
  if (VIDEO_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) return 'video';
  if (AUDIO_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) return 'audio';
  return 'generic';
}

// ── DOM refs ──────────────────────────────────────────────────────────────────

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');

const optionsSection = document.getElementById('options-section');
const editSection = document.getElementById('edit-section');
const targetFormatSelect = document.getElementById('target-format');
const imageOptions = document.getElementById('image-options');
const videoOptions = document.getElementById('video-options');
const audioOptions = document.getElementById('audio-options');
const convertBtn = document.getElementById('convert-btn');

const resultSection = document.getElementById('result-section');
const progressBarContainer = document.getElementById('progress-bar-container');
const progressBar = document.getElementById('progress-bar');
const statusMsg = document.getElementById('status-msg');
const downloadLink = document.getElementById('download-link');
const resetBtn = document.getElementById('reset-btn');

// ── State ─────────────────────────────────────────────────────────────────────

let selectedFile = null;
let fileCategory = null;
let _ffmpeg = null;

// ── Drop zone interactions ────────────────────────────────────────────────────

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelected(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFileSelected(fileInput.files[0]);
});

// ── File selection ────────────────────────────────────────────────────────────

function handleFileSelected(file) {
  const category = getFileCategory(file.type);

  selectedFile = file;
  fileCategory = category;
  window._selectedPdfAction = null;

  fileInfo.textContent = `Selected: ${file.name} (${formatBytes(file.size)}) — ${file.type || 'unknown'}`;
  fileInfo.classList.remove('hidden');

  showEditPanel(category, file);

  if (category === 'image' || category === 'video' || category === 'audio') {
    populateFormats(category);
    showOptionsSection(category);
  } else if (category === 'pdf') {
    showOptionsSection('pdf');
  } else {
    optionsSection.classList.add('hidden');
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function populateFormats(category) {
  const formats = category === 'image'
    ? IMAGE_FORMATS
    : category === 'video'
      ? VIDEO_FORMATS
      : AUDIO_FORMATS;

  targetFormatSelect.innerHTML = '';
  for (const fmt of formats) {
    const opt = document.createElement('option');
    opt.value = fmt;
    opt.textContent = fmt.toUpperCase();
    targetFormatSelect.appendChild(opt);
  }
}

function showOptionsSection(category) {
  optionsSection.classList.remove('hidden');
  imageOptions.classList.add('hidden');
  videoOptions.classList.add('hidden');
  audioOptions.classList.add('hidden');

  const formatRow = targetFormatSelect.closest('.field-row');
  if (category === 'pdf') {
    if (formatRow) formatRow.classList.add('hidden');
  } else {
    if (formatRow) formatRow.classList.remove('hidden');
    if (category === 'image') imageOptions.classList.remove('hidden');
    else if (category === 'video') videoOptions.classList.remove('hidden');
    else if (category === 'audio') audioOptions.classList.remove('hidden');
  }
}

// ── Progress helper ───────────────────────────────────────────────────────────

function setProgress(pct) {
  progressBar.style.width = `${pct}%`;
}

// ── Image conversion via Canvas API ──────────────────────────────────────────

const MIME_MAP = {
  jpeg: 'image/jpeg', jpg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp',
  avif: 'image/avif', gif: 'image/gif', tiff: 'image/tiff',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', flac: 'audio/flac',
  aac: 'audio/aac', m4a: 'audio/mp4', wav: 'audio/wav',
  mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
  avi: 'video/x-msvideo', mov: 'video/quicktime',
  zip: 'application/zip', pdf: 'application/pdf',
};

function getMime(format) {
  return MIME_MAP[format.toLowerCase()] || 'application/octet-stream';
}

function convertImage(file, targetFormat, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (targetFormat === 'jpeg' || targetFormat === 'jpg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Image conversion failed.'));
      }, getMime(targetFormat), quality / 100);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for conversion.'));
    };
    img.src = url;
  });
}

// ── Video / Audio conversion via ffmpeg.wasm ─────────────────────────────────

async function loadFFmpeg() {
  if (_ffmpeg && _ffmpeg.isLoaded()) return _ffmpeg;

  statusMsg.textContent = 'LOADING FFMPEG ENGINE… (FIRST TIME MAY TAKE A MOMENT)';
  setProgress(5);

  const { createFFmpeg } = FFmpeg;
  _ffmpeg = createFFmpeg({
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    log: false,
    progress: ({ ratio }) => {
      if (ratio > 0) setProgress(Math.min(Math.round(ratio * 90), 90));
    },
  });

  await _ffmpeg.load();
  return _ffmpeg;
}

async function convertWithFFmpeg(file, targetFormat, options) {
  const ff = await loadFFmpeg();
  const { fetchFile } = FFmpeg;

  const inputExt = (file.name.split('.').pop() || 'bin').toLowerCase();
  const inputName = `input.${inputExt}`;
  const outputName = `output.${targetFormat}`;

  statusMsg.textContent = 'WRITING FILE TO MEMORY…';
  ff.FS('writeFile', inputName, await fetchFile(file));

  statusMsg.textContent = 'CONVERTING…';

  const args = ['-i', inputName];

  const trimStart = parseFloat(options.trimStart);
  const trimEnd = parseFloat(options.trimEnd);
  if (!isNaN(trimStart) && trimStart > 0) args.push('-ss', String(trimStart));
  if (!isNaN(trimEnd) && trimEnd > 0) args.push('-to', String(trimEnd));

  if (options.videoBitrate) args.push('-b:v', `${options.videoBitrate}k`);
  if (options.resolution) args.push('-vf', `scale=${options.resolution}:-2`);
  if (options.audioBitrate) args.push('-b:a', `${options.audioBitrate}k`);

  args.push(outputName);

  await ff.run(...args);

  const data = ff.FS('readFile', outputName);
  ff.FS('unlink', inputName);
  try { ff.FS('unlink', outputName); } catch (_) { /* ignore */ }

  return new Blob([data.buffer], { type: getMime(targetFormat) });
}

// ── PDF operations via pdf-lib ────────────────────────────────────────────────

function parsePageRange(rangeStr, totalPages) {
  const pages = new Set();
  for (const part of rangeStr.split(',')) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [a, b] = trimmed.split('-').map((n) => parseInt(n.trim(), 10));
      if (!isNaN(a) && !isNaN(b)) {
        for (let i = a; i <= Math.min(b, totalPages); i++) {
          if (i >= 1) pages.add(i);
        }
      }
    } else {
      const n = parseInt(trimmed, 10);
      if (!isNaN(n) && n >= 1 && n <= totalPages) pages.add(n);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

async function executePdfAction() {
  const action = window._selectedPdfAction;
  if (!action) throw new Error('Please select a PDF action from the panel above.');

  if (action === 'pdf-to-word') {
    throw new Error('PDF to Word conversion is not supported in the browser. Please use a dedicated online converter.');
  }

  const { PDFDocument } = PDFLib;

  if (action === 'pdf-compress') {
    const bytes = await selectedFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  if (action === 'pdf-extract') {
    const rangeInput = document.getElementById('page-range');
    const rangeStr = (rangeInput.value || '').trim();
    if (!rangeStr) throw new Error('Please enter a page range (e.g. 1-5).');

    const bytes = await selectedFile.arrayBuffer();
    const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();
    const pageNums = parsePageRange(rangeStr, totalPages);
    if (pageNums.length === 0) throw new Error('No valid pages found in the specified range.');

    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(srcDoc, pageNums.map((n) => n - 1));
    copied.forEach((p) => newDoc.addPage(p));
    const pdfBytes = await newDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  if (action === 'pdf-merge') {
    const mergeInput = document.getElementById('pdf-merge-input');
    if (!mergeInput.files[0]) throw new Error('Please select a second PDF file to merge.');

    const [bytes1, bytes2] = await Promise.all([
      selectedFile.arrayBuffer(),
      mergeInput.files[0].arrayBuffer(),
    ]);
    const [doc1, doc2] = await Promise.all([
      PDFDocument.load(bytes1, { ignoreEncryption: true }),
      PDFDocument.load(bytes2, { ignoreEncryption: true }),
    ]);

    const mergedDoc = await PDFDocument.create();
    const pages1 = await mergedDoc.copyPages(doc1, doc1.getPageIndices());
    const pages2 = await mergedDoc.copyPages(doc2, doc2.getPageIndices());
    pages1.forEach((p) => mergedDoc.addPage(p));
    pages2.forEach((p) => mergedDoc.addPage(p));
    const pdfBytes = await mergedDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  if (action === 'pdf-to-images') {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js not loaded.');
    const bytes = await selectedFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

    if (typeof JSZip !== 'undefined') {
      const zip = new JSZip();
      for (let i = 1; i <= pdf.numPages; i++) {
        setProgress(Math.round((i / pdf.numPages) * 85));
        statusMsg.textContent = `RENDERING PAGE ${i} OF ${pdf.numPages}…`;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const pngBuf = await new Promise((res) => canvas.toBlob((b) => b.arrayBuffer().then(res), 'image/png'));
        zip.file(`page-${String(i).padStart(3, '0')}.png`, pngBuf);
      }
      return zip.generateAsync({ type: 'blob' });
    }

    // Fallback: download page 1 only
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  throw new Error('Unknown PDF action selected.');
}

// ── Generic panel handlers ────────────────────────────────────────────────────

document.getElementById('btn-base64').addEventListener('click', function () {
  if (!selectedFile) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const blob = new Blob([e.target.result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    resultSection.classList.remove('hidden');
    progressBarContainer.classList.add('hidden');
    statusMsg.textContent = 'BASE64 ENCODED.';
    downloadLink.href = url;
    downloadLink.download = selectedFile.name + '.base64.txt';
    downloadLink.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
  };
  reader.readAsDataURL(selectedFile);
});

document.getElementById('btn-zip').addEventListener('click', async function () {
  if (!selectedFile || typeof JSZip === 'undefined') return;
  resultSection.classList.remove('hidden');
  progressBarContainer.classList.add('hidden');
  statusMsg.textContent = 'CREATING ZIP…';
  const zip = new JSZip();
  zip.file(selectedFile.name, await selectedFile.arrayBuffer());
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  statusMsg.textContent = 'ZIP CREATED.';
  downloadLink.href = url;
  downloadLink.download = selectedFile.name + '.zip';
  downloadLink.classList.remove('hidden');
  resetBtn.classList.remove('hidden');
});

// ── Conversion ────────────────────────────────────────────────────────────────

convertBtn.addEventListener('click', startConversion);

async function startConversion() {
  if (!selectedFile) return;

  convertBtn.disabled = true;
  resultSection.classList.remove('hidden');
  progressBarContainer.classList.remove('hidden');
  setProgress(0);
  statusMsg.textContent = 'PROCESSING…';
  downloadLink.classList.add('hidden');
  resetBtn.classList.add('hidden');

  try {
    let blob;
    let filename;

    if (fileCategory === 'image') {
      const format = targetFormatSelect.value;
      const quality = parseInt(document.getElementById('quality').value, 10);
      setProgress(10);
      statusMsg.textContent = 'CONVERTING IMAGE…';
      blob = await convertImage(selectedFile, format, quality);
      filename = `converted.${format}`;
      setProgress(100);
    } else if (fileCategory === 'video') {
      const format = targetFormatSelect.value;
      blob = await convertWithFFmpeg(selectedFile, format, {
        videoBitrate: document.getElementById('video-bitrate').value,
        resolution: document.getElementById('resolution').value,
        audioBitrate: document.getElementById('audio-bitrate-v').value,
        trimStart: document.getElementById('video-trim-start').value,
        trimEnd: document.getElementById('video-trim-end').value,
      });
      filename = `converted.${format}`;
      setProgress(100);
    } else if (fileCategory === 'audio') {
      const format = targetFormatSelect.value;
      blob = await convertWithFFmpeg(selectedFile, format, {
        audioBitrate: document.getElementById('audio-bitrate').value,
        trimStart: document.getElementById('audio-trim-start').value,
        trimEnd: document.getElementById('audio-trim-end').value,
      });
      filename = `converted.${format}`;
      setProgress(100);
    } else if (fileCategory === 'pdf') {
      setProgress(10);
      blob = await executePdfAction();
      const action = window._selectedPdfAction;
      filename = action === 'pdf-to-images' ? 'pages.zip' : 'result.pdf';
      setProgress(100);
    }

    if (blob) {
      const url = URL.createObjectURL(blob);
      statusMsg.textContent = 'CONVERSION COMPLETE.';
      downloadLink.href = url;
      downloadLink.download = filename;
      downloadLink.classList.remove('hidden');
      resetBtn.classList.remove('hidden');
    } else {
      statusMsg.textContent = 'NOTHING TO CONVERT.';
      convertBtn.disabled = false;
      resetBtn.classList.remove('hidden');
    }
  } catch (err) {
    progressBarContainer.classList.add('hidden');
    statusMsg.textContent = `ERROR: ${err.message}`;
    convertBtn.disabled = false;
    resetBtn.classList.remove('hidden');
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────

resetBtn.addEventListener('click', () => {
  selectedFile = null;
  fileCategory = null;
  window._selectedPdfAction = null;
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  editSection.classList.add('hidden');
  cleanupPanels();
  optionsSection.classList.add('hidden');
  resultSection.classList.add('hidden');
  progressBarContainer.classList.add('hidden');
  progressBar.style.width = '0%';
  downloadLink.classList.add('hidden');
  resetBtn.classList.add('hidden');
  convertBtn.disabled = false;
  statusMsg.textContent = '';

  const formatRow = targetFormatSelect.closest('.field-row');
  if (formatRow) formatRow.classList.remove('hidden');
});
