'use strict';

// ── Object URL tracking for cleanup ──────────────────────────────────────────

const _objectURLs = [];

function _createURL(file) {
  const url = URL.createObjectURL(file);
  _objectURLs.push(url);
  return url;
}

function cleanupPanels() {
  _objectURLs.forEach((u) => URL.revokeObjectURL(u));
  _objectURLs.length = 0;

  const audio = document.getElementById('preview-audio');
  const video = document.getElementById('preview-video');
  if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
}

// ── Panel visibility ─────────────────────────────────────────────────────────

function showEditPanel(category, file) {
  const section = document.getElementById('edit-section');
  const panels = document.querySelectorAll('.edit-panel');
  panels.forEach((p) => p.classList.add('hidden'));

  section.classList.remove('hidden');

  const renderers = {
    image: renderImagePanel,
    audio: renderAudioPanel,
    video: renderVideoPanel,
    pdf: renderPdfPanel,
    generic: renderGenericPanel,
  };

  const render = renderers[category] || renderGenericPanel;
  render(file);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function _formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

// ── Image panel ──────────────────────────────────────────────────────────────

function renderImagePanel(file) {
  const panel = document.getElementById('panel-image');
  const img = document.getElementById('preview-image');
  const slider = document.getElementById('compress-slider');
  const valLabel = document.getElementById('compress-value');
  const sizeLabel = document.getElementById('estimated-size');

  panel.classList.remove('hidden');
  img.src = _createURL(file);

  const originalSize = file.size;
  slider.value = 80;
  valLabel.textContent = '80';

  function updateEstimate() {
    const q = parseInt(slider.value, 10);
    valLabel.textContent = q;
    const est = originalSize * (q / 100);
    sizeLabel.textContent = 'ESTIMATED SIZE: ' + _formatBytes(est);
  }

  updateEstimate();
  slider.oninput = updateEstimate;
}

// ── Audio panel ──────────────────────────────────────────────────────────────

function renderAudioPanel(file) {
  const panel = document.getElementById('panel-audio');
  const audio = document.getElementById('preview-audio');
  const playBtn = document.getElementById('audio-play');
  const pauseBtn = document.getElementById('audio-pause');
  const stopBtn = document.getElementById('audio-stop');
  const trimStart = document.getElementById('audio-trim-start');
  const trimEnd = document.getElementById('audio-trim-end');
  const trimStartVal = document.getElementById('audio-trim-start-val');
  const trimEndVal = document.getElementById('audio-trim-end-val');
  const durInfo = document.getElementById('audio-duration-info');
  const brInfo = document.getElementById('audio-bitrate-info');
  const srInfo = document.getElementById('audio-samplerate-info');
  const metaTitle = document.getElementById('meta-title');

  panel.classList.remove('hidden');
  audio.src = _createURL(file);

  // Default metadata title to file name
  metaTitle.value = file.name.replace(/\.[^.]+$/, '');

  audio.addEventListener('loadedmetadata', function onMeta() {
    audio.removeEventListener('loadedmetadata', onMeta);
    const dur = audio.duration || 0;

    trimStart.max = dur;
    trimEnd.max = dur;
    trimStart.value = 0;
    trimEnd.value = dur;
    trimStartVal.textContent = '0.0';
    trimEndVal.textContent = dur.toFixed(1);

    durInfo.textContent = 'DURATION: ' + _formatTime(dur);

    // Simulated info based on file size and duration
    const bitrateKbps = dur > 0 ? Math.round((file.size * 8) / dur / 1000) : 0;
    brInfo.textContent = 'BITRATE: ~' + bitrateKbps + ' KBPS';
    srInfo.textContent = 'SAMPLE RATE: ~44100 HZ';
  });

  trimStart.oninput = function () {
    trimStartVal.textContent = parseFloat(this.value).toFixed(1);
  };
  trimEnd.oninput = function () {
    trimEndVal.textContent = parseFloat(this.value).toFixed(1);
  };

  // Transport controls
  playBtn.onclick = function () {
    const start = parseFloat(trimStart.value);
    if (audio.currentTime < start) audio.currentTime = start;
    audio.play();
  };
  pauseBtn.onclick = function () { audio.pause(); };
  stopBtn.onclick = function () {
    audio.pause();
    audio.currentTime = parseFloat(trimStart.value);
  };

  // Respect trim end point
  audio.ontimeupdate = function () {
    const end = parseFloat(trimEnd.value);
    if (audio.currentTime >= end) {
      audio.pause();
      audio.currentTime = end;
    }
  };
}

// ── Video panel ──────────────────────────────────────────────────────────────

function renderVideoPanel(file) {
  const panel = document.getElementById('panel-video');
  const video = document.getElementById('preview-video');
  const trimStart = document.getElementById('video-trim-start');
  const trimEnd = document.getElementById('video-trim-end');
  const trimStartVal = document.getElementById('video-trim-start-val');
  const trimEndVal = document.getElementById('video-trim-end-val');

  panel.classList.remove('hidden');
  video.src = _createURL(file);
  video.controls = true;

  video.addEventListener('loadedmetadata', function onMeta() {
    video.removeEventListener('loadedmetadata', onMeta);
    const dur = video.duration || 0;

    trimStart.max = dur;
    trimEnd.max = dur;
    trimStart.value = 0;
    trimEnd.value = dur;
    trimStartVal.textContent = '0.0';
    trimEndVal.textContent = dur.toFixed(1);
  });

  trimStart.oninput = function () {
    trimStartVal.textContent = parseFloat(this.value).toFixed(1);
    video.currentTime = parseFloat(this.value);
  };
  trimEnd.oninput = function () {
    trimEndVal.textContent = parseFloat(this.value).toFixed(1);
  };

  // Respect trim points
  video.ontimeupdate = function () {
    const end = parseFloat(trimEnd.value);
    if (video.currentTime >= end) {
      video.pause();
      video.currentTime = end;
    }
  };

  video.onplay = function () {
    const start = parseFloat(trimStart.value);
    if (video.currentTime < start) video.currentTime = start;
  };
}

// ── PDF panel ────────────────────────────────────────────────────────────────

function renderPdfPanel(_file) {
  const panel = document.getElementById('panel-pdf');
  const mergeZone = document.getElementById('pdf-merge-zone');
  const extractRange = document.getElementById('pdf-extract-range');
  const mergeInput = document.getElementById('pdf-merge-input');
  const pdfDropZone = document.getElementById('pdf-drop-zone');

  panel.classList.remove('hidden');
  mergeZone.classList.add('hidden');
  extractRange.classList.add('hidden');

  const grid = document.getElementById('pdf-options-grid');
  grid.onclick = function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    mergeZone.classList.add('hidden');
    extractRange.classList.add('hidden');

    if (btn.dataset.action === 'pdf-merge') {
      mergeZone.classList.remove('hidden');
    } else if (btn.dataset.action === 'pdf-extract') {
      extractRange.classList.remove('hidden');
    }
  };

  // Wire up the merge drop zone click
  pdfDropZone.onclick = function () { mergeInput.click(); };
}

// ── Generic panel ────────────────────────────────────────────────────────────

function renderGenericPanel(file) {
  const panel = document.getElementById('panel-generic');
  const nameEl = document.getElementById('generic-name');
  const extEl = document.getElementById('generic-ext');
  const sizeEl = document.getElementById('generic-size');

  panel.classList.remove('hidden');

  const ext = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : '—';
  nameEl.textContent = 'NAME: ' + file.name;
  extEl.textContent = 'EXTENSION: .' + ext;
  sizeEl.textContent = 'SIZE: ' + _formatBytes(file.size);
}
