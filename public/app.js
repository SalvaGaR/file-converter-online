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

  fileInfo.textContent = `Selected: ${file.name} (${formatBytes(file.size)}) — ${file.type || 'unknown'}`;
  fileInfo.classList.remove('hidden');

  showEditPanel(category, file);

  if (category === 'image' || category === 'video' || category === 'audio') {
    populateFormats(category);
    showOptionsSection(category);
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

  if (category === 'image') imageOptions.classList.remove('hidden');
  else if (category === 'video') videoOptions.classList.remove('hidden');
  else if (category === 'audio') audioOptions.classList.remove('hidden');
}

// ── Conversion ────────────────────────────────────────────────────────────────

convertBtn.addEventListener('click', startConversion);

async function startConversion() {
  if (!selectedFile) return;

  convertBtn.disabled = true;
  resultSection.classList.remove('hidden');
  progressBarContainer.classList.remove('hidden');
  progressBar.style.width = '0%';
  statusMsg.textContent = 'UPLOADING AND CONVERTING…';
  downloadLink.classList.add('hidden');
  resetBtn.classList.add('hidden');

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('targetFormat', targetFormatSelect.value);

  if (fileCategory === 'image') {
    formData.append('quality', document.getElementById('quality').value);
  } else if (fileCategory === 'video') {
    const vb = document.getElementById('video-bitrate').value;
    const res = document.getElementById('resolution').value;
    const ab = document.getElementById('audio-bitrate-v').value;
    if (vb) formData.append('videoBitrate', vb);
    if (res) formData.append('resolution', res);
    if (ab) formData.append('audioBitrate', ab);
  } else if (fileCategory === 'audio') {
    const ab = document.getElementById('audio-bitrate').value;
    if (ab) formData.append('audioBitrate', ab);
  }

  // Simulate upload progress using XHR
  try {
    const token = await uploadWithProgress(formData);
    progressBar.style.width = '100%';
    statusMsg.textContent = 'CONVERSION COMPLETE.';
    downloadLink.href = `/download/${encodeURIComponent(token)}`;
    downloadLink.download = `converted.${targetFormatSelect.value}`;
    downloadLink.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
  } catch (err) {
    progressBarContainer.classList.add('hidden');
    statusMsg.textContent = `ERROR: ${err.message}`;
    convertBtn.disabled = false;
    resetBtn.classList.remove('hidden');
  }
}

function uploadWithProgress(formData) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 80); // 0–80 % for upload
        progressBar.style.width = `${pct}%`;
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        progressBar.style.width = '90%';
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (_) {
          return reject(new Error('Invalid server response.'));
        }
        if (data.error) return reject(new Error(data.error));
        resolve(data.downloadToken);
      } else {
        let msg = `Server error (${xhr.status})`;
        try {
          const d = JSON.parse(xhr.responseText);
          if (d.error) msg = d.error;
        } catch (_) { /* ignore */ }
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted.')));

    xhr.open('POST', '/convert');
    xhr.send(formData);
  });
}

// ── Reset ─────────────────────────────────────────────────────────────────────

resetBtn.addEventListener('click', () => {
  selectedFile = null;
  fileCategory = null;
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
});
