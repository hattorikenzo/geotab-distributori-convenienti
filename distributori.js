(function(){
"use strict";

const DATA_BASE="https://hattorikenzo.github.io/geotab-carburanti/data";
const GRID=.05;
const RADIUS_M=5000;
let api=null,vehicles=[],map=null,vehicleMarker=null,radiusCircle=null,selectedStationMarker=null;
const jsonCache=new Map(),gzipCache=new Map();
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dec=(n,d=3)=>new Intl.NumberFormat("it-IT",{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);

function call(method,params){return new Promise((resolve,reject)=>{try{api.call(method,params||{},resolve,e=>reject(new Error(typeof e==="string"?e:JSON.stringify(e))))}catch(e){reject(e)}})}
function get(type,search,limit){return call("Get",{typeName:type,search:search||{},resultsLimit:limit||50000})}
function hav(lat1,lon1,lat2,lon2){const R=6371000,p=Math.PI/180,a=Math.sin((lat2-lat1)*p/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function dt(v){let d=new Date(v);return isNaN(d)?String(v||"—"):d.toLocaleString("it-IT")}
function normalizeFuel(v){
 let raw=String(v||""),s=raw.toLowerCase();
 if(/(diesel|gasolio).*(hev|hybrid|ibrid)|(hev|hybrid|ibrid).*(diesel|gasolio)/i.test(raw))return "Gasolio";
 if(/\bhev\b|hybrid|ibrid/i.test(raw))return "Benzina";
 if(/diesel|gasolio/.test(s))return "Gasolio";
 if(/gasoline|petrol|benzina/.test(s))return "Benzina";
 if(/lpg|gpl/.test(s))return "GPL";
 if(/cng|metano/.test(s))return "Metano";
 return "";
}
function vinOf(v){return String(v&&((v.vehicleIdentificationNumber||v.vin||v.serialNumber))||"").trim().toUpperCase()}
function vehicleFuel(v){
 let text=[];
 const seen=new Set();
 function walk(x,d){if(x==null||d>6)return;if(typeof x==="string"||typeof x==="number"){text.push(String(x));return}if(typeof x!=="object"||seen.has(x))return;seen.add(x);for(const [k,y] of Object.entries(x)){text.push(k);walk(y,d+1)}}
 walk(v,0);
 let f=normalizeFuel(text.join(" "));if(f)return f;
 let vin=vinOf(v),name=String(v&&v.name||"").toLowerCase();
 if(vin.startsWith("UU15SDAG35")||vin.startsWith("VR3USHNKK")||name==="dacia m&m"||name==="daciam&m")return "Benzina";
 return "";
}
async function fetchJson(url){
 if(jsonCache.has(url))return jsonCache.get(url);
 let p=fetch(url,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()});
 jsonCache.set(url,p);try{return await p}catch(e){jsonCache.delete(url);throw e}
}
async function fetchGzip(url){
 if(gzipCache.has(url))return gzipCache.get(url);
 let p=(async()=>{let r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);let b=await r.blob();if(!("DecompressionStream" in window))throw new Error("Browser senza DecompressionStream");let ds=new DecompressionStream("gzip");return JSON.parse(await new Response(b.stream().pipeThrough(ds)).text())})();
 gzipCache.set(url,p);try{return await p}catch(e){gzipCache.delete(url);throw e}
}
function initMap(){
 if(map)return;
 map=L.map("map",{zoomControl:true}).setView([44.84,11.62],11);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
}
async function latestPosition(deviceId){
 let to=new Date(),from=new Date(to.getTime()-14*86400000);
 let rows=await get("LogRecord",{deviceSearch:{id:deviceId},fromDate:from.toISOString(),toDate:to.toISOString()},50000);
 let valid=(rows||[]).filter(r=>Number.isFinite(Number(r.latitude))&&Number.isFinite(Number(r.longitude))&&!(Number(r.latitude)===0&&Number(r.longitude)===0));
 valid.sort((a,b)=>new Date(b.dateTime)-new Date(a.dateTime));
 return valid[0]||null;
}
async function stationsWithin(lat,lon){
 let latDelta=RADIUS_M/111320,lonDelta=RADIUS_M/(111320*Math.max(.2,Math.cos(lat*Math.PI/180)));
 let minCy=Math.floor((lat-latDelta)/GRID),maxCy=Math.floor((lat+latDelta)/GRID);
 let minCx=Math.floor((lon-lonDelta)/GRID),maxCx=Math.floor((lon+lonDelta)/GRID);
 let jobs=[];
 for(let cy=minCy;cy<=maxCy;cy++)for(let cx=minCx;cx<=maxCx;cx++)jobs.push(fetchJson(`${DATA_BASE}/geo/${cy}_${cx}.json`).catch(()=>[]));
 let chunks=await Promise.all(jobs),seen=new Map();
 for(const arr of chunks)for(const s of arr||[]){
  let id=Number(s[0]),slat=Number(s[1]),slon=Number(s[2]),distance=hav(lat,lon,slat,slon);
  if(distance<=RADIUS_M&&!seen.has(id))seen.set(id,{raw:s,id,lat:slat,lon:slon,distance});
 }
 return [...seen.values()];
}
async function latestPrice(station,fuel,mode){
 let bucket=String(Math.floor(station.id/1000)).padStart(3,"0");
 let o=await fetchGzip(`${DATA_BASE}/prezzi/${bucket}/${station.id}.json.gz`).catch(()=>null);
 if(!o)return null;
 const now=new Date(),day=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
 let candidates=[];
 for(const [key,arr] of Object.entries(o.prezzi||{})){
  const p=key.split("|"),name=p[0],self=String(p[1]??"");
  if(normalizeFuel(name)!==fuel||self!==String(mode))continue;
  let exact=[],previous=[];
  for(const r of arr||[]){
   const stamp=String(r[0]||""),d=stamp.slice(0,10);
   if(d===day)exact.push(r);
   if(d<=day)previous.push(r);
  }
  const pool=exact.length?exact:previous;
  pool.sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
  if(pool.length){
   const r=pool[0],price=Number(r[1]);
   if(Number.isFinite(price)&&price>0)candidates.push({price,date:String(r[0]),source:r[2]||"MIMIT",self,exact:exact.length>0,fuel:name});
  }
 }
 candidates.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 return candidates[0]||null;
}
function stationInfo(s){let r=s.raw;return {name:r[3]||r[6]||r[4]||`Impianto ${s.id}`,brand:r[4]||"",address:[r[7],r[8],r[9]].filter(Boolean).join(" — ")}}
async function resolveAddress(lat,lon){
 try{
  let rows=await call("GetAddresses",{coordinates:[{x:Number(lon),y:Number(lat)}],movingAddresses:false});
  let a=Array.isArray(rows)?rows[0]:rows;
  if(a){
   if(typeof a==="string"&&a.trim())return a.trim();
   let parts=[a.streetNumber,a.street,a.city,a.region,a.postalCode,a.country].filter(Boolean);
   if(parts.length)return [...new Set(parts)].join(", ");
   if(a.formattedAddress)return String(a.formattedAddress);
  }
 }catch(e){}
 return "Indirizzo non disponibile";
}
async function showPosition(p){
 let lat=Number(p.latitude),lon=Number(p.longitude);
 $("positionText").textContent="Ricerca indirizzo…";$("positionDate").textContent="Ultima posizione: "+dt(p.dateTime);
 if(vehicleMarker)vehicleMarker.remove();if(radiusCircle)radiusCircle.remove();
 const carIcon=L.divIcon({className:"dc-car-wrap",html:'<div class="dc-car-marker" aria-label="Veicolo">🚗</div>',iconSize:[64,64],iconAnchor:[32,32]});
 vehicleMarker=L.marker([lat,lon],{icon:carIcon,zIndexOffset:1000,keyboard:false}).addTo(map);
 radiusCircle=L.circle([lat,lon],{radius:RADIUS_M,weight:2,fillOpacity:.05}).addTo(map);
 map.fitBounds(radiusCircle.getBounds(),{padding:[20,20]});
 let address=await resolveAddress(lat,lon);
 $("positionText").textContent=address;
}
function selectStationMarker(s,row){
 document.querySelectorAll("#rows tr").forEach(x=>x.classList.remove("dc-selected-row"));
 if(row)row.classList.add("dc-selected-row");
 if(selectedStationMarker)selectedStationMarker.remove();
 const flagIcon=L.divIcon({className:"dc-flag-wrap",html:'<div class="dc-flag-marker" aria-label="Distributore">⛽</div>',iconSize:[64,64],iconAnchor:[32,56]});
 selectedStationMarker=L.marker([s.lat,s.lon],{icon:flagIcon,zIndexOffset:800,title:"Apri itinerario in Google Maps"}).addTo(map);
 const mapsUrl=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.lat+","+s.lon)}&travelmode=driving`;
 selectedStationMarker.on("click",()=>window.open(mapsUrl,"_blank","noopener,noreferrer"));
}
function render(results,fuel,mode){
 results.sort((a,b)=>a.price.price-b.price.price||a.distance-b.distance);
 let top=results.slice(0,5);
 $("count").textContent=`${top.length} di ${results.length} impianti con prezzo`;
 let tb=$("rows");tb.innerHTML="";
 if(selectedStationMarker){selectedStationMarker.remove();selectedStationMarker=null}
 if(!top.length){
  tb.innerHTML='<tr><td colspan="7" class="dc-empty">Nessun prezzo MIMIT disponibile per i criteri selezionati.</td></tr>';
  $("bestPrice").textContent="—";$("bestName").textContent="Nessun risultato";$("bestInfo").textContent="—";return;
 }
 let best=top[0],bi=stationInfo(best);
 $("bestPrice").textContent=`€ ${dec(best.price.price,3)}/L`;
 $("bestName").textContent=bi.name;
 $("bestInfo").textContent=`${(best.distance/1000).toFixed(2).replace(".",",")} km · ${mode==="1"?"Self service":"Servito"} · comunicazione MIMIT ${dt(best.price.date)}`;
 let rowMap=new Map();
 top.forEach((s,i)=>{
  let info=stationInfo(s),tr=document.createElement("tr");
  if(i===0)tr.className="dc-best-row";
  tr.tabIndex=0;tr.title="Clicca per mostrare questo distributore sulla mappa";
  tr.innerHTML=`<td>${i+1}</td><td><div class="dc-station">${esc(info.name)}</div><div class="dc-address">${esc(info.address)}</div></td><td>${(s.distance/1000).toFixed(2).replace(".",",")} km</td><td>${esc(fuel)}</td><td>${mode==="1"?"Self":"Servito"}</td><td class="dc-num">€ ${dec(s.price.price,3)}</td><td>${esc(dt(s.price.date))}</td>`;
  tr.addEventListener("click",()=>selectStationMarker(s,tr));
  tr.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectStationMarker(s,tr)}});
  tb.appendChild(tr);rowMap.set(s,tr);
 });
 // All'inizio mostra sulla mappa soltanto il distributore più vicino tra i 5 visualizzati.
 let nearest=[...top].sort((a,b)=>a.distance-b.distance)[0];
 selectStationMarker(nearest,rowMap.get(nearest));
}
async function search(){
 let vid=$("vehicle").value;if(!vid)return;
 $("search").disabled=true;$("status").className="dc-status";$("status").textContent="Recupero ultima posizione del veicolo…";
 try{
  let v=vehicles.find(x=>x.id===vid)||{},fuel=$("fuel").value,mode=$("mode").value;
  let p=await latestPosition(vid);if(!p)throw new Error("Nessuna posizione GPS disponibile negli ultimi 14 giorni.");
  await showPosition(p);
  $("status").textContent="Ricerca impianti MIMIT entro 5 km…";
  let stations=await stationsWithin(Number(p.latitude),Number(p.longitude));
  $("status").textContent=`Trovati ${stations.length} impianti. Lettura prezzi MIMIT correnti…`;
  let results=[],batch=20;
  for(let i=0;i<stations.length;i+=batch){
   let part=stations.slice(i,i+batch);
   let prices=await Promise.all(part.map(s=>latestPrice(s,fuel,mode)));
   part.forEach((s,j)=>{if(prices[j])results.push({...s,price:prices[j]})});
   $("status").textContent=`Lettura prezzi MIMIT: ${Math.min(i+batch,stations.length)} / ${stations.length} impianti…`;
  }
  render(results,fuel,mode);
  $("status").className="dc-status ok";$("status").textContent=`Completato: ${results.length} distributori con prezzo ${fuel} ${mode==="1"?"Self":"Servito"} entro 5 km.`;
 }catch(e){$("status").className="dc-status err";$("status").textContent="Errore: "+(e&&e.message?e.message:String(e))}
 finally{$("search").disabled=false}
}
let bound=false,loaded=false,loading=false;
function bind(){
 if(bound)return;initMap();$("search").addEventListener("click",search);
 $("vehicle").addEventListener("change",()=>{let v=vehicles.find(x=>x.id===$("vehicle").value);let f=vehicleFuel(v);if(f)$("fuel").value=f});
 bound=true;
}
async function loadData(myApi){
 if(loaded||loading)return;loading=true;api=myApi;$("status").textContent="MyGeotab collegato. Caricamento veicoli…";
 try{
  vehicles=await get("Device",{},50000);vehicles=(vehicles||[]).filter(v=>!v.isArchived).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  $("vehicle").innerHTML='<option value="">Seleziona un veicolo…</option>'+vehicles.map(v=>`<option value="${esc(v.id)}">${esc(v.name||v.id)}</option>`).join("");
  $("search").disabled=false;$("status").className="dc-status ok";$("status").textContent=`MyGeotab collegato. ${vehicles.length} veicoli disponibili.`;loaded=true;
 }catch(e){$("status").className="dc-status err";$("status").textContent="Errore MyGeotab: "+e.message}
 finally{loading=false}
}
window.geotab=window.geotab||{};window.geotab.addin=window.geotab.addin||{};
window.geotab.addin.distributoriConvenienti=function(){return{
 initialize:function(myApi,state,callback){api=myApi;try{bind()}catch(e){$("status").textContent="Errore avvio: "+e.message}if(callback)callback()},
 focus:function(myApi,state){api=myApi||api;try{bind()}catch(e){return}if(api)loadData(api)},
 blur:function(){}
}};
})();