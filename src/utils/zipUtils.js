/**
 * Pure JavaScript zero-dependency ZIP archive builder for text files.
 * Generates valid PKZip archives downloadable directly in all browsers (Chrome, Safari, Firefox, Edge).
 */
export function createZipArchive(files = []) {
  const fileEntries = [];
  let currentOffset = 0;

  const encoder = new TextEncoder();

  for (const file of files) {
    const filenameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);

    // CRC32 calculation
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < contentBytes.length; i++) {
      crc ^= contentBytes[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;

    // Date & Time (MS-DOS format)
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    // Local Header
    const header = new Uint8Array(30 + filenameBytes.length);
    const view = new DataView(header.buffer);
    
    view.setUint32(0, 0x04034b50, true); // Local Header Signature
    view.setUint16(4, 20, true);         // Version needed
    view.setUint16(6, 0x0800, true);     // Flags (UTF-8)
    view.setUint16(8, 0, true);          // Compression (Store = 0)
    view.setUint16(10, dosTime, true);
    view.setUint16(12, dosDate, true);
    view.setUint32(14, crc, true);       // CRC32
    view.setUint32(18, contentBytes.length, true); // Compressed size
    view.setUint32(22, contentBytes.length, true); // Uncompressed size
    view.setUint16(26, filenameBytes.length, true);
    view.setUint16(28, 0, true);         // Extra field length
    header.set(filenameBytes, 30);

    fileEntries.push({
      header,
      contentBytes,
      filenameBytes,
      crc,
      dosTime,
      dosDate,
      offset: currentOffset
    });

    currentOffset += header.length + contentBytes.length;
  }

  // Central Directory Entries
  const centralDirParts = [];
  let centralDirSize = 0;

  for (const entry of fileEntries) {
    const cdHeader = new Uint8Array(46 + entry.filenameBytes.length);
    const cdView = new DataView(cdHeader.buffer);

    cdView.setUint32(0, 0x02014b50, true); // Central Dir Signature
    cdView.setUint16(4, 20, true);         // Version made by
    cdView.setUint16(6, 20, true);         // Version needed
    cdView.setUint16(8, 0x0800, true);     // Flags
    cdView.setUint16(10, 0, true);        // Compression
    cdView.setUint16(12, entry.dosTime, true);
    cdView.setUint16(14, entry.dosDate, true);
    cdView.setUint32(16, entry.crc, true);
    cdView.setUint32(20, entry.contentBytes.length, true);
    cdView.setUint32(24, entry.contentBytes.length, true);
    cdView.setUint16(28, entry.filenameBytes.length, true);
    cdView.setUint16(30, 0, true);        // Extra field length
    cdView.setUint16(32, 0, true);        // Comment length
    cdView.setUint16(34, 0, true);        // Disk start
    cdView.setUint16(36, 0, true);        // Internal attrs
    cdView.setUint32(38, 0, true);        // External attrs
    cdView.setUint32(42, entry.offset, true); // Local header offset
    cdHeader.set(entry.filenameBytes, 46);

    centralDirParts.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  // End of Central Directory Record (EOCD)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);  // EOCD Signature
  eocdView.setUint16(4, 0, true);           // Disk number
  eocdView.setUint16(6, 0, true);           // Disk with CD
  eocdView.setUint16(8, fileEntries.length, true);  // CD entries on disk
  eocdView.setUint16(10, fileEntries.length, true); // Total CD entries
  eocdView.setUint32(12, centralDirSize, true);     // Size of CD
  eocdView.setUint32(16, currentOffset, true);      // Offset of CD
  eocdView.setUint16(20, 0, true);                  // Comment length

  // Combine into final Blob
  const finalParts = [];
  for (const entry of fileEntries) {
    finalParts.push(entry.header);
    finalParts.push(entry.contentBytes);
  }
  for (const cd of centralDirParts) {
    finalParts.push(cd);
  }
  finalParts.push(eocd);

  return new Blob(finalParts, { type: 'application/zip' });
}
