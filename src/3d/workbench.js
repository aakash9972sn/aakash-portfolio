/* Interactive hardware workbench — procedural ESM Three.js, no external HDR.
 * All geometry/lighting/labels created locally; disposes GPU resources on close.
 * CDN importmap maps 'three' and 'three/addons/' to identical pinned versions.
 */
(() => {
 'use strict';
 const button=document.querySelector('[data-workbench-open]');
 const dialog=document.getElementById('hardware-workbench');
 if(!button||!dialog)return;
 const stage=dialog.querySelector('[data-workbench-stage]');
 const status=dialog.querySelector('[data-workbench-status]');
 const zoomButton=dialog.querySelector('[data-workbench-reset]');
 const toggleDock=dialog.querySelector('[data-workbench-toggle-dock]');
 const dock=dialog.querySelector('[data-workbench-dock]');
 const labels=dialog.querySelector('[data-workbench-labels]');
 const spin=dialog.querySelector('[data-workbench-spin]');
 const wire=dialog.querySelector('[data-workbench-wire]');
 let renderer,scene,camera,controls,root,observer,frame=0,environment,pmrem,THREE,looping=false;
 let allMaterials=[],allGeometries=[],canvasTextures=[],meshList=[];
 let loaded=null;
 const trackMaterial=m=>(allMaterials.push(m),m);
 const trackGeometry=g=>(allGeometries.push(g),g);
 const dark=()=>document.documentElement.dataset.theme==='dark';
 const say=msg=>{if(status)status.textContent=msg};
 function makeTexture(THREE,roughness=false){
  const c=document.createElement('canvas');c.width=1024;c.height=650;
  const ctx=c.getContext('2d');
  if(roughness){
   const image=ctx.createImageData(c.width,c.height);
   for(let i=0;i<image.data.length;i+=4){
    const grain=155+Math.floor(Math.random()*28);
    image.data[i]=grain;image.data[i+1]=grain;image.data[i+2]=grain;image.data[i+3]=255;
   }
   ctx.putImageData(image,0,0);
  }else{
   ctx.clearRect(0,0);ctx.strokeStyle='#effff0';ctx.fillStyle='#f1fff2';ctx.lineWidth=3;
   ctx.strokeRect(22,22,980,606);
   ctx.font='bold 36px monospace';ctx.fillText('ECE / REFERENCE PCB',42,68);
   ctx.font='22px monospace';ctx.fillText('ESP32-S3    ·    MFRC522',42,107);
   ctx.font='bold 27px monospace';
   ctx.fillText('U1  ESP32-S3',307,276);
   ctx.fillText('RFID  13.56MHz',718,144);
   ctx.fillText('3V3  GND  MOSI  MISO  SCK',90,564);
   ctx.fillText('LED  STATUS',435,530);
   ctx.strokeStyle='rgba(232,255,235,.64)';ctx.lineWidth=2;
   for(let i=0;i<18;i++){ctx.beginPath();ctx.arc(44+i*52,613,3,0,Math.PI*2);ctx.stroke()}
  }
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=4;
  canvasTextures.push(t);
  return t;
 }
 function addMesh(group,geo,mat,position=[0,0,0],rotation=[0,0,0]){
  const mesh=new THREE.Mesh(trackGeometry(geo),mat);
  mesh.position.set(...position);mesh.rotation.set(...rotation);
  group.add(mesh);meshList.push(mesh);return mesh;
 }
 function makeBoard(THREE,group,material){
  // Rounded outline with real beveled edges and physical PCB thickness.
  const w=8.5,d=5.5,r=.22;
  const s=new THREE.Shape();
  s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);
  s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);
  s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);
  s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);
  s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
  const geo=new THREE.ExtrudeGeometry(s,{depth:.17,bevelEnabled:true,bevelSize:.038,bevelThickness:.035,bevelSegments:3,steps:1,curveSegments:7});
  addMesh(group,geo,material,[0,-.10,0],[-Math.PI/2,0,0]);
  // Silkscreen is a transparent procedural CanvasTexture above the solder mask.
  const print=makeTexture(THREE);
  addMesh(group,new THREE.PlaneGeometry(8.1,5.2),trackMaterial(new THREE.MeshBasicMaterial({
    map:print,transparent:true,depthWrite:false,opacity:.72,side:THREE.DoubleSide
  })),[0,.165,0],[-Math.PI/2,0,0]);
  // Through-hole mounting holes, represented by dark metal rings.
  const ring=trackMaterial(new THREE.MeshStandardMaterial({color:0xbdc7bf,metalness:.76,roughness:.31}));
  const bore=trackMaterial(new THREE.MeshStandardMaterial({color:0x071a15,roughness:.83}));
  for(const x of [-3.81,3.81])for(const z of [-2.32,2.32]){
    addMesh(group,new THREE.CylinderGeometry(.14,.14,.028,28),ring,[x,.18,z]);
    addMesh(group,new THREE.CylinderGeometry(.082,.082,.03,28),bore,[x,.2,z]);
  }
 }
 function trace(THREE,group,coords,metal,width=.065){
  for(let i=0;i<coords.length-1;i++){
   const a=coords[i],b=coords[i+1];
   const dx=b[0]-a[0],dz=b[1]-a[1];
   const line=addMesh(group,new THREE.BoxGeometry(Math.hypot(dx,dz),.017,width),metal,
     [(a[0]+b[0])/2,.185,(a[1]+b[1])/2],[0,-Math.atan2(dz,dx),0]);
   line.castShadow=false;
  }
  for(const p of coords)addMesh(group,new THREE.CylinderGeometry(width*.64,width*.64,.02,12),metal,[p[0],.192,p[1]]);
 }
 function makeESP32(THREE,group,mats){
  const g=new THREE.Group();g.position.set(-1.18,.18,-.16);group.add(g);
  const substrate=trackMaterial(new THREE.MeshPhysicalMaterial({color:0x122d2b,roughness:.82,metalness:.08}));
  addMesh(g,new THREE.BoxGeometry(2.65,.1,2.75),substrate,[0,.07,0]);
  addMesh(g,new THREE.BoxGeometry(1.95,.17,1.95),mats.metal,[0,.23,-.12]);
  addMesh(g,new THREE.BoxGeometry(1.14,.035,.14),mats.silk,[0,.323,-.7]);
  addMesh(g,new THREE.BoxGeometry(.12,.025,.12),mats.silk,[-.9,.32,-.93]);
  // castellated pins on 2 edges with visible gold contacts.
  for(let i=0;i<15;i++){
   let z=-1.18+i*(2.36/14);
   for(const x of [-1.31,1.31]){
     addMesh(g,new THREE.BoxGeometry(.14,.02,.073),mats.gold,[x,.136,z]);
   }
  }
  const chip=trackMaterial(new THREE.MeshPhysicalMaterial({color:0x14191c,roughness:.44,metalness:.24}));
  addMesh(g,new THREE.BoxGeometry(1.05,.12,.86),chip,[0,.355,.22]);
  addMesh(g,new THREE.CylinderGeometry(.037,.037,.014,16),mats.silk,[-.37,.426,-.08]);
  // oscillator, passive components, ceramic caps
  for(let i=0;i<8;i++){
    const x=-.97+(i%4)*.18,z=.68+Math.floor(i/4)*.22;
    addMesh(g,new THREE.BoxGeometry(.125,.055,.074),i%3?mats.solder:mats.ceramic,[x,.18,z]);
  }
  return g;
 }
 function makeReader(THREE,group,mats){
  const g=new THREE.Group();g.position.set(2.1,.16,-.08);group.add(g);
  const darkboard=trackMaterial(new THREE.MeshStandardMaterial({color:0x123d4d,roughness:.74,metalness:.14}));
  addMesh(g,new THREE.BoxGeometry(3.15,.07,4.35),darkboard,[0,.08,0]);
  const copper=mats.gold;
  // Multi-loop RFID antenna, trace geometry follows rectangular coil.
  for(let i=0;i<5;i++){
    const sx=1.26-i*.15,sz=1.78-i*.17;
    const y=.145+i*.002;
    const coords=[[-sx,-sz],[sx,-sz],[sx,sz],[-sx,sz],[-sx,-sz]];
    for(let j=0;j<4;j++){
      const a=coords[j],b=coords[j+1],dx=b[0]-a[0],dz=b[1]-a[1];
      addMesh(g,new THREE.BoxGeometry(Math.hypot(dx,dz),.014,.045),copper,
        [(a[0]+b[0])/2,y,(a[1]+b[1])/2],[0,-Math.atan2(dz,dx),0]);
    }
  }
  const chip=trackMaterial(new THREE.MeshStandardMaterial({color:0x151717,roughness:.57,metalness:.19}));
  addMesh(g,new THREE.BoxGeometry(.58,.14,.58),chip,[0,.215,-.11]);
  for(let i=0;i<4;i++)for(const sign of [-1,1]){
    addMesh(g,new THREE.BoxGeometry(.15,.027,.065),mats.solder,[sign*.36,.147,-.28+i*.18]);
    addMesh(g,new THREE.BoxGeometry(.065,.027,.14),mats.solder,[-.28+i*.18,.147,sign*.36-.11]);
  }
  // Straight angled pin headers and 2.54mm-pitch connector.
  for(let i=0;i<8;i++){
    const z=-1.35+i*.36;
    addMesh(g,new THREE.BoxGeometry(.17,.14,.19),mats.black,[-1.52,.19,z]);
    addMesh(g,new THREE.BoxGeometry(.066,.45,.066),mats.solder,[-1.52,.45,z]);
    addMesh(g,new THREE.BoxGeometry(.16,.021,.11),mats.gold,[-1.36,.145,z]);
  }
  // Decoupling capacitors and discrete LEDs.
  for(let i=0;i<6;i++){
    addMesh(g,new THREE.BoxGeometry(.2,.085,.105),i%2?mats.ceramic:mats.solder,[-.82+i*.27,.19,1.55]);
  }
  return g;
 }
 function makeWorkbench(THREE){
  scene=new THREE.Scene();scene.background=new THREE.Color(dark()?0x091411:0xe5ebe5);
  camera=new THREE.PerspectiveCamera(39,1,.1,100);
  camera.position.set(9.2,8.5,10.6);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.48;
  stage.replaceChildren(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive three-dimensional illustrative RFID and ESP32 hardware board');
  renderer.domElement.setAttribute('role','img');
  pmrem=new THREE.PMREMGenerator(renderer);
  environment=new loaded.room();
  scene.environment=pmrem.fromScene(environment,.06).texture;
  scene.add(new THREE.HemisphereLight(0xd8f4ff,0x3e493c,2.0));
  const key=new THREE.DirectionalLight(0xffe7c0,3.3);key.position.set(4,11,7);scene.add(key);
  const fill=new THREE.DirectionalLight(0xa2cfe2,1.7);fill.position.set(-8,5,-4);scene.add(fill);
  root=new THREE.Group();scene.add(root);
  const mats={
   board:trackMaterial(new THREE.MeshPhysicalMaterial({color:0x1b5a49,roughness:.81,
      roughnessMap:makeTexture(THREE,true),metalness:.06,clearcoat:.3,clearcoatRoughness:.35})),
   metal:trackMaterial(new THREE.MeshStandardMaterial({color:0xb9c5b9,metalness:.83,roughness:.32})),
   gold:trackMaterial(new THREE.MeshStandardMaterial({color:0xf6ad44,metalness:.84,roughness:.19,emissive:0x4d2500,emissiveIntensity:.15})),
   silk:trackMaterial(new THREE.MeshBasicMaterial({color:0xf0faee})),
   solder:trackMaterial(new THREE.MeshStandardMaterial({color:0x828d8b,metalness:.82,roughness:.3})),
   ceramic:trackMaterial(new THREE.MeshStandardMaterial({color:0xd6d5c7,roughness:.42})),
   black:trackMaterial(new THREE.MeshStandardMaterial({color:0x11171c,roughness:.68}))
  };
  makeBoard(THREE,root,mats.board);
  makeESP32(THREE,root,mats);
  makeReader(THREE,root,mats);
  for(const coords of [
    [[-3.4,-1.2],[-2.85,-1.2],[-2.85,-1.6],[-.2,-1.6],[.7,-1.15]],
    [[-3.5,-.85],[-2.9,-.85],[-2.9,-1.96],[-.3,-1.96],[.75,-1.3]],
    [[-3.4,-.5],[-2.65,-.5],[-2.65,.72],[-.4,.72],[.62,.32]],
    [[-3.4,.25],[-2.55,.25],[-2.55,1.65],[.6,1.65]],
    [[-3.4,1.15],[-1.5,1.15],[-.8,2.02],[.74,2.02]]
  ])trace(THREE,root,coords,mats.gold,.055);
  // Status LEDs: layered bezel, colored lens and emissive centre.
  const ledMats=[0x2df99c,0xff5757,0x39b7ff].map(c=>trackMaterial(new THREE.MeshPhysicalMaterial({
    color:c,emissive:c,emissiveIntensity:.64,roughness:.13,transmission:.15
  })));
  ledMats.forEach((m,i)=>{
    const x=-3.4+i*.38,z=1.96;
    addMesh(root,new THREE.CylinderGeometry(.15,.15,.052,22),mats.solder,[x,.22,z]);
    addMesh(root,new THREE.SphereGeometry(.112,20,16),m,[x,.28,z]);
  });
  // Extra vias and SMD components along PCB edge.
  for(let i=0;i<16;i++){
    const x=-3.4+(i%8)*.39,z=-2.14+Math.floor(i/8)*.27;
    addMesh(root,new THREE.CylinderGeometry(.055,.055,.02,12),mats.gold,[x,.19,z]);
  }
  const floorMat=trackMaterial(new THREE.MeshStandardMaterial({color:dark()?0x11201a:0xd0d9d1,roughness:1}));
  addMesh(scene,new THREE.CylinderGeometry(5.2,5.2,.1,88),floorMat,[0,-.70,0]);
  controls=new loaded.OrbitControls(camera,renderer.domElement);
  controls.target.set(0,0,0);controls.enableDamping=true;controls.dampingFactor=.065;
  controls.minDistance=6;controls.maxDistance=23;controls.maxPolarAngle=Math.PI*.46;controls.minPolarAngle=.17;
  controls.enablePan=false;controls.update();
  observer=new ResizeObserver(resize);observer.observe(stage);
  resize();
 }
 function resize(){
  if(!renderer||!camera)return;
  const rect=stage.getBoundingClientRect();
  const width=Math.max(280,Math.floor(rect.width)),height=Math.max(260,Math.floor(rect.height));
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
 }
 function run(){
  if(!looping||!renderer||!dialog.open)return;
  frame=requestAnimationFrame(run);
  if(!document.hidden){
   if(spin?.checked && root)root.rotation.y+=.0025;
   controls?.update();renderer.render(scene,camera);
  }
 }
 async function open(){
  if(!dialog.open)dialog.showModal();
  if(renderer)return;
  say('Loading interactive procedural hardware model…');
  try{
   loaded=await (async()=>{
    const [three,orbit,room]=await Promise.all([
      import('three'),import('three/addons/controls/OrbitControls.js'),import('three/addons/environments/RoomEnvironment.js')
    ]);
    return{three,OrbitControls:orbit.OrbitControls,room:room.RoomEnvironment};
   })();
   if(!dialog.open)return;
   THREE=loaded.three;
   makeWorkbench(THREE);
   say('Conceptual visualization — rotate, zoom, toggle rotation and inspect the PCB. Not a measured or fabricated physical prototype.');
   looping=true;run();
  }catch(error){
   console.warn('Three.js viewer unavailable',error);
   say('3D preview could not load (WebGL or module CDN unavailable). Hardware circuit details remain available in this report.');
   stage.textContent='3D requires WebGL and access to the pinned Three.js ES modules. The underlying portfolio report works without it.';
  }
 }
 function dispose(){
  looping=false;cancelAnimationFrame(frame);
  observer?.disconnect();observer=null;
  controls?.dispose();controls=null;
  for(const g of allGeometries)g.dispose();
  for(const m of allMaterials)m.dispose();
  for(const t of canvasTextures)t.dispose();
  meshList=[];allGeometries=[];allMaterials=[];canvasTextures=[];
  scene?.environment?.dispose?.();
  pmrem?.dispose();pmrem=null;
  environment?.dispose?.();environment=null;
  renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement?.remove();renderer=null;
  root=null;scene=null;camera=null;loaded=null;
 }
 button.addEventListener('click',open);
 dialog.querySelector('[data-workbench-close]')?.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',dispose);
 zoomButton?.addEventListener('click',()=>{
  if(!camera||!controls)return;
  camera.position.set(9.2,8.5,10.6);controls.target.set(0,0,0);root.rotation.y=0;controls.update();
 });
 toggleDock?.addEventListener('click',()=>{
  dock.hidden=!dock.hidden;toggleDock.setAttribute('aria-expanded',String(!dock.hidden));
 });
 labels?.addEventListener('change',()=>{if(root)root.children.forEach(obj=>{
  if(obj.isMesh&&obj.material?.map?.isCanvasTexture&&obj.material?.transparent)obj.visible=labels.checked;
 })});
 wire?.addEventListener('change',()=>{
  if(!meshList.length)return;
  for(const m of meshList)m.material.wireframe=wire.checked;
 });
})();
