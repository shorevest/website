'use strict';
function ext(name){if(typeof name!=='string')return '';const base=name.split(/[\\/]/).pop();const i=base.lastIndexOf('.');return i<0?'':base.slice(i).toLowerCase();}
function hasPathTraversal(name){return typeof name==='string'&&(name.includes('..')||name.includes('/')||name.includes('\\')||/^[a-zA-Z]:/.test(name));}
function isPdf(buf){return Buffer.isBuffer(buf)&&buf.length>=5&&buf.subarray(0,5).equals(Buffer.from('%PDF-'));}
function zipNames(buf){const names=[];let p=0;while(p<buf.length-30){if(buf.readUInt32LE(p)!==0x04034b50){p++;continue;}const method=buf.readUInt16LE(p+8);const csize=buf.readUInt32LE(p+18);const nlen=buf.readUInt16LE(p+26);const xlen=buf.readUInt16LE(p+28);const name=buf.subarray(p+30,p+30+nlen).toString('utf8');names.push(name);p+=30+nlen+xlen+csize;if(method!==0&&method!==8){} }return names;}
function isDocx(buf){if(!Buffer.isBuffer(buf)||buf.length<4||buf.readUInt32LE(0)!==0x04034b50)return false;const names=zipNames(buf);return names.includes('[Content_Types].xml')&&names.includes('word/document.xml');}
function detect(bytes){const buf=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes||[]);if(isPdf(buf))return 'pdf';if(isDocx(buf))return 'docx';if(buf.length>=4&&buf.readUInt32LE(0)===0x04034b50)return 'zip';return null;}
function makeTinyZip(entries){const chunks=[];for(const name of entries){const data=Buffer.from('x');const n=Buffer.from(name);const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0,6);h.writeUInt16LE(0,8);h.writeUInt32LE(0,10);h.writeUInt32LE(0,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);chunks.push(h,n,data);}return Buffer.concat(chunks);}
module.exports={ext,hasPathTraversal,detect,isPdf,isDocx,makeTinyZip};
