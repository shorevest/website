#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/generate-media-coverage-pdf.mjs content/media-pdfs/<slug>.json');
  process.exit(1);
}
const dataPath = path.resolve(root, input);
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const outDir = path.join(root, 'public/media/archive-pdfs');
fs.mkdirSync(outDir, { recursive: true });
const slug = slugify(data.pdfSlug || [data.publication, data.date, data.title].filter(Boolean).join('-'));
const pdfName = `shorevest-third-party-coverage-${slug}.pdf`;
const pdfPath = path.join(outDir, pdfName);
writeBasicPdf(pdfPath, data);
console.log(`Wrote ${path.relative(root, pdfPath)}`);

function slugify(s) { return String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140); }
function textBlocks(data) {
  const lines = ['SHOREVEST', 'THIRD-PARTY COVERAGE', '', data.publication || '', data.title || '', ''];
  if (data.date) lines.push(`Date: ${data.date}`);
  if (data.author) lines.push(`Author: ${data.author}`);
  if (data.format) lines.push(`Format: ${data.format}`);
  if (data.permissionStatus) lines.push(`Permission status: ${data.permissionStatus}`);
  if (data.summary) lines.push('', data.summary);
  lines.push('');
  for (const block of data.body || []) {
    if (block.type === 'list') (block.items || []).forEach((i) => lines.push(`• ${i}`));
    else if (block.type === 'quote') lines.push(`“${block.text || ''}”`, block.attribution ? `— ${block.attribution}` : '');
    else if (block.type === 'editorialNote') lines.push(`ShoreVest editorial note: ${block.text || ''}`);
    else lines.push(block.text || '');
    lines.push('');
  }
  lines.push('SOURCE AND COPYRIGHT NOTE', data.copyrightNote || `Originally published by ${data.publication || 'the original publication'}${data.date ? ` on ${data.date}` : ''}. Reproduced with permission where applicable. Copyright remains with the original publisher and/or author.`, 'This third-party material is provided for informational purposes only. ShoreVest Partners does not endorse, and is not responsible for, the content of external publications. The views expressed do not necessarily reflect the views of ShoreVest Partners.');
  return lines;
}
function wrap(line, max=88) { const out=[]; let cur=''; for (const w of String(line).split(/\s+/)) { if(!w){continue} if ((cur+' '+w).trim().length>max){out.push(cur); cur=w} else cur=(cur+' '+w).trim(); } out.push(cur); return out; }
function writeBasicPdf(file, data) {
  const pages=[]; let page=[];
  for (const line of textBlocks(data)) {
    const wrapped = line ? wrap(line) : [''];
    for (const l of wrapped) { page.push(l); if (page.length >= 48) { pages.push(page); page=[]; } }
  }
  if (page.length) pages.push(page);
  const objs=[]; const add=(s)=>{objs.push(s); return objs.length};
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds=[];
  for (let p=0;p<pages.length;p++) {
    const stream = renderPage(pages[p], p+1, pages.length);
    const content=add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  const pagesObj=add(`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  for (const id of pageIds) objs[id-1]=objs[id-1].replace('/Parent 0 0 R', `/Parent ${pagesObj} 0 R`);
  const catalog=add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
  let pdf='%PDF-1.4\n'; const xref=[0];
  objs.forEach((o,i)=>{xref.push(Buffer.byteLength(pdf)); pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});
  const start=Buffer.byteLength(pdf); pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+xref.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')+`\ntrailer << /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  fs.writeFileSync(file, pdf);
}
function pdfEscape(s){return String(s).replace(/[\\()]/g,'\\$&').replace(/[“”]/g,'"').replace(/[—]/g,'-').replace(/[•]/g,'-');}
function renderPage(lines, pageNo, total){let y=785; let s='BT\n/F1 10 Tf\n'; for(const line of lines){const size = line === line.toUpperCase() && line.length < 45 && line ? 13 : 10; s += `/F1 ${size} Tf\n50 ${y} Td (${pdfEscape(line)}) Tj\n-${50} -${y} Td\n`; y-=15;} s += `/F1 9 Tf\n50 34 Td (ShoreVest Partners) Tj\n420 0 Td (Page ${pageNo} of ${total}) Tj\nET`; return s;}
