/**
 * Read files out of a ZIP (store or deflate). Used for Word .docx — no extra deps.
 */

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot unpack Word .docx. Export PDF or TXT from Word and upload that.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findEocd(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const min = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

export function isZipBytes(bytes) {
  return bytes && bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<Array<{ name: string, data: Uint8Array }>>}
 */
export async function readZipEntries(bytes) {
  if (!isZipBytes(bytes)) throw new Error('Not a ZIP archive');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new Error('ZIP directory missing');
  const count = view.getUint16(eocd + 8, true);
  let cdOff = view.getUint32(eocd + 16, true);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(cdOff, true) !== 0x02014b50) break;
    const flags = view.getUint16(cdOff + 8, true);
    const method = view.getUint16(cdOff + 10, true);
    const compSize = view.getUint32(cdOff + 20, true);
    const nameLen = view.getUint16(cdOff + 28, true);
    const extraLen = view.getUint16(cdOff + 30, true);
    const commentLen = view.getUint16(cdOff + 32, true);
    const localOff = view.getUint32(cdOff + 42, true);
    const name = new TextDecoder('utf-8').decode(bytes.subarray(cdOff + 46, cdOff + 46 + nameLen));
    cdOff += 46 + nameLen + extraLen + commentLen;
    if (flags & 1) {
      throw new Error('Password-protected Word files are not supported. Save an unprotected copy and retry.');
    }
    if (view.getUint32(localOff, true) !== 0x04034b50) continue;
    const localNameLen = view.getUint16(localOff + 26, true);
    const localExtraLen = view.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + localNameLen + localExtraLen;
    const compressed = bytes.subarray(dataStart, dataStart + compSize);
    let data;
    if (method === 0) {
      data = compressed;
    } else if (method === 8) {
      data = await inflateRaw(compressed);
    } else {
      continue;
    }
    entries.push({ name, data });
  }
  return entries;
}
