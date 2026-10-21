'use strict';
// The canonical layer is shared infrastructure, not part of the optimizer.
globalThis.Kira = globalThis.Kira || {};
(function (K) {
  const utf8 = new TextEncoder();
  const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  function bytesCmp(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  }
  function canonical(value) {
    const out = [];
    function head(type, n) {
      n = BigInt(n);
      if (n < 0n || n > 0xffffffffffffffffn) throw Error('CBOR integer outside uint64');
      if (n < 24n) out.push((type << 5) | Number(n));
      else {
        const width = n <= 255n ? 1 : n <= 65535n ? 2 : n <= 4294967295n ? 4 : 8;
        out.push((type << 5) | ({1:24,2:25,4:26,8:27})[width]);
        for (let i = width - 1; i >= 0; i--) out.push(Number((n >> BigInt(i * 8)) & 255n));
      }
    }
    function write(v) {
      if (v === null) { out.push(246); return; }
      if (typeof v === 'boolean') { out.push(v ? 245 : 244); return; }
      if (typeof v === 'number' || typeof v === 'bigint') {
        if (typeof v === 'number' && !Number.isSafeInteger(v)) throw Error('Canonical numbers must be exact integers');
        const n = BigInt(v); head(n < 0n ? 1 : 0, n < 0n ? -1n - n : n); return;
      }
      if (typeof v === 'string') { const b = utf8.encode(v); head(3, b.length); for (const x of b) out.push(x); return; }
      if (Array.isArray(v)) { head(4, v.length); for (const x of v) write(x); return; }
      if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
        const entries = Object.keys(v).map(k => [canonical(k), k]).sort((a,b) => bytesCmp(a[0], b[0]));
        head(5, entries.length); for (const [b,k] of entries) { for (const x of b) out.push(x); write(v[k]); } return;
      }
      throw Error('Unsupported canonical value');
    }
    write(value); return Uint8Array.from(out);
  }
  const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const rotr = (x,n) => (x >>> n) | (x << (32-n));
  function sha256(input) {
    const src = typeof input === 'string' ? utf8.encode(input) : input;
    const size = Math.ceil((src.length + 9) / 64) * 64, bytes = new Uint8Array(size);
    bytes.set(src); bytes[src.length] = 128;
    let bits = BigInt(src.length) * 8n;
    for (let i=0;i<8;i++) { bytes[size-1-i] = Number(bits & 255n); bits >>= 8n; }
    const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], w = new Uint32Array(64);
    for (let off=0;off<size;off+=64) {
      for (let i=0;i<16;i++) { const p=off+4*i; w[i]=(bytes[p]<<24)|(bytes[p+1]<<16)|(bytes[p+2]<<8)|bytes[p+3]; }
      for (let i=16;i<64;i++) { const a=w[i-15],b=w[i-2]; w[i]=(w[i-16]+(rotr(a,7)^rotr(a,18)^(a>>>3))+w[i-7]+(rotr(b,17)^rotr(b,19)^(b>>>10)))>>>0; }
      let [a,b,c,d,e,f,g,j]=h;
      for (let i=0;i<64;i++) { const t1=(j+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+constants[i]+w[i])>>>0, t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0; j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0; }
      [a,b,c,d,e,f,g,j].forEach((x,i) => {h[i]=(h[i]+x)>>>0;});
    }
    return h.map(x=>x.toString(16).padStart(8,'0')).join('');
  }
  const hash = v => sha256(canonical(v));
  const clone = v => JSON.parse(JSON.stringify(v));
  function freeze(v) { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); for (const k of Object.keys(v)) freeze(v[k]); } return v; }
  function assert(ok, reason) { if (!ok) throw Error(reason); }
  function merkle(nodes) {
    const roots=[];
    nodes.forEach((n,i)=>{ assert(n.children.every(x=>Number.isInteger(x)&&x>=0&&x<i),'Ungrounded evidence'); roots.push(hash({tag:n.tag,fields:n.fields,children:n.children.map(x=>roots[x])})); });
    return roots.length ? roots[roots.length-1] : hash([]);
  }
  // Rigorous fixed-point interval for log(n), using log(m)=2*atanh((m-1)/(m+1)).
  // Range reduction gives 1 <= m < 2. All divisions round outwards; tail is geometric.
  const ceilDiv = (a,b) => (a+b-1n)/b;
  function logInterval(n, p) {
    n=BigInt(n); const Q=1n<<BigInt(p); let k=0n,t=n;
    while(t>=2n){t>>=1n;k++;}
    function series(num,den) {
      if(num===0n)return [0n,0n];
      let powerN=num,powerD=den,lo=0n,hi=0n;
      const nn=num*num,dd=den*den;
      for(let i=0;i<4096;i++) {
        const divisor=powerD*BigInt(2*i+1), numerator=2n*powerN*Q;
        lo+=numerator/divisor; hi+=ceilDiv(numerator,divisor);
        powerN*=nn;powerD*=dd;
        const tail=ceilDiv(2n*powerN*Q*dd, powerD*BigInt(2*i+3)*(dd-nn));
        if(tail<=1n)return [lo,hi+tail];
      }
      throw Error('Log interval budget exceeded');
    }
    const base=1n<<k, [a,b]=series(n-base,n+base), [c,d]=series(1n,3n);
    return [a+k*c,b+k*d];
  }
  function phi(hypo,N) {
    assert(Number.isInteger(hypo)&&hypo>=0&&hypo<N&&N>=2,'Invalid potential counts');
    if(hypo===0)return 4294967296;if(hypo===N-1)return 0;
    for(let p=64;p<=512;p*=2) {
      const [a,b]=logInterval(hypo+1,p),[c,d]=logInterval(N,p), Q=4294967296n;
      const round=(num,den)=>(2n*num+den)/(2n*den);
      const lo=round(Q*(c-b),c),hi=round(Q*(d-a),d);
      if(lo===hi)return Number(lo);
    }
    throw Error('Potential rounding unresolved');
  }
  Object.assign(K,{cmp,bytesCmp,canonical,sha256,hash,clone,freeze,assert,merkle,phi,logInterval});
})(globalThis.Kira);

