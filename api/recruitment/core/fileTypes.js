'use strict';

const zlib = require('zlib');

const DOCX_LIMITS = Object.freeze({
  maxEntries: 200,
  maxCompressedSize: 8 * 1024 * 1024,
  maxUncompressedSize: 12 * 1024 * 1024,
  maxContentTypesRead: 1024 * 1024,
  minPdfSize: 8
});

function ext(name) {
  if (typeof name !== 'string') return '';
  const base = name.split(/[\\/]/).pop();
  const index = base.lastIndexOf('.');
  return index < 0 ? '' : base.slice(index).toLowerCase();
}

function hasPathTraversal(name) {
  return typeof name === 'string' && (name.includes('..') || name.includes('/') || name.includes('\\') || /^[a-zA-Z]:/.test(name));
}

function isPdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= DOCX_LIMITS.minPdfSize && buffer.subarray(0, 5).equals(Buffer.from('%PDF-'));
}

function invalidZipName(name) {
  return name.startsWith('/') || name.startsWith('\\') || name.includes('..') || name.includes('\\');
}

function inflateEntry(method, data) {
  if (method === 0) return data;
  if (method === 8) return zlib.inflateRawSync(data);
  return null;
}

function inspectZip(buffer) {
  const entries = new Map();
  let offset = 0;
  let entryCount = 0;
  let totalUncompressed = 0;

  try {
    while (offset < buffer.length) {
      if (offset + 4 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) break;
      if (offset + 30 > buffer.length) return { ok: false };

      const flags = buffer.readUInt16LE(offset + 6);
      const method = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const nameLength = buffer.readUInt16LE(offset + 26);
      const extraLength = buffer.readUInt16LE(offset + 28);
      const dataStart = offset + 30 + nameLength + extraLength;
      const dataEnd = dataStart + compressedSize;

      if ((flags & 0x1) !== 0 || (flags & 0x8) !== 0) return { ok: false };
      if (method !== 0 && method !== 8) return { ok: false };
      if (dataStart > buffer.length || dataEnd > buffer.length) return { ok: false };
      if (compressedSize > DOCX_LIMITS.maxCompressedSize || uncompressedSize > DOCX_LIMITS.maxUncompressedSize) return { ok: false };

      const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
      if (!name || invalidZipName(name)) return { ok: false };

      entryCount += 1;
      totalUncompressed += uncompressedSize;
      if (entryCount > DOCX_LIMITS.maxEntries || totalUncompressed > DOCX_LIMITS.maxUncompressedSize) return { ok: false };

      if (name === '[Content_Types].xml' || name === 'word/document.xml') {
        const data = buffer.subarray(dataStart, dataEnd);
        const content = inflateEntry(method, data);
        if (!content || content.length !== uncompressedSize || content.length > DOCX_LIMITS.maxContentTypesRead) return { ok: false };
        entries.set(name, content.toString('utf8'));
      }

      offset = dataEnd;
    }
  } catch (_) {
    return { ok: false };
  }

  return { ok: true, entries, entryCount, totalUncompressed };
}

function isDocx(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) return false;
  const inspected = inspectZip(buffer);
  if (!inspected.ok) return false;

  const contentTypes = inspected.entries.get('[Content_Types].xml') || '';
  const hasDocument = inspected.entries.has('word/document.xml');
  const identifiesWordDocument = contentTypes.includes('wordprocessingml.document.main+xml') && contentTypes.includes('/word/document.xml');
  return hasDocument && identifiesWordDocument;
}

function detect(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (isPdf(buffer)) return 'pdf';
  if (isDocx(buffer)) return 'docx';
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) return 'zip';
  return null;
}

function makeTinyZip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const data = Buffer.from(entry.data || 'x');
    const name = Buffer.from(entry.name || entry);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(entry.flags || 0, 6);
    header.writeUInt16LE(entry.method || 0, 8);
    header.writeUInt32LE(0, 10);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(entry.compressedSize ?? data.length, 18);
    header.writeUInt32LE(entry.uncompressedSize ?? data.length, 22);
    header.writeUInt16LE(name.length, 26);
    chunks.push(header, name, data);
  }
  return Buffer.concat(chunks);
}

module.exports = { DOCX_LIMITS, ext, hasPathTraversal, detect, isPdf, isDocx, makeTinyZip };
