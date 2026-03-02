'use strict';

// ── Object URL tracking for cleanup ──────────────────────────────────────────

const _objectURLs = [];
let _waveSurfer = null;

function _createURL(file) {
  const url = URL.createObjectURL(file);
  _objectURLs.push(url);
  return url;
}

function cleanupPanels() {
  _objectURLs.forEach((u) => URL.revokeObjectURL(u));
  _objectURLs.length = 0;

  if (_waveSurfer) {
    _waveSurfer.destroy();
    _waveSurfer = null;
  }

  const video = document.getElementById('preview-video');
  if (video) { video.pause(); video.removeAttribute('src'); video.load(); }

  const pdfPreview = document.getElementById('pdf-preview');
  if (pdfPreview) pdfPreview.innerHTML = '';
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

// ── Audio panel (WaveSurfer waveform) ────────────────────────────────────────

function renderAudioPanel(file) {
  const panel = document.getElementById('panel-audio');
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
  metaTitle.value = file.name.replace(/\.[^.]+$/, '');

  // Destroy any previous WaveSurfer instance
  if (_waveSurfer) {
    _waveSurfer.destroy();
    _waveSurfer = null;
  }

  _waveSurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#000000',
    progressColor: '#555555',
    cursorColor: '#000000',
    height: 80,
    barWidth: 2,
    responsive: true,
    hideScrollbar: true,
  });

  const audioUrl = _createURL(file);
  _waveSurfer.load(audioUrl);

  _waveSurfer.on('ready', function () {
    const dur = _waveSurfer.getDuration();

    trimStart.max = dur;
    trimEnd.max = dur;
    trimStart.value = 0;
    trimEnd.value = dur;
    trimStartVal.textContent = '0.0';
    trimEndVal.textContent = dur.toFixed(1);

    durInfo.textContent = 'DURATION: ' + _formatTime(dur);
    const bitrateKbps = dur > 0 ? Math.round((file.size * 8) / dur / 1000) : 0;
    brInfo.textContent = 'BITRATE: ~' + bitrateKbps + ' KBPS';
  });

  _waveSurfer.on('audioprocess', function (time) {
    const end = parseFloat(trimEnd.value);
    if (time >= end) {
      _waveSurfer.pause();
      const dur = _waveSurfer.getDuration();
      if (dur > 0) _waveSurfer.seekTo(end / dur);
    }
  });

  // Get sample rate via Web Audio API
  srInfo.textContent = 'SAMPLE RATE: —';
  file.arrayBuffer().then(function (buf) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx.decodeAudioData(buf).then(function (decoded) {
      srInfo.textContent = 'SAMPLE RATE: ' + decoded.sampleRate + ' HZ';
      ctx.close();
    });
  }).catch(function () {
    srInfo.textContent = 'SAMPLE RATE: N/A';
  });

  trimStart.oninput = function () {
    trimStartVal.textContent = parseFloat(this.value).toFixed(1);
  };
  trimEnd.oninput = function () {
    trimEndVal.textContent = parseFloat(this.value).toFixed(1);
  };

  playBtn.onclick = function () {
    const start = parseFloat(trimStart.value);
    const dur = _waveSurfer.getDuration();
    if (dur > 0 && _waveSurfer.getCurrentTime() < start) {
      _waveSurfer.seekTo(start / dur);
    }
    _waveSurfer.play();
  };
  pauseBtn.onclick = function () { _waveSurfer.pause(); };
  stopBtn.onclick = function () {
    _waveSurfer.stop();
    const start = parseFloat(trimStart.value);
    const dur = _waveSurfer.getDuration();
    if (dur > 0) _waveSurfer.seekTo(start / dur);
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

// ── PDF panel (pdf.js preview + pdf-lib actions) ─────────────────────────────

async function renderPdfPanel(file) {
  const panel = document.getElementById('panel-pdf');
  const mergeZone = document.getElementById('pdf-merge-zone');
  const extractRange = document.getElementById('pdf-extract-range');
  const mergeInput = document.getElementById('pdf-merge-input');
  const pdfDropZone = document.getElementById('pdf-drop-zone');
  const pdfPreview = document.getElementById('pdf-preview');

  panel.classList.remove('hidden');
  mergeZone.classList.add('hidden');
  extractRange.classList.add('hidden');
  window._selectedPdfAction = null;

  // Render PDF preview with pdf.js
  if (typeof pdfjsLib !== 'undefined' && pdfPreview) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    pdfPreview.innerHTML = '<p class="info-text">LOADING PREVIEW…</p>';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfPreview.innerHTML = '';

      const pageCount = document.createElement('p');
      pageCount.className = 'info-text';
      pageCount.textContent = `PDF: ${pdf.numPages} PAGE${pdf.numPages !== 1 ? 'S' : ''}`;
      pdfPreview.appendChild(pageCount);

      const numToRender = Math.min(pdf.numPages, 5);
      for (let i = 1; i <= numToRender; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.6 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.title = `Page ${i}`;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        pdfPreview.appendChild(canvas);
      }

      if (pdf.numPages > 5) {
        const more = document.createElement('p');
        more.className = 'info-text';
        more.textContent = `… AND ${pdf.numPages - 5} MORE PAGE${pdf.numPages - 5 !== 1 ? 'S' : ''}`;
        pdfPreview.appendChild(more);
      }
    } catch (previewErr) {
      console.warn('PDF preview error:', previewErr);
      pdfPreview.innerHTML = '<p class="info-text">COULD NOT RENDER PREVIEW.</p>';
    }
  }

  // Wire up action buttons
  const grid = document.getElementById('pdf-options-grid');
  grid.onclick = function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    mergeZone.classList.add('hidden');
    extractRange.classList.add('hidden');

    grid.querySelectorAll('.grid-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    window._selectedPdfAction = btn.dataset.action;

    if (btn.dataset.action === 'pdf-merge') {
      mergeZone.classList.remove('hidden');
    } else if (btn.dataset.action === 'pdf-extract') {
      extractRange.classList.remove('hidden');
    }
  };

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
