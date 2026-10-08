'use strict';
// Small RFC6455 server-side WebSocket adapter for BONDI. No npm dependency.
// Browser -> server frames must be masked. Incoming messages capped at 32 KiB.
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const MAX_MESSAGE = 32768;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WebSocketPeer extends EventEmitter {
  constructor(socket, head = Buffer.alloc(0)) {
    super();
    this.socket=socket; this.buffer=Buffer.alloc(0); this.closed=false;
    this.fragment=null; this.fragmentParts=[]; this.fragmentLength=0;
    socket.on('data', chunk => this._data(chunk));
    socket.on('close', () => this._close());
    socket.on('error', err => { this.emit('socketError',err); this._close(); });
    socket.on('end', () => this._close());
    if (head.length) queueMicrotask(() => this._data(head));
  }
  _close() { if(!this.closed){this.closed=true;this.emit('close');} }
  _fail() { if(!this.closed){this.close(1002);this.socket.destroy();} }
  sendJSON(data) { this.sendText(JSON.stringify(data)); }
  sendText(text) { this._sendFrame(1,Buffer.from(text,'utf8')); }
  _sendFrame(opcode, bytes) {
    if(this.closed||this.socket.destroyed)return;
    const len=bytes.length;
    let header;
    if(len<126){header=Buffer.from([0x80|opcode,len]);}
    else if(len<65536){header=Buffer.alloc(4);header[0]=0x80|opcode;header[1]=126;header.writeUInt16BE(len,2);}
    else {header=Buffer.alloc(10);header[0]=0x80|opcode;header[1]=127;header.writeBigUInt64BE(BigInt(len),2);}
    this.socket.write(Buffer.concat([header,bytes]));
  }
  close(code=1000) { if(this.closed)return;this._sendFrame(8,Buffer.from([(code>>8)&255,code&255])); this.socket.end(); this._close(); }
  _data(chunk) {
    if(this.closed)return;
    if(this.buffer.length+chunk.length > MAX_MESSAGE*2+128){this._fail();return;}
    this.buffer=Buffer.concat([this.buffer,chunk]);
    while(!this.closed){
      if(this.buffer.length<2)return;
      const a=this.buffer[0],b=this.buffer[1], opcode=a&0x0f, fin=!!(a&0x80);
      if((a&0x70)|| !(b&0x80)){this._fail();return;}
      let len=b&127,offset=2;
      if(len===126){if(this.buffer.length<4)return;len=this.buffer.readUInt16BE(2);offset=4;}
      else if(len===127){if(this.buffer.length<10)return;const n=this.buffer.readBigUInt64BE(2);if(n>BigInt(MAX_MESSAGE)){this._fail();return;}len=Number(n);offset=10;}
      if(len>MAX_MESSAGE || (opcode>=8 && (!fin||len>125))){this._fail();return;}
      if(this.buffer.length<offset+4+len)return;
      const mask=this.buffer.subarray(offset,offset+4);offset+=4;
      const payload=Buffer.from(this.buffer.subarray(offset,offset+len));
      for(let i=0;i<len;i++)payload[i]^=mask[i%4];
      this.buffer=this.buffer.subarray(offset+len);
      if(opcode===8){this.close();return;}
      if(opcode===9){this._sendFrame(10,payload);continue;}
      if(opcode===10)continue;
      if(opcode===1){
        if(this.fragment!==null){this._fail();return;}
        if(fin){this._deliver(payload);}
        else {this.fragment=1;this.fragmentParts=[payload];this.fragmentLength=payload.length;}
      }else if(opcode===0){
        if(this.fragment===null){this._fail();return;}
        this.fragmentParts.push(payload);this.fragmentLength+=payload.length;
        if(this.fragmentLength>MAX_MESSAGE){this._fail();return;}
        if(fin){this._deliver(Buffer.concat(this.fragmentParts));this.fragment=null;this.fragmentParts=[];this.fragmentLength=0;}
      }else {this._fail();return;}
    }
  }
  _deliver(payload) {
    // Fatal UTF-8 decoding rejects malformed browser input.
    try { const text=new TextDecoder('utf-8',{fatal:true}).decode(payload);this.emit('message',text); }
    catch(_) {this._fail();}
  }
}
function upgradeWebSocket(req,socket,head,handler,{allowedOrigins=[]}={}) {
  const origin=req.headers.origin||'';
  if(allowedOrigins.length && !allowedOrigins.includes(origin)){
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return null;
  }
  if(req.url!=='/ws' || req.method!=='GET' || req.headers.upgrade?.toLowerCase()!=='websocket' ||
    !String(req.headers.connection||'').toLowerCase().split(',').map(x=>x.trim()).includes('upgrade') ||
    req.headers['sec-websocket-version']!=='13' ||
    !/^[A-Za-z0-9+/]{22}==$/.test(req.headers['sec-websocket-key']||'')){
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');return null;
  }
  const digest=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+digest+'\r\n\r\n');
  const peer=new WebSocketPeer(socket,head);
  handler(peer);return peer;
}
module.exports={WebSocketPeer,upgradeWebSocket,MAX_MESSAGE};
