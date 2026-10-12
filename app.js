// app.js
const $ = s => document.querySelector(s);
const input = $('#input'), output = $('#output'), go = $('#go');
const inSize = $('#inSize'), outSize = $('#outSize');
const ratio = $('#ratio'), delta = $('#delta'), timeEl = $('#time');
const toast = $('#toast');

function human(n){
  if(n<1024) return n+' B';
  if(n<1024*1024) return (n/1024).toFixed(1)+' KB';
  return (n/1024/1024).toFixed(2)+' MB';
}
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>toast.classList.remove('show'), 2200);
}
function updateInSize(){ inSize.textContent = human(new Blob([input.value]).size); }
input.addEventListener('input', updateInSize);

const drop = $('#drop'), fileInput = $('#file');
drop.addEventListener('click', ()=>fileInput.click());
drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', ()=>drop.classList.remove('over'));
drop.addEventListener('drop', e=>{
  e.preventDefault(); drop.classList.remove('over');
  const f = e.dataTransfer.files[0]; if(f) readFile(f);
});
fileInput.addEventListener('change', e=>{
  const f = e.target.files[0]; if(f) readFile(f);
});
function readFile(f){
  const r = new FileReader();
  r.onload = () => { input.value = r.result; updateInSize(); showToast('Loaded '+f.name); };
  r.readAsText(f);
}

go.addEventListener('click', ()=>{
  const src = input.value;
  if(!src.trim()){ showToast('Nothing to obfuscate'); return; }
  go.disabled = true;
  go.textContent = 'Working…';
  setTimeout(()=>{
    try{
      const opts = {
        strings:  $('#oStr').checked,
        mangle:   $('#oMangle').checked,
        deadCode: $('#oDead').checked,
        vm:       $('#oCF').checked,
        integrity:$('#oInt').checked,
        watermark:$('#oWM').checked,
      };
      const { code, time } = FLXR.obfuscate(src, opts);
      output.value = code;
      outSize.textContent = human(new Blob([code]).size);
      ratio.textContent = (code.length/Math.max(1,src.length)).toFixed(2)+'x';
      delta.textContent = '+' + (code.length - src.length) + ' chars';
      timeEl.textContent = time.toFixed(1)+' ms';
      showToast('Obfuscated ✓');
    } catch(err){
      console.error(err);
      showToast('Error: '+err.message);
      output.value = '-- error: '+err.message+'\n'+err.stack;
    } finally {
      go.disabled = false;
      go.textContent = 'Obfuscate';
    }
  }, 20);
});

$('#copy').addEventListener('click', async ()=>{
  if(!output.value) return showToast('Nothing to copy');
  try{ await navigator.clipboard.writeText(output.value); showToast('Copied to clipboard'); }
  catch{ output.select(); document.execCommand('copy'); showToast('Copied'); }
});
$('#dl').addEventListener('click', ()=>{
  if(!output.value) return showToast('Nothing to download');
  const blob = new Blob([output.value], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'flxr_' + Date.now() + '.lua';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Downloaded');
});
$('#clear').addEventListener('click', ()=>{
  input.value = ''; output.value = '';
  inSize.textContent='0 B'; outSize.textContent='0 B';
  ratio.textContent='—'; delta.textContent='—'; timeEl.textContent='—';
});