/* ==========================================================================
   ShoreVest Operations — File Handling
   Client-side file inspection for the Process a List workflow:
     - byte-level type sniffing (.xlsx / .xls / .csv, encryption, corruption)
     - CSV parsing with delimiter detection and header-row detection
     - a minimal, dependency-free .xlsx reader (ZIP central directory +
       DecompressionStream) sufficient for contact lists: sheets, rows,
       shared strings, inline strings, formula flags, merged cells,
       hidden rows/columns, macro and external-link detection.

   In production the authoritative parse is performed server-side by the
   Office Scripts integration; this module powers preview, validation and
   demonstration mode. Pure functions are exported for Node tests.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.SVPortalFiles = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ────────────────────────────────────────────────────────────────────────
     Byte sniffing
     ──────────────────────────────────────────────────────────────────────── */

  function extOf(name) {
    var i = String(name || '').lastIndexOf('.');
    return i === -1 ? '' : String(name).slice(i).toLowerCase();
  }

  function startsWith(bytes, sig, offset) {
    var o = offset || 0;
    if (bytes.length < o + sig.length) return false;
    for (var i = 0; i < sig.length; i++) if (bytes[o + i] !== sig[i]) return false;
    return true;
  }

  /* Scan raw bytes for an ASCII string (used on ZIP directories and OLE
     headers, where names are stored uncompressed). */
  function bytesContainAscii(bytes, text, asUtf16) {
    var needle = [];
    for (var i = 0; i < text.length; i++) {
      needle.push(text.charCodeAt(i));
      if (asUtf16) needle.push(0);
    }
    outer:
    for (var j = 0; j <= bytes.length - needle.length; j++) {
      for (var k = 0; k < needle.length; k++) {
        if (bytes[j + k] !== needle[k]) continue outer;
      }
      return true;
    }
    return false;
  }

  /**
   * Inspect the first bytes of an uploaded file.
   * Returns { type: 'xlsx'|'xls'|'csv'|'unknown', encrypted, corrupted,
   *           hasMacros, hasExternalLinks, detail }.
   */
  function sniffBytes(bytes, filename) {
    var ext = extOf(filename);
    var ZIP = [0x50, 0x4B, 0x03, 0x04];
    var ZIP_EMPTY = [0x50, 0x4B, 0x05, 0x06];
    var OLE = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

    var result = { type: 'unknown', encrypted: false, corrupted: false,
                   hasMacros: false, hasExternalLinks: false, detail: '' };

    if (!bytes || !bytes.length) { result.corrupted = false; result.detail = 'Empty file.'; return result; }

    if (startsWith(bytes, ZIP)) {
      /* Office Open XML container. */
      result.type = 'xlsx';
      result.hasMacros = bytesContainAscii(bytes, 'vbaProject.bin');
      result.hasExternalLinks = bytesContainAscii(bytes, 'externalLinks/');
      if (ext === '.csv') { result.type = 'unknown'; result.detail = 'File named .csv but contains a ZIP/Excel container.'; result.corrupted = true; }
      if (ext === '.xlsm' || bytesContainAscii(bytes, '[Content_Types].xml') === false) {
        /* still treat as xlsx candidate; content-types check is advisory */
      }
      return result;
    }
    if (startsWith(bytes, ZIP_EMPTY)) {
      result.type = 'xlsx'; result.corrupted = true; result.detail = 'The workbook container is empty.'; return result;
    }
    if (startsWith(bytes, OLE)) {
      /* OLE compound file: legacy .xls, or an ENCRYPTED .xlsx package. */
      if (bytesContainAscii(bytes, 'EncryptedPackage', true) || ext === '.xlsx') {
        result.type = ext === '.xls' ? 'xls' : 'xlsx';
        result.encrypted = true;
        result.detail = 'The workbook is password protected (encrypted OLE container).';
        return result;
      }
      result.type = 'xls';
      result.detail = 'Legacy binary Excel workbook (BIFF). Parsed server-side by the Office Scripts integration.';
      return result;
    }

    /* Text heuristic for CSV: no NUL bytes in the sample, mostly printable. */
    var sample = bytes.length > 4096 ? bytes.subarray(0, 4096) : bytes;
    var nul = 0, printable = 0;
    for (var i = 0; i < sample.length; i++) {
      var b = sample[i];
      if (b === 0) nul++;
      if (b === 9 || b === 10 || b === 13 || (b >= 32)) printable++;
    }
    if (nul === 0 && printable / sample.length > 0.97) {
      result.type = 'csv';
      if (ext === '.xlsx' || ext === '.xls') {
        result.detail = 'File has an Excel extension but contains plain text; it will be treated as CSV after confirmation.';
      }
      return result;
    }

    result.corrupted = ext === '.xlsx' || ext === '.xls' || ext === '.csv';
    result.detail = 'File content does not match any supported format.';
    return result;
  }

  /* ────────────────────────────────────────────────────────────────────────
     CSV parsing
     ──────────────────────────────────────────────────────────────────────── */

  function detectDelimiter(text) {
    var candidates = [',', ';', '\t'];
    var firstLines = text.split(/\r\n|\n|\r/).slice(0, 5).filter(function (l) { return l.trim(); });
    var best = ',', bestScore = -1;
    candidates.forEach(function (d) {
      var counts = firstLines.map(function (l) { return l.split(d).length - 1; });
      if (!counts.length) return;
      var min = Math.min.apply(null, counts), max = Math.max.apply(null, counts);
      /* consistent, non-zero counts across lines score best */
      var score = min > 0 && min === max ? min * 10 : min;
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }

  /** RFC-4180-style CSV parser (quotes, escaped quotes, CRLF, BOM). */
  function parseCsv(text, delimiter) {
    var s = String(text == null ? '' : text);
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    var d = delimiter || detectDelimiter(s);
    var rows = [], row = [], field = '', inQuotes = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (inQuotes) {
        if (ch === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === d) {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else {
        field += ch;
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function isBlankRow(cells) {
    return !cells || cells.every(function (c) { return String(c == null ? '' : c).trim() === ''; });
  }

  /**
   * Analyse parsed tabular rows: locate the header via the rules engine's
   * detector (passed in to keep this module rules-agnostic), then return
   * headers + data rows with original row numbers preserved and blank rows
   * dropped (their positions are recorded, never silently lost).
   */
  function analyseTable(rows, detectHeaderRow) {
    var detection = detectHeaderRow(rows);
    var analysis = {
      headerDetection: detection,
      headers: [],
      dataRows: [],        /* [{ originalRowNumber (1-based), cells }] */
      blankRowNumbers: [],
      totalDataRows: 0
    };
    if (detection.index === -1 || detection.ambiguous) return analysis;
    analysis.headers = rows[detection.index].map(function (h) { return String(h == null ? '' : h).trim(); });
    for (var i = detection.index + 1; i < rows.length; i++) {
      if (isBlankRow(rows[i])) { analysis.blankRowNumbers.push(i + 1); continue; }
      /* Salesforce CSV reports end with a blank line then a footer such as
         "Copyright (c) 2000-2026 salesforce.com, inc." — drop footer lines
         that have content only in the first cell after a blank separator. */
      analysis.dataRows.push({ originalRowNumber: i + 1, cells: rows[i] });
    }
    /* Trim a trailing Salesforce footer block if present. */
    while (analysis.dataRows.length) {
      var last = analysis.dataRows[analysis.dataRows.length - 1];
      var joined = last.cells.join(' ').toLowerCase();
      var onlyFirst = last.cells.filter(function (c) { return String(c).trim() !== ''; }).length === 1;
      if (onlyFirst && (joined.indexOf('salesforce.com') !== -1 || joined.indexOf('confidential information') !== -1 || joined.indexOf('copyright') !== -1)) {
        analysis.dataRows.pop();
      } else break;
    }
    analysis.totalDataRows = analysis.dataRows.length;
    return analysis;
  }

  /* ────────────────────────────────────────────────────────────────────────
     Minimal XLSX reader (ZIP + DecompressionStream)
     ──────────────────────────────────────────────────────────────────────── */

  function readU16(b, o) { return b[o] | (b[o + 1] << 8); }
  function readU32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  /** Parse the ZIP central directory. Returns entries: {name, method, compSize, uncompSize, offset}. */
  function zipEntries(bytes) {
    /* Find End Of Central Directory (scan backwards, max 64KB + 22). */
    var eocd = -1;
    var min = Math.max(0, bytes.length - 65558);
    for (var i = bytes.length - 22; i >= min; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4B && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd === -1) throw new Error('ZIP central directory not found (corrupted workbook).');
    var count = readU16(bytes, eocd + 10);
    var cdOffset = readU32(bytes, eocd + 16);
    var entries = [];
    var p = cdOffset;
    for (var e = 0; e < count; e++) {
      if (readU32(bytes, p) !== 0x02014b50) throw new Error('Corrupted ZIP central directory entry.');
      var method = readU16(bytes, p + 10);
      var compSize = readU32(bytes, p + 20);
      var uncompSize = readU32(bytes, p + 24);
      var nameLen = readU16(bytes, p + 28);
      var extraLen = readU16(bytes, p + 30);
      var commentLen = readU16(bytes, p + 32);
      var offset = readU32(bytes, p + 42);
      var name = '';
      for (var c = 0; c < nameLen; c++) name += String.fromCharCode(bytes[p + 46 + c]);
      entries.push({ name: name, method: method, compSize: compSize, uncompSize: uncompSize, offset: offset });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  function inflateRaw(compressed) {
    /* Browser + Node 18+: DecompressionStream('deflate-raw'). */
    if (typeof DecompressionStream !== 'undefined') {
      var ds = new DecompressionStream('deflate-raw');
      var stream = new Blob([compressed]).stream().pipeThrough(ds);
      return new Response(stream).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
    }
    /* Node fallback for tests on older runtimes. */
    if (typeof require === 'function') {
      try {
        var zlib = require('zlib');
        return Promise.resolve(new Uint8Array(zlib.inflateRawSync(Buffer.from(compressed))));
      } catch (e) { /* fall through */ }
    }
    return Promise.reject(new Error('No deflate implementation available.'));
  }

  function readEntry(bytes, entry) {
    var p = entry.offset;
    if (readU32(bytes, p) !== 0x04034b50) return Promise.reject(new Error('Corrupted ZIP local header for ' + entry.name + '.'));
    var nameLen = readU16(bytes, p + 26);
    var extraLen = readU16(bytes, p + 28);
    var start = p + 30 + nameLen + extraLen;
    var data = bytes.subarray(start, start + entry.compSize);
    if (entry.method === 0) return Promise.resolve(data);
    if (entry.method === 8) return inflateRaw(data);
    return Promise.reject(new Error('Unsupported ZIP compression method ' + entry.method + ' in ' + entry.name + '.'));
  }

  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    return Buffer.from(bytes).toString('utf8');
  }

  function xmlUnescape(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'").replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
            .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(parseInt(d, 10)); })
            .replace(/&amp;/g, '&');
  }

  /* Collect the concatenated <t> text inside an <si> or <is> element. */
  function collectT(xml) {
    var out = '', re = /<t[^>]*>([\s\S]*?)<\/t>/g, m;
    while ((m = re.exec(xml)) !== null) out += xmlUnescape(m[1]);
    return out;
  }

  function parseSharedStrings(xml) {
    var strings = [], re = /<si>([\s\S]*?)<\/si>/g, m;
    while ((m = re.exec(xml)) !== null) strings.push(collectT(m[1]));
    return strings;
  }

  function colRefToIndex(ref) {
    var letters = ref.replace(/\d+$/, '');
    var n = 0;
    for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return n - 1;
  }

  /**
   * Parse one worksheet XML into rows of strings.
   * Returns { rows, hiddenRowNumbers, hiddenColumns, mergedRanges, formulaCells }.
   */
  function parseSheet(xml, sharedStrings) {
    var rows = [], hiddenRowNumbers = [], hiddenColumns = [], mergedRanges = [], formulaCells = 0;

    var colRe = /<col [^>]*hidden="(?:1|true)"[^>]*\/>/g, cm;
    while ((cm = colRe.exec(xml)) !== null) hiddenColumns.push(cm[0]);

    var mergeRe = /<mergeCell ref="([^"]+)"/g, mm;
    while ((mm = mergeRe.exec(xml)) !== null) mergedRanges.push(mm[1]);

    var rowRe = /<row ([^>]*)>([\s\S]*?)<\/row>|<row ([^>]*)\/>/g, rm;
    while ((rm = rowRe.exec(xml)) !== null) {
      var attrs = rm[1] || rm[3] || '';
      var inner = rm[2] || '';
      var rNumM = attrs.match(/(?:^|\s)r="(\d+)"/);
      var rowNum = rNumM ? parseInt(rNumM[1], 10) : rows.length + 1;
      if (/hidden="(?:1|true)"/.test(attrs)) hiddenRowNumbers.push(rowNum);
      while (rows.length < rowNum - 1) rows.push([]);
      var cells = [];
      var cellRe = /<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cellM;
      while ((cellM = cellRe.exec(inner)) !== null) {
        var cAttrs = cellM[1], cInner = cellM[2] || '';
        var refM = cAttrs.match(/r="([A-Z]+\d+)"/);
        var idx = refM ? colRefToIndex(refM[1]) : cells.length;
        var typeM = cAttrs.match(/t="(\w+)"/);
        var type = typeM ? typeM[1] : 'n';
        if (cInner.indexOf('<f') !== -1) formulaCells++;
        var value = '';
        if (type === 's') {
          var vM = cInner.match(/<v>([\s\S]*?)<\/v>/);
          value = vM ? (sharedStrings[parseInt(vM[1], 10)] || '') : '';
        } else if (type === 'inlineStr') {
          value = collectT(cInner);
        } else {
          /* n, str (formula string result), b, e — use the cached value */
          var vM2 = cInner.match(/<v>([\s\S]*?)<\/v>/);
          value = vM2 ? xmlUnescape(vM2[1]) : '';
          if (type === 'b') value = value === '1' ? 'TRUE' : (value === '0' ? 'FALSE' : value);
        }
        while (cells.length < idx) cells.push('');
        cells[idx] = value;
      }
      rows.push(cells);
    }
    return { rows: rows, hiddenRowNumbers: hiddenRowNumbers,
             hiddenColumns: hiddenColumns.length, mergedRanges: mergedRanges,
             formulaCells: formulaCells };
  }

  /**
   * Read an .xlsx workbook from bytes.
   * Resolves { sheets: [{name, rows, hiddenRowNumbers, hiddenColumns,
   *            mergedRanges, formulaCells}], sheetNames, hasMacros,
   *            hasExternalLinks }.
   * Rejects with a descriptive Error on corruption — callers surface the
   * exact reason and stop.
   */
  function readXlsx(bytes) {
    var entries;
    try { entries = zipEntries(bytes); }
    catch (e) { return Promise.reject(e); }

    var byName = {};
    entries.forEach(function (en) { byName[en.name] = en; });

    var hasMacros = !!byName['xl/vbaProject.bin'];
    var hasExternalLinks = entries.some(function (en) { return en.name.indexOf('xl/externalLinks/') === 0; });

    if (!byName['xl/workbook.xml']) return Promise.reject(new Error('Workbook structure not found (corrupted or not an Excel file).'));

    function text(name) {
      if (!byName[name]) return Promise.resolve('');
      return readEntry(bytes, byName[name]).then(utf8Decode);
    }

    return Promise.all([text('xl/workbook.xml'), text('xl/_rels/workbook.xml.rels'), text('xl/sharedStrings.xml')])
      .then(function (parts) {
        var wbXml = parts[0], relsXml = parts[1], sstXml = parts[2];
        var sharedStrings = sstXml ? parseSharedStrings(sstXml) : [];

        var rels = {};
        var relRe = /<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g, rm2;
        while ((rm2 = relRe.exec(relsXml)) !== null) rels[rm2[1]] = rm2[2];
        /* Relationship attribute order can vary */
        var relRe2 = /<Relationship [^>]*Target="([^"]+)"[^>]*Id="([^"]+)"[^>]*\/>/g;
        while ((rm2 = relRe2.exec(relsXml)) !== null) rels[rm2[2]] = rm2[1];

        var sheetsMeta = [];
        var sheetRe = /<sheet [^>]*\/>/g, sm;
        while ((sm = sheetRe.exec(wbXml)) !== null) {
          var tag = sm[0];
          var nameM = tag.match(/name="([^"]*)"/);
          var ridM = tag.match(/r:id="([^"]*)"/);
          var stateM = tag.match(/state="([^"]*)"/);
          sheetsMeta.push({
            name: nameM ? xmlUnescape(nameM[1]) : 'Sheet',
            rid: ridM ? ridM[1] : null,
            hidden: stateM ? stateM[1] !== 'visible' : false
          });
        }

        return Promise.all(sheetsMeta.map(function (meta) {
          var target = meta.rid && rels[meta.rid] ? rels[meta.rid] : null;
          if (!target) return Promise.resolve(Object.assign({ rows: [] }, meta));
          var path = target.indexOf('/') === 0 ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
          return text(path).then(function (xml) {
            var parsed = xml ? parseSheet(xml, sharedStrings) : { rows: [], hiddenRowNumbers: [], hiddenColumns: 0, mergedRanges: [], formulaCells: 0 };
            return Object.assign({}, meta, parsed);
          });
        })).then(function (sheets) {
          return {
            sheets: sheets,
            sheetNames: sheets.map(function (s) { return s.name; }),
            hasMacros: hasMacros,
            hasExternalLinks: hasExternalLinks
          };
        });
      });
  }

  /* ────────────────────────────────────────────────────────────────────────
     Hashing (duplicate-file detection)
     ──────────────────────────────────────────────────────────────────────── */

  function sha256Hex(bytes) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      return crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
    }
    if (typeof require === 'function') {
      try {
        var nodeCrypto = require('crypto');
        return Promise.resolve(nodeCrypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
      } catch (e) { /* fall through */ }
    }
    return Promise.reject(new Error('No SHA-256 implementation available.'));
  }

  function formatBytes(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  return {
    extOf: extOf,
    sniffBytes: sniffBytes,
    detectDelimiter: detectDelimiter,
    parseCsv: parseCsv,
    isBlankRow: isBlankRow,
    analyseTable: analyseTable,
    zipEntries: zipEntries,
    readXlsx: readXlsx,
    parseSheet: parseSheet,
    parseSharedStrings: parseSharedStrings,
    colRefToIndex: colRefToIndex,
    sha256Hex: sha256Hex,
    formatBytes: formatBytes
  };
});
