'use strict';

// ── Object URL tracking for cleanup ──────────────────────────────────────────

const _objectURLs = [];
let _waveSurfer = null;
let _imageCropper = null;
let _flipH = 1;
let _flipV = 1;

// Conversion constants
const BITS_PER_BYTE = 8;
const BITS_PER_KILOBIT = 1000;
const PDF_RENDER_BASE_SCALE = 1.5;

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

  if (_imageCropper) {
    _imageCropper.destroy();
    _imageCropper = null;
  }

  const video = document.getElementById('preview-video');
  if (video) { video.pause(); video.removeAttribute('src'); video.load(); }

  const pdfPreview = document.getElementById('pdf-preview');
  if (pdfPreview) pdfPreview.innerHTML = '';

  const officePreview = document.getElementById('office-preview');
  if (officePreview) officePreview.innerHTML = '';
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
    office: renderOfficePanel,
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

  panel.classList.remove('hidden');

  // Destroy any previous cropper before loading new image
  if (_imageCropper) {
    _imageCropper.destroy();
    _imageCropper = null;
  }

  img.src = _createURL(file);

  _flipH = 1;
  _flipV = 1;

  img.onload = function () {
    if (typeof Cropper !== 'undefined') {
      _imageCropper = new Cropper(img, {
        viewMode: 1,
        autoCropArea: 1,
        responsive: true,
        background: false,
      });
    }
  };

  document.getElementById('btn-rotate-cw').onclick = function () {
    if (_imageCropper) _imageCropper.rotate(90);
  };
  document.getElementById('btn-flip-h').onclick = function () {
    if (_imageCropper) {
      _flipH *= -1;
      _imageCropper.scaleX(_flipH);
    }
  };
  document.getElementById('btn-flip-v').onclick = function () {
    if (_imageCropper) {
      _flipV *= -1;
      _imageCropper.scaleY(_flipV);
    }
  };
}

// ── Audio panel (WaveSurfer waveform + spectrogram + regions) ─────────────────

