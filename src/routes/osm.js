'use strict';
/* Nominatim OSM fallback. Respect public-instance 1 request/second global
 * rate limit, proper User-Agent, query caps and 12h cache. No tracking key.
 */
const cache=new Map();
let queue=Promise.resolve(),lastRequest=0;
function address(v){
 const a=v.address||{},name=String(v.display_name||'').slice(0,350);
 return {
  lat:Number(v.lat),lng:Number(v.lon),formattedAddress:name,
  addressLine:String([a.house_number,a.road||a.pedestrian||a.suburb||a.neighbourhood].filter(Boolean).join(' ')||name.split(',').slice(0,2).join(',')).slice(0,220),
  city:String(a.city||a.town||a.village||a.county||'').slice(0,80),
  state:String(a.state||'').slice(0,80),
  pincode:/^[1-9]\d{5}$/.test(a.postcode||'')?a.postcode:''
 };
}
async function nominatim(url){
 const saved=cache.get(url);
 if(saved && Date.now()-saved.at<12*3600*1000)return saved.data;
 const task=queue.then(async()=>{
  const delay=Math.max(0,1100-(Date.now()-lastRequest));
  if(delay)await new Promise(r=>setTimeout(r,delay));
  lastRequest=Date.now();
  const response=await fetch(url,{
   headers:{'User-Agent':process.env.OSM_USER_AGENT||'AakashPortfolio/1.0 (educational-demo; contact: portfolio-maintainer)','Accept':'application/json'},
   signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw Error('OpenStreetMap search unavailable');
  const data=await response.json();
  cache.set(url,{at:Date.now(),data});
  if(cache.size>250)cache.delete(cache.keys().next().value);
  return data;
 });
 queue=task.catch(()=>{});
 return task;
}
function mountOSM(app){
 app.post('/api/osm/search',async(req,res)=>{
  const query=String(req.body?.query||'').trim();
  if(query.length<3||query.length>180)return res.status(400).json({error:'Enter a location search (3-180 characters).'});
  try{
   const url='https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=in&q='+encodeURIComponent(query);
   const results=(await nominatim(url)).map(address).filter(v=>Number.isFinite(v.lat)&&Number.isFinite(v.lng));
   return res.json({results,provider:'OpenStreetMap · Nominatim'});
  }catch{return res.status(503).json({error:'OpenStreetMap search unavailable; enter address manually.'})}
 });
 app.post('/api/osm/reverse',async(req,res)=>{
  const lat=Number(req.body?.latitude??req.body?.lat),lon=Number(req.body?.longitude??req.body?.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return res.status(400).json({error:'Invalid coordinates.'});
  try{
   const url='https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat='+lat.toFixed(6)+'&lon='+lon.toFixed(6);
   return res.json({result:address(await nominatim(url)),provider:'OpenStreetMap · Nominatim'});
  }catch{return res.status(503).json({error:'Reverse location lookup unavailable; enter address manually.'})}
 });
}
module.exports={mountOSM};
