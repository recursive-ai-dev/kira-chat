'use strict';
(function(K){
  const U=K.UNICODE;
  function nfc(text){
    const out=[];
    function decompose(n){
      if(n>=0xac00&&n<0xd7a4){const s=n-0xac00;out.push(0x1100+Math.floor(s/588),0x1161+Math.floor((s%588)/28));if(s%28)out.push(0x11a7+s%28);}
      else if(U.decomposition[n])U.decomposition[n].forEach(decompose);else out.push(n);
    }
    for(const s of text){const n=s.codePointAt(0);K.assert(!(n>=0xd800&&n<=0xdfff),'Unpaired Unicode surrogate');decompose(n);}
    for(let i=1;i<out.length;i++){let j=i;const cc=U.combining[out[i]]||0;if(cc)while(j>0&&(U.combining[out[j-1]]||0)>cc){[out[j-1],out[j]]=[out[j],out[j-1]];j--;}}
    if(!out.length)return '';
    const result=[out[0]];let starter=0,last=0;
    for(let i=1;i<out.length;i++){
      const a=result[starter],b=out[i],cc=U.combining[b]||0;let composition=U.composition[a+','+b];
      if(a>=0x1100&&a<0x1113&&b>=0x1161&&b<0x1176)composition=0xac00+(a-0x1100)*588+(b-0x1161)*28;
      if(a>=0xac00&&a<0xd7a4&&(a-0xac00)%28===0&&b>0x11a7&&b<0x11c3)composition=a+b-0x11a7;
      if(composition!==undefined&&(last<cc||last===0))result[starter]=composition;
      else{if(cc===0)starter=result.length;result.push(b);last=cc;}
    }
    return result.map(x=>String.fromCodePoint(x)).join('');
  }
  K.nfc=nfc;
  K.fold=s=>nfc(s).replace(/[A-Z]/g,c=>String.fromCharCode(c.charCodeAt(0)+32)).replace(/[\u2018\u2019]/g,"'");
})(Kira);

