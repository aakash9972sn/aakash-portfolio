'use strict';
/* Optional Gemini Live relay. Raw microphone PCM never leaves the backend except
 * to the configured Gemini Live model. Secret keys are never sent to browsers.
 * Disabled by default: ENABLE_LIVE_AUDIO=true required.
 */
const {WebSocketServer,WebSocket}=require('ws');
const {GoogleGenAI}=require('@google/genai');
function attachLiveRelay(server,origins){
 const wss=new WebSocketServer({noServer:true,maxPayload:40000,perMessageDeflate:false});
 const perIP=new Map();
 function allowed(req){
  const origin=String(req.headers.origin||'').replace(/\/+$/,'');
  return origin&&origins.has(origin);
 }
 server.on('upgrade',(req,socket,head)=>{
  let url;
  try{url=new URL(req.url||'','http://localhost')}catch{socket.destroy();return}
  if(url.pathname!=='/ws/live'){socket.destroy();return}
  const ip=req.socket.remoteAddress||'unknown';
  const ok=process.env.ENABLE_LIVE_AUDIO==='true'&&!!process.env.GEMINI_API_KEY&&allowed(req)&&
    (perIP.get(ip)||0)<2&&wss.clients.size<20;
  if(!ok){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return}
  wss.handleUpgrade(req,socket,head,ws=>{ws._clientIP=ip;wss.emit('connection',ws,req)});
 });
 wss.on('connection',async ws=>{
  const ip=ws._clientIP;perIP.set(ip,(perIP.get(ip)||0)+1);
  let session,closing=false,chunks=0;
  const expiry=setTimeout(()=>{ws.close(1000,'Live session time limit reached')},180000);
  const safeSend=data=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))};
  function stop(){
   if(closing)return;closing=true;clearTimeout(expiry);
   perIP.set(ip,Math.max(0,(perIP.get(ip)||1)-1));
   try{session?.close()}catch{}
  }
  ws.on('close',stop);ws.on('error',stop);
  try{
   const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
   session=await ai.live.connect({
    model:process.env.GEMINI_LIVE_MODEL||'gemini-live-2.5-flash-preview',
    config:{
     responseModalities:['AUDIO'],
     inputAudioTranscription:{},outputAudioTranscription:{},
     systemInstruction:'You are a helpful voice assistant for an electronics portfolio and educational test centre. Speak clearly in English/Hindi/Hinglish. Never claim to have placed a real Blunder order.'
    },
    callbacks:{
     onopen:()=>safeSend({type:'ready'}),
     onmessage:(m)=>{
      const content=m.serverContent||{};
      for(const part of content.modelTurn?.parts||[]){
       const audio=part.inlineData;
       if(audio?.data&&audio.mimeType?.startsWith('audio/pcm'))
        safeSend({type:'audio',data:audio.data,mimeType:audio.mimeType});
       if(part.text)safeSend({type:'text',text:String(part.text).slice(0,1000)});
      }
      if(content.inputTranscription?.text)safeSend({type:'input-transcript',text:String(content.inputTranscription.text).slice(0,1500)});
      if(content.outputTranscription?.text)safeSend({type:'output-transcript',text:String(content.outputTranscription.text).slice(0,1500)});
      if(content.turnComplete)safeSend({type:'turn-complete'});
      if(content.interrupted)safeSend({type:'interrupt'});
     },
     onerror:()=>safeSend({type:'error',message:'Live model connection failed. Use the browser voice fallback.'}),
     onclose:()=>{safeSend({type:'closed'});ws.close()}
    }
   });
   if(closing){session.close();return}
   safeSend({type:'ready'});
  }catch(e){safeSend({type:'error',message:'Live voice is unavailable for this API key/model. Browser speech fallback is available.'});ws.close();return}
  ws.on('message',raw=>{
   if(closing||!session)return;
   try{
    const msg=JSON.parse(String(raw));
    if(msg.type==='audio'){
     if(++chunks>4000){ws.close(1008,'Audio limit');return}
     const data=String(msg.data||'');
     if(data.length>32000||data.length<50||!/^[A-Za-z0-9+/=]+$/.test(data))return;
     session.sendRealtimeInput({audio:{data,mimeType:'audio/pcm;rate=16000'}});
    }else if(msg.type==='stop'){
     session.sendRealtimeInput({audioStreamEnd:true});
    }else if(msg.type==='text'){
     session.sendRealtimeInput({text:String(msg.text||'').slice(0,350)});
    }
   }catch{safeSend({type:'error',message:'Invalid audio frame'})}
  });
 });
 return wss;
}
module.exports={attachLiveRelay};
