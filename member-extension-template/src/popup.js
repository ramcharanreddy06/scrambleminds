const CONFIG='buddyMemberConfig';
const CAPTURE='buddyCaptureEnabled';
const QUEUE='buddyCaptureQueue';
const LAST_SYNC='buddyLastSync';
const LAST_CAPTURE='buddyLastCapture';
const byId=id=>document.getElementById(id);
const template=typeof SCRAMBLED_MINDS_TEMPLATE_CONFIG==='object'?SCRAMBLED_MINDS_TEMPLATE_CONFIG:{};
function render(config,enabled,message=''){
  const ready=Boolean(config?.backendUrl&&config?.memberId&&config?.email&&config?.memberToken);
  byId('member-name').textContent=ready?config.memberId:'Member not configured';
  byId('member-detail').textContent=ready?config.email:'Admin preparation is required.';
  const button=byId('capture-toggle');
  button.disabled=!ready;
  button.classList.toggle('on',ready&&enabled);
  button.setAttribute('aria-pressed',String(ready&&enabled));
  byId('toggle-label').textContent=ready?(enabled?'Capture is ON':'Capture is OFF'):'Not ready';
  if(message)byId('sync-status').textContent=message;
}
chrome.storage.local.get([CONFIG,CAPTURE,QUEUE,LAST_SYNC,LAST_CAPTURE]).then(async data=>{
  const saved=data[CONFIG]||{};
  const config={backendUrl:template.backendUrl||saved.backendUrl||'',memberId:template.memberId||saved.memberId||'',email:template.email||saved.email||'',memberToken:template.memberToken||saved.memberToken||''};
  if(config.memberId&&config.email&&config.memberToken)await chrome.storage.local.set({[CONFIG]:config});
  const capture=data[LAST_CAPTURE];
  const sync=data[LAST_SYNC];
  const pending=Array.isArray(data[QUEUE])?data[QUEUE].length:0;
  const detail=capture?`Capture: ${capture.stage}${capture.platform?' ('+capture.platform+')':''}. ${pending} upload(s) pending.`:(pending?`${pending} upload(s) pending.`:'No capture diagnostic yet.');
  render(config,Boolean(data[CAPTURE]),sync?.ok===false?`Sync error: ${sync.error}. ${detail}`:detail);
}).catch(()=>render(template,false,'Could not load member settings.'));
byId('capture-toggle').addEventListener('click',async()=>{
  const data=await chrome.storage.local.get([CONFIG,CAPTURE]);
  const config=data[CONFIG]||template;
  if(!config.memberId||!config.memberToken)return;
  const enabled=!Boolean(data[CAPTURE]);
  await chrome.storage.local.set({[CAPTURE]:enabled});
  render(config,enabled,enabled?'Project capture enabled.':'Personal capture protection enabled.');
});
