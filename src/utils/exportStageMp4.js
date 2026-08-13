/**
 * Export helpers for 3D Stage — always deliver .mp4 when possible.
 * Prefer native MediaRecorder MP4; otherwise record WebM and remux/transcode via ffmpeg.wasm.
 */

let ffmpegSingleton = null;
let ffmpegLoadPromise = null;

export function pickRecorderMimePreferMp4() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.4D401F,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export function isMp4Mime(mime = '') {
  return String(mime).toLowerCase().includes('mp4');
}

async function getFfmpeg() {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    });
    ffmpegSingleton = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await ffmpegLoadPromise;
  } catch (err) {
    ffmpegLoadPromise = null;
    throw err;
  }
}

/**
 * Convert a recorded WebM/Blob into H.264 MP4.
 */
export async function convertBlobToMp4(inputBlob, onProgress) {
  const { fetchFile } = await import('@ffmpeg/util');
  const ffmpeg = await getFfmpeg();

  if (typeof onProgress === 'function') {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.max(0, Math.min(1, progress || 0)));
    });
  }

  const inName = 'stage_in.webm';
  const outName = 'stage_out.mp4';
  await ffmpeg.writeFile(inName, await fetchFile(inputBlob));

  const tryRead = async () => {
    try {
      const out = await ffmpeg.readFile(outName);
      if (out && out.length > 32) return out;
    } catch {
      /* missing */
    }
    return null;
  };

  // Prefer stream copy when possible; fall back to H.264 encode.
  await ffmpeg.exec([
    '-i', inName,
    '-c', 'copy',
    '-movflags', '+faststart',
    outName
  ]).catch(() => -1);

  let data = await tryRead();
  if (!data) {
    try {
      await ffmpeg.deleteFile(outName);
    } catch {
      /* ignore */
    }
    await ffmpeg.exec([
      '-i', inName,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-an',
      '-movflags', '+faststart',
      outName
    ]);
    data = await tryRead();
  }
  if (!data) {
    throw new Error('MP4 conversion failed');
  }
  try {
    await ffmpeg.deleteFile(inName);
  } catch {
    /* ignore */
  }
  try {
    await ffmpeg.deleteFile(outName);
  } catch {
    /* ignore */
  }
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return new Blob([bytes.buffer], { type: 'video/mp4' });
}

/**
 * Ensure blob is MP4. If already mp4, return as-is; else convert.
 */
export async function ensureMp4Blob(blob, mimeType = '', onProgress) {
  if (blob && isMp4Mime(mimeType || blob.type)) {
    return blob.type === 'video/mp4' ? blob : new Blob([blob], { type: 'video/mp4' });
  }
  return convertBlobToMp4(blob, onProgress);
}
