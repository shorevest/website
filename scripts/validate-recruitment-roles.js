#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'assets/data/recruitment/roles.v1.json');
const schemaPath = path.join(root, 'assets/data/recruitment/roles.v1.schema.json');
function readJson(file){ return JSON.parse(fs.readFileSync(file,'utf8')); }
function formatAjvError(error){ const p=error.instancePath||'/'; let d=error.message||'is invalid'; if(error.keyword==='additionalProperties'&&error.params?.additionalProperty)d=`must not have additional property ${JSON.stringify(error.params.additionalProperty)}`; if(error.keyword==='required'&&error.params?.missingProperty)d=`must have required property ${JSON.stringify(error.params.missingProperty)}`; return `${p} ${d}`; }
function validateManifest(manifest, schema){ const ajv=new Ajv2020({allErrors:true,strict:true}); addFormats(ajv,{formats:['date-time','date']}); const validate=ajv.compile(schema); const errors=validate(manifest)?[]:(validate.errors||[]).map(formatAjvError); errors.push(...validateSemantics(manifest)); return errors; }
function badText(v){return typeof v==='string' && (/<[a-z!/]|&#?\w+;|mailto:|<\s*script/i.test(v));}
function scanText(value, pathLabel, errors){ if(typeof value==='string'){ if(badText(value)) errors.push(`${pathLabel} must be plain public text.`); return; } if(Array.isArray(value)) value.forEach((x,i)=>scanText(x,`${pathLabel}[${i}]`,errors)); else if(value&&typeof value==='object') Object.keys(value).forEach(k=>scanText(value[k],`${pathLabel}.${k}`,errors)); }
function validateSemantics(manifest){ const errors=[]; if(!manifest||!Array.isArray(manifest.roles)) return errors; const ids=new Set(), slugs=new Set(); manifest.roles.forEach((r,i)=>{ const p=`roles[${i}]`; if(ids.has(r.id)) errors.push(`${p}.id must be unique.`); ids.add(r.id); if(slugs.has(r.slug)) errors.push(`${p}.slug must be unique.`); slugs.add(r.slug); if(r.status==='draft' && /JobPosting/i.test(JSON.stringify(r))) errors.push(`${p} draft must not include JobPosting metadata.`); if(r.application){ if(r.application.cv && r.application.cv.allowedExtensions && r.application.cv.allowedExtensions.indexOf('.doc') !== -1) errors.push(`${p}.application.cv must not allow legacy .doc files.`); if(r.status !== 'published' && r.application.enabled === true) errors.push(`${p}.application.enabled must remain false unless the role is published and approved.`); } ['title','location','department','reportingLine','employmentType','targetStartDate','roleOverview','responsibilities','requiredQualifications','preferredQualifications','recruitmentStatus'].forEach(f=>scanText(r[f],`${p}.${f}`,errors)); }); return errors; }
if (require.main === module) { const errors=validateManifest(readJson(manifestPath), readJson(schemaPath)); if(errors.length){ console.error(errors.join('\n')); process.exit(1); } console.log('recruitment role manifest validated'); }
module.exports = { validateManifest, validateSemantics };
