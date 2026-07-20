const assert=require('assert');
const base=require('../assets/data/recruitment/roles.v1.json');
const {createMemoryAdapters}=require('../api/recruitment/core/inMemoryAdapters');
const {initiateApplication,completeUpload,processScanResult}=require('../api/recruitment/core/flows');
const {APPLICATION_STATES:A,FILE_STATES:F,SCAN_RESULTS:S,ERROR_CODES:E}=require('../api/recruitment/core/constants');
const {transition}=require('../api/recruitment/core/stateMachines');
const {makeTinyZip}=require('../api/recruitment/core/fileTypes');
function manifest(rolePatch={}){const m=JSON.parse(JSON.stringify(base));m.roles=[Object.assign(m.roles.find(r=>r.id==='legal-assistant'),{status:'published',contentReviewRequired:false,application:{enabled:true,deadlineUtc:null,privacyNoticeVersion:'approved-v1',allowedSources:['website','linkedin','direct','other'],cv:{required:true,maxSizeBytes:100,allowedExtensions:['.pdf','.docx'],allowedMimeTypes:['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']}}},rolePatch)];return m;}
function req(p={}){return Object.assign({roleId:'legal-assistant',locale:'en',source:'website',clientSubmissionId:'550e8400-e29b-41d4-a716-446655440000',candidate:{fullName:'Candidate Name',email:'Person@Example.COM',telephone:'',currentLocation:'',linkedinUrl:'',coverNote:''},privacyAccepted:true,privacyNoticeVersion:'approved-v1',submittedAtClientUtc:'2026-07-20T00:00:00Z',file:{originalName:'cv.pdf',declaredMimeType:'application/pdf',sizeBytes:9}},p);}
async function start(m=manifest(),r=req()){const deps=createMemoryAdapters({manifest:m});const res=await initiateApplication(r,deps);return {deps,res};}
(async()=>{
for(const [patch,code] of [[{status:'draft'},E.ROLE_NOT_OPEN],[{status:'closed'},E.ROLE_NOT_OPEN],[{application:{enabled:false,deadlineUtc:null,privacyNoticeVersion:'approved-v1',allowedSources:['website'],cv:{required:true,maxSizeBytes:100,allowedExtensions:['.pdf'],allowedMimeTypes:['application/pdf']}}},E.ROLE_NOT_OPEN],[{contentReviewRequired:true},E.ROLE_NOT_OPEN],[{application:{enabled:true,deadlineUtc:'2026-01-01T00:00:00Z',privacyNoticeVersion:'approved-v1',allowedSources:['website'],cv:{required:true,maxSizeBytes:100,allowedExtensions:['.pdf'],allowedMimeTypes:['application/pdf']}}},E.APPLICATION_DEADLINE_PASSED]]){assert.strictEqual((await start(manifest(patch))).res.errorCode,code);}
assert.strictEqual((await start(manifest(),req({roleId:'../bad'}))).res.errorCode,E.ROLE_NOT_FOUND);
assert.strictEqual((await start(manifest(),req({locale:'fr'}))).res.errorCode,E.VALIDATION_FAILED);
assert.strictEqual((await start(manifest(),req({privacyNoticeVersion:'stale'}))).res.errorCode,E.PRIVACY_VERSION_INVALID);
assert.strictEqual((await start(manifest(),req({candidate:{...req().candidate,email:'bad'}}))).res.errorCode,E.VALIDATION_FAILED);
assert.strictEqual((await start(manifest(),req({candidate:{...req().candidate,fullName:'x'.repeat(201)}}))).res.errorCode,E.VALIDATION_FAILED);
assert.strictEqual((await start(manifest(),req({file:{originalName:'cv.doc',declaredMimeType:'application/msword',sizeBytes:9}}))).res.errorCode,E.FILE_TYPE_REJECTED);
assert.strictEqual((await start(manifest(),req({file:{originalName:'cv.pdf',declaredMimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',sizeBytes:9}}))).res.errorCode,E.FILE_TYPE_REJECTED);
assert.strictEqual((await start(manifest(),req({file:{originalName:'../cv.pdf',declaredMimeType:'application/pdf',sizeBytes:9}}))).res.errorCode,E.VALIDATION_FAILED);
assert.strictEqual((await start(manifest(),req({file:{originalName:'cv.pdf',declaredMimeType:'application/pdf',sizeBytes:101}}))).res.errorCode,E.FILE_TOO_LARGE);
let {deps,res}=await start();assert.ok(res.success);let again=await initiateApplication(req(),deps);assert.strictEqual(again.applicationReference,res.applicationReference);
assert.ok(!deps.files.get(res.fileReference).quarantineBlobPath.includes('Candidate'));
assert.ok(!deps.files.get(res.fileReference).quarantineBlobPath.includes('Example'));
deps.storage.put('recruitment-quarantine',deps.files.get(res.fileReference).quarantineBlobPath,Buffer.from('%PDF-test'),'application/pdf');let done=await completeUpload({applicationReference:res.applicationReference,fileReference:res.fileReference,completionToken:res.completionToken},deps);assert.ok(done.success);let done2=await completeUpload({applicationReference:res.applicationReference,fileReference:res.fileReference,completionToken:res.completionToken},deps);assert.ok(done2.success);
assert.strictEqual((await completeUpload({applicationReference:'x',fileReference:res.fileReference,completionToken:res.completionToken},deps)).errorCode,E.TOKEN_INVALID);
let s=await processScanResult({eventId:'e1',fileReference:res.fileReference,blobPath:deps.files.get(res.fileReference).quarantineBlobPath,result:S.Clean,scannedAtUtc:'2026-07-20T00:05:00Z'},deps);assert.ok(s.success);assert.strictEqual(deps.files.get(res.fileReference).technicalStatus,F.Ready);assert.strictEqual((await processScanResult({eventId:'e1',fileReference:res.fileReference,blobPath:deps.files.get(res.fileReference).quarantineBlobPath,result:S.Clean,scannedAtUtc:'2026-07-20T00:05:00Z'},deps)).deduplicated,true);
({deps,res}=await start());assert.strictEqual((await completeUpload({applicationReference:res.applicationReference,fileReference:res.fileReference,completionToken:res.completionToken},deps)).errorCode,E.BLOB_NOT_FOUND);
deps.storage.put('recruitment-quarantine',deps.files.get(res.fileReference).quarantineBlobPath,Buffer.from('%PDF-testx'),'application/pdf');assert.strictEqual((await completeUpload({applicationReference:res.applicationReference,fileReference:res.fileReference,completionToken:res.completionToken},deps)).errorCode,E.BLOB_MISMATCH);
({deps,res}=await start());deps.storage.put('recruitment-quarantine',deps.files.get(res.fileReference).quarantineBlobPath,Buffer.from('not pdf!!'),'application/pdf');assert.strictEqual((await completeUpload({applicationReference:res.applicationReference,fileReference:res.fileReference,completionToken:res.completionToken},deps)).errorCode,E.FILE_SIGNATURE_REJECTED);
const badZip=makeTinyZip(['x.txt']);({deps,res}=await start(manifest(),req({file:{originalName:'cv.docx',declaredMimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',sizeBytes:badZip.length}})));deps.storage.put('recruitment-quarantine',deps.files.get(res.fileReference).quarantineBlobPath,badZip,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');assert.strictEqual((await completeUpload({applicationReference:res.applicationReference,fileReference:res.fileReference,completionToken:res.completionToken},deps)).errorCode,E.FILE_SIGNATURE_REJECTED);
assert.throws(()=>transition('application',A.Ready,A.UploadPending),/not allowed/);
assert.ok(!JSON.stringify(deps.logger.logs).includes('%PDF-test'));
console.log('recruitment application core tests passed');
})();
