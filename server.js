// APEX GP server: serves the game, the /soundtrack folder, and the multiplayer relay.
// Setup: npm i ws   then: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib'),{WebSocketServer}=require('ws');
const ROOT=__dirname,MUS=path.join(ROOT,'soundtrack'),AUD=/\.(mp3|ogg|wav|m4a|flac|aac)$/i;
const TYPES={'.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.m4a':'audio/mp4','.flac':'audio/flac','.aac':'audio/aac'};
const CORS={'access-control-allow-origin':'*'},rooms=new Map();
let page=null,pageGz=null;
const send=(res,code,type,body)=>{res.writeHead(code,{'content-type':type,...CORS});res.end(body)};
const srv=http.createServer((req,res)=>{
 const u=decodeURIComponent(req.url.split('?')[0]);
 if(u==='/api/music'){let l=[];try{l=fs.readdirSync(MUS).filter(f=>AUD.test(f))}catch(e){}return send(res,200,'application/json',JSON.stringify(l))}
 if(u==='/api/rooms')return send(res,200,'application/json',JSON.stringify([...rooms].map(([r,m])=>({r,n:m.size}))));
 if(u.startsWith('/soundtrack/')){const f=path.join(MUS,path.basename(u));if(!fs.existsSync(f))return send(res,404,'text/plain','not found');
  const size=fs.statSync(f).size,ty=TYPES[path.extname(f).toLowerCase()]||'application/octet-stream',m=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');
  if(m){const a=m[1]?+m[1]:0,b=m[2]?Math.min(+m[2],size-1):size-1;res.writeHead(206,{'content-type':ty,'accept-ranges':'bytes','content-range':`bytes ${a}-${b}/${size}`,'content-length':b-a+1,...CORS});return fs.createReadStream(f,{start:a,end:b}).pipe(res)}
  res.writeHead(200,{'content-type':ty,'accept-ranges':'bytes','content-length':size,...CORS});return fs.createReadStream(f).pipe(res)}
 if(!page){page=fs.readFileSync(path.join(ROOT,'index.html'));pageGz=zlib.gzipSync(page,{level:9})}
 const gz=/gzip/.test(req.headers['accept-encoding']||'');
 res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=600',...(gz?{'content-encoding':'gzip'}:{})});res.end(gz?pageGz:page)});
const wss=new WebSocketServer({server:srv,maxPayload:4096});
wss.on('connection',ws=>{let room,id,key;
 ws.on('message',d=>{let m;try{m=JSON.parse(d)}catch(e){return}
  if(m.t==='j'&&!room){id=String(m.id).slice(0,24);key=String(m.r).slice(0,8);if(!rooms.has(key)){const created=new Map();created.host=id;rooms.set(key,created)}room=rooms.get(key);if(room.size>=12)return ws.close();
   room.set(id,{ws,s:{}});ws.send(JSON.stringify({t:'hi',host:room.host}));room.forEach((o,k)=>{if(k!==id)ws.send(JSON.stringify({t:'p',id:k,s:{...o.s,h:k===room.host}}))})}
  else if(m.t==='p'&&room&&room.get(id)&&m.s&&typeof m.s==='object'){const o=room.get(id);o.s={...m.s,h:id===room.host};const out=JSON.stringify({t:'p',id,s:o.s});room.forEach((p,k)=>{if(k!==id&&p.ws.readyState===1)p.ws.send(out)})}});
 ws.on('close',()=>{if(!room)return;const wasHost=id===room.host;room.delete(id);room.forEach(p=>p.ws.readyState===1&&p.ws.send(JSON.stringify({t:'l',id})));if(!room.size)rooms.delete(key);else if(wasHost){room.host=room.keys().next().value;room.forEach((p,k)=>p.ws.readyState===1&&p.ws.send(JSON.stringify({t:'hi',host:room.host})))}})});
srv.listen(process.env.PORT||3000,()=>console.log('APEX GP on :'+(process.env.PORT||3000)));