/* Optional chat voice tools: grounded search toggle, transcription and live mic.
 * No Gemini keys or privileged credentials are held in the browser.
 */
(()=>{
'use strict';
const host=document.querySelector('aakash-assistant');
const root=host?.shadowRoot;
if(!root)return;
const $=selector=>root.querySelector(selector);
const dialog=$('dialog'),input=$('textarea'),status=$('.status'),form=$('form');
const tools=document.createElement('section');
tools.className='ai-tools';
tools.setAttribute('aria-label','Optional AI tools');
tools.innerHTML=[
 '<div class="ai-tool-row"><label class="ai-tool-search"><input id="ai-verify-search" type="checkbox"> Verify with Web Search</label>',
 '<label class="ai-model-choice"><span>Model</span><select id="ai-model-preset" aria-label="Model effort"><option value="fast">Fast</option><option value="deep">Deep</option></select></label></div>',
 '<div class="ai-tool-row ai-tool-buttons">',
 '<button type="button" id="ai-voice-live" aria-pressed="false">🎙 Live voice</button>',
 '<button type="button" id="ai-audio-record" aria-pressed="false">● Record</button>',
 '<button type="button" id="ai-audio-upload">Upload audio</button>',
 '<button type="button" id="ai-speak-reply">Listen to reply</button>',
 '<button type="button" id="ai-figure-link">Figure Studio ↗</button>',
 '</div><input type="file" id="ai-audio-file" accept="audio/webm,audio/wav,audio/mpeg,audio/mp3,audio/ogg,audio/mp4" hidden>',
 '<p class="ai-tools-status" id="ai-tools-status" role="status"></p>'
].join('');
form.parentNode.insertBefore(tools,form);
const report=(msg)=>{$('#ai-tools-status').textContent=msg;};
const liveBtn=$('#ai-voice-live'),recordBtn=$('#ai-audio-record');
let stream=null,context=null,proc=null,socket=null,liveActive=false,playbackContext=null,playhead=0;
let recording=null,recordingStream=null,recorded=[];
function apiUrl(path){return (window.API_BASE_URL||'')+path}
function base64(bytes){
 let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(s);
}
function pcm16(float){
 const output=new Uint8Array(float.length*2);
 const view=new DataView(output.buffer);
 for(let i=0;i<float.length;i++){
  const n=Math.max(-1,Math.min(1,float[i]));
  view.setInt16(i*2,n<0?n*0x8000:n*0x7fff,true);
 }
 return base64(output);
}
function downsample(samples,ratio){
 if(ratio<=1.01)return samples;
 const len=Math.max(1,Math.round(samples.length/ratio));
 const result=new Float32Array(len);
 for(let i=0;i<len;i++){
   const from=Math.floor(i*ratio),to=Math.min(samples.length,Math.floor((i+1)*ratio));
   let sum=0;for(let j=from;j<Math.max(from+1,to);j++)sum+=samples[j]||0;
   result[i]=sum/Math.max(1,to-from);
 }
 return result;
}
async function playPCM(data,mimeType){
 try{
  if(!playbackContext)playbackContext=new (window.AudioContext||window.webkitAudioContext)();
  if(playbackContext.state==='suspended')await playbackContext.resume();
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
  const view=new DataView(bytes.buffer);
  const n=Math.floor(bytes.length/2),rate=Number(/rate=(\d+)/.exec(mimeType||'')?.[1])||24000;
  const buffer=playbackContext.createBuffer(1,n,rate);
  const out=buffer.getChannelData(0);
  for(let i=0;i<n;i++)out[i]=view.getInt16(i*2,true)/32768;
  const source=playbackContext.createBufferSource();source.buffer=buffer;
  source.connect(playbackContext.destination);
  playhead=Math.max(playbackContext.currentTime+0.02,playhead);
  source.start(playhead);playhead+=buffer.duration;
 }catch{report('Live audio playback unavailable in this browser.')}
}
function stopLive(){
 liveActive=false;
 liveBtn.textContent='🎙 Live voice';liveBtn.setAttribute('aria-pressed','false');
 try{socket?.send(JSON.stringify({type:'stop'}))}catch{}
 try{socket?.close()}catch{}
 socket=null;
 try{proc?.disconnect()}catch{}proc=null;
 stream?.getTracks().forEach(t=>t.stop());stream=null;
 if(context)context.close().catch(()=>{});context=null;
}
function browserSpeech(){
 const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SpeechRecognition){report('Live Gemini unavailable; this browser has no speech-recognition fallback. You can still type questions.');return}
 const speech=new SpeechRecognition();
 speech.lang=/\b(?:hi|hinglish)\b/i.test(navigator.language)?'hi-IN':'en-IN';
 speech.interimResults=false;
 speech.onresult=e=>{
  const result=e.results[e.results.length-1][0]?.transcript||'';
  input.value=(input.value+' '+result).trim().slice(0,700);
  report('Speech recognition complete (browser fallback). Press Send to ask AI.');
 };
 speech.onerror=e=>report('Browser speech recognition: '+e.error);
 speech.start();
 report('Listening with browser speech recognition; your browser may use its own speech service.');
}
async function startLive(){
 if(liveActive){stopLive();report('Live session stopped.');return}
 if(!navigator.mediaDevices?.getUserMedia || !window.isSecureContext){
  browserSpeech();return;
 }
 liveBtn.disabled=true;
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
  const service=window.API_BASE_URL||location.origin;
  const wsUrl=new URL(service.replace(/^http/i,'ws')+'/ws/live');
  socket=new WebSocket(wsUrl);
  let ready=false;
  const timer=setTimeout(()=>{if(!ready){try{socket?.close()}catch{};stopLive();browserSpeech()}},8000);
  socket.onmessage=async e=>{
    let m;try{m=JSON.parse(e.data)}catch{return}
    if(m.type==='ready'&&!ready){
      clearTimeout(timer);ready=true;liveActive=true;
      const Ctx=window.AudioContext||window.webkitAudioContext;
      context=new Ctx({sampleRate:16000});
      await context.resume();
      const src=context.createMediaStreamSource(stream);
      // ScriptProcessor fallback for broad browsers; all processing is client-side PCM.
      proc=context.createScriptProcessor(4096,1,1);
      const muted=context.createGain();muted.gain.value=0;
      src.connect(proc);proc.connect(muted);muted.connect(context.destination);
      proc.onaudioprocess=event=>{
        if(!liveActive||socket?.readyState!==WebSocket.OPEN)return;
        const samples=event.inputBuffer.getChannelData(0);
        const buf=downsample(samples,context.sampleRate/16000);
        socket.send(JSON.stringify({type:'audio',data:pcm16(buf)}));
      };
      liveBtn.textContent='■ Stop live';liveBtn.setAttribute('aria-pressed','true');
      report('Live Gemini connected. Speak naturally; audio stays transient.');
    } else if(m.type==='audio'&&m.data){playPCM(m.data,m.mimeType)}
    else if(m.type==='input-transcript'&&m.text){
      input.value=(input.value+' '+m.text).trim().slice(0,700);
    }else if(m.type==='output-transcript'&&m.text){
      report('AI: '+String(m.text).slice(0,180));
    }else if(m.type==='error'){report(m.message||'Live unavailable.');if(!ready){clearTimeout(timer);stopLive();browserSpeech()}}
  };
  socket.onerror=()=>{if(!ready){clearTimeout(timer);stopLive();browserSpeech()}else report('Live network error; retry or use browser speech.');};
  socket.onclose=()=>{clearTimeout(timer);if(liveActive){stopLive();report('Live session ended.')}}; 
 }catch(error){stopLive();report('Microphone unavailable: '+(error.message||error));browserSpeech()}
 finally{liveBtn.disabled=false}
}
liveBtn.addEventListener('click',startLive);
async function transcribeFile(file){
 if(!file)return;
 if(file.size>7*1024*1024){report('Audio file exceeds 7 MB. Please trim it.');return}
 const allowed=/^audio\/(webm|wav|x-wav|mpeg|mp3|ogg|mp4)(;codecs=[\w,.-]+)?$/;
 const mime=file.type||'audio/webm';
 if(!allowed.test(mime)){report('Upload a supported WebM, WAV, MP3, OGG or MP4 file.');return}
 report('Transcribing audio securely on the backend…');
 try{
  const buffer=new Uint8Array(await file.arrayBuffer());
  const response=await fetch(apiUrl('/api/ai/transcribe'),{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({mimeType:mime,audioBase64:base64(buffer)}),
   signal:AbortSignal.timeout(90000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Transcription not available.');
  input.value=(input.value+'\n'+String(data.transcript||'')).trim().slice(0,700);
  report('Transcript inserted in the chat box. Review it before sending.');
 }catch(e){report('Could not transcribe: '+(e.message||e))}
}
$('#ai-audio-upload').addEventListener('click',()=>$('#ai-audio-file').click());
$('#ai-audio-file').addEventListener('change',event=>{transcribeFile(event.target.files?.[0]);event.target.value=''});
async function recordToggle(){
 if(recording&&recording.state==='recording'){recording.stop();recordBtn.textContent='● Record';recordBtn.setAttribute('aria-pressed','false');return}
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){browserSpeech();return}
 try{
  recordingStream=await navigator.mediaDevices.getUserMedia({audio:true});
  recorded=[];
  const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
  recording=new MediaRecorder(recordingStream,{mimeType:mime});
  recording.ondataavailable=e=>{if(e.data?.size)recorded.push(e.data)};
  recording.onstop=()=>{
   recordingStream?.getTracks().forEach(t=>t.stop());recordingStream=null;
   const blob=new Blob(recorded,{type:recording.mimeType});recorded=[];
   if(blob.size)transcribeFile(new File([blob],'microphone.webm',{type:recording.mimeType}));
  };
  recording.start();recordBtn.textContent='■ Stop recording';recordBtn.setAttribute('aria-pressed','true');
  report('Recording locally. Click Stop to request transcription.');
  setTimeout(()=>{if(recording?.state==='recording')recording.stop()},60000);
 }catch(e){report('Cannot record mic: '+e.message);browserSpeech()}
}
recordBtn.addEventListener('click',recordToggle);
$('#ai-speak-reply').addEventListener('click',()=>{
 const messages=[...root.querySelectorAll('.message.assistant > p')];
 const answer=messages.at(-1)?.textContent||'';
 if(!answer)return report('Ask a question first to hear the reply.');
 if(!window.speechSynthesis)return report('Speech synthesis is unavailable in this browser.');
 speechSynthesis.cancel();
 const utter=new SpeechSynthesisUtterance(answer.slice(0,3000));
 utter.rate=1.0;speechSynthesis.speak(utter);
 report('Reading the last AI reply with browser speech synthesis.');
});
$('#ai-figure-link').addEventListener('click',()=>window.open(new URL('figure-studio.html',new URL('.',document.querySelector('script[src*="ai-tools.js"]')?.src||location.href)).href,'_blank','noopener'));
dialog.addEventListener('close',()=>{
 stopLive();
 if(recording?.state==='recording')recording.stop();
 window.speechSynthesis?.cancel?.();
});
})();
