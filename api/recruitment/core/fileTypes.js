'use strict';

const zlib = require('zlib');

const DOCX_LIMITS = Object.freeze({
  maxEntries: 200,
  maxCompressedSize: 8 * 1024 * 1024,
  maxUncompressedSize: 12 * 1024 * 1024,
  maxContentTypesRead: 1024 * 1024,
  minPdfSize: 8
});

function ext(name){ if(typeof name!=='string')return ''; const base=name.split(/[\\/]/).pop(); const i=base.lastIndexOf('.'); return i<0?'':base.slice(i).toLowerCase(); }
function hasPathTraversal(name){ return typeof name==='string'&&(name.includes('..')||name.includes('/')||name.includes('\\')||/^[a-zA-Z]:/.test(name)); }
function isPdf(buffer){ return Buffer.isBuffer(buffer)&&buffer.length>=DOCX_LIMITS.minPdfSize&&buffer.subarray(0,5).equals(Buffer.from('%PDF-')); }
function invalidZipName(name){ return !name||name.startsWith('/')||name.startsWith('\\')||name.includes('..')||name.includes('\\')||/^[a-zA-Z]:/.test(name); }
function findEocd(buffer){ const min=22; const max=Math.max(0,buffer.length-0xffff-22); for(let i=buffer.length-min;i>=max;i--){ if(buffer.readUInt32LE(i)===0x06054b50)return i; } return -1; }
function inflateBounded(method,data,expected){ if(expected>DOCX_LIMITS.maxUncompressedSize)return null; if(method===0){ return data.length===expected?data:null; } if(method!==8)return null; const out=zlib.inflateRawSync(data,{maxOutputLength:expected}); return out.length===expected?out:null; }
function inspectZip(buffer){
  try{
    if(!Buffer.isBuffer(buffer)||buffer.length<22)return {ok:false};
    const eocd=findEocd(buffer); if(eocd<0)return {ok:false};
    const disk=buffer.readUInt16LE(eocd+4), cdDisk=buffer.readUInt16LE(eocd+6), diskEntries=buffer.readUInt16LE(eocd+8), totalEntries=buffer.readUInt16LE(eocd+10);
    const cdSize=buffer.readUInt32LE(eocd+12), cdOffset=buffer.readUInt32LE(eocd+16), commentLen=buffer.readUInt16LE(eocd+20);
    if(disk!==0||cdDisk!==0||diskEntries!==totalEntries||eocd+22+commentLen!==buffer.length)return {ok:false};
    if(totalEntries<1||totalEntries>DOCX_LIMITS.maxEntries)return {ok:false};
    if(cdOffset+cdSize!==eocd||cdOffset>=buffer.length)return {ok:false};
    const entries=new Map(); let offset=cdOffset; let totalUncompressed=0;
    for(let i=0;i<totalEntries;i++){
      if(offset+46>eocd||buffer.readUInt32LE(offset)!==0x02014b50)return {ok:false};
      const flags=buffer.readUInt16LE(offset+8), method=buffer.readUInt16LE(offset+10), crc=buffer.readUInt32LE(offset+16);
      const compressedSize=buffer.readUInt32LE(offset+20), uncompressedSize=buffer.readUInt32LE(offset+24), nameLength=buffer.readUInt16LE(offset+28), extraLength=buffer.readUInt16LE(offset+30), commentLength=buffer.readUInt16LE(offset+32), localOffset=buffer.readUInt32LE(offset+42);
      if((flags&0x1)!==0||(flags&0x8)!==0||(method!==0&&method!==8))return {ok:false};
      if(compressedSize>DOCX_LIMITS.maxCompressedSize||uncompressedSize>DOCX_LIMITS.maxUncompressedSize)return {ok:false};
      totalUncompressed+=uncompressedSize; if(totalUncompressed>DOCX_LIMITS.maxUncompressedSize)return {ok:false};
      const name=buffer.subarray(offset+46,offset+46+nameLength).toString('utf8'); if(invalidZipName(name))return {ok:false};
      if((name==='[Content_Types].xml'||name==='word/document.xml')&&entries.has(name))return {ok:false};
      if(localOffset+30>cdOffset||buffer.readUInt32LE(localOffset)!==0x04034b50)return {ok:false};
      const lfFlags=buffer.readUInt16LE(localOffset+6), lfMethod=buffer.readUInt16LE(localOffset+8), lfCompressed=buffer.readUInt32LE(localOffset+18), lfUncompressed=buffer.readUInt32LE(localOffset+22), lfNameLen=buffer.readUInt16LE(localOffset+26), lfExtraLen=buffer.readUInt16LE(localOffset+28);
      const dataStart=localOffset+30+lfNameLen+lfExtraLen, dataEnd=dataStart+compressedSize;
      const lfName=buffer.subarray(localOffset+30,localOffset+30+lfNameLen).toString('utf8');
      if(lfFlags!==flags||lfMethod!==method||lfCompressed!==compressedSize||lfUncompressed!==uncompressedSize||lfName!==name||dataEnd>cdOffset)return {ok:false};
      if(name==='[Content_Types].xml'||name==='word/document.xml'){
        const content=inflateBounded(method,buffer.subarray(dataStart,dataEnd),uncompressedSize); if(!content||content.length>DOCX_LIMITS.maxContentTypesRead)return {ok:false};
        entries.set(name,{text:content.toString('utf8'),crc});
      }
      offset+=46+nameLength+extraLength+commentLength;
    }
    if(offset!==eocd)return {ok:false};
    return {ok:true,entries,entryCount:totalEntries,totalUncompressed};
  }catch(_){ return {ok:false}; }
}
function isDocx(buffer){ const z=inspectZip(buffer); if(!z.ok)return false; const ct=z.entries.get('[Content_Types].xml')?.text||''; return z.entries.has('word/document.xml')&&ct.includes('ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"')&&ct.includes('PartName="/word/document.xml"'); }
function detect(bytes){ const buffer=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes||[]); if(isPdf(buffer))return 'pdf'; if(isDocx(buffer))return 'docx'; if(buffer.length>=4&&buffer.readUInt32LE(0)===0x04034b50)return 'zip'; return null; }
function makeTinyZip(entries){ const chunks=[]; for(const entry of entries){ const data=Buffer.from(entry.data||'x'); const name=Buffer.from(entry.name||entry); const header=Buffer.alloc(30); header.writeUInt32LE(0x04034b50,0); header.writeUInt16LE(20,4); header.writeUInt16LE(entry.flags||0,6); header.writeUInt16LE(entry.method||0,8); header.writeUInt32LE(entry.compressedSize??data.length,18); header.writeUInt32LE(entry.uncompressedSize??data.length,22); header.writeUInt16LE(name.length,26); chunks.push(header,name,data); } return Buffer.concat(chunks); }
function makeDocxFixture(extra=[]){
 const all=[{name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},{name:'word/document.xml',data:'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'},...extra];
 const locals=[], centrals=[]; let offset=0;
 for(const e of all){ const name=Buffer.from(e.name); const data=Buffer.from(e.data||''); const method=e.method??0; const comp=method===8?zlib.deflateRawSync(data):data; const local=Buffer.alloc(30); local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4); local.writeUInt16LE(e.flags||0,6); local.writeUInt16LE(method,8); local.writeUInt32LE(comp.length,18); local.writeUInt32LE(data.length,22); local.writeUInt16LE(name.length,26); locals.push(local,name,comp); const cd=Buffer.alloc(46); cd.writeUInt32LE(0x02014b50,0); cd.writeUInt16LE(20,4); cd.writeUInt16LE(20,6); cd.writeUInt16LE(e.flags||0,8); cd.writeUInt16LE(method,10); cd.writeUInt32LE(comp.length,20); cd.writeUInt32LE(data.length,24); cd.writeUInt16LE(name.length,28); cd.writeUInt32LE(offset,42); centrals.push(cd,name); offset+=30+name.length+comp.length; }
 const cdStart=offset; const cdBuf=Buffer.concat(centrals); const eocd=Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50,0); eocd.writeUInt16LE(all.length,8); eocd.writeUInt16LE(all.length,10); eocd.writeUInt32LE(cdBuf.length,12); eocd.writeUInt32LE(cdStart,16); return Buffer.concat([...locals,cdBuf,eocd]); }
module.exports={DOCX_LIMITS,ext,hasPathTraversal,detect,isPdf,isDocx,makeTinyZip,makeDocxFixture,inspectZip};
