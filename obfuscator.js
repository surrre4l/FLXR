// obfuscator.js
const FLXR = (() => {
const LUA_KW = new Set(['and','break','do','else','elseif','end','false','for','function','goto','if','in','local','nil','not','or','repeat','return','then','true','until','while']);
const ALPHABET = "ZqXk9vTn3sLpYwR8mBcDfGgHjK2uAeQi4oP0rS6tU7xV1yWzN5aCbEIJlMOhFd+/";

function randomBytes(n){ const b=new Uint8Array(n); crypto.getRandomValues(b); return Array.from(b); }
function strToBytes(s){ const b=[]; for(let i=0;i<s.length;i++) b.push(s.charCodeAt(i)&0xff); return b; }
function xorBytes(bytes,key){
  const k = Array.isArray(key) ? key : strToBytes(key);
  const out = new Array(bytes.length);
  for(let i=0;i<bytes.length;i++) out[i] = bytes[i] ^ k[i % k.length];
  return out;
}
function encodeB64(bytes){
  let out='';
  for(let i=0;i<bytes.length;i+=3){
    const b1=bytes[i]||0, b2=bytes[i+1]!==undefined?bytes[i+1]:0, b3=bytes[i+2]!==undefined?bytes[i+2]:0;
    const n=(b1<<16)|(b2<<8)|b3;
    out += ALPHABET[(n>>18)&63] + ALPHABET[(n>>12)&63];
    out += (i+1<bytes.length) ? ALPHABET[(n>>6)&63] : '=';
    out += (i+2<bytes.length) ? ALPHABET[n&63]    : '=';
  }
  return out;
}
function fnvLike(s){ let h=5381; for(let i=0;i<s.length;i++) h=(h*33+(s.charCodeAt(i)&0xff))%4294967296; return h; }

function tokenize(src){
  const t=[]; let i=0; const n=src.length;
  while(i<n){
    const c=src[i];
    if(/\s/.test(c)){ let j=i; while(j<n&&/\s/.test(src[j])) j++; t.push({t:'ws',v:src.slice(i,j)}); i=j; continue; }
    if(c==='['){
      const m=/^\[(=*)\[/.exec(src.slice(i));
      if(m){
        const close=']'+m[1]+']';
        const end=src.indexOf(close,i+m[0].length);
        if(end!==-1){ t.push({t:'string',v:src.slice(i,end+close.length),_long:true,_eq:m[1]}); i=end+close.length; continue; }
      }
    }
    if(c==='-'&&src[i+1]==='-'){
      let j=i+2;
      if(src[j]==='['){
        const m=/^\[(=*)\[/.exec(src.slice(j));
        if(m){
          const close=']'+m[1]+']';
          const end=src.indexOf(close,j+m[0].length);
          if(end!==-1){ t.push({t:'comment',v:src.slice(i,end+close.length)}); i=end+close.length; continue; }
        }
      }
      while(j<n&&src[j]!=='\n') j++;
      t.push({t:'comment',v:src.slice(i,j)}); i=j; continue;
    }
    if(c==='"'||c==="'"){
      let j=i+1;
      while(j<n){
        if(src[j]==='\\'){ j+=2; continue; }
        if(src[j]===c){ j++; break; }
        if(src[j]==='\n') break;
        j++;
      }
      t.push({t:'string',v:src.slice(i,j)}); i=j; continue;
    }
    if(/[0-9]/.test(c)||(c==='.'&&/[0-9]/.test(src[i+1]||''))){
      let j=i;
      if(c==='0'&&/[xX]/.test(src[i+1]||'')){
        j=i+2; while(j<n&&/[0-9a-fA-F.]/.test(src[j])) j++;
        if(/[pP]/.test(src[j]||'')){ j++; if(/[+-]/.test(src[j]||'')) j++; while(j<n&&/[0-9]/.test(src[j])) j++; }
      } else {
        while(j<n&&/[0-9.eE]/.test(src[j])){
          if((src[j]==='e'||src[j]==='E')&&/[+-]/.test(src[j+1]||'')){ j+=2; continue; }
          j++;
        }
      }
      t.push({t:'number',v:src.slice(i,j)}); i=j; continue;
    }
    if(/[A-Za-z_]/.test(c)){
      let j=i; while(j<n&&/[A-Za-z0-9_]/.test(src[j])) j++;
      const v=src.slice(i,j);
      t.push({t:LUA_KW.has(v)?'kw':'name',v}); i=j; continue;
    }
    if(src.slice(i,i+3)==='...'){ t.push({t:'op',v:'...'}); i+=3; continue; }
    const two=src.slice(i,i+2);
    if(['==','~=','<=','>=','..','::','//','<<','>>'].includes(two)){ t.push({t:'op',v:two}); i+=2; continue; }
    t.push({t:'op',v:c}); i++;
  }
  return t;
}

function luaStringToBytes(tok){
  if(tok._long){
    const m=/^\[(=*)\[([\s\S]*)\]\1\]$/.exec(tok.v);
    let content = m ? m[2] : '';
    if(content[0]==='\n') content=content.slice(1);
    return strToBytes(content);
  }
  const content = tok.v.slice(1,-1);
  const bytes=[];
  let i=0;
  while(i<content.length){
    const c=content[i];
    if(c!=='\\'){ bytes.push(content.charCodeAt(i)&0xff); i++; continue; }
    i++;
    const e=content[i];
    if(e==='n'){ bytes.push(10); i++; }
    else if(e==='t'){ bytes.push(9); i++; }
    else if(e==='r'){ bytes.push(13); i++; }
    else if(e==='a'){ bytes.push(7); i++; }
    else if(e==='b'){ bytes.push(8); i++; }
    else if(e==='f'){ bytes.push(12); i++; }
    else if(e==='v'){ bytes.push(11); i++; }
    else if(e==='\\'){ bytes.push(92); i++; }
    else if(e==='"'){ bytes.push(34); i++; }
    else if(e==="'"){ bytes.push(39); i++; }
    else if(e==='\n'){ bytes.push(10); i++; }
    else if(e==='x'){ const h=content.slice(i+1,i+3); bytes.push(parseInt(h,16)&0xff); i+=3; }
    else if(/[0-9]/.test(e)){ let num=''; while(/[0-9]/.test(content[i])&&num.length<3){num+=content[i];i++;} bytes.push(parseInt(num,10)&0xff); }
    else if(e==='z'){ i++; while(i<content.length&&/\s/.test(content[i])) i++; }
    else { bytes.push(content.charCodeAt(i)&0xff); i++; }
  }
  return bytes;
}

const DECODER_NAME = '__FLXR_S';
function encryptStringTokens(tokens, key){
  const out=[];
  for(const tk of tokens){
    if(tk.t!=='string'){ out.push(tk); continue; }
    const bytes = luaStringToBytes(tk);
    const enc = xorBytes(bytes, key);
    const b64 = encodeB64(enc);
    out.push({t:'name',v:DECODER_NAME});
    out.push({t:'op',v:'('});
    out.push({t:'string',v:'"'+b64+'"'});
    out.push({t:'op',v:')'});
  }
  return out;
}

function buildDecoderSrc(key){
  return `local ${DECODER_NAME}=function()local _A="${ALPHABET}";local _M={};for _i=1,#_A do _M[_A:sub(_i,_i)]=_i-1 end;local _K={${key.map(b=>'0x'+b.toString(16).padStart(2,'0')).join(',')}};return function(_s)local _b={};local _i=1;while _i<=#_s do local _a,_c,_d,_e=_M[_s:sub(_i,_i)],_M[_s:sub(_i+1,_i+1)],_M[_s:sub(_i+2,_i+2)],_M[_s:sub(_i+3,_i+3)];if not _a or not _c then break end;local _n=_a*262144+_c*4096;if _d then _n=_n+_d*64 end;if _e then _n=_n+_e end;_b[#_b+1]=string.char(math.floor(_n/65536)%256);if _d then _b[#_b+1]=string.char(math.floor(_n/256)%256)end;if _e then _b[#_b+1]=string.char(_n%256)end;_i=_i+4 end;local _o={};for _j=1,#_b do local _a=_b[_j];local _b2=_K[((_j-1)%#_K)+1];local _r,_bit=0,1;for _=1,8 do local _x,_y=_a%2,_b2%2;if _x~=_y then _r=_r+_bit end;_a,_b2,_bit=math.floor(_a/2),math.floor(_b2/2),_bit*2 end;_o[_j]=string.char(_r)end;return table.concat(_o)end end()`;
}

function mangleNames(tokens){
  const out=[];
  const scopes=[Object.create(null)];
  const used=new Set();
  const CH='IlO01abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let counter=0;
  function gen(){
    let n=counter++, name='';
    do{ name=CH[n%CH.length]+name; n=Math.floor(n/CH.length)-1; }while(n>=0);
    name='_'+name;
    while(used.has(name)||LUA_KW.has(name)){
      let m=counter++; name='_';
      do{ name=CH[m%CH.length]+name; m=Math.floor(m/CH.length)-1; }while(m>=0);
    }
    used.add(name); return name;
  }
  const push=()=>scopes.push(Object.create(null));
  const pop =()=>{ if(scopes.length>1) scopes.pop(); };
  function declare(nm){ const m=gen(); scopes[scopes.length-1][nm]=m; return m; }
  function lookup(nm){ for(let i=scopes.length-1;i>=0;i--) if(nm in scopes[i]) return scopes[i][nm]; return null; }

  const trivia=t=>t.t==='ws'||t.t==='comment';
  const nextI=(arr,idx)=>{ for(let i=idx+1;i<arr.length;i++) if(!trivia(arr[i])) return i; return -1; };
  const prevI=(arr,idx)=>{ for(let i=idx-1;i>=0;i--) if(!trivia(arr[i])) return i; return -1; };

  const brackets=[];
  let fnPending=false, expectDo=false;

  let i=0;
  while(i<tokens.length){
    const tk=tokens[i];
    if(trivia(tk)){ out.push(tk); i++; continue; }

    if(tk.t==='op' && (tk.v==='('||tk.v==='{'||tk.v==='[')){
      if(tk.v==='(' && fnPending){
        push();
        let j=i+1, expect=true;
        while(j<tokens.length){
          const p=tokens[j];
          if(trivia(p)){ j++; continue; }
          if(p.t==='op'&&p.v===')') break;
          if(p.t==='op'&&p.v===','){ expect=true; j++; continue; }
          if(p.t==='op'&&p.v==='...'){ expect=false; j++; continue; }
          if(expect&&p.t==='name'){ declare(p.v); expect=false; }
          j++;
        }
        fnPending=false;
      }
      brackets.push(tk.v);
    } else if(tk.t==='op' && (tk.v===')'||tk.v==='}'||tk.v===']')){
      brackets.pop();
    }

    if(tk.t==='kw'){
      if(tk.v==='function'){ fnPending=true; }
      else if(tk.v==='local'){
        let j=i+1;
        while(j<tokens.length&&trivia(tokens[j])) j++;
        if(j<tokens.length&&tokens[j].t==='kw'&&tokens[j].v==='function'){
          j++;
          while(j<tokens.length&&trivia(tokens[j])) j++;
          if(j<tokens.length&&tokens[j].t==='name') declare(tokens[j].v);
        } else {
          let expect=true;
          while(j<tokens.length){
            const p=tokens[j];
            if(trivia(p)){ j++; continue; }
            if(p.t==='name'&&expect){ declare(p.v); expect=false; j++; continue; }
            if(p.t==='op'&&p.v===','){ expect=true; j++; continue; }
            break;
          }
        }
      }
      else if(tk.v==='for'){
        push();
        let j=i+1;
        while(j<tokens.length){
          const p=tokens[j];
          if(trivia(p)){ j++; continue; }
          if(p.t==='name'){ declare(p.v); j++; continue; }
          if(p.t==='op'&&p.v===','){ j++; continue; }
          break;
        }
        expectDo=true;
      }
      else if(tk.v==='while'){ push(); expectDo=true; }
      else if(tk.v==='do'){ if(expectDo){ expectDo=false; } else { push(); } }
      else if(tk.v==='then'){ push(); }
      else if(tk.v==='elseif'){ pop(); }
      else if(tk.v==='else'){ pop(); push(); }
      else if(tk.v==='end'){ pop(); }
      else if(tk.v==='repeat'){ push(); }
      else if(tk.v==='until'){ pop(); }
    }

    if(tk.t==='name'){
      const pi=prevI(tokens,i);
      const prev=pi>=0?tokens[pi]:null;
      const isField = prev&&prev.t==='op'&&(prev.v==='.'||prev.v===':');
      const isLabel = prev&&prev.t==='op'&&prev.v==='::';
      const isGoto  = prev&&prev.t==='kw'&&prev.v==='goto';
      const nextTokIdx = nextI(tokens,i);
      const nextTok = nextTokIdx>=0?tokens[nextTokIdx]:null;
      const isLabelEnd = nextTok&&nextTok.t==='op'&&nextTok.v==='::';

      let isKey=false;
      if(brackets.length && brackets[brackets.length-1]==='{'){
        if(nextTok&&nextTok.t==='op'&&nextTok.v==='='){
          if(prev&&prev.t==='op'&&(prev.v==='{'||prev.v===',')) isKey=true;
        }
      }

      if(!isField && !isKey && !isLabel && !isLabelEnd && !isGoto){
        const m=lookup(tk.v);
        if(m){ out.push({t:'name',v:m}); i++; continue; }
      }
    }

    out.push(tk); i++;
  }
  return out;
}

function buildDeadCodeSrc(){
  const blocks = [
`do local _a,_b=7,7;if _a*_a-_b*_b==13 then local _c=string.char(70,76,88,82);error(_c)end end`,
`do local _t={1,2,3};if #_t==4 then local _q=0;for _i=1,100 do _q=_q+_i end;print(_q)end end`,
`do local _f=function()return false end;if _f() then local _x=("%d"):format(1);error(_x)end end`,
  ];
  return blocks[Math.floor(Math.random()*blocks.length)] + ' ';
}

/* ---------- random ident helper ---------- */
const RCH = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function makeIdGen(){
  const used = new Set();
  return function nid(){
    let s;
    do {
      s = '';
      const len = 6 + Math.floor(Math.random()*4);
      for(let i=0;i<len;i++) s += RCH[Math.floor(Math.random()*RCH.length)];
    } while(used.has(s));
    used.add(s);
    return '_' + s;
  };
}

/* ---------- VM wrapper ---------- */
function buildVMSrc(code, opts){
  const key = randomBytes(24);
  const enc = xorBytes(strToBytes(code), key);
  const b64 = encodeB64(enc);
  const hash = fnvLike(b64);

  const nid = makeIdGen();
  const N = {
    str: nid(), tab: nid(), mat: nid(), ldr: nid(),
    alp: nid(), key: nid(), pl: nid(), map: nid(),
    dec: nid(), xr:  nid(), pc:  nid(), fn:  nid(), src: nid(),
    h:   nid(), i:   nid(), o:   nid(), a:   nid(), b:   nid(),
    c:   nid(), e:   nid(), n:   nid(), j:   nid(), r:   nid(),
    bit: nid(), x:   nid(), y:   nid(), d:   nid()
  };

  // alphabet encoded as decimal byte escapes → looks like \90\113\88\107...
  const alphaEsc = strToBytes(ALPHABET).map(b => '\\' + b).join('');
  const kBytes = key.map(b => '0x'+b.toString(16).padStart(2,'0')).join(',');

  const integrityBlock = opts.integrity ? `
local ${N.h}=5381
for ${N.i}=1,#${N.pl} do ${N.h}=(${N.h}*33+${N.pl}:byte(${N.i}))%4294967296 end
if ${N.h}~=${hash} then error("FLXR: integrity check failed") end` : '';

  // compact, no comments, random names, encoded alphabet
  return `local ${N.str}=string local ${N.tab}=table local ${N.mat}=math
local ${N.ldr}=loadstring or load
if not ${N.ldr} then
  if warn then warn("[FLXRfuscator] loadstring is not available in this environment (Studio needs LoadStringEnabled; otherwise use an executor)") end
  return
end
local ${N.alp}="${alphaEsc}"
local ${N.key}={${kBytes}}
local ${N.pl}="${b64}"
local ${N.map}={}
for ${N.i}=1,#${N.alp} do ${N.map}[${N.alp}:sub(${N.i},${N.i})]=${N.i}-1 end
local function ${N.dec}(${N.d})
local ${N.o}={}
local ${N.i}=1
while ${N.i}<=#${N.d} do
local ${N.a},${N.b},${N.c},${N.e}=${N.map}[${N.d}:sub(${N.i},${N.i})],${N.map}[${N.d}:sub(${N.i}+1,${N.i}+1)],${N.map}[${N.d}:sub(${N.i}+2,${N.i}+2)],${N.map}[${N.d}:sub(${N.i}+3,${N.i}+3)]
if not ${N.a} or not ${N.b} then break end
local ${N.n}=${N.a}*262144+${N.b}*4096
if ${N.c} then ${N.n}=${N.n}+${N.c}*64 end
if ${N.e} then ${N.n}=${N.n}+${N.e} end
${N.o}[#${N.o}+1]=${N.str}.char(${N.mat}.floor(${N.n}/65536)%256)
if ${N.c} then ${N.o}[#${N.o}+1]=${N.str}.char(${N.mat}.floor(${N.n}/256)%256) end
if ${N.e} then ${N.o}[#${N.o}+1]=${N.str}.char(${N.n}%256) end
${N.i}=${N.i}+4
end
return ${N.tab}.concat(${N.o})
end
local function ${N.xr}(${N.d})
local ${N.o}={}
for ${N.i}=1,#${N.d} do
local ${N.a}=${N.d}:byte(${N.i})
local ${N.b}=${N.key}[(((${N.i}-1))%#${N.key})+1]
local ${N.r},${N.bit}=0,1
for _=1,8 do
local ${N.x},${N.y}=${N.a}%2,${N.b}%2
if ${N.x}~=${N.y} then ${N.r}=${N.r}+${N.bit} end
${N.a},${N.b},${N.bit}=${N.mat}.floor(${N.a}/2),${N.mat}.floor(${N.b}/2),${N.bit}*2
end
${N.o}[${N.i}]=${N.str}.char(${N.r})
end
return ${N.tab}.concat(${N.o})
end
${integrityBlock}
local ${N.pc}=1
local ${N.fn}=nil
local ${N.src}=nil
while ${N.pc}~=0 do
if ${N.pc}==1 then
${N.src}=${N.xr}(${N.dec}(${N.pl}))
${N.pc}=2
elseif ${N.pc}==2 then
${N.fn}=${N.ldr}(${N.src},"=FLXR")
${N.pc}=${N.fn} and 3 or 0
elseif ${N.pc}==3 then
if setfenv then pcall(setfenv,${N.fn},(getfenv and getfenv()) or _G) end
${N.fn}(...)
${N.pc}=0
else
${N.pc}=0
end
end`;
}

/* ---------- watermark (kept minimal) ---------- */
function buildWatermark(){
  return `--[[FLXRfuscator v1.0 | ykyk]]--\n`;
}

function obfuscate(src, opts){
  const t0 = performance.now();
  let code = src;

  let tokens = tokenize(code);

  const strKey = randomBytes(16);
  if(opts.strings) tokens = encryptStringTokens(tokens, strKey);

  if(opts.strings){
    const decTokens = tokenize(buildDecoderSrc(strKey));
    tokens = [...decTokens, {t:'ws',v:'\n'}, ...tokens];
  }

  if(opts.deadCode){
    const deadTokens = tokenize(buildDeadCodeSrc());
    tokens = [...deadTokens, {t:'ws',v:'\n'}, ...tokens];
  }

  if(opts.mangle) tokens = mangleNames(tokens);

  code = tokens.map(t=>t.v).join('');

  if(opts.vm) code = buildVMSrc(code, opts);

  if(opts.watermark) code = buildWatermark() + code;

  return { code, time: performance.now() - t0 };
}

return { obfuscate };
})();