function renderAudioPanel(file) {
  const panel = document.getElementById('panel-audio');
  const playBtn = document.getElementById('audio-play');
  const pauseBtn = document.getElementById('audio-pause');
  const stopBtn = document.getElementById('audio-stop');
  const toggleBtn = document.getElementById('audio-view-toggle');
  const waveformEl = document.getElementById('waveform');
  const spectrogramEl = document.getElementById('spectrogram');
  const trimStart = document.getElementById('audio-trim-start');
  const trimEnd = document.getElementById('audio-trim-end');
  const timeCounter = document.getElementById('audio-time-counter');
  const durInfo = document.getElementById('audio-duration-info');
  const brInfo = document.getElementById('audio-bitrate-info');
  const srInfo = document.getElementById('audio-samplerate-info');
  const metaTitle = document.getElementById('meta-title');

  panel.classList.remove('hidden');
  metaTitle.value = file.name.replace(/\.[^.]+$/, '');

  // Reset view to waveform
  waveformEl.classList.remove('hidden');
  spectrogramEl.classList.add('hidden');
  toggleBtn.textContent = 'VIEW: SPECTROGRAM';

  // Destroy any previous WaveSurfer instance
  if (_waveSurfer) {
    _waveSurfer.destroy();
    _waveSurfer = null;
  }

  const plugins = [];
  if (typeof WaveSurfer.regions !== 'undefined') {
    plugins.push(WaveSurfer.regions.create());
  }
  if (typeof WaveSurfer.spectrogram !== 'undefined') {
    plugins.push(WaveSurfer.spectrogram.create({
      container: '#spectrogram',
      labels: false,
      height: 128,
    }));
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
    backend: 'WebAudio',
    plugins: plugins,
  });

  const audioUrl = _createURL(file);
  _waveSurfer.load(audioUrl);

  let _trimRegion = null;

  _waveSurfer.on('ready', function () {
    const dur = _waveSurfer.getDuration();

    trimStart.max = dur;
    trimEnd.max = dur;
    trimStart.value = (0).toFixed(1);
    trimEnd.value = dur.toFixed(1);

    timeCounter.textContent = _formatTime(0) + ' / ' + _formatTime(dur);
    durInfo.textContent = 'DURATION: ' + _formatTime(dur);
    const bitrateKbps = dur > 0 ? Math.round((file.size * BITS_PER_BYTE) / dur / BITS_PER_KILOBIT) : 0;
    brInfo.textContent = 'BITRATE: ~' + bitrateKbps + ' KBPS';

    // Create visual trim region
    if (_waveSurfer.addRegion) {
      _trimRegion = _waveSurfer.addRegion({
        start: 0,
        end: dur,
        color: 'rgba(0, 0, 0, 0.1)',
        drag: true,
        resize: true,
      });
    }
  });

  // Sync region handles → numeric inputs (bidirectional)
  _waveSurfer.on('region-updated', function (region) {
    trimStart.value = region.start.toFixed(1);
    trimEnd.value = region.end.toFixed(1);
  });

  _waveSurfer.on('audioprocess', function (time) {
    const dur = _waveSurfer.getDuration();
    timeCounter.textContent = _formatTime(time) + ' / ' + _formatTime(dur);
    const end = parseFloat(trimEnd.value);
    if (time >= end) {
      _waveSurfer.pause();
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

  // Sync numeric inputs → region (bidirectional)
  trimStart.oninput = function () {
    const start = parseFloat(this.value);
    const end = parseFloat(trimEnd.value);
    if (!isNaN(start) && start < end && _trimRegion) _trimRegion.update({ start: start });
  };
  trimEnd.oninput = function () {
    const end = parseFloat(this.value);
    const start = parseFloat(trimStart.value);
    if (!isNaN(end) && end > start && _trimRegion) _trimRegion.update({ end: end });
  };

  // Toggle waveform / spectrogram view
  toggleBtn.onclick = function () {
    const showingWave = !waveformEl.classList.contains('hidden');
    if (showingWave) {
      waveformEl.classList.add('hidden');
      spectrogramEl.classList.remove('hidden');
      toggleBtn.textContent = 'VIEW: WAVEFORM';
    } else {
      spectrogramEl.classList.add('hidden');
      waveformEl.classList.remove('hidden');
      toggleBtn.textContent = 'VIEW: SPECTROGRAM';
    }
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
  const durInfo = document.getElementById('video-duration-info');
  const resInfo = document.getElementById('video-resolution-info');
  const brInfo = document.getElementById('video-bitrate-info');

  panel.classList.remove('hidden');
  video.src = _createURL(file);
  video.controls = true;

  // Live estimated size in the options section
  const videoBitrateInput = document.getElementById('video-bitrate');
  const audioBitrateInput = document.getElementById('audio-bitrate-v');
  const estSizeLabel = document.getElementById('video-estimated-size');

  let _videoDuration = 0;

  function updateEstimatedSize() {
    if (!estSizeLabel || _videoDuration <= 0) return;
    const vbr = parseFloat(videoBitrateInput.value) || 0;
    const abr = parseFloat(audioBitrateInput.value) || 0;
    if (vbr <= 0 && abr <= 0) {
      estSizeLabel.textContent = '';
      return;
    }
    const totalKbps = vbr + abr;
    const bytes = (totalKbps * BITS_PER_KILOBIT / BITS_PER_BYTE) * _videoDuration;
    estSizeLabel.textContent = 'ESTIMATED OUTPUT SIZE: ' + _formatBytes(bytes);
  }

  if (videoBitrateInput) videoBitrateInput.oninput = updateEstimatedSize;
  if (audioBitrateInput) audioBitrateInput.oninput = updateEstimatedSize;

  video.addEventListener('loadedmetadata', function onMeta() {
    video.removeEventListener('loadedmetadata', onMeta);
    const dur = video.duration || 0;
    _videoDuration = dur;

    trimStart.max = dur;
    trimEnd.max = dur;
    trimStart.value = 0;
    trimEnd.value = dur;
    trimStartVal.textContent = '0.0';
    trimEndVal.textContent = dur.toFixed(1);

    durInfo.textContent = 'DURATION: ' + _formatTime(dur);
    resInfo.textContent = 'RESOLUTION: ' + video.videoWidth + ' × ' + video.videoHeight;
    const bitrateKbps = dur > 0 ? Math.round((file.size * BITS_PER_BYTE) / dur / BITS_PER_KILOBIT) : 0;
    brInfo.textContent = 'ESTIMATED BITRATE: ~' + bitrateKbps + ' KBPS';
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
  const pdfNav = document.getElementById('pdf-nav');
  const pdfPrev = document.getElementById('pdf-prev');
  const pdfNext = document.getElementById('pdf-next');
  const pdfPageInfo = document.getElementById('pdf-page-info');

  panel.classList.remove('hidden');
  mergeZone.classList.add('hidden');
  extractRange.classList.add('hidden');
  pdfNav.classList.add('hidden');
  window._selectedPdfAction = null;

  // Render PDF preview with pdf.js (single page, hi-DPI)
  if (typeof pdfjsLib !== 'undefined' && pdfPreview) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    pdfPreview.innerHTML = '<p class="info-text">LOADING PREVIEW…</p>';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let currentPage = 1;
      const totalPages = pdf.numPages;

      async function renderPage(pageNum) {
        pdfPreview.innerHTML = '';
        const page = await pdf.getPage(pageNum);
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: PDF_RENDER_BASE_SCALE * dpr });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = (viewport.width / dpr) + 'px';
        canvas.style.height = (viewport.height / dpr) + 'px';
        canvas.title = 'Page ' + pageNum;

        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        pdfPreview.appendChild(canvas);

        pdfPageInfo.textContent = 'PAGE ' + pageNum + ' OF ' + totalPages;
        pdfPrev.disabled = pageNum <= 1;
        pdfNext.disabled = pageNum >= totalPages;
      }

      await renderPage(currentPage);
      pdfNav.classList.remove('hidden');

      pdfPrev.onclick = async function () {
        if (currentPage > 1) {
          currentPage--;
          await renderPage(currentPage);
        }
      };
      pdfNext.onclick = async function () {
        if (currentPage < totalPages) {
          currentPage++;
          await renderPage(currentPage);
        }
      };
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

// ── Office panel (Mammoth.js for DOCX, SheetJS for Excel) ────────────────────

async function renderOfficePanel(file) {
  const panel = document.getElementById('panel-office');
  const preview = document.getElementById('office-preview');
  const nameEl = document.getElementById('office-name');
  const sizeEl = document.getElementById('office-size');
  const optionsGrid = document.getElementById('office-options-grid');
  const docxBtn = optionsGrid.querySelector('[data-action="docx-to-pdf"]');

  panel.classList.remove('hidden');
  preview.innerHTML = '<p class="info-text">LOADING PREVIEW…</p>';
  nameEl.textContent = 'NAME: ' + file.name;
  sizeEl.textContent = 'SIZE: ' + _formatBytes(file.size);

  const ext = file.name.split('.').pop().toLowerCase();
  const isDocx = ext === 'docx';
  const isExcel = ext === 'xlsx' || ext === 'xls' || ext === 'csv';

  // Show DOCX-to-PDF button only for DOCX files
  if (docxBtn) docxBtn.classList.toggle('hidden', !isDocx);

  window._selectedOfficeAction = null;

  optionsGrid.onclick = function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    optionsGrid.querySelectorAll('.grid-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    window._selectedOfficeAction = btn.dataset.action;
  };

  try {
    const arrayBuffer = await file.arrayBuffer();

    if (isDocx && typeof mammoth !== 'undefined') {
      const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
      preview.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'office-html-content';
      container.innerHTML = result.value;
      preview.appendChild(container);
    } else if (isExcel && typeof XLSX !== 'undefined') {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      preview.innerHTML = '';
      workbook.SheetNames.forEach(function (name) {
        const sheet = workbook.Sheets[name];
        const heading = document.createElement('h3');
        heading.textContent = name;
        heading.style.fontWeight = '900';
        heading.style.marginBottom = '0.5rem';
        preview.appendChild(heading);

        const html = XLSX.utils.sheet_to_html(sheet);
        const wrapper = document.createElement('div');
        wrapper.className = 'office-html-content';
        wrapper.innerHTML = html;
        preview.appendChild(wrapper);
      });
    } else {
      preview.innerHTML = '<p class="info-text">NO PREVIEW AVAILABLE FOR THIS FILE TYPE.</p>';
    }
  } catch (err) {
    console.warn('Office preview error:', err);
    preview.innerHTML = '<p class="info-text">COULD NOT RENDER PREVIEW.</p>';
  }
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
