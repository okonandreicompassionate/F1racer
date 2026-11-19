// Tiny relay for APEX GP multiplayer. Setup: npm i ws   then: node server.js
// Serves index.html and relays player state per room. Deploy on Render/Railway; friends open the URL.
const http=require('http'),fs=require('fs'),{WebSocketServer}=require('ws');
const srv=http.createServer((q,r)=>{r.writeHead(200,{'content-type':'text/html'});r.end(fs.readFileSync(__dirname+'/index.html'))});
const wss=new WebSocketServer({server:srv,maxPayload:4096}),rooms=new Map();
wss.on('connection',ws=>{let room,id;
 ws.on('message',d=>{let m;try{m=JSON.parse(d)}catch(e){return}
  if(m.t==='j'){id=String(m.id).slice(0,24);const k=String(m.r).slice(0,8);if(!rooms.has(k))rooms.set(k,new Map());room=rooms.get(k);if(room.size>=12)return ws.close();
   room.set(id,{ws,s:{}});room.forEach((o,k2)=>{if(k2!==id)ws.send(JSON.stringify({t:'p',id:k2,s:o.s}))})}
  else if(m.t==='p'&&room&&room.get(id)){const o=room.get(id);Object.assign(o.s,m.s);const out=JSON.stringify({t:'p',id,s:m.s});room.forEach((p,k2)=>{if(k2!==id&&p.ws.readyState===1)p.ws.send(out)})}});
 ws.on('close',()=>{if(!room)return;room.delete(id);room.forEach(p=>p.ws.readyState===1&&p.ws.send(JSON.stringify({t:'l',id})));if(!room.size)for(const[k,v]of rooms)if(v===room)rooms.delete(k)})});
srv.listen(process.env.PORT||3000,()=>console.log('APEX GP on :'+(process.env.PORT||3000)));