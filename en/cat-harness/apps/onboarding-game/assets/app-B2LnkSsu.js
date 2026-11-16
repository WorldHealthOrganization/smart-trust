var vu=Object.defineProperty;var _u=(i,e,t)=>e in i?vu(i,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):i[e]=t;var xe=(i,e,t)=>_u(i,typeof e!="symbol"?e+"":e,t);import{l as wt,t as Sa,a as yu,L as xu,N as pl,S as bu,i as Su,s as Mu}from"./index-DKuLDdck.js";/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Eo="170",qi={ROTATE:0,DOLLY:1,PAN:2},Gi={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},wu=0,ml=1,Tu=2,Qc=1,eh=2,On=3,ti=0,Wt=1,bn=2,Bn=0,Yi=1,Ma=2,gl=3,vl=4,Eu=5,ui=100,Au=101,Cu=102,Ru=103,Pu=104,Du=200,Lu=201,Nu=202,Iu=203,wa=204,Ta=205,Ou=206,Uu=207,ku=208,Fu=209,Bu=210,Hu=211,zu=212,Gu=213,Vu=214,Ea=0,Aa=1,Ca=2,Ji=3,Ra=4,Pa=5,Da=6,La=7,th=0,Wu=1,$u=2,ei=0,nh=1,ih=2,sh=3,Ao=4,Xu=5,rh=6,ah=7,oh=300,Qi=301,es=302,Na=303,Ia=304,Pr=306,Oa=1e3,pi=1001,Ua=1002,gn=1003,qu=1004,Ws=1005,Sn=1006,Ur=1007,mi=1008,Vn=1009,lh=1010,ch=1011,Ps=1012,Co=1013,gi=1014,kn=1015,Hn=1016,Ro=1017,Po=1018,ts=1020,hh=35902,uh=1021,dh=1022,mn=1023,fh=1024,ph=1025,Ki=1026,ns=1027,mh=1028,Do=1029,gh=1030,Lo=1031,No=1033,gr=33776,vr=33777,_r=33778,yr=33779,ka=35840,Fa=35841,Ba=35842,Ha=35843,za=36196,Ga=37492,Va=37496,Wa=37808,$a=37809,Xa=37810,qa=37811,Ya=37812,Ka=37813,ja=37814,Za=37815,Ja=37816,Qa=37817,eo=37818,to=37819,no=37820,io=37821,xr=36492,so=36494,ro=36495,vh=36283,ao=36284,oo=36285,lo=36286,Yu=3200,Ku=3201,_h=0,ju=1,Qn="",Gt="srgb",as="srgb-linear",Dr="linear",rt="srgb",Mi=7680,_l=519,Zu=512,Ju=513,Qu=514,yh=515,ed=516,td=517,nd=518,id=519,yl=35044,xl="300 es",Fn=2e3,wr=2001;class xi{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;const n=this._listeners;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;const s=this._listeners[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){if(this._listeners===void 0)return;const n=this._listeners[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}}const Ot=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let bl=1234567;const ws=Math.PI/180,Ds=180/Math.PI;function bi(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ot[i&255]+Ot[i>>8&255]+Ot[i>>16&255]+Ot[i>>24&255]+"-"+Ot[e&255]+Ot[e>>8&255]+"-"+Ot[e>>16&15|64]+Ot[e>>24&255]+"-"+Ot[t&63|128]+Ot[t>>8&255]+"-"+Ot[t>>16&255]+Ot[t>>24&255]+Ot[n&255]+Ot[n>>8&255]+Ot[n>>16&255]+Ot[n>>24&255]).toLowerCase()}function Mt(i,e,t){return Math.max(e,Math.min(t,i))}function Io(i,e){return(i%e+e)%e}function sd(i,e,t,n,s){return n+(i-e)*(s-n)/(t-e)}function rd(i,e,t){return i!==e?(t-i)/(e-i):0}function Ts(i,e,t){return(1-t)*i+t*e}function ad(i,e,t,n){return Ts(i,e,1-Math.exp(-t*n))}function od(i,e=1){return e-Math.abs(Io(i,e*2)-e)}function ld(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*(3-2*i))}function cd(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*i*(i*(i*6-15)+10))}function hd(i,e){return i+Math.floor(Math.random()*(e-i+1))}function ud(i,e){return i+Math.random()*(e-i)}function dd(i){return i*(.5-Math.random())}function fd(i){i!==void 0&&(bl=i);let e=bl+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function pd(i){return i*ws}function md(i){return i*Ds}function gd(i){return(i&i-1)===0&&i!==0}function vd(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function _d(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function yd(i,e,t,n,s){const r=Math.cos,a=Math.sin,o=r(t/2),l=a(t/2),c=r((e+n)/2),h=a((e+n)/2),u=r((e-n)/2),d=a((e-n)/2),p=r((n-e)/2),g=a((n-e)/2);switch(s){case"XYX":i.set(o*h,l*u,l*d,o*c);break;case"YZY":i.set(l*d,o*h,l*u,o*c);break;case"ZXZ":i.set(l*u,l*d,o*h,o*c);break;case"XZX":i.set(o*h,l*g,l*p,o*c);break;case"YXY":i.set(l*p,o*h,l*g,o*c);break;case"ZYZ":i.set(l*g,l*p,o*h,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function zi(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function Ht(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}const br={DEG2RAD:ws,RAD2DEG:Ds,generateUUID:bi,clamp:Mt,euclideanModulo:Io,mapLinear:sd,inverseLerp:rd,lerp:Ts,damp:ad,pingpong:od,smoothstep:ld,smootherstep:cd,randInt:hd,randFloat:ud,randFloatSpread:dd,seededRandom:fd,degToRad:pd,radToDeg:md,isPowerOfTwo:gd,ceilPowerOfTwo:vd,floorPowerOfTwo:_d,setQuaternionFromProperEuler:yd,normalize:Ht,denormalize:zi};class Z{constructor(e=0,t=0){Z.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Mt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*s+e.x,this.y=r*s+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class qe{constructor(e,t,n,s,r,a,o,l,c){qe.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c)}set(e,t,n,s,r,a,o,l,c){const h=this.elements;return h[0]=e,h[1]=s,h[2]=o,h[3]=t,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],p=n[5],g=n[8],v=s[0],m=s[3],f=s[6],S=s[1],y=s[4],_=s[7],N=s[2],A=s[5],R=s[8];return r[0]=a*v+o*S+l*N,r[3]=a*m+o*y+l*A,r[6]=a*f+o*_+l*R,r[1]=c*v+h*S+u*N,r[4]=c*m+h*y+u*A,r[7]=c*f+h*_+u*R,r[2]=d*v+p*S+g*N,r[5]=d*m+p*y+g*A,r[8]=d*f+p*_+g*R,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*a*h-t*o*c-n*r*h+n*o*l+s*r*c-s*a*l}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=h*a-o*c,d=o*l-h*r,p=c*r-a*l,g=t*u+n*d+s*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const v=1/g;return e[0]=u*v,e[1]=(s*c-h*n)*v,e[2]=(o*n-s*a)*v,e[3]=d*v,e[4]=(h*t-s*l)*v,e[5]=(s*r-o*t)*v,e[6]=p*v,e[7]=(n*l-c*t)*v,e[8]=(a*t-n*r)*v,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(kr.makeScale(e,t)),this}rotate(e){return this.premultiply(kr.makeRotation(-e)),this}translate(e,t){return this.premultiply(kr.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const kr=new qe;function xh(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function Tr(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function xd(){const i=Tr("canvas");return i.style.display="block",i}const Sl={};function xs(i){i in Sl||(Sl[i]=!0,console.warn(i))}function bd(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}function Sd(i){const e=i.elements;e[2]=.5*e[2]+.5*e[3],e[6]=.5*e[6]+.5*e[7],e[10]=.5*e[10]+.5*e[11],e[14]=.5*e[14]+.5*e[15]}function Md(i){const e=i.elements;e[11]===-1?(e[10]=-e[10]-1,e[14]=-e[14]):(e[10]=-e[10],e[14]=-e[14]+1)}const Je={enabled:!0,workingColorSpace:as,spaces:{},convert:function(i,e,t){return this.enabled===!1||e===t||!e||!t||(this.spaces[e].transfer===rt&&(i.r=zn(i.r),i.g=zn(i.g),i.b=zn(i.b)),this.spaces[e].primaries!==this.spaces[t].primaries&&(i.applyMatrix3(this.spaces[e].toXYZ),i.applyMatrix3(this.spaces[t].fromXYZ)),this.spaces[t].transfer===rt&&(i.r=ji(i.r),i.g=ji(i.g),i.b=ji(i.b))),i},fromWorkingColorSpace:function(i,e){return this.convert(i,this.workingColorSpace,e)},toWorkingColorSpace:function(i,e){return this.convert(i,e,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===Qn?Dr:this.spaces[i].transfer},getLuminanceCoefficients:function(i,e=this.workingColorSpace){return i.fromArray(this.spaces[e].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,e,t){return i.copy(this.spaces[e].toXYZ).multiply(this.spaces[t].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace}};function zn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function ji(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}const Ml=[.64,.33,.3,.6,.15,.06],wl=[.2126,.7152,.0722],Tl=[.3127,.329],El=new qe().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Al=new qe().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Je.define({[as]:{primaries:Ml,whitePoint:Tl,transfer:Dr,toXYZ:El,fromXYZ:Al,luminanceCoefficients:wl,workingColorSpaceConfig:{unpackColorSpace:Gt},outputColorSpaceConfig:{drawingBufferColorSpace:Gt}},[Gt]:{primaries:Ml,whitePoint:Tl,transfer:rt,toXYZ:El,fromXYZ:Al,luminanceCoefficients:wl,outputColorSpaceConfig:{drawingBufferColorSpace:Gt}}});let wi;class wd{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{wi===void 0&&(wi=Tr("canvas")),wi.width=e.width,wi.height=e.height;const n=wi.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),t=wi}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Tr("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=zn(r[a]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(zn(t[n]/255)*255):t[n]=zn(t[n]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let Td=0;class bh{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Td++}),this.uuid=bi(),this.data=e,this.dataReady=!0,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(Fr(s[a].image)):r.push(Fr(s[a]))}else r=Fr(s);n.url=r}return t||(e.images[this.uuid]=n),n}}function Fr(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?wd.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let Ed=0;class $t extends xi{constructor(e=$t.DEFAULT_IMAGE,t=$t.DEFAULT_MAPPING,n=pi,s=pi,r=Sn,a=mi,o=mn,l=Vn,c=$t.DEFAULT_ANISOTROPY,h=Qn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Ed++}),this.uuid=bi(),this.name="",this.source=new bh(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Z(0,0),this.repeat=new Z(1,1),this.center=new Z(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new qe,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==oh)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Oa:e.x=e.x-Math.floor(e.x);break;case pi:e.x=e.x<0?0:1;break;case Ua:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Oa:e.y=e.y-Math.floor(e.y);break;case pi:e.y=e.y<0?0:1;break;case Ua:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}$t.DEFAULT_IMAGE=null;$t.DEFAULT_MAPPING=oh;$t.DEFAULT_ANISOTROPY=1;class lt{constructor(e=0,t=0,n=0,s=1){lt.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r;const l=e.elements,c=l[0],h=l[4],u=l[8],d=l[1],p=l[5],g=l[9],v=l[2],m=l[6],f=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-v)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+v)<.1&&Math.abs(g+m)<.1&&Math.abs(c+p+f-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const y=(c+1)/2,_=(p+1)/2,N=(f+1)/2,A=(h+d)/4,R=(u+v)/4,D=(g+m)/4;return y>_&&y>N?y<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(y),s=A/n,r=R/n):_>N?_<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(_),n=A/s,r=D/s):N<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(N),n=R/r,s=D/r),this.set(n,s,r,t),this}let S=Math.sqrt((m-g)*(m-g)+(u-v)*(u-v)+(d-h)*(d-h));return Math.abs(S)<.001&&(S=1),this.x=(m-g)/S,this.y=(u-v)/S,this.z=(d-h)/S,this.w=Math.acos((c+p+f-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Ad extends xi{constructor(e=1,t=1,n={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new lt(0,0,e,t),this.scissorTest=!1,this.viewport=new lt(0,0,e,t);const s={width:e,height:t,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Sn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);const r=new $t(s,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];const a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let n=0,s=e.textures.length;n<s;n++)this.textures[n]=e.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;const t=Object.assign({},e.texture.image);return this.texture.source=new bh(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class vn extends Ad{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class Sh extends $t{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=gn,this.minFilter=gn,this.wrapR=pi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Cd extends $t{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=gn,this.minFilter=gn,this.wrapR=pi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class vi{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,a,o){let l=n[s+0],c=n[s+1],h=n[s+2],u=n[s+3];const d=r[a+0],p=r[a+1],g=r[a+2],v=r[a+3];if(o===0){e[t+0]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u;return}if(o===1){e[t+0]=d,e[t+1]=p,e[t+2]=g,e[t+3]=v;return}if(u!==v||l!==d||c!==p||h!==g){let m=1-o;const f=l*d+c*p+h*g+u*v,S=f>=0?1:-1,y=1-f*f;if(y>Number.EPSILON){const N=Math.sqrt(y),A=Math.atan2(N,f*S);m=Math.sin(m*A)/N,o=Math.sin(o*A)/N}const _=o*S;if(l=l*m+d*_,c=c*m+p*_,h=h*m+g*_,u=u*m+v*_,m===1-o){const N=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=N,c*=N,h*=N,u*=N}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,s,r,a){const o=n[s],l=n[s+1],c=n[s+2],h=n[s+3],u=r[a],d=r[a+1],p=r[a+2],g=r[a+3];return e[t]=o*g+h*u+l*p-c*d,e[t+1]=l*g+h*d+c*u-o*p,e[t+2]=c*g+h*p+o*d-l*u,e[t+3]=h*g-o*u-l*d-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(s/2),u=o(r/2),d=l(n/2),p=l(s/2),g=l(r/2);switch(a){case"XYZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"YXZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"ZXY":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"ZYX":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"YZX":this._x=d*h*u+c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u-d*p*g;break;case"XZY":this._x=d*h*u-c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u+d*p*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],h=t[6],u=t[10],d=n+o+u;if(d>0){const p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(h-l)*p,this._y=(r-c)*p,this._z=(a-s)*p}else if(n>o&&n>u){const p=2*Math.sqrt(1+n-o-u);this._w=(h-l)/p,this._x=.25*p,this._y=(s+a)/p,this._z=(r+c)/p}else if(o>u){const p=2*Math.sqrt(1+o-n-u);this._w=(r-c)/p,this._x=(s+a)/p,this._y=.25*p,this._z=(l+h)/p}else{const p=2*Math.sqrt(1+u-n-o);this._w=(a-s)/p,this._x=(r+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<Number.EPSILON?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Mt(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+a*o+s*c-r*l,this._y=s*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-s*o,this._w=a*h-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const n=this._x,s=this._y,r=this._z,a=this._w;let o=a*e._w+n*e._x+s*e._y+r*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),o>=1)return this._w=a,this._x=n,this._y=s,this._z=r,this;const l=1-o*o;if(l<=Number.EPSILON){const p=1-t;return this._w=p*a+t*this._w,this._x=p*n+t*this._x,this._y=p*s+t*this._y,this._z=p*r+t*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,o),u=Math.sin((1-t)*h)/c,d=Math.sin(t*h)/c;return this._w=a*u+this._w*d,this._x=n*u+this._x*d,this._y=s*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class E{constructor(e=0,t=0,n=0){E.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Cl.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Cl.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*n),h=2*(o*t-r*s),u=2*(r*n-a*t);return this.x=t+l*c+a*u-o*h,this.y=n+l*h+o*c-r*u,this.z=s+l*u+r*h-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Br.copy(this).projectOnVector(e),this.sub(Br)}reflect(e){return this.sub(Br.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Mt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Br=new E,Cl=new vi;class Bs{constructor(e=new E(1/0,1/0,1/0),t=new E(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(ln.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(ln.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=ln.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,ln):ln.fromBufferAttribute(r,a),ln.applyMatrix4(e.matrixWorld),this.expandByPoint(ln);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),$s.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),$s.copy(n.boundingBox)),$s.applyMatrix4(e.matrixWorld),this.union($s)}const s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,ln),ln.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(ds),Xs.subVectors(this.max,ds),Ti.subVectors(e.a,ds),Ei.subVectors(e.b,ds),Ai.subVectors(e.c,ds),Xn.subVectors(Ei,Ti),qn.subVectors(Ai,Ei),si.subVectors(Ti,Ai);let t=[0,-Xn.z,Xn.y,0,-qn.z,qn.y,0,-si.z,si.y,Xn.z,0,-Xn.x,qn.z,0,-qn.x,si.z,0,-si.x,-Xn.y,Xn.x,0,-qn.y,qn.x,0,-si.y,si.x,0];return!Hr(t,Ti,Ei,Ai,Xs)||(t=[1,0,0,0,1,0,0,0,1],!Hr(t,Ti,Ei,Ai,Xs))?!1:(qs.crossVectors(Xn,qn),t=[qs.x,qs.y,qs.z],Hr(t,Ti,Ei,Ai,Xs))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,ln).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(ln).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Rn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Rn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Rn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Rn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Rn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Rn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Rn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Rn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Rn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}const Rn=[new E,new E,new E,new E,new E,new E,new E,new E],ln=new E,$s=new Bs,Ti=new E,Ei=new E,Ai=new E,Xn=new E,qn=new E,si=new E,ds=new E,Xs=new E,qs=new E,ri=new E;function Hr(i,e,t,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){ri.fromArray(i,r);const o=s.x*Math.abs(ri.x)+s.y*Math.abs(ri.y)+s.z*Math.abs(ri.z),l=e.dot(ri),c=t.dot(ri),h=n.dot(ri);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const Rd=new Bs,fs=new E,zr=new E;class Oo{constructor(e=new E,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Rd.setFromPoints(e).getCenter(n);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;fs.subVectors(e,this.center);const t=fs.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(fs,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(zr.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(fs.copy(e.center).add(zr)),this.expandByPoint(fs.copy(e.center).sub(zr))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}}const Pn=new E,Gr=new E,Ys=new E,Yn=new E,Vr=new E,Ks=new E,Wr=new E;class Uo{constructor(e=new E,t=new E(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Pn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=Pn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Pn.copy(this.origin).addScaledVector(this.direction,t),Pn.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){Gr.copy(e).add(t).multiplyScalar(.5),Ys.copy(t).sub(e).normalize(),Yn.copy(this.origin).sub(Gr);const r=e.distanceTo(t)*.5,a=-this.direction.dot(Ys),o=Yn.dot(this.direction),l=-Yn.dot(Ys),c=Yn.lengthSq(),h=Math.abs(1-a*a);let u,d,p,g;if(h>0)if(u=a*l-o,d=a*o-l,g=r*h,u>=0)if(d>=-g)if(d<=g){const v=1/h;u*=v,d*=v,p=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d<=-g?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c):d<=g?(u=0,d=Math.min(Math.max(-r,-l),r),p=d*(d+2*l)+c):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(Gr).addScaledVector(Ys,d),p}intersectSphere(e,t){Pn.subVectors(e.center,this.origin);const n=Pn.dot(this.direction),s=Pn.dot(Pn)-n*n,r=e.radius*e.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,s=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,s=(e.min.x-d.x)*c),h>=0?(r=(e.min.y-d.y)*h,a=(e.max.y-d.y)*h):(r=(e.max.y-d.y)*h,a=(e.min.y-d.y)*h),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),u>=0?(o=(e.min.z-d.z)*u,l=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,l=(e.min.z-d.z)*u),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,Pn)!==null}intersectTriangle(e,t,n,s,r){Vr.subVectors(t,e),Ks.subVectors(n,e),Wr.crossVectors(Vr,Ks);let a=this.direction.dot(Wr),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Yn.subVectors(this.origin,e);const l=o*this.direction.dot(Ks.crossVectors(Yn,Ks));if(l<0)return null;const c=o*this.direction.dot(Vr.cross(Yn));if(c<0||l+c>a)return null;const h=-o*Yn.dot(Wr);return h<0?null:this.at(h/a,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ht{constructor(e,t,n,s,r,a,o,l,c,h,u,d,p,g,v,m){ht.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c,h,u,d,p,g,v,m)}set(e,t,n,s,r,a,o,l,c,h,u,d,p,g,v,m){const f=this.elements;return f[0]=e,f[4]=t,f[8]=n,f[12]=s,f[1]=r,f[5]=a,f[9]=o,f[13]=l,f[2]=c,f[6]=h,f[10]=u,f[14]=d,f[3]=p,f[7]=g,f[11]=v,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ht().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,n=e.elements,s=1/Ci.setFromMatrixColumn(e,0).length(),r=1/Ci.setFromMatrixColumn(e,1).length(),a=1/Ci.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(e.order==="XYZ"){const d=a*h,p=a*u,g=o*h,v=o*u;t[0]=l*h,t[4]=-l*u,t[8]=c,t[1]=p+g*c,t[5]=d-v*c,t[9]=-o*l,t[2]=v-d*c,t[6]=g+p*c,t[10]=a*l}else if(e.order==="YXZ"){const d=l*h,p=l*u,g=c*h,v=c*u;t[0]=d+v*o,t[4]=g*o-p,t[8]=a*c,t[1]=a*u,t[5]=a*h,t[9]=-o,t[2]=p*o-g,t[6]=v+d*o,t[10]=a*l}else if(e.order==="ZXY"){const d=l*h,p=l*u,g=c*h,v=c*u;t[0]=d-v*o,t[4]=-a*u,t[8]=g+p*o,t[1]=p+g*o,t[5]=a*h,t[9]=v-d*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const d=a*h,p=a*u,g=o*h,v=o*u;t[0]=l*h,t[4]=g*c-p,t[8]=d*c+v,t[1]=l*u,t[5]=v*c+d,t[9]=p*c-g,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const d=a*l,p=a*c,g=o*l,v=o*c;t[0]=l*h,t[4]=v-d*u,t[8]=g*u+p,t[1]=u,t[5]=a*h,t[9]=-o*h,t[2]=-c*h,t[6]=p*u+g,t[10]=d-v*u}else if(e.order==="XZY"){const d=a*l,p=a*c,g=o*l,v=o*c;t[0]=l*h,t[4]=-u,t[8]=c*h,t[1]=d*u+v,t[5]=a*h,t[9]=p*u-g,t[2]=g*u-p,t[6]=o*h,t[10]=v*u+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Pd,e,Dd)}lookAt(e,t,n){const s=this.elements;return Jt.subVectors(e,t),Jt.lengthSq()===0&&(Jt.z=1),Jt.normalize(),Kn.crossVectors(n,Jt),Kn.lengthSq()===0&&(Math.abs(n.z)===1?Jt.x+=1e-4:Jt.z+=1e-4,Jt.normalize(),Kn.crossVectors(n,Jt)),Kn.normalize(),js.crossVectors(Jt,Kn),s[0]=Kn.x,s[4]=js.x,s[8]=Jt.x,s[1]=Kn.y,s[5]=js.y,s[9]=Jt.y,s[2]=Kn.z,s[6]=js.z,s[10]=Jt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],p=n[13],g=n[2],v=n[6],m=n[10],f=n[14],S=n[3],y=n[7],_=n[11],N=n[15],A=s[0],R=s[4],D=s[8],w=s[12],b=s[1],P=s[5],z=s[9],k=s[13],G=s[2],K=s[6],V=s[10],ne=s[14],W=s[3],le=s[7],ge=s[11],Me=s[15];return r[0]=a*A+o*b+l*G+c*W,r[4]=a*R+o*P+l*K+c*le,r[8]=a*D+o*z+l*V+c*ge,r[12]=a*w+o*k+l*ne+c*Me,r[1]=h*A+u*b+d*G+p*W,r[5]=h*R+u*P+d*K+p*le,r[9]=h*D+u*z+d*V+p*ge,r[13]=h*w+u*k+d*ne+p*Me,r[2]=g*A+v*b+m*G+f*W,r[6]=g*R+v*P+m*K+f*le,r[10]=g*D+v*z+m*V+f*ge,r[14]=g*w+v*k+m*ne+f*Me,r[3]=S*A+y*b+_*G+N*W,r[7]=S*R+y*P+_*K+N*le,r[11]=S*D+y*z+_*V+N*ge,r[15]=S*w+y*k+_*ne+N*Me,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],h=e[2],u=e[6],d=e[10],p=e[14],g=e[3],v=e[7],m=e[11],f=e[15];return g*(+r*l*u-s*c*u-r*o*d+n*c*d+s*o*p-n*l*p)+v*(+t*l*p-t*c*d+r*a*d-s*a*p+s*c*h-r*l*h)+m*(+t*c*u-t*o*p-r*a*u+n*a*p+r*o*h-n*c*h)+f*(-s*o*h-t*l*u+t*o*d+s*a*u-n*a*d+n*l*h)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=e[9],d=e[10],p=e[11],g=e[12],v=e[13],m=e[14],f=e[15],S=u*m*c-v*d*c+v*l*p-o*m*p-u*l*f+o*d*f,y=g*d*c-h*m*c-g*l*p+a*m*p+h*l*f-a*d*f,_=h*v*c-g*u*c+g*o*p-a*v*p-h*o*f+a*u*f,N=g*u*l-h*v*l-g*o*d+a*v*d+h*o*m-a*u*m,A=t*S+n*y+s*_+r*N;if(A===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const R=1/A;return e[0]=S*R,e[1]=(v*d*r-u*m*r-v*s*p+n*m*p+u*s*f-n*d*f)*R,e[2]=(o*m*r-v*l*r+v*s*c-n*m*c-o*s*f+n*l*f)*R,e[3]=(u*l*r-o*d*r-u*s*c+n*d*c+o*s*p-n*l*p)*R,e[4]=y*R,e[5]=(h*m*r-g*d*r+g*s*p-t*m*p-h*s*f+t*d*f)*R,e[6]=(g*l*r-a*m*r-g*s*c+t*m*c+a*s*f-t*l*f)*R,e[7]=(a*d*r-h*l*r+h*s*c-t*d*c-a*s*p+t*l*p)*R,e[8]=_*R,e[9]=(g*u*r-h*v*r-g*n*p+t*v*p+h*n*f-t*u*f)*R,e[10]=(a*v*r-g*o*r+g*n*c-t*v*c-a*n*f+t*o*f)*R,e[11]=(h*o*r-a*u*r-h*n*c+t*u*c+a*n*p-t*o*p)*R,e[12]=N*R,e[13]=(h*v*s-g*u*s+g*n*d-t*v*d-h*n*m+t*u*m)*R,e[14]=(g*o*s-a*v*s-g*n*l+t*v*l+a*n*m-t*o*m)*R,e[15]=(a*u*s-h*o*s+h*n*l-t*u*l-a*n*d+t*o*d)*R,this}scale(e){const t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),r=1-n,a=e.x,o=e.y,l=e.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+n,h*l-s*a,0,c*l-s*o,h*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,a){return this.set(1,n,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,h=a+a,u=o+o,d=r*c,p=r*h,g=r*u,v=a*h,m=a*u,f=o*u,S=l*c,y=l*h,_=l*u,N=n.x,A=n.y,R=n.z;return s[0]=(1-(v+f))*N,s[1]=(p+_)*N,s[2]=(g-y)*N,s[3]=0,s[4]=(p-_)*A,s[5]=(1-(d+f))*A,s[6]=(m+S)*A,s[7]=0,s[8]=(g+y)*R,s[9]=(m-S)*R,s[10]=(1-(d+v))*R,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;let r=Ci.set(s[0],s[1],s[2]).length();const a=Ci.set(s[4],s[5],s[6]).length(),o=Ci.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),e.x=s[12],e.y=s[13],e.z=s[14],cn.copy(this);const c=1/r,h=1/a,u=1/o;return cn.elements[0]*=c,cn.elements[1]*=c,cn.elements[2]*=c,cn.elements[4]*=h,cn.elements[5]*=h,cn.elements[6]*=h,cn.elements[8]*=u,cn.elements[9]*=u,cn.elements[10]*=u,t.setFromRotationMatrix(cn),n.x=r,n.y=a,n.z=o,this}makePerspective(e,t,n,s,r,a,o=Fn){const l=this.elements,c=2*r/(t-e),h=2*r/(n-s),u=(t+e)/(t-e),d=(n+s)/(n-s);let p,g;if(o===Fn)p=-(a+r)/(a-r),g=-2*a*r/(a-r);else if(o===wr)p=-a/(a-r),g=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,s,r,a,o=Fn){const l=this.elements,c=1/(t-e),h=1/(n-s),u=1/(a-r),d=(t+e)*c,p=(n+s)*h;let g,v;if(o===Fn)g=(a+r)*u,v=-2*u;else if(o===wr)g=r*u,v=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-p,l[2]=0,l[6]=0,l[10]=v,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const Ci=new E,cn=new ht,Pd=new E(0,0,0),Dd=new E(1,1,1),Kn=new E,js=new E,Jt=new E,Rl=new ht,Pl=new vi;class wn{constructor(e=0,t=0,n=0,s=wn.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],h=s[9],u=s[2],d=s[6],p=s[10];switch(t){case"XYZ":this._y=Math.asin(Mt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Mt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(Mt(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Mt(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Mt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-Mt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Rl.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Rl,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Pl.setFromEuler(this),this.setFromQuaternion(Pl,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}wn.DEFAULT_ORDER="XYZ";class ko{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Ld=0;const Dl=new E,Ri=new vi,Dn=new ht,Zs=new E,ps=new E,Nd=new E,Id=new vi,Ll=new E(1,0,0),Nl=new E(0,1,0),Il=new E(0,0,1),Ol={type:"added"},Od={type:"removed"},Pi={type:"childadded",child:null},$r={type:"childremoved",child:null};class Nt extends xi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ld++}),this.uuid=bi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Nt.DEFAULT_UP.clone();const e=new E,t=new wn,n=new vi,s=new E(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ht},normalMatrix:{value:new qe}}),this.matrix=new ht,this.matrixWorld=new ht,this.matrixAutoUpdate=Nt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Nt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new ko,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Ri.setFromAxisAngle(e,t),this.quaternion.multiply(Ri),this}rotateOnWorldAxis(e,t){return Ri.setFromAxisAngle(e,t),this.quaternion.premultiply(Ri),this}rotateX(e){return this.rotateOnAxis(Ll,e)}rotateY(e){return this.rotateOnAxis(Nl,e)}rotateZ(e){return this.rotateOnAxis(Il,e)}translateOnAxis(e,t){return Dl.copy(e).applyQuaternion(this.quaternion),this.position.add(Dl.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Ll,e)}translateY(e){return this.translateOnAxis(Nl,e)}translateZ(e){return this.translateOnAxis(Il,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Dn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Zs.copy(e):Zs.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),ps.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Dn.lookAt(ps,Zs,this.up):Dn.lookAt(Zs,ps,this.up),this.quaternion.setFromRotationMatrix(Dn),s&&(Dn.extractRotation(s.matrixWorld),Ri.setFromRotationMatrix(Dn),this.quaternion.premultiply(Ri.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Ol),Pi.child=e,this.dispatchEvent(Pi),Pi.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Od),$r.child=e,this.dispatchEvent($r),$r.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Dn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Dn.multiply(e.parent.matrixWorld)),e.applyMatrix4(Dn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Ol),Pi.child=e,this.dispatchEvent(Pi),Pi.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ps,e,Nd),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ps,Id,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){const n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.visibility=this._visibility,s.active=this._active,s.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.geometryCount=this._geometryCount,s.matricesTexture=this._matricesTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere={center:s.boundingSphere.center.toArray(),radius:s.boundingSphere.radius}),this.boundingBox!==null&&(s.boundingBox={min:s.boundingBox.min.toArray(),max:s.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];r(e.shapes,u)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),h=a(e.images),u=a(e.shapes),d=a(e.skeletons),p=a(e.animations),g=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),p.length>0&&(n.animations=p),g.length>0&&(n.nodes=g)}return n.object=s,n;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}}Nt.DEFAULT_UP=new E(0,1,0);Nt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Nt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const hn=new E,Ln=new E,Xr=new E,Nn=new E,Di=new E,Li=new E,Ul=new E,qr=new E,Yr=new E,Kr=new E,jr=new lt,Zr=new lt,Jr=new lt;class pn{constructor(e=new E,t=new E,n=new E){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),hn.subVectors(e,t),s.cross(hn);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){hn.subVectors(s,t),Ln.subVectors(n,t),Xr.subVectors(e,t);const a=hn.dot(hn),o=hn.dot(Ln),l=hn.dot(Xr),c=Ln.dot(Ln),h=Ln.dot(Xr),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;const d=1/u,p=(c*l-o*h)*d,g=(a*h-o*l)*d;return r.set(1-p-g,g,p)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,Nn)===null?!1:Nn.x>=0&&Nn.y>=0&&Nn.x+Nn.y<=1}static getInterpolation(e,t,n,s,r,a,o,l){return this.getBarycoord(e,t,n,s,Nn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Nn.x),l.addScaledVector(a,Nn.y),l.addScaledVector(o,Nn.z),l)}static getInterpolatedAttribute(e,t,n,s,r,a){return jr.setScalar(0),Zr.setScalar(0),Jr.setScalar(0),jr.fromBufferAttribute(e,t),Zr.fromBufferAttribute(e,n),Jr.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(jr,r.x),a.addScaledVector(Zr,r.y),a.addScaledVector(Jr,r.z),a}static isFrontFacing(e,t,n,s){return hn.subVectors(n,t),Ln.subVectors(e,t),hn.cross(Ln).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return hn.subVectors(this.c,this.b),Ln.subVectors(this.a,this.b),hn.cross(Ln).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return pn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return pn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return pn.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return pn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return pn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,r=this.c;let a,o;Di.subVectors(s,n),Li.subVectors(r,n),qr.subVectors(e,n);const l=Di.dot(qr),c=Li.dot(qr);if(l<=0&&c<=0)return t.copy(n);Yr.subVectors(e,s);const h=Di.dot(Yr),u=Li.dot(Yr);if(h>=0&&u<=h)return t.copy(s);const d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),t.copy(n).addScaledVector(Di,a);Kr.subVectors(e,r);const p=Di.dot(Kr),g=Li.dot(Kr);if(g>=0&&p<=g)return t.copy(r);const v=p*c-l*g;if(v<=0&&c>=0&&g<=0)return o=c/(c-g),t.copy(n).addScaledVector(Li,o);const m=h*g-p*u;if(m<=0&&u-h>=0&&p-g>=0)return Ul.subVectors(r,s),o=(u-h)/(u-h+(p-g)),t.copy(s).addScaledVector(Ul,o);const f=1/(m+v+d);return a=v*f,o=d*f,t.copy(n).addScaledVector(Di,a).addScaledVector(Li,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const Mh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},jn={h:0,s:0,l:0},Js={h:0,s:0,l:0};function Qr(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class Ge{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Gt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Je.toWorkingColorSpace(this,t),this}setRGB(e,t,n,s=Je.workingColorSpace){return this.r=e,this.g=t,this.b=n,Je.toWorkingColorSpace(this,s),this}setHSL(e,t,n,s=Je.workingColorSpace){if(e=Io(e,1),t=Mt(t,0,1),n=Mt(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=Qr(a,r,e+1/3),this.g=Qr(a,r,e),this.b=Qr(a,r,e-1/3)}return Je.toWorkingColorSpace(this,s),this}setStyle(e,t=Gt){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Gt){const n=Mh[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=zn(e.r),this.g=zn(e.g),this.b=zn(e.b),this}copyLinearToSRGB(e){return this.r=ji(e.r),this.g=ji(e.g),this.b=ji(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Gt){return Je.fromWorkingColorSpace(Ut.copy(this),e),Math.round(Mt(Ut.r*255,0,255))*65536+Math.round(Mt(Ut.g*255,0,255))*256+Math.round(Mt(Ut.b*255,0,255))}getHexString(e=Gt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Je.workingColorSpace){Je.fromWorkingColorSpace(Ut.copy(this),t);const n=Ut.r,s=Ut.g,r=Ut.b,a=Math.max(n,s,r),o=Math.min(n,s,r);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case n:l=(s-r)/u+(s<r?6:0);break;case s:l=(r-n)/u+2;break;case r:l=(n-s)/u+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=Je.workingColorSpace){return Je.fromWorkingColorSpace(Ut.copy(this),t),e.r=Ut.r,e.g=Ut.g,e.b=Ut.b,e}getStyle(e=Gt){Je.fromWorkingColorSpace(Ut.copy(this),e);const t=Ut.r,n=Ut.g,s=Ut.b;return e!==Gt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(jn),this.setHSL(jn.h+e,jn.s+t,jn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(jn),e.getHSL(Js);const n=Ts(jn.h,Js.h,t),s=Ts(jn.s,Js.s,t),r=Ts(jn.l,Js.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Ut=new Ge;Ge.NAMES=Mh;let Ud=0;class Hs extends xi{static get type(){return"Material"}get type(){return this.constructor.type}set type(e){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ud++}),this.uuid=bi(),this.name="",this.blending=Yi,this.side=ti,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=wa,this.blendDst=Ta,this.blendEquation=ui,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ge(0,0,0),this.blendAlpha=0,this.depthFunc=Ji,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=_l,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Mi,this.stencilZFail=Mi,this.stencilZPass=Mi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Yi&&(n.blending=this.blending),this.side!==ti&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==wa&&(n.blendSrc=this.blendSrc),this.blendDst!==Ta&&(n.blendDst=this.blendDst),this.blendEquation!==ui&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Ji&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==_l&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Mi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Mi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Mi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(t){const r=s(e.textures),a=s(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class Tn extends Hs{static get type(){return"MeshBasicMaterial"}constructor(e){super(),this.isMeshBasicMaterial=!0,this.color=new Ge(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new wn,this.combine=th,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const St=new E,Qs=new Z;class Mn{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=yl,this.updateRanges=[],this.gpuType=kn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Qs.fromBufferAttribute(this,t),Qs.applyMatrix3(e),this.setXY(t,Qs.x,Qs.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.applyMatrix3(e),this.setXYZ(t,St.x,St.y,St.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.applyMatrix4(e),this.setXYZ(t,St.x,St.y,St.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.applyNormalMatrix(e),this.setXYZ(t,St.x,St.y,St.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)St.fromBufferAttribute(this,t),St.transformDirection(e),this.setXYZ(t,St.x,St.y,St.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=zi(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Ht(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=zi(t,this.array)),t}setX(e,t){return this.normalized&&(t=Ht(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=zi(t,this.array)),t}setY(e,t){return this.normalized&&(t=Ht(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=zi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Ht(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=zi(t,this.array)),t}setW(e,t){return this.normalized&&(t=Ht(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Ht(t,this.array),n=Ht(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=Ht(t,this.array),n=Ht(n,this.array),s=Ht(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=Ht(t,this.array),n=Ht(n,this.array),s=Ht(s,this.array),r=Ht(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==yl&&(e.usage=this.usage),e}}class wh extends Mn{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class Th extends Mn{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class at extends Mn{constructor(e,t,n){super(new Float32Array(e),t,n)}}let kd=0;const nn=new ht,ea=new Nt,Ni=new E,Qt=new Bs,ms=new Bs,Pt=new E;class Xt extends xi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:kd++}),this.uuid=bi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(xh(e)?Th:wh)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new qe().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return nn.makeRotationFromQuaternion(e),this.applyMatrix4(nn),this}rotateX(e){return nn.makeRotationX(e),this.applyMatrix4(nn),this}rotateY(e){return nn.makeRotationY(e),this.applyMatrix4(nn),this}rotateZ(e){return nn.makeRotationZ(e),this.applyMatrix4(nn),this}translate(e,t,n){return nn.makeTranslation(e,t,n),this.applyMatrix4(nn),this}scale(e,t,n){return nn.makeScale(e,t,n),this.applyMatrix4(nn),this}lookAt(e){return ea.lookAt(e),ea.updateMatrix(),this.applyMatrix4(ea.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ni).negate(),this.translate(Ni.x,Ni.y,Ni.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let s=0,r=e.length;s<r;s++){const a=e[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new at(n,3))}else{for(let n=0,s=t.count;n<s;n++){const r=e[n];t.setXYZ(n,r.x,r.y,r.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Bs);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new E(-1/0,-1/0,-1/0),new E(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const r=t[n];Qt.setFromBufferAttribute(r),this.morphTargetsRelative?(Pt.addVectors(this.boundingBox.min,Qt.min),this.boundingBox.expandByPoint(Pt),Pt.addVectors(this.boundingBox.max,Qt.max),this.boundingBox.expandByPoint(Pt)):(this.boundingBox.expandByPoint(Qt.min),this.boundingBox.expandByPoint(Qt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Oo);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new E,1/0);return}if(e){const n=this.boundingSphere.center;if(Qt.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){const o=t[r];ms.setFromBufferAttribute(o),this.morphTargetsRelative?(Pt.addVectors(Qt.min,ms.min),Qt.expandByPoint(Pt),Pt.addVectors(Qt.max,ms.max),Qt.expandByPoint(Pt)):(Qt.expandByPoint(ms.min),Qt.expandByPoint(ms.max))}Qt.getCenter(n);let s=0;for(let r=0,a=e.count;r<a;r++)Pt.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(Pt));if(t)for(let r=0,a=t.length;r<a;r++){const o=t[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Pt.fromBufferAttribute(o,c),l&&(Ni.fromBufferAttribute(e,c),Pt.add(Ni)),s=Math.max(s,n.distanceToSquared(Pt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,s=t.normal,r=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Mn(new Float32Array(4*n.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let D=0;D<n.count;D++)o[D]=new E,l[D]=new E;const c=new E,h=new E,u=new E,d=new Z,p=new Z,g=new Z,v=new E,m=new E;function f(D,w,b){c.fromBufferAttribute(n,D),h.fromBufferAttribute(n,w),u.fromBufferAttribute(n,b),d.fromBufferAttribute(r,D),p.fromBufferAttribute(r,w),g.fromBufferAttribute(r,b),h.sub(c),u.sub(c),p.sub(d),g.sub(d);const P=1/(p.x*g.y-g.x*p.y);isFinite(P)&&(v.copy(h).multiplyScalar(g.y).addScaledVector(u,-p.y).multiplyScalar(P),m.copy(u).multiplyScalar(p.x).addScaledVector(h,-g.x).multiplyScalar(P),o[D].add(v),o[w].add(v),o[b].add(v),l[D].add(m),l[w].add(m),l[b].add(m))}let S=this.groups;S.length===0&&(S=[{start:0,count:e.count}]);for(let D=0,w=S.length;D<w;++D){const b=S[D],P=b.start,z=b.count;for(let k=P,G=P+z;k<G;k+=3)f(e.getX(k+0),e.getX(k+1),e.getX(k+2))}const y=new E,_=new E,N=new E,A=new E;function R(D){N.fromBufferAttribute(s,D),A.copy(N);const w=o[D];y.copy(w),y.sub(N.multiplyScalar(N.dot(w))).normalize(),_.crossVectors(A,w);const P=_.dot(l[D])<0?-1:1;a.setXYZW(D,y.x,y.y,y.z,P)}for(let D=0,w=S.length;D<w;++D){const b=S[D],P=b.start,z=b.count;for(let k=P,G=P+z;k<G;k+=3)R(e.getX(k+0)),R(e.getX(k+1)),R(e.getX(k+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Mn(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,p=n.count;d<p;d++)n.setXYZ(d,0,0,0);const s=new E,r=new E,a=new E,o=new E,l=new E,c=new E,h=new E,u=new E;if(e)for(let d=0,p=e.count;d<p;d+=3){const g=e.getX(d+0),v=e.getX(d+1),m=e.getX(d+2);s.fromBufferAttribute(t,g),r.fromBufferAttribute(t,v),a.fromBufferAttribute(t,m),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,v),c.fromBufferAttribute(n,m),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(v,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,p=t.count;d<p;d+=3)s.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Pt.fromBufferAttribute(e,t),Pt.normalize(),e.setXYZ(t,Pt.x,Pt.y,Pt.z)}toNonIndexed(){function e(o,l){const c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h);let p=0,g=0;for(let v=0,m=l.length;v<m;v++){o.isInterleavedBufferAttribute?p=l[v]*o.data.stride+o.offset:p=l[v]*h;for(let f=0;f<h;f++)d[g++]=c[p++]}return new Mn(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Xt,n=this.index.array,s=this.attributes;for(const o in s){const l=s[o],c=e(l,n);t.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){const d=c[h],p=e(d,n);l.push(p)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){const p=c[u];h.push(p.toJSON(e.data))}h.length>0&&(s[l]=h,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone(t));const s=e.attributes;for(const c in s){const h=s[c];this.setAttribute(c,h.clone(t))}const r=e.morphAttributes;for(const c in r){const h=[],u=r[c];for(let d=0,p=u.length;d<p;d++)h.push(u[d].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,h=a.length;c<h;c++){const u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const kl=new ht,ai=new Uo,er=new Oo,Fl=new E,tr=new E,nr=new E,ir=new E,ta=new E,sr=new E,Bl=new E,rr=new E;class ke extends Nt{constructor(e=new Xt,t=new Tn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const o=this.morphTargetInfluences;if(r&&o){sr.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=o[l],u=r[l];h!==0&&(ta.fromBufferAttribute(u,e),a?sr.addScaledVector(ta,h):sr.addScaledVector(ta.sub(t),h))}t.add(sr)}return t}raycast(e,t){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),er.copy(n.boundingSphere),er.applyMatrix4(r),ai.copy(e.ray).recast(e.near),!(er.containsPoint(ai.origin)===!1&&(ai.intersectSphere(er,Fl)===null||ai.origin.distanceToSquared(Fl)>(e.far-e.near)**2))&&(kl.copy(r).invert(),ai.copy(e.ray).applyMatrix4(kl),!(n.boundingBox!==null&&ai.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,ai)))}_computeIntersections(e,t,n){let s;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,p=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,v=d.length;g<v;g++){const m=d[g],f=a[m.materialIndex],S=Math.max(m.start,p.start),y=Math.min(o.count,Math.min(m.start+m.count,p.start+p.count));for(let _=S,N=y;_<N;_+=3){const A=o.getX(_),R=o.getX(_+1),D=o.getX(_+2);s=ar(this,f,e,n,c,h,u,A,R,D),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const g=Math.max(0,p.start),v=Math.min(o.count,p.start+p.count);for(let m=g,f=v;m<f;m+=3){const S=o.getX(m),y=o.getX(m+1),_=o.getX(m+2);s=ar(this,a,e,n,c,h,u,S,y,_),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,v=d.length;g<v;g++){const m=d[g],f=a[m.materialIndex],S=Math.max(m.start,p.start),y=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let _=S,N=y;_<N;_+=3){const A=_,R=_+1,D=_+2;s=ar(this,f,e,n,c,h,u,A,R,D),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const g=Math.max(0,p.start),v=Math.min(l.count,p.start+p.count);for(let m=g,f=v;m<f;m+=3){const S=m,y=m+1,_=m+2;s=ar(this,a,e,n,c,h,u,S,y,_),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}}function Fd(i,e,t,n,s,r,a,o){let l;if(e.side===Wt?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,e.side===ti,o),l===null)return null;rr.copy(o),rr.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(rr);return c<t.near||c>t.far?null:{distance:c,point:rr.clone(),object:i}}function ar(i,e,t,n,s,r,a,o,l,c){i.getVertexPosition(o,tr),i.getVertexPosition(l,nr),i.getVertexPosition(c,ir);const h=Fd(i,e,t,n,tr,nr,ir,Bl);if(h){const u=new E;pn.getBarycoord(Bl,tr,nr,ir,u),s&&(h.uv=pn.getInterpolatedAttribute(s,o,l,c,u,new Z)),r&&(h.uv1=pn.getInterpolatedAttribute(r,o,l,c,u,new Z)),a&&(h.normal=pn.getInterpolatedAttribute(a,o,l,c,u,new E),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new E,materialIndex:0};pn.getNormal(tr,nr,ir,d.normal),h.face=d,h.barycoord=u}return h}class mt extends Xt{constructor(e=1,t=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],h=[],u=[];let d=0,p=0;g("z","y","x",-1,-1,n,t,e,a,r,0),g("z","y","x",1,-1,n,t,-e,a,r,1),g("x","z","y",1,1,e,n,t,s,a,2),g("x","z","y",1,-1,e,n,-t,s,a,3),g("x","y","z",1,-1,e,t,n,s,r,4),g("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new at(c,3)),this.setAttribute("normal",new at(h,3)),this.setAttribute("uv",new at(u,2));function g(v,m,f,S,y,_,N,A,R,D,w){const b=_/R,P=N/D,z=_/2,k=N/2,G=A/2,K=R+1,V=D+1;let ne=0,W=0;const le=new E;for(let ge=0;ge<V;ge++){const Me=ge*P-k;for(let Ve=0;Ve<K;Ve++){const tt=Ve*b-z;le[v]=tt*S,le[m]=Me*y,le[f]=G,c.push(le.x,le.y,le.z),le[v]=0,le[m]=0,le[f]=A>0?1:-1,h.push(le.x,le.y,le.z),u.push(Ve/R),u.push(1-ge/D),ne+=1}}for(let ge=0;ge<D;ge++)for(let Me=0;Me<R;Me++){const Ve=d+Me+K*ge,tt=d+Me+K*(ge+1),Y=d+(Me+1)+K*(ge+1),se=d+(Me+1)+K*ge;l.push(Ve,tt,se),l.push(tt,Y,se),W+=6}o.addGroup(p,W,w),p+=W,d+=ne}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new mt(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function is(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone():Array.isArray(s)?e[t][n]=s.slice():e[t][n]=s}}return e}function zt(i){const e={};for(let t=0;t<i.length;t++){const n=is(i[t]);for(const s in n)e[s]=n[s]}return e}function Bd(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Eh(i){const e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Je.workingColorSpace}const Ls={clone:is,merge:zt};var Hd=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,zd=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Vt extends Hs{static get type(){return"ShaderMaterial"}constructor(e){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Hd,this.fragmentShader=zd,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=is(e.uniforms),this.uniformsGroups=Bd(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}}class Ah extends Nt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ht,this.projectionMatrix=new ht,this.projectionMatrixInverse=new ht,this.coordinateSystem=Fn}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Zn=new E,Hl=new Z,zl=new Z;class en extends Ah{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Ds*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(ws*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ds*2*Math.atan(Math.tan(ws*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Zn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Zn.x,Zn.y).multiplyScalar(-e/Zn.z),Zn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Zn.x,Zn.y).multiplyScalar(-e/Zn.z)}getViewSize(e,t){return this.getViewBounds(e,Hl,zl),t.subVectors(zl,Hl)}setViewOffset(e,t,n,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(ws*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const Ii=-90,Oi=1;class Gd extends Nt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new en(Ii,Oi,e,t);s.layers=this.layers,this.add(s);const r=new en(Ii,Oi,e,t);r.layers=this.layers,this.add(r);const a=new en(Ii,Oi,e,t);a.layers=this.layers,this.add(a);const o=new en(Ii,Oi,e,t);o.layers=this.layers,this.add(o);const l=new en(Ii,Oi,e,t);l.layers=this.layers,this.add(l);const c=new en(Ii,Oi,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,r,a,o,l]=t;for(const c of t)this.remove(c);if(e===Fn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===wr)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,h]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;const v=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,s),e.render(t,r),e.setRenderTarget(n,1,s),e.render(t,a),e.setRenderTarget(n,2,s),e.render(t,o),e.setRenderTarget(n,3,s),e.render(t,l),e.setRenderTarget(n,4,s),e.render(t,c),n.texture.generateMipmaps=v,e.setRenderTarget(n,5,s),e.render(t,h),e.setRenderTarget(u,d,p),e.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class Ch extends $t{constructor(e,t,n,s,r,a,o,l,c,h){e=e!==void 0?e:[],t=t!==void 0?t:Qi,super(e,t,n,s,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class Vd extends vn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new Ch(s,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:Sn}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new mt(5,5,5),r=new Vt({name:"CubemapFromEquirect",uniforms:is(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Wt,blending:Bn});r.uniforms.tEquirect.value=t;const a=new ke(s,r),o=t.minFilter;return t.minFilter===mi&&(t.minFilter=Sn),new Gd(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t,n,s){const r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,s);e.setRenderTarget(r)}}const na=new E,Wd=new E,$d=new qe;class Jn{constructor(e=new E(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=na.subVectors(n,t).cross(Wd.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const n=e.delta(na),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const r=-(e.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:t.copy(e.start).addScaledVector(n,r)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||$d.getNormalMatrix(e),s=this.coplanarPoint(na).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const oi=new Oo,or=new E;class Fo{constructor(e=new Jn,t=new Jn,n=new Jn,s=new Jn,r=new Jn,a=new Jn){this.planes=[e,t,n,s,r,a]}set(e,t,n,s,r,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Fn){const n=this.planes,s=e.elements,r=s[0],a=s[1],o=s[2],l=s[3],c=s[4],h=s[5],u=s[6],d=s[7],p=s[8],g=s[9],v=s[10],m=s[11],f=s[12],S=s[13],y=s[14],_=s[15];if(n[0].setComponents(l-r,d-c,m-p,_-f).normalize(),n[1].setComponents(l+r,d+c,m+p,_+f).normalize(),n[2].setComponents(l+a,d+h,m+g,_+S).normalize(),n[3].setComponents(l-a,d-h,m-g,_-S).normalize(),n[4].setComponents(l-o,d-u,m-v,_-y).normalize(),t===Fn)n[5].setComponents(l+o,d+u,m+v,_+y).normalize();else if(t===wr)n[5].setComponents(o,u,v,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),oi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),oi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(oi)}intersectsSprite(e){return oi.center.set(0,0,0),oi.radius=.7071067811865476,oi.applyMatrix4(e.matrixWorld),this.intersectsSphere(oi)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(or.x=s.normal.x>0?e.max.x:e.min.x,or.y=s.normal.y>0?e.max.y:e.min.y,or.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(or)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Rh(){let i=null,e=!1,t=null,n=null;function s(r,a){t(r,a),n=i.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function Xd(i){const e=new WeakMap;function t(o,l){const c=o.array,h=o.usage,u=c.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,c,h),o.onUploadCallback();let p;if(c instanceof Float32Array)p=i.FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?p=i.HALF_FLOAT:p=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=i.SHORT;else if(c instanceof Uint32Array)p=i.UNSIGNED_INT;else if(c instanceof Int32Array)p=i.INT;else if(c instanceof Int8Array)p=i.BYTE;else if(c instanceof Uint8Array)p=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function n(o,l,c){const h=l.array,u=l.updateRanges;if(i.bindBuffer(c,o),u.length===0)i.bufferSubData(c,0,h);else{u.sort((p,g)=>p.start-g.start);let d=0;for(let p=1;p<u.length;p++){const g=u[d],v=u[p];v.start<=g.start+g.count+1?g.count=Math.max(g.count,v.start+v.count-g.start):(++d,u[d]=v)}u.length=d+1;for(let p=0,g=u.length;p<g;p++){const v=u[p];i.bufferSubData(c,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(i.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}class ni extends Xt{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const r=e/2,a=t/2,o=Math.floor(n),l=Math.floor(s),c=o+1,h=l+1,u=e/o,d=t/l,p=[],g=[],v=[],m=[];for(let f=0;f<h;f++){const S=f*d-a;for(let y=0;y<c;y++){const _=y*u-r;g.push(_,-S,0),v.push(0,0,1),m.push(y/o),m.push(1-f/l)}}for(let f=0;f<l;f++)for(let S=0;S<o;S++){const y=S+c*f,_=S+c*(f+1),N=S+1+c*(f+1),A=S+1+c*f;p.push(y,_,A),p.push(_,N,A)}this.setIndex(p),this.setAttribute("position",new at(g,3)),this.setAttribute("normal",new at(v,3)),this.setAttribute("uv",new at(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ni(e.width,e.height,e.widthSegments,e.heightSegments)}}var qd=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Yd=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Kd=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,jd=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Zd=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Jd=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Qd=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,ef=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,tf=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,nf=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,sf=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,rf=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,af=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,of=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,lf=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,cf=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,hf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,uf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,df=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,ff=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,pf=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,mf=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,gf=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,vf=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,_f=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,yf=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,xf=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,bf=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Sf=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Mf=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,wf="gl_FragColor = linearToOutputTexel( gl_FragColor );",Tf=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Ef=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,Af=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Cf=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Rf=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Pf=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Df=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Lf=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Nf=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,If=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Of=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Uf=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,kf=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Ff=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Bf=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Hf=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,zf=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Gf=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Vf=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Wf=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,$f=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Xf=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,qf=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Yf=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Kf=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,jf=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Zf=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Jf=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Qf=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,ep=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,tp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,np=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,ip=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,sp=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,rp=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,ap=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,op=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,lp=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,cp=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,hp=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,up=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,dp=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,fp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,pp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,mp=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,gp=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,vp=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,_p=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,yp=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,xp=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,bp=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Sp=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Mp=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,wp=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Tp=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Ep=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Ap=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Cp=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Rp=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,Pp=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Dp=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Lp=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Np=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Ip=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Op=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Up=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,kp=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Fp=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Bp=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Hp=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,zp=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Gp=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Vp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Wp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,$p=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Xp=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const qp=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Yp=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Kp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,jp=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Zp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Jp=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Qp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,em=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,tm=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,nm=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,im=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,sm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,rm=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,am=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,om=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,lm=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,cm=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,hm=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,um=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,dm=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,fm=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,pm=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,mm=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,gm=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,vm=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,_m=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ym=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,xm=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,bm=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Sm=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Mm=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,wm=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Tm=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Em=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ke={alphahash_fragment:qd,alphahash_pars_fragment:Yd,alphamap_fragment:Kd,alphamap_pars_fragment:jd,alphatest_fragment:Zd,alphatest_pars_fragment:Jd,aomap_fragment:Qd,aomap_pars_fragment:ef,batching_pars_vertex:tf,batching_vertex:nf,begin_vertex:sf,beginnormal_vertex:rf,bsdfs:af,iridescence_fragment:of,bumpmap_pars_fragment:lf,clipping_planes_fragment:cf,clipping_planes_pars_fragment:hf,clipping_planes_pars_vertex:uf,clipping_planes_vertex:df,color_fragment:ff,color_pars_fragment:pf,color_pars_vertex:mf,color_vertex:gf,common:vf,cube_uv_reflection_fragment:_f,defaultnormal_vertex:yf,displacementmap_pars_vertex:xf,displacementmap_vertex:bf,emissivemap_fragment:Sf,emissivemap_pars_fragment:Mf,colorspace_fragment:wf,colorspace_pars_fragment:Tf,envmap_fragment:Ef,envmap_common_pars_fragment:Af,envmap_pars_fragment:Cf,envmap_pars_vertex:Rf,envmap_physical_pars_fragment:Hf,envmap_vertex:Pf,fog_vertex:Df,fog_pars_vertex:Lf,fog_fragment:Nf,fog_pars_fragment:If,gradientmap_pars_fragment:Of,lightmap_pars_fragment:Uf,lights_lambert_fragment:kf,lights_lambert_pars_fragment:Ff,lights_pars_begin:Bf,lights_toon_fragment:zf,lights_toon_pars_fragment:Gf,lights_phong_fragment:Vf,lights_phong_pars_fragment:Wf,lights_physical_fragment:$f,lights_physical_pars_fragment:Xf,lights_fragment_begin:qf,lights_fragment_maps:Yf,lights_fragment_end:Kf,logdepthbuf_fragment:jf,logdepthbuf_pars_fragment:Zf,logdepthbuf_pars_vertex:Jf,logdepthbuf_vertex:Qf,map_fragment:ep,map_pars_fragment:tp,map_particle_fragment:np,map_particle_pars_fragment:ip,metalnessmap_fragment:sp,metalnessmap_pars_fragment:rp,morphinstance_vertex:ap,morphcolor_vertex:op,morphnormal_vertex:lp,morphtarget_pars_vertex:cp,morphtarget_vertex:hp,normal_fragment_begin:up,normal_fragment_maps:dp,normal_pars_fragment:fp,normal_pars_vertex:pp,normal_vertex:mp,normalmap_pars_fragment:gp,clearcoat_normal_fragment_begin:vp,clearcoat_normal_fragment_maps:_p,clearcoat_pars_fragment:yp,iridescence_pars_fragment:xp,opaque_fragment:bp,packing:Sp,premultiplied_alpha_fragment:Mp,project_vertex:wp,dithering_fragment:Tp,dithering_pars_fragment:Ep,roughnessmap_fragment:Ap,roughnessmap_pars_fragment:Cp,shadowmap_pars_fragment:Rp,shadowmap_pars_vertex:Pp,shadowmap_vertex:Dp,shadowmask_pars_fragment:Lp,skinbase_vertex:Np,skinning_pars_vertex:Ip,skinning_vertex:Op,skinnormal_vertex:Up,specularmap_fragment:kp,specularmap_pars_fragment:Fp,tonemapping_fragment:Bp,tonemapping_pars_fragment:Hp,transmission_fragment:zp,transmission_pars_fragment:Gp,uv_pars_fragment:Vp,uv_pars_vertex:Wp,uv_vertex:$p,worldpos_vertex:Xp,background_vert:qp,background_frag:Yp,backgroundCube_vert:Kp,backgroundCube_frag:jp,cube_vert:Zp,cube_frag:Jp,depth_vert:Qp,depth_frag:em,distanceRGBA_vert:tm,distanceRGBA_frag:nm,equirect_vert:im,equirect_frag:sm,linedashed_vert:rm,linedashed_frag:am,meshbasic_vert:om,meshbasic_frag:lm,meshlambert_vert:cm,meshlambert_frag:hm,meshmatcap_vert:um,meshmatcap_frag:dm,meshnormal_vert:fm,meshnormal_frag:pm,meshphong_vert:mm,meshphong_frag:gm,meshphysical_vert:vm,meshphysical_frag:_m,meshtoon_vert:ym,meshtoon_frag:xm,points_vert:bm,points_frag:Sm,shadow_vert:Mm,shadow_frag:wm,sprite_vert:Tm,sprite_frag:Em},he={common:{diffuse:{value:new Ge(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new qe},alphaMap:{value:null},alphaMapTransform:{value:new qe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new qe}},envmap:{envMap:{value:null},envMapRotation:{value:new qe},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new qe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new qe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new qe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new qe},normalScale:{value:new Z(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new qe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new qe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new qe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new qe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ge(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Ge(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new qe},alphaTest:{value:0},uvTransform:{value:new qe}},sprite:{diffuse:{value:new Ge(16777215)},opacity:{value:1},center:{value:new Z(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new qe},alphaMap:{value:null},alphaMapTransform:{value:new qe},alphaTest:{value:0}}},xn={basic:{uniforms:zt([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.fog]),vertexShader:Ke.meshbasic_vert,fragmentShader:Ke.meshbasic_frag},lambert:{uniforms:zt([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.fog,he.lights,{emissive:{value:new Ge(0)}}]),vertexShader:Ke.meshlambert_vert,fragmentShader:Ke.meshlambert_frag},phong:{uniforms:zt([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.fog,he.lights,{emissive:{value:new Ge(0)},specular:{value:new Ge(1118481)},shininess:{value:30}}]),vertexShader:Ke.meshphong_vert,fragmentShader:Ke.meshphong_frag},standard:{uniforms:zt([he.common,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.roughnessmap,he.metalnessmap,he.fog,he.lights,{emissive:{value:new Ge(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ke.meshphysical_vert,fragmentShader:Ke.meshphysical_frag},toon:{uniforms:zt([he.common,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.gradientmap,he.fog,he.lights,{emissive:{value:new Ge(0)}}]),vertexShader:Ke.meshtoon_vert,fragmentShader:Ke.meshtoon_frag},matcap:{uniforms:zt([he.common,he.bumpmap,he.normalmap,he.displacementmap,he.fog,{matcap:{value:null}}]),vertexShader:Ke.meshmatcap_vert,fragmentShader:Ke.meshmatcap_frag},points:{uniforms:zt([he.points,he.fog]),vertexShader:Ke.points_vert,fragmentShader:Ke.points_frag},dashed:{uniforms:zt([he.common,he.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ke.linedashed_vert,fragmentShader:Ke.linedashed_frag},depth:{uniforms:zt([he.common,he.displacementmap]),vertexShader:Ke.depth_vert,fragmentShader:Ke.depth_frag},normal:{uniforms:zt([he.common,he.bumpmap,he.normalmap,he.displacementmap,{opacity:{value:1}}]),vertexShader:Ke.meshnormal_vert,fragmentShader:Ke.meshnormal_frag},sprite:{uniforms:zt([he.sprite,he.fog]),vertexShader:Ke.sprite_vert,fragmentShader:Ke.sprite_frag},background:{uniforms:{uvTransform:{value:new qe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ke.background_vert,fragmentShader:Ke.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new qe}},vertexShader:Ke.backgroundCube_vert,fragmentShader:Ke.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ke.cube_vert,fragmentShader:Ke.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ke.equirect_vert,fragmentShader:Ke.equirect_frag},distanceRGBA:{uniforms:zt([he.common,he.displacementmap,{referencePosition:{value:new E},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ke.distanceRGBA_vert,fragmentShader:Ke.distanceRGBA_frag},shadow:{uniforms:zt([he.lights,he.fog,{color:{value:new Ge(0)},opacity:{value:1}}]),vertexShader:Ke.shadow_vert,fragmentShader:Ke.shadow_frag}};xn.physical={uniforms:zt([xn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new qe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new qe},clearcoatNormalScale:{value:new Z(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new qe},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new qe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new qe},sheen:{value:0},sheenColor:{value:new Ge(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new qe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new qe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new qe},transmissionSamplerSize:{value:new Z},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new qe},attenuationDistance:{value:0},attenuationColor:{value:new Ge(0)},specularColor:{value:new Ge(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new qe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new qe},anisotropyVector:{value:new Z},anisotropyMap:{value:null},anisotropyMapTransform:{value:new qe}}]),vertexShader:Ke.meshphysical_vert,fragmentShader:Ke.meshphysical_frag};const lr={r:0,b:0,g:0},li=new wn,Am=new ht;function Cm(i,e,t,n,s,r,a){const o=new Ge(0);let l=r===!0?0:1,c,h,u=null,d=0,p=null;function g(S){let y=S.isScene===!0?S.background:null;return y&&y.isTexture&&(y=(S.backgroundBlurriness>0?t:e).get(y)),y}function v(S){let y=!1;const _=g(S);_===null?f(o,l):_&&_.isColor&&(f(_,1),y=!0);const N=i.xr.getEnvironmentBlendMode();N==="additive"?n.buffers.color.setClear(0,0,0,1,a):N==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(i.autoClear||y)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function m(S,y){const _=g(y);_&&(_.isCubeTexture||_.mapping===Pr)?(h===void 0&&(h=new ke(new mt(1,1,1),new Vt({name:"BackgroundCubeMaterial",uniforms:is(xn.backgroundCube.uniforms),vertexShader:xn.backgroundCube.vertexShader,fragmentShader:xn.backgroundCube.fragmentShader,side:Wt,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(N,A,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(h)),li.copy(y.backgroundRotation),li.x*=-1,li.y*=-1,li.z*=-1,_.isCubeTexture&&_.isRenderTargetTexture===!1&&(li.y*=-1,li.z*=-1),h.material.uniforms.envMap.value=_,h.material.uniforms.flipEnvMap.value=_.isCubeTexture&&_.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=y.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(Am.makeRotationFromEuler(li)),h.material.toneMapped=Je.getTransfer(_.colorSpace)!==rt,(u!==_||d!==_.version||p!==i.toneMapping)&&(h.material.needsUpdate=!0,u=_,d=_.version,p=i.toneMapping),h.layers.enableAll(),S.unshift(h,h.geometry,h.material,0,0,null)):_&&_.isTexture&&(c===void 0&&(c=new ke(new ni(2,2),new Vt({name:"BackgroundMaterial",uniforms:is(xn.background.uniforms),vertexShader:xn.background.vertexShader,fragmentShader:xn.background.fragmentShader,side:ti,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=_,c.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,c.material.toneMapped=Je.getTransfer(_.colorSpace)!==rt,_.matrixAutoUpdate===!0&&_.updateMatrix(),c.material.uniforms.uvTransform.value.copy(_.matrix),(u!==_||d!==_.version||p!==i.toneMapping)&&(c.material.needsUpdate=!0,u=_,d=_.version,p=i.toneMapping),c.layers.enableAll(),S.unshift(c,c.geometry,c.material,0,0,null))}function f(S,y){S.getRGB(lr,Eh(i)),n.buffers.color.setClear(lr.r,lr.g,lr.b,y,a)}return{getClearColor:function(){return o},setClearColor:function(S,y=1){o.set(S),l=y,f(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(S){l=S,f(o,l)},render:v,addToRenderList:m}}function Rm(i,e){const t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null);let r=s,a=!1;function o(b,P,z,k,G){let K=!1;const V=u(k,z,P);r!==V&&(r=V,c(r.object)),K=p(b,k,z,G),K&&g(b,k,z,G),G!==null&&e.update(G,i.ELEMENT_ARRAY_BUFFER),(K||a)&&(a=!1,_(b,P,z,k),G!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(G).buffer))}function l(){return i.createVertexArray()}function c(b){return i.bindVertexArray(b)}function h(b){return i.deleteVertexArray(b)}function u(b,P,z){const k=z.wireframe===!0;let G=n[b.id];G===void 0&&(G={},n[b.id]=G);let K=G[P.id];K===void 0&&(K={},G[P.id]=K);let V=K[k];return V===void 0&&(V=d(l()),K[k]=V),V}function d(b){const P=[],z=[],k=[];for(let G=0;G<t;G++)P[G]=0,z[G]=0,k[G]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:P,enabledAttributes:z,attributeDivisors:k,object:b,attributes:{},index:null}}function p(b,P,z,k){const G=r.attributes,K=P.attributes;let V=0;const ne=z.getAttributes();for(const W in ne)if(ne[W].location>=0){const ge=G[W];let Me=K[W];if(Me===void 0&&(W==="instanceMatrix"&&b.instanceMatrix&&(Me=b.instanceMatrix),W==="instanceColor"&&b.instanceColor&&(Me=b.instanceColor)),ge===void 0||ge.attribute!==Me||Me&&ge.data!==Me.data)return!0;V++}return r.attributesNum!==V||r.index!==k}function g(b,P,z,k){const G={},K=P.attributes;let V=0;const ne=z.getAttributes();for(const W in ne)if(ne[W].location>=0){let ge=K[W];ge===void 0&&(W==="instanceMatrix"&&b.instanceMatrix&&(ge=b.instanceMatrix),W==="instanceColor"&&b.instanceColor&&(ge=b.instanceColor));const Me={};Me.attribute=ge,ge&&ge.data&&(Me.data=ge.data),G[W]=Me,V++}r.attributes=G,r.attributesNum=V,r.index=k}function v(){const b=r.newAttributes;for(let P=0,z=b.length;P<z;P++)b[P]=0}function m(b){f(b,0)}function f(b,P){const z=r.newAttributes,k=r.enabledAttributes,G=r.attributeDivisors;z[b]=1,k[b]===0&&(i.enableVertexAttribArray(b),k[b]=1),G[b]!==P&&(i.vertexAttribDivisor(b,P),G[b]=P)}function S(){const b=r.newAttributes,P=r.enabledAttributes;for(let z=0,k=P.length;z<k;z++)P[z]!==b[z]&&(i.disableVertexAttribArray(z),P[z]=0)}function y(b,P,z,k,G,K,V){V===!0?i.vertexAttribIPointer(b,P,z,G,K):i.vertexAttribPointer(b,P,z,k,G,K)}function _(b,P,z,k){v();const G=k.attributes,K=z.getAttributes(),V=P.defaultAttributeValues;for(const ne in K){const W=K[ne];if(W.location>=0){let le=G[ne];if(le===void 0&&(ne==="instanceMatrix"&&b.instanceMatrix&&(le=b.instanceMatrix),ne==="instanceColor"&&b.instanceColor&&(le=b.instanceColor)),le!==void 0){const ge=le.normalized,Me=le.itemSize,Ve=e.get(le);if(Ve===void 0)continue;const tt=Ve.buffer,Y=Ve.type,se=Ve.bytesPerElement,we=Y===i.INT||Y===i.UNSIGNED_INT||le.gpuType===Co;if(le.isInterleavedBufferAttribute){const ae=le.data,Ne=ae.stride,He=le.offset;if(ae.isInstancedInterleavedBuffer){for(let Ue=0;Ue<W.locationSize;Ue++)f(W.location+Ue,ae.meshPerAttribute);b.isInstancedMesh!==!0&&k._maxInstanceCount===void 0&&(k._maxInstanceCount=ae.meshPerAttribute*ae.count)}else for(let Ue=0;Ue<W.locationSize;Ue++)m(W.location+Ue);i.bindBuffer(i.ARRAY_BUFFER,tt);for(let Ue=0;Ue<W.locationSize;Ue++)y(W.location+Ue,Me/W.locationSize,Y,ge,Ne*se,(He+Me/W.locationSize*Ue)*se,we)}else{if(le.isInstancedBufferAttribute){for(let ae=0;ae<W.locationSize;ae++)f(W.location+ae,le.meshPerAttribute);b.isInstancedMesh!==!0&&k._maxInstanceCount===void 0&&(k._maxInstanceCount=le.meshPerAttribute*le.count)}else for(let ae=0;ae<W.locationSize;ae++)m(W.location+ae);i.bindBuffer(i.ARRAY_BUFFER,tt);for(let ae=0;ae<W.locationSize;ae++)y(W.location+ae,Me/W.locationSize,Y,ge,Me*se,Me/W.locationSize*ae*se,we)}}else if(V!==void 0){const ge=V[ne];if(ge!==void 0)switch(ge.length){case 2:i.vertexAttrib2fv(W.location,ge);break;case 3:i.vertexAttrib3fv(W.location,ge);break;case 4:i.vertexAttrib4fv(W.location,ge);break;default:i.vertexAttrib1fv(W.location,ge)}}}}S()}function N(){D();for(const b in n){const P=n[b];for(const z in P){const k=P[z];for(const G in k)h(k[G].object),delete k[G];delete P[z]}delete n[b]}}function A(b){if(n[b.id]===void 0)return;const P=n[b.id];for(const z in P){const k=P[z];for(const G in k)h(k[G].object),delete k[G];delete P[z]}delete n[b.id]}function R(b){for(const P in n){const z=n[P];if(z[b.id]===void 0)continue;const k=z[b.id];for(const G in k)h(k[G].object),delete k[G];delete z[b.id]}}function D(){w(),a=!0,r!==s&&(r=s,c(r.object))}function w(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:D,resetDefaultState:w,dispose:N,releaseStatesOfGeometry:A,releaseStatesOfProgram:R,initAttributes:v,enableAttribute:m,disableUnusedAttributes:S}}function Pm(i,e,t){let n;function s(c){n=c}function r(c,h){i.drawArrays(n,c,h),t.update(h,n,1)}function a(c,h,u){u!==0&&(i.drawArraysInstanced(n,c,h,u),t.update(h,n,u))}function o(c,h,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,u);let p=0;for(let g=0;g<u;g++)p+=h[g];t.update(p,n,1)}function l(c,h,u,d){if(u===0)return;const p=e.get("WEBGL_multi_draw");if(p===null)for(let g=0;g<c.length;g++)a(c[g],h[g],d[g]);else{p.multiDrawArraysInstancedWEBGL(n,c,0,h,0,d,0,u);let g=0;for(let v=0;v<u;v++)g+=h[v]*d[v];t.update(g,n,1)}}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function Dm(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const R=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(R){return!(R!==mn&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){const D=R===Hn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(R!==Vn&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==kn&&!D)}function l(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const u=t.logarithmicDepthBuffer===!0,d=t.reverseDepthBuffer===!0&&e.has("EXT_clip_control"),p=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),f=i.getParameter(i.MAX_VERTEX_ATTRIBS),S=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),y=i.getParameter(i.MAX_VARYING_VECTORS),_=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),N=g>0,A=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:u,reverseDepthBuffer:d,maxTextures:p,maxVertexTextures:g,maxTextureSize:v,maxCubemapSize:m,maxAttributes:f,maxVertexUniforms:S,maxVaryings:y,maxFragmentUniforms:_,vertexTextures:N,maxSamples:A}}function Lm(i){const e=this;let t=null,n=0,s=!1,r=!1;const a=new Jn,o=new qe,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const p=u.length!==0||d||n!==0||s;return s=d,n=u.length,p},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){t=h(u,d,0)},this.setState=function(u,d,p){const g=u.clippingPlanes,v=u.clipIntersection,m=u.clipShadows,f=i.get(u);if(!s||g===null||g.length===0||r&&!m)r?h(null):c();else{const S=r?0:n,y=S*4;let _=f.clippingState||null;l.value=_,_=h(g,d,y,p);for(let N=0;N!==y;++N)_[N]=t[N];f.clippingState=_,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=S}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(u,d,p,g){const v=u!==null?u.length:0;let m=null;if(v!==0){if(m=l.value,g!==!0||m===null){const f=p+v*4,S=d.matrixWorldInverse;o.getNormalMatrix(S),(m===null||m.length<f)&&(m=new Float32Array(f));for(let y=0,_=p;y!==v;++y,_+=4)a.copy(u[y]).applyMatrix4(S,o),a.normal.toArray(m,_),m[_+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=v,e.numIntersection=0,m}}function Nm(i){let e=new WeakMap;function t(a,o){return o===Na?a.mapping=Qi:o===Ia&&(a.mapping=es),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===Na||o===Ia)if(e.has(a)){const l=e.get(a).texture;return t(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new Vd(l.height);return c.fromEquirectangularTexture(i,a),e.set(a,c),a.addEventListener("dispose",s),t(c.texture,a.mapping)}else return null}}return a}function s(a){const o=a.target;o.removeEventListener("dispose",s);const l=e.get(o);l!==void 0&&(e.delete(o),l.dispose())}function r(){e=new WeakMap}return{get:n,dispose:r}}class Bo extends Ah{constructor(e=-1,t=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-e,a=n+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}const Vi=4,Gl=[.125,.215,.35,.446,.526,.582],di=20,ia=new Bo,Vl=new Ge;let sa=null,ra=0,aa=0,oa=!1;const hi=(1+Math.sqrt(5))/2,Ui=1/hi,Wl=[new E(-hi,Ui,0),new E(hi,Ui,0),new E(-Ui,0,hi),new E(Ui,0,hi),new E(0,hi,-Ui),new E(0,hi,Ui),new E(-1,1,-1),new E(1,1,-1),new E(-1,1,1),new E(1,1,1)];class co{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,s=100){sa=this._renderer.getRenderTarget(),ra=this._renderer.getActiveCubeFace(),aa=this._renderer.getActiveMipmapLevel(),oa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(e,n,s,r),t>0&&this._blur(r,0,0,t),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ql(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Xl(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(sa,ra,aa),this._renderer.xr.enabled=oa,e.scissorTest=!1,cr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Qi||e.mapping===es?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),sa=this._renderer.getRenderTarget(),ra=this._renderer.getActiveCubeFace(),aa=this._renderer.getActiveMipmapLevel(),oa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Sn,minFilter:Sn,generateMipmaps:!1,type:Hn,format:mn,colorSpace:as,depthBuffer:!1},s=$l(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=$l(e,t,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Im(r)),this._blurMaterial=Om(r,e,t)}return s}_compileMaterial(e){const t=new ke(this._lodPlanes[0],e);this._renderer.compile(t,ia)}_sceneToCubeUV(e,t,n,s){const o=new en(90,1,t,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(Vl),h.toneMapping=ei,h.autoClear=!1;const p=new Tn({name:"PMREM.Background",side:Wt,depthWrite:!1,depthTest:!1}),g=new ke(new mt,p);let v=!1;const m=e.background;m?m.isColor&&(p.color.copy(m),e.background=null,v=!0):(p.color.copy(Vl),v=!0);for(let f=0;f<6;f++){const S=f%3;S===0?(o.up.set(0,l[f],0),o.lookAt(c[f],0,0)):S===1?(o.up.set(0,0,l[f]),o.lookAt(0,c[f],0)):(o.up.set(0,l[f],0),o.lookAt(0,0,c[f]));const y=this._cubeSize;cr(s,S*y,f>2?y:0,y,y),h.setRenderTarget(s),v&&h.render(g,o),h.render(e,o)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=d,h.autoClear=u,e.background=m}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===Qi||e.mapping===es;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=ql()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Xl());const r=s?this._cubemapMaterial:this._equirectMaterial,a=new ke(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=e;const l=this._cubeSize;cr(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,ia)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const a=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),o=Wl[(s-r-1)%Wl.length];this._blur(e,r-1,r,a,o)}t.autoClear=n}_blur(e,t,n,s,r){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,s,"latitudinal",r),this._halfBlur(a,e,n,n,s,"longitudinal",r)}_halfBlur(e,t,n,s,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new ke(this._lodPlanes[s],c),d=c.uniforms,p=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*di-1),v=r/g,m=isFinite(r)?1+Math.floor(h*v):di;m>di&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${di}`);const f=[];let S=0;for(let R=0;R<di;++R){const D=R/v,w=Math.exp(-D*D/2);f.push(w),R===0?S+=w:R<m&&(S+=2*w)}for(let R=0;R<f.length;R++)f[R]=f[R]/S;d.envMap.value=e.texture,d.samples.value=m,d.weights.value=f,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:y}=this;d.dTheta.value=g,d.mipInt.value=y-n;const _=this._sizeLods[s],N=3*_*(s>y-Vi?s-y+Vi:0),A=4*(this._cubeSize-_);cr(t,N,A,3*_,2*_),l.setRenderTarget(t),l.render(u,ia)}}function Im(i){const e=[],t=[],n=[];let s=i;const r=i-Vi+1+Gl.length;for(let a=0;a<r;a++){const o=Math.pow(2,s);t.push(o);let l=1/o;a>i-Vi?l=Gl[a-i+Vi-1]:a===0&&(l=0),n.push(l);const c=1/(o-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],p=6,g=6,v=3,m=2,f=1,S=new Float32Array(v*g*p),y=new Float32Array(m*g*p),_=new Float32Array(f*g*p);for(let A=0;A<p;A++){const R=A%3*2/3-1,D=A>2?0:-1,w=[R,D,0,R+2/3,D,0,R+2/3,D+1,0,R,D,0,R+2/3,D+1,0,R,D+1,0];S.set(w,v*g*A),y.set(d,m*g*A);const b=[A,A,A,A,A,A];_.set(b,f*g*A)}const N=new Xt;N.setAttribute("position",new Mn(S,v)),N.setAttribute("uv",new Mn(y,m)),N.setAttribute("faceIndex",new Mn(_,f)),e.push(N),s>Vi&&s--}return{lodPlanes:e,sizeLods:t,sigmas:n}}function $l(i,e,t){const n=new vn(i,e,t);return n.texture.mapping=Pr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function cr(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function Om(i,e,t){const n=new Float32Array(di),s=new E(0,1,0);return new Vt({name:"SphericalGaussianBlur",defines:{n:di,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:Ho(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function Xl(){return new Vt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Ho(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function ql(){return new Vt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Ho(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Bn,depthTest:!1,depthWrite:!1})}function Ho(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Um(i){let e=new WeakMap,t=null;function n(o){if(o&&o.isTexture){const l=o.mapping,c=l===Na||l===Ia,h=l===Qi||l===es;if(c||h){let u=e.get(o);const d=u!==void 0?u.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==d)return t===null&&(t=new co(i)),u=c?t.fromEquirectangular(o,u):t.fromCubemap(o,u),u.texture.pmremVersion=o.pmremVersion,e.set(o,u),u.texture;if(u!==void 0)return u.texture;{const p=o.image;return c&&p&&p.height>0||h&&p&&s(p)?(t===null&&(t=new co(i)),u=c?t.fromEquirectangular(o):t.fromCubemap(o),u.texture.pmremVersion=o.pmremVersion,e.set(o,u),o.addEventListener("dispose",r),u.texture):null}}}return o}function s(o){let l=0;const c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function r(o){const l=o.target;l.removeEventListener("dispose",r);const c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function a(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:n,dispose:a}}function km(i){const e={};function t(n){if(e[n]!==void 0)return e[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const s=t(n);return s===null&&xs("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function Fm(i,e,t,n){const s={},r=new WeakMap;function a(u){const d=u.target;d.index!==null&&e.remove(d.index);for(const g in d.attributes)e.remove(d.attributes[g]);for(const g in d.morphAttributes){const v=d.morphAttributes[g];for(let m=0,f=v.length;m<f;m++)e.remove(v[m])}d.removeEventListener("dispose",a),delete s[d.id];const p=r.get(d);p&&(e.remove(p),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function o(u,d){return s[d.id]===!0||(d.addEventListener("dispose",a),s[d.id]=!0,t.memory.geometries++),d}function l(u){const d=u.attributes;for(const g in d)e.update(d[g],i.ARRAY_BUFFER);const p=u.morphAttributes;for(const g in p){const v=p[g];for(let m=0,f=v.length;m<f;m++)e.update(v[m],i.ARRAY_BUFFER)}}function c(u){const d=[],p=u.index,g=u.attributes.position;let v=0;if(p!==null){const S=p.array;v=p.version;for(let y=0,_=S.length;y<_;y+=3){const N=S[y+0],A=S[y+1],R=S[y+2];d.push(N,A,A,R,R,N)}}else if(g!==void 0){const S=g.array;v=g.version;for(let y=0,_=S.length/3-1;y<_;y+=3){const N=y+0,A=y+1,R=y+2;d.push(N,A,A,R,R,N)}}else return;const m=new(xh(d)?Th:wh)(d,1);m.version=v;const f=r.get(u);f&&e.remove(f),r.set(u,m)}function h(u){const d=r.get(u);if(d){const p=u.index;p!==null&&d.version<p.version&&c(u)}else c(u);return r.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function Bm(i,e,t){let n;function s(d){n=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function l(d,p){i.drawElements(n,p,r,d*a),t.update(p,n,1)}function c(d,p,g){g!==0&&(i.drawElementsInstanced(n,p,r,d*a,g),t.update(p,n,g))}function h(d,p,g){if(g===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,p,0,r,d,0,g);let m=0;for(let f=0;f<g;f++)m+=p[f];t.update(m,n,1)}function u(d,p,g,v){if(g===0)return;const m=e.get("WEBGL_multi_draw");if(m===null)for(let f=0;f<d.length;f++)c(d[f]/a,p[f],v[f]);else{m.multiDrawElementsInstancedWEBGL(n,p,0,r,d,0,v,0,g);let f=0;for(let S=0;S<g;S++)f+=p[S]*v[S];t.update(f,n,1)}}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function Hm(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(r/3);break;case i.LINES:t.lines+=o*(r/2);break;case i.LINE_STRIP:t.lines+=o*(r-1);break;case i.LINE_LOOP:t.lines+=o*r;break;case i.POINTS:t.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function zm(i,e,t){const n=new WeakMap,s=new lt;function r(a,o,l){const c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0;let d=n.get(o);if(d===void 0||d.count!==u){let w=function(){R.dispose(),n.delete(o),o.removeEventListener("dispose",w)};d!==void 0&&d.texture.dispose();const p=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,v=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],f=o.morphAttributes.normal||[],S=o.morphAttributes.color||[];let y=0;p===!0&&(y=1),g===!0&&(y=2),v===!0&&(y=3);let _=o.attributes.position.count*y,N=1;_>e.maxTextureSize&&(N=Math.ceil(_/e.maxTextureSize),_=e.maxTextureSize);const A=new Float32Array(_*N*4*u),R=new Sh(A,_,N,u);R.type=kn,R.needsUpdate=!0;const D=y*4;for(let b=0;b<u;b++){const P=m[b],z=f[b],k=S[b],G=_*N*4*b;for(let K=0;K<P.count;K++){const V=K*D;p===!0&&(s.fromBufferAttribute(P,K),A[G+V+0]=s.x,A[G+V+1]=s.y,A[G+V+2]=s.z,A[G+V+3]=0),g===!0&&(s.fromBufferAttribute(z,K),A[G+V+4]=s.x,A[G+V+5]=s.y,A[G+V+6]=s.z,A[G+V+7]=0),v===!0&&(s.fromBufferAttribute(k,K),A[G+V+8]=s.x,A[G+V+9]=s.y,A[G+V+10]=s.z,A[G+V+11]=k.itemSize===4?s.w:1)}}d={count:u,texture:R,size:new Z(_,N)},n.set(o,d),o.addEventListener("dispose",w)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let p=0;for(let v=0;v<c.length;v++)p+=c[v];const g=o.morphTargetsRelative?1:1-p;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function Gm(i,e,t,n){let s=new WeakMap;function r(l){const c=n.render.frame,h=l.geometry,u=e.get(l,h);if(s.get(u)!==c&&(e.update(u),s.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),s.get(l)!==c&&(t.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;s.get(d)!==c&&(d.update(),s.set(d,c))}return u}function a(){s=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:r,dispose:a}}class Ph extends $t{constructor(e,t,n,s,r,a,o,l,c,h=Ki){if(h!==Ki&&h!==ns)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Ki&&(n=gi),n===void 0&&h===ns&&(n=ts),super(null,s,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=o!==void 0?o:gn,this.minFilter=l!==void 0?l:gn,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}const Dh=new $t,Yl=new Ph(1,1),Lh=new Sh,Nh=new Cd,Ih=new Ch,Kl=[],jl=[],Zl=new Float32Array(16),Jl=new Float32Array(9),Ql=new Float32Array(4);function os(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let r=Kl[s];if(r===void 0&&(r=new Float32Array(s),Kl[s]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(r,o)}return r}function Ct(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function Rt(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function Lr(i,e){let t=jl[e];t===void 0&&(t=new Int32Array(e),jl[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function Vm(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function Wm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Ct(t,e))return;i.uniform2fv(this.addr,e),Rt(t,e)}}function $m(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Ct(t,e))return;i.uniform3fv(this.addr,e),Rt(t,e)}}function Xm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Ct(t,e))return;i.uniform4fv(this.addr,e),Rt(t,e)}}function qm(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Ct(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),Rt(t,e)}else{if(Ct(t,n))return;Ql.set(n),i.uniformMatrix2fv(this.addr,!1,Ql),Rt(t,n)}}function Ym(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Ct(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),Rt(t,e)}else{if(Ct(t,n))return;Jl.set(n),i.uniformMatrix3fv(this.addr,!1,Jl),Rt(t,n)}}function Km(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Ct(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),Rt(t,e)}else{if(Ct(t,n))return;Zl.set(n),i.uniformMatrix4fv(this.addr,!1,Zl),Rt(t,n)}}function jm(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function Zm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Ct(t,e))return;i.uniform2iv(this.addr,e),Rt(t,e)}}function Jm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Ct(t,e))return;i.uniform3iv(this.addr,e),Rt(t,e)}}function Qm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Ct(t,e))return;i.uniform4iv(this.addr,e),Rt(t,e)}}function eg(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function tg(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Ct(t,e))return;i.uniform2uiv(this.addr,e),Rt(t,e)}}function ng(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Ct(t,e))return;i.uniform3uiv(this.addr,e),Rt(t,e)}}function ig(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Ct(t,e))return;i.uniform4uiv(this.addr,e),Rt(t,e)}}function sg(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Yl.compareFunction=yh,r=Yl):r=Dh,t.setTexture2D(e||r,s)}function rg(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||Nh,s)}function ag(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||Ih,s)}function og(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||Lh,s)}function lg(i){switch(i){case 5126:return Vm;case 35664:return Wm;case 35665:return $m;case 35666:return Xm;case 35674:return qm;case 35675:return Ym;case 35676:return Km;case 5124:case 35670:return jm;case 35667:case 35671:return Zm;case 35668:case 35672:return Jm;case 35669:case 35673:return Qm;case 5125:return eg;case 36294:return tg;case 36295:return ng;case 36296:return ig;case 35678:case 36198:case 36298:case 36306:case 35682:return sg;case 35679:case 36299:case 36307:return rg;case 35680:case 36300:case 36308:case 36293:return ag;case 36289:case 36303:case 36311:case 36292:return og}}function cg(i,e){i.uniform1fv(this.addr,e)}function hg(i,e){const t=os(e,this.size,2);i.uniform2fv(this.addr,t)}function ug(i,e){const t=os(e,this.size,3);i.uniform3fv(this.addr,t)}function dg(i,e){const t=os(e,this.size,4);i.uniform4fv(this.addr,t)}function fg(i,e){const t=os(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function pg(i,e){const t=os(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function mg(i,e){const t=os(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function gg(i,e){i.uniform1iv(this.addr,e)}function vg(i,e){i.uniform2iv(this.addr,e)}function _g(i,e){i.uniform3iv(this.addr,e)}function yg(i,e){i.uniform4iv(this.addr,e)}function xg(i,e){i.uniform1uiv(this.addr,e)}function bg(i,e){i.uniform2uiv(this.addr,e)}function Sg(i,e){i.uniform3uiv(this.addr,e)}function Mg(i,e){i.uniform4uiv(this.addr,e)}function wg(i,e,t){const n=this.cache,s=e.length,r=Lr(t,s);Ct(n,r)||(i.uniform1iv(this.addr,r),Rt(n,r));for(let a=0;a!==s;++a)t.setTexture2D(e[a]||Dh,r[a])}function Tg(i,e,t){const n=this.cache,s=e.length,r=Lr(t,s);Ct(n,r)||(i.uniform1iv(this.addr,r),Rt(n,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||Nh,r[a])}function Eg(i,e,t){const n=this.cache,s=e.length,r=Lr(t,s);Ct(n,r)||(i.uniform1iv(this.addr,r),Rt(n,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||Ih,r[a])}function Ag(i,e,t){const n=this.cache,s=e.length,r=Lr(t,s);Ct(n,r)||(i.uniform1iv(this.addr,r),Rt(n,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||Lh,r[a])}function Cg(i){switch(i){case 5126:return cg;case 35664:return hg;case 35665:return ug;case 35666:return dg;case 35674:return fg;case 35675:return pg;case 35676:return mg;case 5124:case 35670:return gg;case 35667:case 35671:return vg;case 35668:case 35672:return _g;case 35669:case 35673:return yg;case 5125:return xg;case 36294:return bg;case 36295:return Sg;case 36296:return Mg;case 35678:case 36198:case 36298:case 36306:case 35682:return wg;case 35679:case 36299:case 36307:return Tg;case 35680:case 36300:case 36308:case 36293:return Eg;case 36289:case 36303:case 36311:case 36292:return Ag}}class Rg{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=lg(t.type)}}class Pg{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Cg(t.type)}}class Dg{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(e,t[o.id],n)}}}const la=/(\w+)(\])?(\[|\.)?/g;function ec(i,e){i.seq.push(e),i.map[e.id]=e}function Lg(i,e,t){const n=i.name,s=n.length;for(la.lastIndex=0;;){const r=la.exec(n),a=la.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){ec(t,c===void 0?new Rg(o,i,e):new Pg(o,i,e));break}else{let u=t.map[o];u===void 0&&(u=new Dg(o),ec(t,u)),t=u}}}class Sr{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=e.getActiveUniform(t,s),a=e.getUniformLocation(t,r.name);Lg(r,a,this)}}setValue(e,t,n,s){const r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,a=t.length;r!==a;++r){const o=t[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,r=e.length;s!==r;++s){const a=e[s];a.id in t&&n.push(a)}return n}}function tc(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const Ng=37297;let Ig=0;function Og(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){const o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}const nc=new qe;function Ug(i){Je._getMatrix(nc,Je.workingColorSpace,i);const e=`mat3( ${nc.elements.map(t=>t.toFixed(4))} )`;switch(Je.getTransfer(i)){case Dr:return[e,"LinearTransferOETF"];case rt:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function ic(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),s=i.getShaderInfoLog(e).trim();if(n&&s==="")return"";const r=/ERROR: 0:(\d+)/.exec(s);if(r){const a=parseInt(r[1]);return t.toUpperCase()+`

`+s+`

`+Og(i.getShaderSource(e),a)}else return s}function kg(i,e){const t=Ug(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function Fg(i,e){let t;switch(e){case nh:t="Linear";break;case ih:t="Reinhard";break;case sh:t="Cineon";break;case Ao:t="ACESFilmic";break;case rh:t="AgX";break;case ah:t="Neutral";break;case Xu:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const hr=new E;function Bg(){Je.getLuminanceCoefficients(hr);const i=hr.x.toFixed(4),e=hr.y.toFixed(4),t=hr.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Hg(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(bs).join(`
`)}function zg(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function Gg(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s),a=r.name;let o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function bs(i){return i!==""}function sc(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function rc(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const Vg=/^[ \t]*#include +<([\w\d./]+)>/gm;function ho(i){return i.replace(Vg,$g)}const Wg=new Map;function $g(i,e){let t=Ke[e];if(t===void 0){const n=Wg.get(e);if(n!==void 0)t=Ke[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return ho(t)}const Xg=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function ac(i){return i.replace(Xg,qg)}function qg(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function oc(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function Yg(i){let e="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===Qc?e="SHADOWMAP_TYPE_PCF":i.shadowMapType===eh?e="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===On&&(e="SHADOWMAP_TYPE_VSM"),e}function Kg(i){let e="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case Qi:case es:e="ENVMAP_TYPE_CUBE";break;case Pr:e="ENVMAP_TYPE_CUBE_UV";break}return e}function jg(i){let e="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case es:e="ENVMAP_MODE_REFRACTION";break}return e}function Zg(i){let e="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case th:e="ENVMAP_BLENDING_MULTIPLY";break;case Wu:e="ENVMAP_BLENDING_MIX";break;case $u:e="ENVMAP_BLENDING_ADD";break}return e}function Jg(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),7*16)),texelHeight:n,maxMip:t}}function Qg(i,e,t,n){const s=i.getContext(),r=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=Yg(t),c=Kg(t),h=jg(t),u=Zg(t),d=Jg(t),p=Hg(t),g=zg(r),v=s.createProgram();let m,f,S=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(bs).join(`
`),m.length>0&&(m+=`
`),f=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(bs).join(`
`),f.length>0&&(f+=`
`)):(m=[oc(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(bs).join(`
`),f=[oc(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==ei?"#define TONE_MAPPING":"",t.toneMapping!==ei?Ke.tonemapping_pars_fragment:"",t.toneMapping!==ei?Fg("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Ke.colorspace_pars_fragment,kg("linearToOutputTexel",t.outputColorSpace),Bg(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(bs).join(`
`)),a=ho(a),a=sc(a,t),a=rc(a,t),o=ho(o),o=sc(o,t),o=rc(o,t),a=ac(a),o=ac(o),t.isRawShaderMaterial!==!0&&(S=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,f=["#define varying in",t.glslVersion===xl?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===xl?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);const y=S+m+a,_=S+f+o,N=tc(s,s.VERTEX_SHADER,y),A=tc(s,s.FRAGMENT_SHADER,_);s.attachShader(v,N),s.attachShader(v,A),t.index0AttributeName!==void 0?s.bindAttribLocation(v,0,t.index0AttributeName):t.morphTargets===!0&&s.bindAttribLocation(v,0,"position"),s.linkProgram(v);function R(P){if(i.debug.checkShaderErrors){const z=s.getProgramInfoLog(v).trim(),k=s.getShaderInfoLog(N).trim(),G=s.getShaderInfoLog(A).trim();let K=!0,V=!0;if(s.getProgramParameter(v,s.LINK_STATUS)===!1)if(K=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,v,N,A);else{const ne=ic(s,N,"vertex"),W=ic(s,A,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(v,s.VALIDATE_STATUS)+`

Material Name: `+P.name+`
Material Type: `+P.type+`

Program Info Log: `+z+`
`+ne+`
`+W)}else z!==""?console.warn("THREE.WebGLProgram: Program Info Log:",z):(k===""||G==="")&&(V=!1);V&&(P.diagnostics={runnable:K,programLog:z,vertexShader:{log:k,prefix:m},fragmentShader:{log:G,prefix:f}})}s.deleteShader(N),s.deleteShader(A),D=new Sr(s,v),w=Gg(s,v)}let D;this.getUniforms=function(){return D===void 0&&R(this),D};let w;this.getAttributes=function(){return w===void 0&&R(this),w};let b=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return b===!1&&(b=s.getProgramParameter(v,Ng)),b},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(v),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Ig++,this.cacheKey=e,this.usedTimes=1,this.program=v,this.vertexShader=N,this.fragmentShader=A,this}let ev=0;class tv{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,s=this._getShaderStage(t),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(e);return a.has(s)===!1&&(a.add(s),s.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new nv(e),t.set(e,n)),n}}class nv{constructor(e){this.id=ev++,this.code=e,this.usedTimes=0}}function iv(i,e,t,n,s,r,a){const o=new ko,l=new tv,c=new Set,h=[],u=s.logarithmicDepthBuffer,d=s.vertexTextures;let p=s.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function v(w){return c.add(w),w===0?"uv":`uv${w}`}function m(w,b,P,z,k){const G=z.fog,K=k.geometry,V=w.isMeshStandardMaterial?z.environment:null,ne=(w.isMeshStandardMaterial?t:e).get(w.envMap||V),W=ne&&ne.mapping===Pr?ne.image.height:null,le=g[w.type];w.precision!==null&&(p=s.getMaxPrecision(w.precision),p!==w.precision&&console.warn("THREE.WebGLProgram.getParameters:",w.precision,"not supported, using",p,"instead."));const ge=K.morphAttributes.position||K.morphAttributes.normal||K.morphAttributes.color,Me=ge!==void 0?ge.length:0;let Ve=0;K.morphAttributes.position!==void 0&&(Ve=1),K.morphAttributes.normal!==void 0&&(Ve=2),K.morphAttributes.color!==void 0&&(Ve=3);let tt,Y,se,we;if(le){const st=xn[le];tt=st.vertexShader,Y=st.fragmentShader}else tt=w.vertexShader,Y=w.fragmentShader,l.update(w),se=l.getVertexShaderID(w),we=l.getFragmentShaderID(w);const ae=i.getRenderTarget(),Ne=i.state.buffers.depth.getReversed(),He=k.isInstancedMesh===!0,Ue=k.isBatchedMesh===!0,Qe=!!w.map,J=!!w.matcap,ie=!!ne,C=!!w.aoMap,Re=!!w.lightMap,ee=!!w.bumpMap,ye=!!w.normalMap,oe=!!w.displacementMap,Ie=!!w.emissiveMap,ve=!!w.metalnessMap,T=!!w.roughnessMap,x=w.anisotropy>0,U=w.clearcoat>0,X=w.dispersion>0,Q=w.iridescence>0,q=w.sheen>0,Te=w.transmission>0,ue=x&&!!w.anisotropyMap,_e=U&&!!w.clearcoatMap,je=U&&!!w.clearcoatNormalMap,te=U&&!!w.clearcoatRoughnessMap,be=Q&&!!w.iridescenceMap,Oe=Q&&!!w.iridescenceThicknessMap,Fe=q&&!!w.sheenColorMap,Se=q&&!!w.sheenRoughnessMap,Ze=!!w.specularMap,Ye=!!w.specularColorMap,ut=!!w.specularIntensityMap,L=Te&&!!w.transmissionMap,de=Te&&!!w.thicknessMap,$=!!w.gradientMap,j=!!w.alphaMap,me=w.alphaTest>0,fe=!!w.alphaHash,$e=!!w.extensions;let vt=ei;w.toneMapped&&(ae===null||ae.isXRRenderTarget===!0)&&(vt=i.toneMapping);const It={shaderID:le,shaderType:w.type,shaderName:w.name,vertexShader:tt,fragmentShader:Y,defines:w.defines,customVertexShaderID:se,customFragmentShaderID:we,isRawShaderMaterial:w.isRawShaderMaterial===!0,glslVersion:w.glslVersion,precision:p,batching:Ue,batchingColor:Ue&&k._colorsTexture!==null,instancing:He,instancingColor:He&&k.instanceColor!==null,instancingMorph:He&&k.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:ae===null?i.outputColorSpace:ae.isXRRenderTarget===!0?ae.texture.colorSpace:as,alphaToCoverage:!!w.alphaToCoverage,map:Qe,matcap:J,envMap:ie,envMapMode:ie&&ne.mapping,envMapCubeUVHeight:W,aoMap:C,lightMap:Re,bumpMap:ee,normalMap:ye,displacementMap:d&&oe,emissiveMap:Ie,normalMapObjectSpace:ye&&w.normalMapType===ju,normalMapTangentSpace:ye&&w.normalMapType===_h,metalnessMap:ve,roughnessMap:T,anisotropy:x,anisotropyMap:ue,clearcoat:U,clearcoatMap:_e,clearcoatNormalMap:je,clearcoatRoughnessMap:te,dispersion:X,iridescence:Q,iridescenceMap:be,iridescenceThicknessMap:Oe,sheen:q,sheenColorMap:Fe,sheenRoughnessMap:Se,specularMap:Ze,specularColorMap:Ye,specularIntensityMap:ut,transmission:Te,transmissionMap:L,thicknessMap:de,gradientMap:$,opaque:w.transparent===!1&&w.blending===Yi&&w.alphaToCoverage===!1,alphaMap:j,alphaTest:me,alphaHash:fe,combine:w.combine,mapUv:Qe&&v(w.map.channel),aoMapUv:C&&v(w.aoMap.channel),lightMapUv:Re&&v(w.lightMap.channel),bumpMapUv:ee&&v(w.bumpMap.channel),normalMapUv:ye&&v(w.normalMap.channel),displacementMapUv:oe&&v(w.displacementMap.channel),emissiveMapUv:Ie&&v(w.emissiveMap.channel),metalnessMapUv:ve&&v(w.metalnessMap.channel),roughnessMapUv:T&&v(w.roughnessMap.channel),anisotropyMapUv:ue&&v(w.anisotropyMap.channel),clearcoatMapUv:_e&&v(w.clearcoatMap.channel),clearcoatNormalMapUv:je&&v(w.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:te&&v(w.clearcoatRoughnessMap.channel),iridescenceMapUv:be&&v(w.iridescenceMap.channel),iridescenceThicknessMapUv:Oe&&v(w.iridescenceThicknessMap.channel),sheenColorMapUv:Fe&&v(w.sheenColorMap.channel),sheenRoughnessMapUv:Se&&v(w.sheenRoughnessMap.channel),specularMapUv:Ze&&v(w.specularMap.channel),specularColorMapUv:Ye&&v(w.specularColorMap.channel),specularIntensityMapUv:ut&&v(w.specularIntensityMap.channel),transmissionMapUv:L&&v(w.transmissionMap.channel),thicknessMapUv:de&&v(w.thicknessMap.channel),alphaMapUv:j&&v(w.alphaMap.channel),vertexTangents:!!K.attributes.tangent&&(ye||x),vertexColors:w.vertexColors,vertexAlphas:w.vertexColors===!0&&!!K.attributes.color&&K.attributes.color.itemSize===4,pointsUvs:k.isPoints===!0&&!!K.attributes.uv&&(Qe||j),fog:!!G,useFog:w.fog===!0,fogExp2:!!G&&G.isFogExp2,flatShading:w.flatShading===!0,sizeAttenuation:w.sizeAttenuation===!0,logarithmicDepthBuffer:u,reverseDepthBuffer:Ne,skinning:k.isSkinnedMesh===!0,morphTargets:K.morphAttributes.position!==void 0,morphNormals:K.morphAttributes.normal!==void 0,morphColors:K.morphAttributes.color!==void 0,morphTargetsCount:Me,morphTextureStride:Ve,numDirLights:b.directional.length,numPointLights:b.point.length,numSpotLights:b.spot.length,numSpotLightMaps:b.spotLightMap.length,numRectAreaLights:b.rectArea.length,numHemiLights:b.hemi.length,numDirLightShadows:b.directionalShadowMap.length,numPointLightShadows:b.pointShadowMap.length,numSpotLightShadows:b.spotShadowMap.length,numSpotLightShadowsWithMaps:b.numSpotLightShadowsWithMaps,numLightProbes:b.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:w.dithering,shadowMapEnabled:i.shadowMap.enabled&&P.length>0,shadowMapType:i.shadowMap.type,toneMapping:vt,decodeVideoTexture:Qe&&w.map.isVideoTexture===!0&&Je.getTransfer(w.map.colorSpace)===rt,decodeVideoTextureEmissive:Ie&&w.emissiveMap.isVideoTexture===!0&&Je.getTransfer(w.emissiveMap.colorSpace)===rt,premultipliedAlpha:w.premultipliedAlpha,doubleSided:w.side===bn,flipSided:w.side===Wt,useDepthPacking:w.depthPacking>=0,depthPacking:w.depthPacking||0,index0AttributeName:w.index0AttributeName,extensionClipCullDistance:$e&&w.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:($e&&w.extensions.multiDraw===!0||Ue)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:w.customProgramCacheKey()};return It.vertexUv1s=c.has(1),It.vertexUv2s=c.has(2),It.vertexUv3s=c.has(3),c.clear(),It}function f(w){const b=[];if(w.shaderID?b.push(w.shaderID):(b.push(w.customVertexShaderID),b.push(w.customFragmentShaderID)),w.defines!==void 0)for(const P in w.defines)b.push(P),b.push(w.defines[P]);return w.isRawShaderMaterial===!1&&(S(b,w),y(b,w),b.push(i.outputColorSpace)),b.push(w.customProgramCacheKey),b.join()}function S(w,b){w.push(b.precision),w.push(b.outputColorSpace),w.push(b.envMapMode),w.push(b.envMapCubeUVHeight),w.push(b.mapUv),w.push(b.alphaMapUv),w.push(b.lightMapUv),w.push(b.aoMapUv),w.push(b.bumpMapUv),w.push(b.normalMapUv),w.push(b.displacementMapUv),w.push(b.emissiveMapUv),w.push(b.metalnessMapUv),w.push(b.roughnessMapUv),w.push(b.anisotropyMapUv),w.push(b.clearcoatMapUv),w.push(b.clearcoatNormalMapUv),w.push(b.clearcoatRoughnessMapUv),w.push(b.iridescenceMapUv),w.push(b.iridescenceThicknessMapUv),w.push(b.sheenColorMapUv),w.push(b.sheenRoughnessMapUv),w.push(b.specularMapUv),w.push(b.specularColorMapUv),w.push(b.specularIntensityMapUv),w.push(b.transmissionMapUv),w.push(b.thicknessMapUv),w.push(b.combine),w.push(b.fogExp2),w.push(b.sizeAttenuation),w.push(b.morphTargetsCount),w.push(b.morphAttributeCount),w.push(b.numDirLights),w.push(b.numPointLights),w.push(b.numSpotLights),w.push(b.numSpotLightMaps),w.push(b.numHemiLights),w.push(b.numRectAreaLights),w.push(b.numDirLightShadows),w.push(b.numPointLightShadows),w.push(b.numSpotLightShadows),w.push(b.numSpotLightShadowsWithMaps),w.push(b.numLightProbes),w.push(b.shadowMapType),w.push(b.toneMapping),w.push(b.numClippingPlanes),w.push(b.numClipIntersection),w.push(b.depthPacking)}function y(w,b){o.disableAll(),b.supportsVertexTextures&&o.enable(0),b.instancing&&o.enable(1),b.instancingColor&&o.enable(2),b.instancingMorph&&o.enable(3),b.matcap&&o.enable(4),b.envMap&&o.enable(5),b.normalMapObjectSpace&&o.enable(6),b.normalMapTangentSpace&&o.enable(7),b.clearcoat&&o.enable(8),b.iridescence&&o.enable(9),b.alphaTest&&o.enable(10),b.vertexColors&&o.enable(11),b.vertexAlphas&&o.enable(12),b.vertexUv1s&&o.enable(13),b.vertexUv2s&&o.enable(14),b.vertexUv3s&&o.enable(15),b.vertexTangents&&o.enable(16),b.anisotropy&&o.enable(17),b.alphaHash&&o.enable(18),b.batching&&o.enable(19),b.dispersion&&o.enable(20),b.batchingColor&&o.enable(21),w.push(o.mask),o.disableAll(),b.fog&&o.enable(0),b.useFog&&o.enable(1),b.flatShading&&o.enable(2),b.logarithmicDepthBuffer&&o.enable(3),b.reverseDepthBuffer&&o.enable(4),b.skinning&&o.enable(5),b.morphTargets&&o.enable(6),b.morphNormals&&o.enable(7),b.morphColors&&o.enable(8),b.premultipliedAlpha&&o.enable(9),b.shadowMapEnabled&&o.enable(10),b.doubleSided&&o.enable(11),b.flipSided&&o.enable(12),b.useDepthPacking&&o.enable(13),b.dithering&&o.enable(14),b.transmission&&o.enable(15),b.sheen&&o.enable(16),b.opaque&&o.enable(17),b.pointsUvs&&o.enable(18),b.decodeVideoTexture&&o.enable(19),b.decodeVideoTextureEmissive&&o.enable(20),b.alphaToCoverage&&o.enable(21),w.push(o.mask)}function _(w){const b=g[w.type];let P;if(b){const z=xn[b];P=Ls.clone(z.uniforms)}else P=w.uniforms;return P}function N(w,b){let P;for(let z=0,k=h.length;z<k;z++){const G=h[z];if(G.cacheKey===b){P=G,++P.usedTimes;break}}return P===void 0&&(P=new Qg(i,b,w,r),h.push(P)),P}function A(w){if(--w.usedTimes===0){const b=h.indexOf(w);h[b]=h[h.length-1],h.pop(),w.destroy()}}function R(w){l.remove(w)}function D(){l.dispose()}return{getParameters:m,getProgramCacheKey:f,getUniforms:_,acquireProgram:N,releaseProgram:A,releaseShaderCache:R,programs:h,dispose:D}}function sv(){let i=new WeakMap;function e(a){return i.has(a)}function t(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function rv(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.z!==e.z?i.z-e.z:i.id-e.id}function lc(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function cc(){const i=[];let e=0;const t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function a(u,d,p,g,v,m){let f=i[e];return f===void 0?(f={id:u.id,object:u,geometry:d,material:p,groupOrder:g,renderOrder:u.renderOrder,z:v,group:m},i[e]=f):(f.id=u.id,f.object=u,f.geometry=d,f.material=p,f.groupOrder=g,f.renderOrder=u.renderOrder,f.z=v,f.group=m),e++,f}function o(u,d,p,g,v,m){const f=a(u,d,p,g,v,m);p.transmission>0?n.push(f):p.transparent===!0?s.push(f):t.push(f)}function l(u,d,p,g,v,m){const f=a(u,d,p,g,v,m);p.transmission>0?n.unshift(f):p.transparent===!0?s.unshift(f):t.unshift(f)}function c(u,d){t.length>1&&t.sort(u||rv),n.length>1&&n.sort(d||lc),s.length>1&&s.sort(d||lc)}function h(){for(let u=e,d=i.length;u<d;u++){const p=i[u];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:o,unshift:l,finish:h,sort:c}}function av(){let i=new WeakMap;function e(n,s){const r=i.get(n);let a;return r===void 0?(a=new cc,i.set(n,[a])):s>=r.length?(a=new cc,r.push(a)):a=r[s],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function ov(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new E,color:new Ge};break;case"SpotLight":t={position:new E,direction:new E,color:new Ge,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new E,color:new Ge,distance:0,decay:0};break;case"HemisphereLight":t={direction:new E,skyColor:new Ge,groundColor:new Ge};break;case"RectAreaLight":t={color:new Ge,position:new E,halfWidth:new E,halfHeight:new E};break}return i[e.id]=t,t}}}function lv(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Z};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Z};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Z,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let cv=0;function hv(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function uv(i){const e=new ov,t=lv(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new E);const s=new E,r=new ht,a=new ht;function o(c){let h=0,u=0,d=0;for(let w=0;w<9;w++)n.probe[w].set(0,0,0);let p=0,g=0,v=0,m=0,f=0,S=0,y=0,_=0,N=0,A=0,R=0;c.sort(hv);for(let w=0,b=c.length;w<b;w++){const P=c[w],z=P.color,k=P.intensity,G=P.distance,K=P.shadow&&P.shadow.map?P.shadow.map.texture:null;if(P.isAmbientLight)h+=z.r*k,u+=z.g*k,d+=z.b*k;else if(P.isLightProbe){for(let V=0;V<9;V++)n.probe[V].addScaledVector(P.sh.coefficients[V],k);R++}else if(P.isDirectionalLight){const V=e.get(P);if(V.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){const ne=P.shadow,W=t.get(P);W.shadowIntensity=ne.intensity,W.shadowBias=ne.bias,W.shadowNormalBias=ne.normalBias,W.shadowRadius=ne.radius,W.shadowMapSize=ne.mapSize,n.directionalShadow[p]=W,n.directionalShadowMap[p]=K,n.directionalShadowMatrix[p]=P.shadow.matrix,S++}n.directional[p]=V,p++}else if(P.isSpotLight){const V=e.get(P);V.position.setFromMatrixPosition(P.matrixWorld),V.color.copy(z).multiplyScalar(k),V.distance=G,V.coneCos=Math.cos(P.angle),V.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),V.decay=P.decay,n.spot[v]=V;const ne=P.shadow;if(P.map&&(n.spotLightMap[N]=P.map,N++,ne.updateMatrices(P),P.castShadow&&A++),n.spotLightMatrix[v]=ne.matrix,P.castShadow){const W=t.get(P);W.shadowIntensity=ne.intensity,W.shadowBias=ne.bias,W.shadowNormalBias=ne.normalBias,W.shadowRadius=ne.radius,W.shadowMapSize=ne.mapSize,n.spotShadow[v]=W,n.spotShadowMap[v]=K,_++}v++}else if(P.isRectAreaLight){const V=e.get(P);V.color.copy(z).multiplyScalar(k),V.halfWidth.set(P.width*.5,0,0),V.halfHeight.set(0,P.height*.5,0),n.rectArea[m]=V,m++}else if(P.isPointLight){const V=e.get(P);if(V.color.copy(P.color).multiplyScalar(P.intensity),V.distance=P.distance,V.decay=P.decay,P.castShadow){const ne=P.shadow,W=t.get(P);W.shadowIntensity=ne.intensity,W.shadowBias=ne.bias,W.shadowNormalBias=ne.normalBias,W.shadowRadius=ne.radius,W.shadowMapSize=ne.mapSize,W.shadowCameraNear=ne.camera.near,W.shadowCameraFar=ne.camera.far,n.pointShadow[g]=W,n.pointShadowMap[g]=K,n.pointShadowMatrix[g]=P.shadow.matrix,y++}n.point[g]=V,g++}else if(P.isHemisphereLight){const V=e.get(P);V.skyColor.copy(P.color).multiplyScalar(k),V.groundColor.copy(P.groundColor).multiplyScalar(k),n.hemi[f]=V,f++}}m>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=he.LTC_FLOAT_1,n.rectAreaLTC2=he.LTC_FLOAT_2):(n.rectAreaLTC1=he.LTC_HALF_1,n.rectAreaLTC2=he.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;const D=n.hash;(D.directionalLength!==p||D.pointLength!==g||D.spotLength!==v||D.rectAreaLength!==m||D.hemiLength!==f||D.numDirectionalShadows!==S||D.numPointShadows!==y||D.numSpotShadows!==_||D.numSpotMaps!==N||D.numLightProbes!==R)&&(n.directional.length=p,n.spot.length=v,n.rectArea.length=m,n.point.length=g,n.hemi.length=f,n.directionalShadow.length=S,n.directionalShadowMap.length=S,n.pointShadow.length=y,n.pointShadowMap.length=y,n.spotShadow.length=_,n.spotShadowMap.length=_,n.directionalShadowMatrix.length=S,n.pointShadowMatrix.length=y,n.spotLightMatrix.length=_+N-A,n.spotLightMap.length=N,n.numSpotLightShadowsWithMaps=A,n.numLightProbes=R,D.directionalLength=p,D.pointLength=g,D.spotLength=v,D.rectAreaLength=m,D.hemiLength=f,D.numDirectionalShadows=S,D.numPointShadows=y,D.numSpotShadows=_,D.numSpotMaps=N,D.numLightProbes=R,n.version=cv++)}function l(c,h){let u=0,d=0,p=0,g=0,v=0;const m=h.matrixWorldInverse;for(let f=0,S=c.length;f<S;f++){const y=c[f];if(y.isDirectionalLight){const _=n.directional[u];_.direction.setFromMatrixPosition(y.matrixWorld),s.setFromMatrixPosition(y.target.matrixWorld),_.direction.sub(s),_.direction.transformDirection(m),u++}else if(y.isSpotLight){const _=n.spot[p];_.position.setFromMatrixPosition(y.matrixWorld),_.position.applyMatrix4(m),_.direction.setFromMatrixPosition(y.matrixWorld),s.setFromMatrixPosition(y.target.matrixWorld),_.direction.sub(s),_.direction.transformDirection(m),p++}else if(y.isRectAreaLight){const _=n.rectArea[g];_.position.setFromMatrixPosition(y.matrixWorld),_.position.applyMatrix4(m),a.identity(),r.copy(y.matrixWorld),r.premultiply(m),a.extractRotation(r),_.halfWidth.set(y.width*.5,0,0),_.halfHeight.set(0,y.height*.5,0),_.halfWidth.applyMatrix4(a),_.halfHeight.applyMatrix4(a),g++}else if(y.isPointLight){const _=n.point[d];_.position.setFromMatrixPosition(y.matrixWorld),_.position.applyMatrix4(m),d++}else if(y.isHemisphereLight){const _=n.hemi[v];_.direction.setFromMatrixPosition(y.matrixWorld),_.direction.transformDirection(m),v++}}}return{setup:o,setupView:l,state:n}}function hc(i){const e=new uv(i),t=[],n=[];function s(h){c.camera=h,t.length=0,n.length=0}function r(h){t.push(h)}function a(h){n.push(h)}function o(){e.setup(t)}function l(h){e.setupView(t,h)}const c={lightsArray:t,shadowsArray:n,camera:null,lights:e,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:o,setupLightsView:l,pushLight:r,pushShadow:a}}function dv(i){let e=new WeakMap;function t(s,r=0){const a=e.get(s);let o;return a===void 0?(o=new hc(i),e.set(s,[o])):r>=a.length?(o=new hc(i),a.push(o)):o=a[r],o}function n(){e=new WeakMap}return{get:t,dispose:n}}class fv extends Hs{static get type(){return"MeshDepthMaterial"}constructor(e){super(),this.isMeshDepthMaterial=!0,this.depthPacking=Yu,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class pv extends Hs{static get type(){return"MeshDistanceMaterial"}constructor(e){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}const mv=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,gv=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function vv(i,e,t){let n=new Fo;const s=new Z,r=new Z,a=new lt,o=new fv({depthPacking:Ku}),l=new pv,c={},h=t.maxTextureSize,u={[ti]:Wt,[Wt]:ti,[bn]:bn},d=new Vt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Z},radius:{value:4}},vertexShader:mv,fragmentShader:gv}),p=d.clone();p.defines.HORIZONTAL_PASS=1;const g=new Xt;g.setAttribute("position",new Mn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const v=new ke(g,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Qc;let f=this.type;this.render=function(A,R,D){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||A.length===0)return;const w=i.getRenderTarget(),b=i.getActiveCubeFace(),P=i.getActiveMipmapLevel(),z=i.state;z.setBlending(Bn),z.buffers.color.setClear(1,1,1,1),z.buffers.depth.setTest(!0),z.setScissorTest(!1);const k=f!==On&&this.type===On,G=f===On&&this.type!==On;for(let K=0,V=A.length;K<V;K++){const ne=A[K],W=ne.shadow;if(W===void 0){console.warn("THREE.WebGLShadowMap:",ne,"has no shadow.");continue}if(W.autoUpdate===!1&&W.needsUpdate===!1)continue;s.copy(W.mapSize);const le=W.getFrameExtents();if(s.multiply(le),r.copy(W.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/le.x),s.x=r.x*le.x,W.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/le.y),s.y=r.y*le.y,W.mapSize.y=r.y)),W.map===null||k===!0||G===!0){const Me=this.type!==On?{minFilter:gn,magFilter:gn}:{};W.map!==null&&W.map.dispose(),W.map=new vn(s.x,s.y,Me),W.map.texture.name=ne.name+".shadowMap",W.camera.updateProjectionMatrix()}i.setRenderTarget(W.map),i.clear();const ge=W.getViewportCount();for(let Me=0;Me<ge;Me++){const Ve=W.getViewport(Me);a.set(r.x*Ve.x,r.y*Ve.y,r.x*Ve.z,r.y*Ve.w),z.viewport(a),W.updateMatrices(ne,Me),n=W.getFrustum(),_(R,D,W.camera,ne,this.type)}W.isPointLightShadow!==!0&&this.type===On&&S(W,D),W.needsUpdate=!1}f=this.type,m.needsUpdate=!1,i.setRenderTarget(w,b,P)};function S(A,R){const D=e.update(v);d.defines.VSM_SAMPLES!==A.blurSamples&&(d.defines.VSM_SAMPLES=A.blurSamples,p.defines.VSM_SAMPLES=A.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new vn(s.x,s.y)),d.uniforms.shadow_pass.value=A.map.texture,d.uniforms.resolution.value=A.mapSize,d.uniforms.radius.value=A.radius,i.setRenderTarget(A.mapPass),i.clear(),i.renderBufferDirect(R,null,D,d,v,null),p.uniforms.shadow_pass.value=A.mapPass.texture,p.uniforms.resolution.value=A.mapSize,p.uniforms.radius.value=A.radius,i.setRenderTarget(A.map),i.clear(),i.renderBufferDirect(R,null,D,p,v,null)}function y(A,R,D,w){let b=null;const P=D.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(P!==void 0)b=P;else if(b=D.isPointLight===!0?l:o,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0){const z=b.uuid,k=R.uuid;let G=c[z];G===void 0&&(G={},c[z]=G);let K=G[k];K===void 0&&(K=b.clone(),G[k]=K,R.addEventListener("dispose",N)),b=K}if(b.visible=R.visible,b.wireframe=R.wireframe,w===On?b.side=R.shadowSide!==null?R.shadowSide:R.side:b.side=R.shadowSide!==null?R.shadowSide:u[R.side],b.alphaMap=R.alphaMap,b.alphaTest=R.alphaTest,b.map=R.map,b.clipShadows=R.clipShadows,b.clippingPlanes=R.clippingPlanes,b.clipIntersection=R.clipIntersection,b.displacementMap=R.displacementMap,b.displacementScale=R.displacementScale,b.displacementBias=R.displacementBias,b.wireframeLinewidth=R.wireframeLinewidth,b.linewidth=R.linewidth,D.isPointLight===!0&&b.isMeshDistanceMaterial===!0){const z=i.properties.get(b);z.light=D}return b}function _(A,R,D,w,b){if(A.visible===!1)return;if(A.layers.test(R.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&b===On)&&(!A.frustumCulled||n.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(D.matrixWorldInverse,A.matrixWorld);const k=e.update(A),G=A.material;if(Array.isArray(G)){const K=k.groups;for(let V=0,ne=K.length;V<ne;V++){const W=K[V],le=G[W.materialIndex];if(le&&le.visible){const ge=y(A,le,w,b);A.onBeforeShadow(i,A,R,D,k,ge,W),i.renderBufferDirect(D,null,k,ge,A,W),A.onAfterShadow(i,A,R,D,k,ge,W)}}}else if(G.visible){const K=y(A,G,w,b);A.onBeforeShadow(i,A,R,D,k,K,null),i.renderBufferDirect(D,null,k,K,A,null),A.onAfterShadow(i,A,R,D,k,K,null)}}const z=A.children;for(let k=0,G=z.length;k<G;k++)_(z[k],R,D,w,b)}function N(A){A.target.removeEventListener("dispose",N);for(const D in c){const w=c[D],b=A.target.uuid;b in w&&(w[b].dispose(),delete w[b])}}}const _v={[Ea]:Aa,[Ca]:Da,[Ra]:La,[Ji]:Pa,[Aa]:Ea,[Da]:Ca,[La]:Ra,[Pa]:Ji};function yv(i,e){function t(){let L=!1;const de=new lt;let $=null;const j=new lt(0,0,0,0);return{setMask:function(me){$!==me&&!L&&(i.colorMask(me,me,me,me),$=me)},setLocked:function(me){L=me},setClear:function(me,fe,$e,vt,It){It===!0&&(me*=vt,fe*=vt,$e*=vt),de.set(me,fe,$e,vt),j.equals(de)===!1&&(i.clearColor(me,fe,$e,vt),j.copy(de))},reset:function(){L=!1,$=null,j.set(-1,0,0,0)}}}function n(){let L=!1,de=!1,$=null,j=null,me=null;return{setReversed:function(fe){if(de!==fe){const $e=e.get("EXT_clip_control");de?$e.clipControlEXT($e.LOWER_LEFT_EXT,$e.ZERO_TO_ONE_EXT):$e.clipControlEXT($e.LOWER_LEFT_EXT,$e.NEGATIVE_ONE_TO_ONE_EXT);const vt=me;me=null,this.setClear(vt)}de=fe},getReversed:function(){return de},setTest:function(fe){fe?ae(i.DEPTH_TEST):Ne(i.DEPTH_TEST)},setMask:function(fe){$!==fe&&!L&&(i.depthMask(fe),$=fe)},setFunc:function(fe){if(de&&(fe=_v[fe]),j!==fe){switch(fe){case Ea:i.depthFunc(i.NEVER);break;case Aa:i.depthFunc(i.ALWAYS);break;case Ca:i.depthFunc(i.LESS);break;case Ji:i.depthFunc(i.LEQUAL);break;case Ra:i.depthFunc(i.EQUAL);break;case Pa:i.depthFunc(i.GEQUAL);break;case Da:i.depthFunc(i.GREATER);break;case La:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}j=fe}},setLocked:function(fe){L=fe},setClear:function(fe){me!==fe&&(de&&(fe=1-fe),i.clearDepth(fe),me=fe)},reset:function(){L=!1,$=null,j=null,me=null,de=!1}}}function s(){let L=!1,de=null,$=null,j=null,me=null,fe=null,$e=null,vt=null,It=null;return{setTest:function(st){L||(st?ae(i.STENCIL_TEST):Ne(i.STENCIL_TEST))},setMask:function(st){de!==st&&!L&&(i.stencilMask(st),de=st)},setFunc:function(st,an,An){($!==st||j!==an||me!==An)&&(i.stencilFunc(st,an,An),$=st,j=an,me=An)},setOp:function(st,an,An){(fe!==st||$e!==an||vt!==An)&&(i.stencilOp(st,an,An),fe=st,$e=an,vt=An)},setLocked:function(st){L=st},setClear:function(st){It!==st&&(i.clearStencil(st),It=st)},reset:function(){L=!1,de=null,$=null,j=null,me=null,fe=null,$e=null,vt=null,It=null}}}const r=new t,a=new n,o=new s,l=new WeakMap,c=new WeakMap;let h={},u={},d=new WeakMap,p=[],g=null,v=!1,m=null,f=null,S=null,y=null,_=null,N=null,A=null,R=new Ge(0,0,0),D=0,w=!1,b=null,P=null,z=null,k=null,G=null;const K=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let V=!1,ne=0;const W=i.getParameter(i.VERSION);W.indexOf("WebGL")!==-1?(ne=parseFloat(/^WebGL (\d)/.exec(W)[1]),V=ne>=1):W.indexOf("OpenGL ES")!==-1&&(ne=parseFloat(/^OpenGL ES (\d)/.exec(W)[1]),V=ne>=2);let le=null,ge={};const Me=i.getParameter(i.SCISSOR_BOX),Ve=i.getParameter(i.VIEWPORT),tt=new lt().fromArray(Me),Y=new lt().fromArray(Ve);function se(L,de,$,j){const me=new Uint8Array(4),fe=i.createTexture();i.bindTexture(L,fe),i.texParameteri(L,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(L,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let $e=0;$e<$;$e++)L===i.TEXTURE_3D||L===i.TEXTURE_2D_ARRAY?i.texImage3D(de,0,i.RGBA,1,1,j,0,i.RGBA,i.UNSIGNED_BYTE,me):i.texImage2D(de+$e,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,me);return fe}const we={};we[i.TEXTURE_2D]=se(i.TEXTURE_2D,i.TEXTURE_2D,1),we[i.TEXTURE_CUBE_MAP]=se(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),we[i.TEXTURE_2D_ARRAY]=se(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),we[i.TEXTURE_3D]=se(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),ae(i.DEPTH_TEST),a.setFunc(Ji),ee(!1),ye(ml),ae(i.CULL_FACE),C(Bn);function ae(L){h[L]!==!0&&(i.enable(L),h[L]=!0)}function Ne(L){h[L]!==!1&&(i.disable(L),h[L]=!1)}function He(L,de){return u[L]!==de?(i.bindFramebuffer(L,de),u[L]=de,L===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=de),L===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=de),!0):!1}function Ue(L,de){let $=p,j=!1;if(L){$=d.get(de),$===void 0&&($=[],d.set(de,$));const me=L.textures;if($.length!==me.length||$[0]!==i.COLOR_ATTACHMENT0){for(let fe=0,$e=me.length;fe<$e;fe++)$[fe]=i.COLOR_ATTACHMENT0+fe;$.length=me.length,j=!0}}else $[0]!==i.BACK&&($[0]=i.BACK,j=!0);j&&i.drawBuffers($)}function Qe(L){return g!==L?(i.useProgram(L),g=L,!0):!1}const J={[ui]:i.FUNC_ADD,[Au]:i.FUNC_SUBTRACT,[Cu]:i.FUNC_REVERSE_SUBTRACT};J[Ru]=i.MIN,J[Pu]=i.MAX;const ie={[Du]:i.ZERO,[Lu]:i.ONE,[Nu]:i.SRC_COLOR,[wa]:i.SRC_ALPHA,[Bu]:i.SRC_ALPHA_SATURATE,[ku]:i.DST_COLOR,[Ou]:i.DST_ALPHA,[Iu]:i.ONE_MINUS_SRC_COLOR,[Ta]:i.ONE_MINUS_SRC_ALPHA,[Fu]:i.ONE_MINUS_DST_COLOR,[Uu]:i.ONE_MINUS_DST_ALPHA,[Hu]:i.CONSTANT_COLOR,[zu]:i.ONE_MINUS_CONSTANT_COLOR,[Gu]:i.CONSTANT_ALPHA,[Vu]:i.ONE_MINUS_CONSTANT_ALPHA};function C(L,de,$,j,me,fe,$e,vt,It,st){if(L===Bn){v===!0&&(Ne(i.BLEND),v=!1);return}if(v===!1&&(ae(i.BLEND),v=!0),L!==Eu){if(L!==m||st!==w){if((f!==ui||_!==ui)&&(i.blendEquation(i.FUNC_ADD),f=ui,_=ui),st)switch(L){case Yi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Ma:i.blendFunc(i.ONE,i.ONE);break;case gl:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case vl:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",L);break}else switch(L){case Yi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Ma:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case gl:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case vl:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",L);break}S=null,y=null,N=null,A=null,R.set(0,0,0),D=0,m=L,w=st}return}me=me||de,fe=fe||$,$e=$e||j,(de!==f||me!==_)&&(i.blendEquationSeparate(J[de],J[me]),f=de,_=me),($!==S||j!==y||fe!==N||$e!==A)&&(i.blendFuncSeparate(ie[$],ie[j],ie[fe],ie[$e]),S=$,y=j,N=fe,A=$e),(vt.equals(R)===!1||It!==D)&&(i.blendColor(vt.r,vt.g,vt.b,It),R.copy(vt),D=It),m=L,w=!1}function Re(L,de){L.side===bn?Ne(i.CULL_FACE):ae(i.CULL_FACE);let $=L.side===Wt;de&&($=!$),ee($),L.blending===Yi&&L.transparent===!1?C(Bn):C(L.blending,L.blendEquation,L.blendSrc,L.blendDst,L.blendEquationAlpha,L.blendSrcAlpha,L.blendDstAlpha,L.blendColor,L.blendAlpha,L.premultipliedAlpha),a.setFunc(L.depthFunc),a.setTest(L.depthTest),a.setMask(L.depthWrite),r.setMask(L.colorWrite);const j=L.stencilWrite;o.setTest(j),j&&(o.setMask(L.stencilWriteMask),o.setFunc(L.stencilFunc,L.stencilRef,L.stencilFuncMask),o.setOp(L.stencilFail,L.stencilZFail,L.stencilZPass)),Ie(L.polygonOffset,L.polygonOffsetFactor,L.polygonOffsetUnits),L.alphaToCoverage===!0?ae(i.SAMPLE_ALPHA_TO_COVERAGE):Ne(i.SAMPLE_ALPHA_TO_COVERAGE)}function ee(L){b!==L&&(L?i.frontFace(i.CW):i.frontFace(i.CCW),b=L)}function ye(L){L!==wu?(ae(i.CULL_FACE),L!==P&&(L===ml?i.cullFace(i.BACK):L===Tu?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Ne(i.CULL_FACE),P=L}function oe(L){L!==z&&(V&&i.lineWidth(L),z=L)}function Ie(L,de,$){L?(ae(i.POLYGON_OFFSET_FILL),(k!==de||G!==$)&&(i.polygonOffset(de,$),k=de,G=$)):Ne(i.POLYGON_OFFSET_FILL)}function ve(L){L?ae(i.SCISSOR_TEST):Ne(i.SCISSOR_TEST)}function T(L){L===void 0&&(L=i.TEXTURE0+K-1),le!==L&&(i.activeTexture(L),le=L)}function x(L,de,$){$===void 0&&(le===null?$=i.TEXTURE0+K-1:$=le);let j=ge[$];j===void 0&&(j={type:void 0,texture:void 0},ge[$]=j),(j.type!==L||j.texture!==de)&&(le!==$&&(i.activeTexture($),le=$),i.bindTexture(L,de||we[L]),j.type=L,j.texture=de)}function U(){const L=ge[le];L!==void 0&&L.type!==void 0&&(i.bindTexture(L.type,null),L.type=void 0,L.texture=void 0)}function X(){try{i.compressedTexImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function Q(){try{i.compressedTexImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function q(){try{i.texSubImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function Te(){try{i.texSubImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function ue(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function _e(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function je(){try{i.texStorage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function te(){try{i.texStorage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function be(){try{i.texImage2D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function Oe(){try{i.texImage3D.apply(i,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function Fe(L){tt.equals(L)===!1&&(i.scissor(L.x,L.y,L.z,L.w),tt.copy(L))}function Se(L){Y.equals(L)===!1&&(i.viewport(L.x,L.y,L.z,L.w),Y.copy(L))}function Ze(L,de){let $=c.get(de);$===void 0&&($=new WeakMap,c.set(de,$));let j=$.get(L);j===void 0&&(j=i.getUniformBlockIndex(de,L.name),$.set(L,j))}function Ye(L,de){const j=c.get(de).get(L);l.get(de)!==j&&(i.uniformBlockBinding(de,j,L.__bindingPointIndex),l.set(de,j))}function ut(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),h={},le=null,ge={},u={},d=new WeakMap,p=[],g=null,v=!1,m=null,f=null,S=null,y=null,_=null,N=null,A=null,R=new Ge(0,0,0),D=0,w=!1,b=null,P=null,z=null,k=null,G=null,tt.set(0,0,i.canvas.width,i.canvas.height),Y.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:ae,disable:Ne,bindFramebuffer:He,drawBuffers:Ue,useProgram:Qe,setBlending:C,setMaterial:Re,setFlipSided:ee,setCullFace:ye,setLineWidth:oe,setPolygonOffset:Ie,setScissorTest:ve,activeTexture:T,bindTexture:x,unbindTexture:U,compressedTexImage2D:X,compressedTexImage3D:Q,texImage2D:be,texImage3D:Oe,updateUBOMapping:Ze,uniformBlockBinding:Ye,texStorage2D:je,texStorage3D:te,texSubImage2D:q,texSubImage3D:Te,compressedTexSubImage2D:ue,compressedTexSubImage3D:_e,scissor:Fe,viewport:Se,reset:ut}}function uc(i,e,t,n){const s=xv(n);switch(t){case uh:return i*e;case fh:return i*e;case ph:return i*e*2;case mh:return i*e/s.components*s.byteLength;case Do:return i*e/s.components*s.byteLength;case gh:return i*e*2/s.components*s.byteLength;case Lo:return i*e*2/s.components*s.byteLength;case dh:return i*e*3/s.components*s.byteLength;case mn:return i*e*4/s.components*s.byteLength;case No:return i*e*4/s.components*s.byteLength;case gr:case vr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case _r:case yr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Fa:case Ha:return Math.max(i,16)*Math.max(e,8)/4;case ka:case Ba:return Math.max(i,8)*Math.max(e,8)/2;case za:case Ga:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case Va:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Wa:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case $a:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case Xa:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case qa:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case Ya:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case Ka:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case ja:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case Za:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case Ja:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case Qa:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case eo:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case to:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case no:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case io:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case xr:case so:case ro:return Math.ceil(i/4)*Math.ceil(e/4)*16;case vh:case ao:return Math.ceil(i/4)*Math.ceil(e/4)*8;case oo:case lo:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function xv(i){switch(i){case Vn:case lh:return{byteLength:1,components:1};case Ps:case ch:case Hn:return{byteLength:2,components:1};case Ro:case Po:return{byteLength:2,components:4};case gi:case Co:case kn:return{byteLength:4,components:1};case hh:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}function bv(i,e,t,n,s,r,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Z,h=new WeakMap;let u;const d=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(T,x){return p?new OffscreenCanvas(T,x):Tr("canvas")}function v(T,x,U){let X=1;const Q=ve(T);if((Q.width>U||Q.height>U)&&(X=U/Math.max(Q.width,Q.height)),X<1)if(typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&T instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&T instanceof ImageBitmap||typeof VideoFrame<"u"&&T instanceof VideoFrame){const q=Math.floor(X*Q.width),Te=Math.floor(X*Q.height);u===void 0&&(u=g(q,Te));const ue=x?g(q,Te):u;return ue.width=q,ue.height=Te,ue.getContext("2d").drawImage(T,0,0,q,Te),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+Q.width+"x"+Q.height+") to ("+q+"x"+Te+")."),ue}else return"data"in T&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+Q.width+"x"+Q.height+")."),T;return T}function m(T){return T.generateMipmaps}function f(T){i.generateMipmap(T)}function S(T){return T.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:T.isWebGL3DRenderTarget?i.TEXTURE_3D:T.isWebGLArrayRenderTarget||T.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function y(T,x,U,X,Q=!1){if(T!==null){if(i[T]!==void 0)return i[T];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+T+"'")}let q=x;if(x===i.RED&&(U===i.FLOAT&&(q=i.R32F),U===i.HALF_FLOAT&&(q=i.R16F),U===i.UNSIGNED_BYTE&&(q=i.R8)),x===i.RED_INTEGER&&(U===i.UNSIGNED_BYTE&&(q=i.R8UI),U===i.UNSIGNED_SHORT&&(q=i.R16UI),U===i.UNSIGNED_INT&&(q=i.R32UI),U===i.BYTE&&(q=i.R8I),U===i.SHORT&&(q=i.R16I),U===i.INT&&(q=i.R32I)),x===i.RG&&(U===i.FLOAT&&(q=i.RG32F),U===i.HALF_FLOAT&&(q=i.RG16F),U===i.UNSIGNED_BYTE&&(q=i.RG8)),x===i.RG_INTEGER&&(U===i.UNSIGNED_BYTE&&(q=i.RG8UI),U===i.UNSIGNED_SHORT&&(q=i.RG16UI),U===i.UNSIGNED_INT&&(q=i.RG32UI),U===i.BYTE&&(q=i.RG8I),U===i.SHORT&&(q=i.RG16I),U===i.INT&&(q=i.RG32I)),x===i.RGB_INTEGER&&(U===i.UNSIGNED_BYTE&&(q=i.RGB8UI),U===i.UNSIGNED_SHORT&&(q=i.RGB16UI),U===i.UNSIGNED_INT&&(q=i.RGB32UI),U===i.BYTE&&(q=i.RGB8I),U===i.SHORT&&(q=i.RGB16I),U===i.INT&&(q=i.RGB32I)),x===i.RGBA_INTEGER&&(U===i.UNSIGNED_BYTE&&(q=i.RGBA8UI),U===i.UNSIGNED_SHORT&&(q=i.RGBA16UI),U===i.UNSIGNED_INT&&(q=i.RGBA32UI),U===i.BYTE&&(q=i.RGBA8I),U===i.SHORT&&(q=i.RGBA16I),U===i.INT&&(q=i.RGBA32I)),x===i.RGB&&U===i.UNSIGNED_INT_5_9_9_9_REV&&(q=i.RGB9_E5),x===i.RGBA){const Te=Q?Dr:Je.getTransfer(X);U===i.FLOAT&&(q=i.RGBA32F),U===i.HALF_FLOAT&&(q=i.RGBA16F),U===i.UNSIGNED_BYTE&&(q=Te===rt?i.SRGB8_ALPHA8:i.RGBA8),U===i.UNSIGNED_SHORT_4_4_4_4&&(q=i.RGBA4),U===i.UNSIGNED_SHORT_5_5_5_1&&(q=i.RGB5_A1)}return(q===i.R16F||q===i.R32F||q===i.RG16F||q===i.RG32F||q===i.RGBA16F||q===i.RGBA32F)&&e.get("EXT_color_buffer_float"),q}function _(T,x){let U;return T?x===null||x===gi||x===ts?U=i.DEPTH24_STENCIL8:x===kn?U=i.DEPTH32F_STENCIL8:x===Ps&&(U=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):x===null||x===gi||x===ts?U=i.DEPTH_COMPONENT24:x===kn?U=i.DEPTH_COMPONENT32F:x===Ps&&(U=i.DEPTH_COMPONENT16),U}function N(T,x){return m(T)===!0||T.isFramebufferTexture&&T.minFilter!==gn&&T.minFilter!==Sn?Math.log2(Math.max(x.width,x.height))+1:T.mipmaps!==void 0&&T.mipmaps.length>0?T.mipmaps.length:T.isCompressedTexture&&Array.isArray(T.image)?x.mipmaps.length:1}function A(T){const x=T.target;x.removeEventListener("dispose",A),D(x),x.isVideoTexture&&h.delete(x)}function R(T){const x=T.target;x.removeEventListener("dispose",R),b(x)}function D(T){const x=n.get(T);if(x.__webglInit===void 0)return;const U=T.source,X=d.get(U);if(X){const Q=X[x.__cacheKey];Q.usedTimes--,Q.usedTimes===0&&w(T),Object.keys(X).length===0&&d.delete(U)}n.remove(T)}function w(T){const x=n.get(T);i.deleteTexture(x.__webglTexture);const U=T.source,X=d.get(U);delete X[x.__cacheKey],a.memory.textures--}function b(T){const x=n.get(T);if(T.depthTexture&&(T.depthTexture.dispose(),n.remove(T.depthTexture)),T.isWebGLCubeRenderTarget)for(let X=0;X<6;X++){if(Array.isArray(x.__webglFramebuffer[X]))for(let Q=0;Q<x.__webglFramebuffer[X].length;Q++)i.deleteFramebuffer(x.__webglFramebuffer[X][Q]);else i.deleteFramebuffer(x.__webglFramebuffer[X]);x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer[X])}else{if(Array.isArray(x.__webglFramebuffer))for(let X=0;X<x.__webglFramebuffer.length;X++)i.deleteFramebuffer(x.__webglFramebuffer[X]);else i.deleteFramebuffer(x.__webglFramebuffer);if(x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer),x.__webglMultisampledFramebuffer&&i.deleteFramebuffer(x.__webglMultisampledFramebuffer),x.__webglColorRenderbuffer)for(let X=0;X<x.__webglColorRenderbuffer.length;X++)x.__webglColorRenderbuffer[X]&&i.deleteRenderbuffer(x.__webglColorRenderbuffer[X]);x.__webglDepthRenderbuffer&&i.deleteRenderbuffer(x.__webglDepthRenderbuffer)}const U=T.textures;for(let X=0,Q=U.length;X<Q;X++){const q=n.get(U[X]);q.__webglTexture&&(i.deleteTexture(q.__webglTexture),a.memory.textures--),n.remove(U[X])}n.remove(T)}let P=0;function z(){P=0}function k(){const T=P;return T>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+T+" texture units while this GPU supports only "+s.maxTextures),P+=1,T}function G(T){const x=[];return x.push(T.wrapS),x.push(T.wrapT),x.push(T.wrapR||0),x.push(T.magFilter),x.push(T.minFilter),x.push(T.anisotropy),x.push(T.internalFormat),x.push(T.format),x.push(T.type),x.push(T.generateMipmaps),x.push(T.premultiplyAlpha),x.push(T.flipY),x.push(T.unpackAlignment),x.push(T.colorSpace),x.join()}function K(T,x){const U=n.get(T);if(T.isVideoTexture&&oe(T),T.isRenderTargetTexture===!1&&T.version>0&&U.__version!==T.version){const X=T.image;if(X===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(X.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Y(U,T,x);return}}t.bindTexture(i.TEXTURE_2D,U.__webglTexture,i.TEXTURE0+x)}function V(T,x){const U=n.get(T);if(T.version>0&&U.__version!==T.version){Y(U,T,x);return}t.bindTexture(i.TEXTURE_2D_ARRAY,U.__webglTexture,i.TEXTURE0+x)}function ne(T,x){const U=n.get(T);if(T.version>0&&U.__version!==T.version){Y(U,T,x);return}t.bindTexture(i.TEXTURE_3D,U.__webglTexture,i.TEXTURE0+x)}function W(T,x){const U=n.get(T);if(T.version>0&&U.__version!==T.version){se(U,T,x);return}t.bindTexture(i.TEXTURE_CUBE_MAP,U.__webglTexture,i.TEXTURE0+x)}const le={[Oa]:i.REPEAT,[pi]:i.CLAMP_TO_EDGE,[Ua]:i.MIRRORED_REPEAT},ge={[gn]:i.NEAREST,[qu]:i.NEAREST_MIPMAP_NEAREST,[Ws]:i.NEAREST_MIPMAP_LINEAR,[Sn]:i.LINEAR,[Ur]:i.LINEAR_MIPMAP_NEAREST,[mi]:i.LINEAR_MIPMAP_LINEAR},Me={[Zu]:i.NEVER,[id]:i.ALWAYS,[Ju]:i.LESS,[yh]:i.LEQUAL,[Qu]:i.EQUAL,[nd]:i.GEQUAL,[ed]:i.GREATER,[td]:i.NOTEQUAL};function Ve(T,x){if(x.type===kn&&e.has("OES_texture_float_linear")===!1&&(x.magFilter===Sn||x.magFilter===Ur||x.magFilter===Ws||x.magFilter===mi||x.minFilter===Sn||x.minFilter===Ur||x.minFilter===Ws||x.minFilter===mi)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(T,i.TEXTURE_WRAP_S,le[x.wrapS]),i.texParameteri(T,i.TEXTURE_WRAP_T,le[x.wrapT]),(T===i.TEXTURE_3D||T===i.TEXTURE_2D_ARRAY)&&i.texParameteri(T,i.TEXTURE_WRAP_R,le[x.wrapR]),i.texParameteri(T,i.TEXTURE_MAG_FILTER,ge[x.magFilter]),i.texParameteri(T,i.TEXTURE_MIN_FILTER,ge[x.minFilter]),x.compareFunction&&(i.texParameteri(T,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(T,i.TEXTURE_COMPARE_FUNC,Me[x.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(x.magFilter===gn||x.minFilter!==Ws&&x.minFilter!==mi||x.type===kn&&e.has("OES_texture_float_linear")===!1)return;if(x.anisotropy>1||n.get(x).__currentAnisotropy){const U=e.get("EXT_texture_filter_anisotropic");i.texParameterf(T,U.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,s.getMaxAnisotropy())),n.get(x).__currentAnisotropy=x.anisotropy}}}function tt(T,x){let U=!1;T.__webglInit===void 0&&(T.__webglInit=!0,x.addEventListener("dispose",A));const X=x.source;let Q=d.get(X);Q===void 0&&(Q={},d.set(X,Q));const q=G(x);if(q!==T.__cacheKey){Q[q]===void 0&&(Q[q]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,U=!0),Q[q].usedTimes++;const Te=Q[T.__cacheKey];Te!==void 0&&(Q[T.__cacheKey].usedTimes--,Te.usedTimes===0&&w(x)),T.__cacheKey=q,T.__webglTexture=Q[q].texture}return U}function Y(T,x,U){let X=i.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(X=i.TEXTURE_2D_ARRAY),x.isData3DTexture&&(X=i.TEXTURE_3D);const Q=tt(T,x),q=x.source;t.bindTexture(X,T.__webglTexture,i.TEXTURE0+U);const Te=n.get(q);if(q.version!==Te.__version||Q===!0){t.activeTexture(i.TEXTURE0+U);const ue=Je.getPrimaries(Je.workingColorSpace),_e=x.colorSpace===Qn?null:Je.getPrimaries(x.colorSpace),je=x.colorSpace===Qn||ue===_e?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,je);let te=v(x.image,!1,s.maxTextureSize);te=Ie(x,te);const be=r.convert(x.format,x.colorSpace),Oe=r.convert(x.type);let Fe=y(x.internalFormat,be,Oe,x.colorSpace,x.isVideoTexture);Ve(X,x);let Se;const Ze=x.mipmaps,Ye=x.isVideoTexture!==!0,ut=Te.__version===void 0||Q===!0,L=q.dataReady,de=N(x,te);if(x.isDepthTexture)Fe=_(x.format===ns,x.type),ut&&(Ye?t.texStorage2D(i.TEXTURE_2D,1,Fe,te.width,te.height):t.texImage2D(i.TEXTURE_2D,0,Fe,te.width,te.height,0,be,Oe,null));else if(x.isDataTexture)if(Ze.length>0){Ye&&ut&&t.texStorage2D(i.TEXTURE_2D,de,Fe,Ze[0].width,Ze[0].height);for(let $=0,j=Ze.length;$<j;$++)Se=Ze[$],Ye?L&&t.texSubImage2D(i.TEXTURE_2D,$,0,0,Se.width,Se.height,be,Oe,Se.data):t.texImage2D(i.TEXTURE_2D,$,Fe,Se.width,Se.height,0,be,Oe,Se.data);x.generateMipmaps=!1}else Ye?(ut&&t.texStorage2D(i.TEXTURE_2D,de,Fe,te.width,te.height),L&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,te.width,te.height,be,Oe,te.data)):t.texImage2D(i.TEXTURE_2D,0,Fe,te.width,te.height,0,be,Oe,te.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){Ye&&ut&&t.texStorage3D(i.TEXTURE_2D_ARRAY,de,Fe,Ze[0].width,Ze[0].height,te.depth);for(let $=0,j=Ze.length;$<j;$++)if(Se=Ze[$],x.format!==mn)if(be!==null)if(Ye){if(L)if(x.layerUpdates.size>0){const me=uc(Se.width,Se.height,x.format,x.type);for(const fe of x.layerUpdates){const $e=Se.data.subarray(fe*me/Se.data.BYTES_PER_ELEMENT,(fe+1)*me/Se.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,fe,Se.width,Se.height,1,be,$e)}x.clearLayerUpdates()}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,0,Se.width,Se.height,te.depth,be,Se.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,$,Fe,Se.width,Se.height,te.depth,0,Se.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ye?L&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,0,Se.width,Se.height,te.depth,be,Oe,Se.data):t.texImage3D(i.TEXTURE_2D_ARRAY,$,Fe,Se.width,Se.height,te.depth,0,be,Oe,Se.data)}else{Ye&&ut&&t.texStorage2D(i.TEXTURE_2D,de,Fe,Ze[0].width,Ze[0].height);for(let $=0,j=Ze.length;$<j;$++)Se=Ze[$],x.format!==mn?be!==null?Ye?L&&t.compressedTexSubImage2D(i.TEXTURE_2D,$,0,0,Se.width,Se.height,be,Se.data):t.compressedTexImage2D(i.TEXTURE_2D,$,Fe,Se.width,Se.height,0,Se.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ye?L&&t.texSubImage2D(i.TEXTURE_2D,$,0,0,Se.width,Se.height,be,Oe,Se.data):t.texImage2D(i.TEXTURE_2D,$,Fe,Se.width,Se.height,0,be,Oe,Se.data)}else if(x.isDataArrayTexture)if(Ye){if(ut&&t.texStorage3D(i.TEXTURE_2D_ARRAY,de,Fe,te.width,te.height,te.depth),L)if(x.layerUpdates.size>0){const $=uc(te.width,te.height,x.format,x.type);for(const j of x.layerUpdates){const me=te.data.subarray(j*$/te.data.BYTES_PER_ELEMENT,(j+1)*$/te.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,j,te.width,te.height,1,be,Oe,me)}x.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,te.width,te.height,te.depth,be,Oe,te.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,Fe,te.width,te.height,te.depth,0,be,Oe,te.data);else if(x.isData3DTexture)Ye?(ut&&t.texStorage3D(i.TEXTURE_3D,de,Fe,te.width,te.height,te.depth),L&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,te.width,te.height,te.depth,be,Oe,te.data)):t.texImage3D(i.TEXTURE_3D,0,Fe,te.width,te.height,te.depth,0,be,Oe,te.data);else if(x.isFramebufferTexture){if(ut)if(Ye)t.texStorage2D(i.TEXTURE_2D,de,Fe,te.width,te.height);else{let $=te.width,j=te.height;for(let me=0;me<de;me++)t.texImage2D(i.TEXTURE_2D,me,Fe,$,j,0,be,Oe,null),$>>=1,j>>=1}}else if(Ze.length>0){if(Ye&&ut){const $=ve(Ze[0]);t.texStorage2D(i.TEXTURE_2D,de,Fe,$.width,$.height)}for(let $=0,j=Ze.length;$<j;$++)Se=Ze[$],Ye?L&&t.texSubImage2D(i.TEXTURE_2D,$,0,0,be,Oe,Se):t.texImage2D(i.TEXTURE_2D,$,Fe,be,Oe,Se);x.generateMipmaps=!1}else if(Ye){if(ut){const $=ve(te);t.texStorage2D(i.TEXTURE_2D,de,Fe,$.width,$.height)}L&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,be,Oe,te)}else t.texImage2D(i.TEXTURE_2D,0,Fe,be,Oe,te);m(x)&&f(X),Te.__version=q.version,x.onUpdate&&x.onUpdate(x)}T.__version=x.version}function se(T,x,U){if(x.image.length!==6)return;const X=tt(T,x),Q=x.source;t.bindTexture(i.TEXTURE_CUBE_MAP,T.__webglTexture,i.TEXTURE0+U);const q=n.get(Q);if(Q.version!==q.__version||X===!0){t.activeTexture(i.TEXTURE0+U);const Te=Je.getPrimaries(Je.workingColorSpace),ue=x.colorSpace===Qn?null:Je.getPrimaries(x.colorSpace),_e=x.colorSpace===Qn||Te===ue?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,_e);const je=x.isCompressedTexture||x.image[0].isCompressedTexture,te=x.image[0]&&x.image[0].isDataTexture,be=[];for(let j=0;j<6;j++)!je&&!te?be[j]=v(x.image[j],!0,s.maxCubemapSize):be[j]=te?x.image[j].image:x.image[j],be[j]=Ie(x,be[j]);const Oe=be[0],Fe=r.convert(x.format,x.colorSpace),Se=r.convert(x.type),Ze=y(x.internalFormat,Fe,Se,x.colorSpace),Ye=x.isVideoTexture!==!0,ut=q.__version===void 0||X===!0,L=Q.dataReady;let de=N(x,Oe);Ve(i.TEXTURE_CUBE_MAP,x);let $;if(je){Ye&&ut&&t.texStorage2D(i.TEXTURE_CUBE_MAP,de,Ze,Oe.width,Oe.height);for(let j=0;j<6;j++){$=be[j].mipmaps;for(let me=0;me<$.length;me++){const fe=$[me];x.format!==mn?Fe!==null?Ye?L&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,me,0,0,fe.width,fe.height,Fe,fe.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,me,Ze,fe.width,fe.height,0,fe.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Ye?L&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,me,0,0,fe.width,fe.height,Fe,Se,fe.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,me,Ze,fe.width,fe.height,0,Fe,Se,fe.data)}}}else{if($=x.mipmaps,Ye&&ut){$.length>0&&de++;const j=ve(be[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,de,Ze,j.width,j.height)}for(let j=0;j<6;j++)if(te){Ye?L&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,be[j].width,be[j].height,Fe,Se,be[j].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Ze,be[j].width,be[j].height,0,Fe,Se,be[j].data);for(let me=0;me<$.length;me++){const $e=$[me].image[j].image;Ye?L&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,me+1,0,0,$e.width,$e.height,Fe,Se,$e.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,me+1,Ze,$e.width,$e.height,0,Fe,Se,$e.data)}}else{Ye?L&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,Fe,Se,be[j]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Ze,Fe,Se,be[j]);for(let me=0;me<$.length;me++){const fe=$[me];Ye?L&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,me+1,0,0,Fe,Se,fe.image[j]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+j,me+1,Ze,Fe,Se,fe.image[j])}}}m(x)&&f(i.TEXTURE_CUBE_MAP),q.__version=Q.version,x.onUpdate&&x.onUpdate(x)}T.__version=x.version}function we(T,x,U,X,Q,q){const Te=r.convert(U.format,U.colorSpace),ue=r.convert(U.type),_e=y(U.internalFormat,Te,ue,U.colorSpace),je=n.get(x),te=n.get(U);if(te.__renderTarget=x,!je.__hasExternalTextures){const be=Math.max(1,x.width>>q),Oe=Math.max(1,x.height>>q);Q===i.TEXTURE_3D||Q===i.TEXTURE_2D_ARRAY?t.texImage3D(Q,q,_e,be,Oe,x.depth,0,Te,ue,null):t.texImage2D(Q,q,_e,be,Oe,0,Te,ue,null)}t.bindFramebuffer(i.FRAMEBUFFER,T),ye(x)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,X,Q,te.__webglTexture,0,ee(x)):(Q===i.TEXTURE_2D||Q>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&Q<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,X,Q,te.__webglTexture,q),t.bindFramebuffer(i.FRAMEBUFFER,null)}function ae(T,x,U){if(i.bindRenderbuffer(i.RENDERBUFFER,T),x.depthBuffer){const X=x.depthTexture,Q=X&&X.isDepthTexture?X.type:null,q=_(x.stencilBuffer,Q),Te=x.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ue=ee(x);ye(x)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ue,q,x.width,x.height):U?i.renderbufferStorageMultisample(i.RENDERBUFFER,ue,q,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,q,x.width,x.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,Te,i.RENDERBUFFER,T)}else{const X=x.textures;for(let Q=0;Q<X.length;Q++){const q=X[Q],Te=r.convert(q.format,q.colorSpace),ue=r.convert(q.type),_e=y(q.internalFormat,Te,ue,q.colorSpace),je=ee(x);U&&ye(x)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,je,_e,x.width,x.height):ye(x)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,je,_e,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,_e,x.width,x.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Ne(T,x){if(x&&x.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(i.FRAMEBUFFER,T),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const X=n.get(x.depthTexture);X.__renderTarget=x,(!X.__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),K(x.depthTexture,0);const Q=X.__webglTexture,q=ee(x);if(x.depthTexture.format===Ki)ye(x)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,Q,0,q):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,Q,0);else if(x.depthTexture.format===ns)ye(x)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,Q,0,q):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,Q,0);else throw new Error("Unknown depthTexture format")}function He(T){const x=n.get(T),U=T.isWebGLCubeRenderTarget===!0;if(x.__boundDepthTexture!==T.depthTexture){const X=T.depthTexture;if(x.__depthDisposeCallback&&x.__depthDisposeCallback(),X){const Q=()=>{delete x.__boundDepthTexture,delete x.__depthDisposeCallback,X.removeEventListener("dispose",Q)};X.addEventListener("dispose",Q),x.__depthDisposeCallback=Q}x.__boundDepthTexture=X}if(T.depthTexture&&!x.__autoAllocateDepthBuffer){if(U)throw new Error("target.depthTexture not supported in Cube render targets");Ne(x.__webglFramebuffer,T)}else if(U){x.__webglDepthbuffer=[];for(let X=0;X<6;X++)if(t.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer[X]),x.__webglDepthbuffer[X]===void 0)x.__webglDepthbuffer[X]=i.createRenderbuffer(),ae(x.__webglDepthbuffer[X],T,!1);else{const Q=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,q=x.__webglDepthbuffer[X];i.bindRenderbuffer(i.RENDERBUFFER,q),i.framebufferRenderbuffer(i.FRAMEBUFFER,Q,i.RENDERBUFFER,q)}}else if(t.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer===void 0)x.__webglDepthbuffer=i.createRenderbuffer(),ae(x.__webglDepthbuffer,T,!1);else{const X=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Q=x.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,Q),i.framebufferRenderbuffer(i.FRAMEBUFFER,X,i.RENDERBUFFER,Q)}t.bindFramebuffer(i.FRAMEBUFFER,null)}function Ue(T,x,U){const X=n.get(T);x!==void 0&&we(X.__webglFramebuffer,T,T.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),U!==void 0&&He(T)}function Qe(T){const x=T.texture,U=n.get(T),X=n.get(x);T.addEventListener("dispose",R);const Q=T.textures,q=T.isWebGLCubeRenderTarget===!0,Te=Q.length>1;if(Te||(X.__webglTexture===void 0&&(X.__webglTexture=i.createTexture()),X.__version=x.version,a.memory.textures++),q){U.__webglFramebuffer=[];for(let ue=0;ue<6;ue++)if(x.mipmaps&&x.mipmaps.length>0){U.__webglFramebuffer[ue]=[];for(let _e=0;_e<x.mipmaps.length;_e++)U.__webglFramebuffer[ue][_e]=i.createFramebuffer()}else U.__webglFramebuffer[ue]=i.createFramebuffer()}else{if(x.mipmaps&&x.mipmaps.length>0){U.__webglFramebuffer=[];for(let ue=0;ue<x.mipmaps.length;ue++)U.__webglFramebuffer[ue]=i.createFramebuffer()}else U.__webglFramebuffer=i.createFramebuffer();if(Te)for(let ue=0,_e=Q.length;ue<_e;ue++){const je=n.get(Q[ue]);je.__webglTexture===void 0&&(je.__webglTexture=i.createTexture(),a.memory.textures++)}if(T.samples>0&&ye(T)===!1){U.__webglMultisampledFramebuffer=i.createFramebuffer(),U.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,U.__webglMultisampledFramebuffer);for(let ue=0;ue<Q.length;ue++){const _e=Q[ue];U.__webglColorRenderbuffer[ue]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,U.__webglColorRenderbuffer[ue]);const je=r.convert(_e.format,_e.colorSpace),te=r.convert(_e.type),be=y(_e.internalFormat,je,te,_e.colorSpace,T.isXRRenderTarget===!0),Oe=ee(T);i.renderbufferStorageMultisample(i.RENDERBUFFER,Oe,be,T.width,T.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ue,i.RENDERBUFFER,U.__webglColorRenderbuffer[ue])}i.bindRenderbuffer(i.RENDERBUFFER,null),T.depthBuffer&&(U.__webglDepthRenderbuffer=i.createRenderbuffer(),ae(U.__webglDepthRenderbuffer,T,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(q){t.bindTexture(i.TEXTURE_CUBE_MAP,X.__webglTexture),Ve(i.TEXTURE_CUBE_MAP,x);for(let ue=0;ue<6;ue++)if(x.mipmaps&&x.mipmaps.length>0)for(let _e=0;_e<x.mipmaps.length;_e++)we(U.__webglFramebuffer[ue][_e],T,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ue,_e);else we(U.__webglFramebuffer[ue],T,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+ue,0);m(x)&&f(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(Te){for(let ue=0,_e=Q.length;ue<_e;ue++){const je=Q[ue],te=n.get(je);t.bindTexture(i.TEXTURE_2D,te.__webglTexture),Ve(i.TEXTURE_2D,je),we(U.__webglFramebuffer,T,je,i.COLOR_ATTACHMENT0+ue,i.TEXTURE_2D,0),m(je)&&f(i.TEXTURE_2D)}t.unbindTexture()}else{let ue=i.TEXTURE_2D;if((T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(ue=T.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(ue,X.__webglTexture),Ve(ue,x),x.mipmaps&&x.mipmaps.length>0)for(let _e=0;_e<x.mipmaps.length;_e++)we(U.__webglFramebuffer[_e],T,x,i.COLOR_ATTACHMENT0,ue,_e);else we(U.__webglFramebuffer,T,x,i.COLOR_ATTACHMENT0,ue,0);m(x)&&f(ue),t.unbindTexture()}T.depthBuffer&&He(T)}function J(T){const x=T.textures;for(let U=0,X=x.length;U<X;U++){const Q=x[U];if(m(Q)){const q=S(T),Te=n.get(Q).__webglTexture;t.bindTexture(q,Te),f(q),t.unbindTexture()}}}const ie=[],C=[];function Re(T){if(T.samples>0){if(ye(T)===!1){const x=T.textures,U=T.width,X=T.height;let Q=i.COLOR_BUFFER_BIT;const q=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Te=n.get(T),ue=x.length>1;if(ue)for(let _e=0;_e<x.length;_e++)t.bindFramebuffer(i.FRAMEBUFFER,Te.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+_e,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,Te.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+_e,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,Te.__webglMultisampledFramebuffer),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Te.__webglFramebuffer);for(let _e=0;_e<x.length;_e++){if(T.resolveDepthBuffer&&(T.depthBuffer&&(Q|=i.DEPTH_BUFFER_BIT),T.stencilBuffer&&T.resolveStencilBuffer&&(Q|=i.STENCIL_BUFFER_BIT)),ue){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,Te.__webglColorRenderbuffer[_e]);const je=n.get(x[_e]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,je,0)}i.blitFramebuffer(0,0,U,X,0,0,U,X,Q,i.NEAREST),l===!0&&(ie.length=0,C.length=0,ie.push(i.COLOR_ATTACHMENT0+_e),T.depthBuffer&&T.resolveDepthBuffer===!1&&(ie.push(q),C.push(q),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,C)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,ie))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),ue)for(let _e=0;_e<x.length;_e++){t.bindFramebuffer(i.FRAMEBUFFER,Te.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+_e,i.RENDERBUFFER,Te.__webglColorRenderbuffer[_e]);const je=n.get(x[_e]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,Te.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+_e,i.TEXTURE_2D,je,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,Te.__webglMultisampledFramebuffer)}else if(T.depthBuffer&&T.resolveDepthBuffer===!1&&l){const x=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[x])}}}function ee(T){return Math.min(s.maxSamples,T.samples)}function ye(T){const x=n.get(T);return T.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function oe(T){const x=a.render.frame;h.get(T)!==x&&(h.set(T,x),T.update())}function Ie(T,x){const U=T.colorSpace,X=T.format,Q=T.type;return T.isCompressedTexture===!0||T.isVideoTexture===!0||U!==as&&U!==Qn&&(Je.getTransfer(U)===rt?(X!==mn||Q!==Vn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",U)),x}function ve(T){return typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement?(c.width=T.naturalWidth||T.width,c.height=T.naturalHeight||T.height):typeof VideoFrame<"u"&&T instanceof VideoFrame?(c.width=T.displayWidth,c.height=T.displayHeight):(c.width=T.width,c.height=T.height),c}this.allocateTextureUnit=k,this.resetTextureUnits=z,this.setTexture2D=K,this.setTexture2DArray=V,this.setTexture3D=ne,this.setTextureCube=W,this.rebindTextures=Ue,this.setupRenderTarget=Qe,this.updateRenderTargetMipmap=J,this.updateMultisampleRenderTarget=Re,this.setupDepthRenderbuffer=He,this.setupFrameBufferTexture=we,this.useMultisampledRTT=ye}function Sv(i,e){function t(n,s=Qn){let r;const a=Je.getTransfer(s);if(n===Vn)return i.UNSIGNED_BYTE;if(n===Ro)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Po)return i.UNSIGNED_SHORT_5_5_5_1;if(n===hh)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===lh)return i.BYTE;if(n===ch)return i.SHORT;if(n===Ps)return i.UNSIGNED_SHORT;if(n===Co)return i.INT;if(n===gi)return i.UNSIGNED_INT;if(n===kn)return i.FLOAT;if(n===Hn)return i.HALF_FLOAT;if(n===uh)return i.ALPHA;if(n===dh)return i.RGB;if(n===mn)return i.RGBA;if(n===fh)return i.LUMINANCE;if(n===ph)return i.LUMINANCE_ALPHA;if(n===Ki)return i.DEPTH_COMPONENT;if(n===ns)return i.DEPTH_STENCIL;if(n===mh)return i.RED;if(n===Do)return i.RED_INTEGER;if(n===gh)return i.RG;if(n===Lo)return i.RG_INTEGER;if(n===No)return i.RGBA_INTEGER;if(n===gr||n===vr||n===_r||n===yr)if(a===rt)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===gr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===vr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===_r)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===yr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===gr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===vr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===_r)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===yr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===ka||n===Fa||n===Ba||n===Ha)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===ka)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Fa)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Ba)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Ha)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===za||n===Ga||n===Va)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===za||n===Ga)return a===rt?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Va)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===Wa||n===$a||n===Xa||n===qa||n===Ya||n===Ka||n===ja||n===Za||n===Ja||n===Qa||n===eo||n===to||n===no||n===io)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Wa)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===$a)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Xa)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===qa)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Ya)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Ka)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===ja)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Za)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Ja)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Qa)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===eo)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===to)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===no)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===io)return a===rt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===xr||n===so||n===ro)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===xr)return a===rt?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===so)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===ro)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===vh||n===ao||n===oo||n===lo)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===xr)return r.COMPRESSED_RED_RGTC1_EXT;if(n===ao)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===oo)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===lo)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===ts?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}class Mv extends en{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}}class ct extends Nt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const wv={type:"move"};class ca{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ct,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ct,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new E,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new E),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ct,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new E,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new E),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const v of e.hand.values()){const m=t.getJointPose(v,n),f=this._getHandJoint(c,v);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),p=.02,g=.005;c.inputState.pinching&&d>p+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=p-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(wv)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new ct;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}const Tv=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Ev=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class Av{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t,n){if(this.texture===null){const s=new $t,r=e.properties.get(s);r.__webglTexture=t.texture,(t.depthNear!=n.depthNear||t.depthFar!=n.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=s}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new Vt({vertexShader:Tv,fragmentShader:Ev,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new ke(new ni(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Cv extends xi{constructor(e,t){super();const n=this;let s=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,p=null,g=null;const v=new Av,m=t.getContextAttributes();let f=null,S=null;const y=[],_=[],N=new Z;let A=null;const R=new en;R.viewport=new lt;const D=new en;D.viewport=new lt;const w=[R,D],b=new Mv;let P=null,z=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let se=y[Y];return se===void 0&&(se=new ca,y[Y]=se),se.getTargetRaySpace()},this.getControllerGrip=function(Y){let se=y[Y];return se===void 0&&(se=new ca,y[Y]=se),se.getGripSpace()},this.getHand=function(Y){let se=y[Y];return se===void 0&&(se=new ca,y[Y]=se),se.getHandSpace()};function k(Y){const se=_.indexOf(Y.inputSource);if(se===-1)return;const we=y[se];we!==void 0&&(we.update(Y.inputSource,Y.frame,c||a),we.dispatchEvent({type:Y.type,data:Y.inputSource}))}function G(){s.removeEventListener("select",k),s.removeEventListener("selectstart",k),s.removeEventListener("selectend",k),s.removeEventListener("squeeze",k),s.removeEventListener("squeezestart",k),s.removeEventListener("squeezeend",k),s.removeEventListener("end",G),s.removeEventListener("inputsourceschange",K);for(let Y=0;Y<y.length;Y++){const se=_[Y];se!==null&&(_[Y]=null,y[Y].disconnect(se))}P=null,z=null,v.reset(),e.setRenderTarget(f),p=null,d=null,u=null,s=null,S=null,tt.stop(),n.isPresenting=!1,e.setPixelRatio(A),e.setSize(N.width,N.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){r=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(Y){if(s=Y,s!==null){if(f=e.getRenderTarget(),s.addEventListener("select",k),s.addEventListener("selectstart",k),s.addEventListener("selectend",k),s.addEventListener("squeeze",k),s.addEventListener("squeezestart",k),s.addEventListener("squeezeend",k),s.addEventListener("end",G),s.addEventListener("inputsourceschange",K),m.xrCompatible!==!0&&await t.makeXRCompatible(),A=e.getPixelRatio(),e.getSize(N),s.renderState.layers===void 0){const se={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(s,t,se),s.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),S=new vn(p.framebufferWidth,p.framebufferHeight,{format:mn,type:Vn,colorSpace:e.outputColorSpace,stencilBuffer:m.stencil})}else{let se=null,we=null,ae=null;m.depth&&(ae=m.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,se=m.stencil?ns:Ki,we=m.stencil?ts:gi);const Ne={colorFormat:t.RGBA8,depthFormat:ae,scaleFactor:r};u=new XRWebGLBinding(s,t),d=u.createProjectionLayer(Ne),s.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),S=new vn(d.textureWidth,d.textureHeight,{format:mn,type:Vn,depthTexture:new Ph(d.textureWidth,d.textureHeight,we,void 0,void 0,void 0,void 0,void 0,void 0,se),stencilBuffer:m.stencil,colorSpace:e.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),tt.setContext(s),tt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return v.getDepthTexture()};function K(Y){for(let se=0;se<Y.removed.length;se++){const we=Y.removed[se],ae=_.indexOf(we);ae>=0&&(_[ae]=null,y[ae].disconnect(we))}for(let se=0;se<Y.added.length;se++){const we=Y.added[se];let ae=_.indexOf(we);if(ae===-1){for(let He=0;He<y.length;He++)if(He>=_.length){_.push(we),ae=He;break}else if(_[He]===null){_[He]=we,ae=He;break}if(ae===-1)break}const Ne=y[ae];Ne&&Ne.connect(we)}}const V=new E,ne=new E;function W(Y,se,we){V.setFromMatrixPosition(se.matrixWorld),ne.setFromMatrixPosition(we.matrixWorld);const ae=V.distanceTo(ne),Ne=se.projectionMatrix.elements,He=we.projectionMatrix.elements,Ue=Ne[14]/(Ne[10]-1),Qe=Ne[14]/(Ne[10]+1),J=(Ne[9]+1)/Ne[5],ie=(Ne[9]-1)/Ne[5],C=(Ne[8]-1)/Ne[0],Re=(He[8]+1)/He[0],ee=Ue*C,ye=Ue*Re,oe=ae/(-C+Re),Ie=oe*-C;if(se.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(Ie),Y.translateZ(oe),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),Ne[10]===-1)Y.projectionMatrix.copy(se.projectionMatrix),Y.projectionMatrixInverse.copy(se.projectionMatrixInverse);else{const ve=Ue+oe,T=Qe+oe,x=ee-Ie,U=ye+(ae-Ie),X=J*Qe/T*ve,Q=ie*Qe/T*ve;Y.projectionMatrix.makePerspective(x,U,X,Q,ve,T),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function le(Y,se){se===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(se.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(s===null)return;let se=Y.near,we=Y.far;v.texture!==null&&(v.depthNear>0&&(se=v.depthNear),v.depthFar>0&&(we=v.depthFar)),b.near=D.near=R.near=se,b.far=D.far=R.far=we,(P!==b.near||z!==b.far)&&(s.updateRenderState({depthNear:b.near,depthFar:b.far}),P=b.near,z=b.far),R.layers.mask=Y.layers.mask|2,D.layers.mask=Y.layers.mask|4,b.layers.mask=R.layers.mask|D.layers.mask;const ae=Y.parent,Ne=b.cameras;le(b,ae);for(let He=0;He<Ne.length;He++)le(Ne[He],ae);Ne.length===2?W(b,R,D):b.projectionMatrix.copy(R.projectionMatrix),ge(Y,b,ae)};function ge(Y,se,we){we===null?Y.matrix.copy(se.matrixWorld):(Y.matrix.copy(we.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(se.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(se.projectionMatrix),Y.projectionMatrixInverse.copy(se.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=Ds*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return b},this.getFoveation=function(){if(!(d===null&&p===null))return l},this.setFoveation=function(Y){l=Y,d!==null&&(d.fixedFoveation=Y),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=Y)},this.hasDepthSensing=function(){return v.texture!==null},this.getDepthSensingMesh=function(){return v.getMesh(b)};let Me=null;function Ve(Y,se){if(h=se.getViewerPose(c||a),g=se,h!==null){const we=h.views;p!==null&&(e.setRenderTargetFramebuffer(S,p.framebuffer),e.setRenderTarget(S));let ae=!1;we.length!==b.cameras.length&&(b.cameras.length=0,ae=!0);for(let He=0;He<we.length;He++){const Ue=we[He];let Qe=null;if(p!==null)Qe=p.getViewport(Ue);else{const ie=u.getViewSubImage(d,Ue);Qe=ie.viewport,He===0&&(e.setRenderTargetTextures(S,ie.colorTexture,d.ignoreDepthValues?void 0:ie.depthStencilTexture),e.setRenderTarget(S))}let J=w[He];J===void 0&&(J=new en,J.layers.enable(He),J.viewport=new lt,w[He]=J),J.matrix.fromArray(Ue.transform.matrix),J.matrix.decompose(J.position,J.quaternion,J.scale),J.projectionMatrix.fromArray(Ue.projectionMatrix),J.projectionMatrixInverse.copy(J.projectionMatrix).invert(),J.viewport.set(Qe.x,Qe.y,Qe.width,Qe.height),He===0&&(b.matrix.copy(J.matrix),b.matrix.decompose(b.position,b.quaternion,b.scale)),ae===!0&&b.cameras.push(J)}const Ne=s.enabledFeatures;if(Ne&&Ne.includes("depth-sensing")){const He=u.getDepthInformation(we[0]);He&&He.isValid&&He.texture&&v.init(e,He,s.renderState)}}for(let we=0;we<y.length;we++){const ae=_[we],Ne=y[we];ae!==null&&Ne!==void 0&&Ne.update(ae,se,c||a)}Me&&Me(Y,se),se.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:se}),g=null}const tt=new Rh;tt.setAnimationLoop(Ve),this.setAnimationLoop=function(Y){Me=Y},this.dispose=function(){}}}const ci=new wn,Rv=new ht;function Pv(i,e){function t(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function n(m,f){f.color.getRGB(m.fogColor.value,Eh(i)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function s(m,f,S,y,_){f.isMeshBasicMaterial||f.isMeshLambertMaterial?r(m,f):f.isMeshToonMaterial?(r(m,f),u(m,f)):f.isMeshPhongMaterial?(r(m,f),h(m,f)):f.isMeshStandardMaterial?(r(m,f),d(m,f),f.isMeshPhysicalMaterial&&p(m,f,_)):f.isMeshMatcapMaterial?(r(m,f),g(m,f)):f.isMeshDepthMaterial?r(m,f):f.isMeshDistanceMaterial?(r(m,f),v(m,f)):f.isMeshNormalMaterial?r(m,f):f.isLineBasicMaterial?(a(m,f),f.isLineDashedMaterial&&o(m,f)):f.isPointsMaterial?l(m,f,S,y):f.isSpriteMaterial?c(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function r(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,t(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===Wt&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,t(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===Wt&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,t(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,t(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,t(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);const S=e.get(f),y=S.envMap,_=S.envMapRotation;y&&(m.envMap.value=y,ci.copy(_),ci.x*=-1,ci.y*=-1,ci.z*=-1,y.isCubeTexture&&y.isRenderTargetTexture===!1&&(ci.y*=-1,ci.z*=-1),m.envMapRotation.value.setFromMatrix4(Rv.makeRotationFromEuler(ci)),m.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap&&(m.lightMap.value=f.lightMap,m.lightMapIntensity.value=f.lightMapIntensity,t(f.lightMap,m.lightMapTransform)),f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,t(f.aoMap,m.aoMapTransform))}function a(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform))}function o(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function l(m,f,S,y){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*S,m.scale.value=y*.5,f.map&&(m.map.value=f.map,t(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function c(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function h(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function u(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function d(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,t(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,t(f.roughnessMap,m.roughnessMapTransform)),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function p(m,f,S){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,t(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,t(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,t(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,t(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,t(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===Wt&&m.clearcoatNormalScale.value.negate())),f.dispersion>0&&(m.dispersion.value=f.dispersion),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,t(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,t(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=S.texture,m.transmissionSamplerSize.value.set(S.width,S.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,t(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,t(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,t(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,t(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,t(f.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,f){f.matcap&&(m.matcap.value=f.matcap)}function v(m,f){const S=e.get(f).light;m.referencePosition.value.setFromMatrixPosition(S.matrixWorld),m.nearDistance.value=S.shadow.camera.near,m.farDistance.value=S.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Dv(i,e,t,n){let s={},r={},a=[];const o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(S,y){const _=y.program;n.uniformBlockBinding(S,_)}function c(S,y){let _=s[S.id];_===void 0&&(g(S),_=h(S),s[S.id]=_,S.addEventListener("dispose",m));const N=y.program;n.updateUBOMapping(S,N);const A=e.render.frame;r[S.id]!==A&&(d(S),r[S.id]=A)}function h(S){const y=u();S.__bindingPointIndex=y;const _=i.createBuffer(),N=S.__size,A=S.usage;return i.bindBuffer(i.UNIFORM_BUFFER,_),i.bufferData(i.UNIFORM_BUFFER,N,A),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,y,_),_}function u(){for(let S=0;S<o;S++)if(a.indexOf(S)===-1)return a.push(S),S;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(S){const y=s[S.id],_=S.uniforms,N=S.__cache;i.bindBuffer(i.UNIFORM_BUFFER,y);for(let A=0,R=_.length;A<R;A++){const D=Array.isArray(_[A])?_[A]:[_[A]];for(let w=0,b=D.length;w<b;w++){const P=D[w];if(p(P,A,w,N)===!0){const z=P.__offset,k=Array.isArray(P.value)?P.value:[P.value];let G=0;for(let K=0;K<k.length;K++){const V=k[K],ne=v(V);typeof V=="number"||typeof V=="boolean"?(P.__data[0]=V,i.bufferSubData(i.UNIFORM_BUFFER,z+G,P.__data)):V.isMatrix3?(P.__data[0]=V.elements[0],P.__data[1]=V.elements[1],P.__data[2]=V.elements[2],P.__data[3]=0,P.__data[4]=V.elements[3],P.__data[5]=V.elements[4],P.__data[6]=V.elements[5],P.__data[7]=0,P.__data[8]=V.elements[6],P.__data[9]=V.elements[7],P.__data[10]=V.elements[8],P.__data[11]=0):(V.toArray(P.__data,G),G+=ne.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,z,P.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function p(S,y,_,N){const A=S.value,R=y+"_"+_;if(N[R]===void 0)return typeof A=="number"||typeof A=="boolean"?N[R]=A:N[R]=A.clone(),!0;{const D=N[R];if(typeof A=="number"||typeof A=="boolean"){if(D!==A)return N[R]=A,!0}else if(D.equals(A)===!1)return D.copy(A),!0}return!1}function g(S){const y=S.uniforms;let _=0;const N=16;for(let R=0,D=y.length;R<D;R++){const w=Array.isArray(y[R])?y[R]:[y[R]];for(let b=0,P=w.length;b<P;b++){const z=w[b],k=Array.isArray(z.value)?z.value:[z.value];for(let G=0,K=k.length;G<K;G++){const V=k[G],ne=v(V),W=_%N,le=W%ne.boundary,ge=W+le;_+=le,ge!==0&&N-ge<ne.storage&&(_+=N-ge),z.__data=new Float32Array(ne.storage/Float32Array.BYTES_PER_ELEMENT),z.__offset=_,_+=ne.storage}}}const A=_%N;return A>0&&(_+=N-A),S.__size=_,S.__cache={},this}function v(S){const y={boundary:0,storage:0};return typeof S=="number"||typeof S=="boolean"?(y.boundary=4,y.storage=4):S.isVector2?(y.boundary=8,y.storage=8):S.isVector3||S.isColor?(y.boundary=16,y.storage=12):S.isVector4?(y.boundary=16,y.storage=16):S.isMatrix3?(y.boundary=48,y.storage=48):S.isMatrix4?(y.boundary=64,y.storage=64):S.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",S),y}function m(S){const y=S.target;y.removeEventListener("dispose",m);const _=a.indexOf(y.__bindingPointIndex);a.splice(_,1),i.deleteBuffer(s[y.id]),delete s[y.id],delete r[y.id]}function f(){for(const S in s)i.deleteBuffer(s[S]);a=[],s={},r={}}return{bind:l,update:c,dispose:f}}class Lv{constructor(e={}){const{canvas:t=xd(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reverseDepthBuffer:d=!1}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=a;const g=new Uint32Array(4),v=new Int32Array(4);let m=null,f=null;const S=[],y=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Gt,this.toneMapping=ei,this.toneMappingExposure=1;const _=this;let N=!1,A=0,R=0,D=null,w=-1,b=null;const P=new lt,z=new lt;let k=null;const G=new Ge(0);let K=0,V=t.width,ne=t.height,W=1,le=null,ge=null;const Me=new lt(0,0,V,ne),Ve=new lt(0,0,V,ne);let tt=!1;const Y=new Fo;let se=!1,we=!1;const ae=new ht,Ne=new ht,He=new E,Ue=new lt,Qe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let J=!1;function ie(){return D===null?W:1}let C=n;function Re(M,I){return t.getContext(M,I)}try{const M={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Eo}`),t.addEventListener("webglcontextlost",j,!1),t.addEventListener("webglcontextrestored",me,!1),t.addEventListener("webglcontextcreationerror",fe,!1),C===null){const I="webgl2";if(C=Re(I,M),C===null)throw Re(I)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(M){throw console.error("THREE.WebGLRenderer: "+M.message),M}let ee,ye,oe,Ie,ve,T,x,U,X,Q,q,Te,ue,_e,je,te,be,Oe,Fe,Se,Ze,Ye,ut,L;function de(){ee=new km(C),ee.init(),Ye=new Sv(C,ee),ye=new Dm(C,ee,e,Ye),oe=new yv(C,ee),ye.reverseDepthBuffer&&d&&oe.buffers.depth.setReversed(!0),Ie=new Hm(C),ve=new sv,T=new bv(C,ee,oe,ve,ye,Ye,Ie),x=new Nm(_),U=new Um(_),X=new Xd(C),ut=new Rm(C,X),Q=new Fm(C,X,Ie,ut),q=new Gm(C,Q,X,Ie),Fe=new zm(C,ye,T),te=new Lm(ve),Te=new iv(_,x,U,ee,ye,ut,te),ue=new Pv(_,ve),_e=new av,je=new dv(ee),Oe=new Cm(_,x,U,oe,q,p,l),be=new vv(_,q,ye),L=new Dv(C,Ie,ye,oe),Se=new Pm(C,ee,Ie),Ze=new Bm(C,ee,Ie),Ie.programs=Te.programs,_.capabilities=ye,_.extensions=ee,_.properties=ve,_.renderLists=_e,_.shadowMap=be,_.state=oe,_.info=Ie}de();const $=new Cv(_,C);this.xr=$,this.getContext=function(){return C},this.getContextAttributes=function(){return C.getContextAttributes()},this.forceContextLoss=function(){const M=ee.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){const M=ee.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return W},this.setPixelRatio=function(M){M!==void 0&&(W=M,this.setSize(V,ne,!1))},this.getSize=function(M){return M.set(V,ne)},this.setSize=function(M,I,B=!0){if($.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}V=M,ne=I,t.width=Math.floor(M*W),t.height=Math.floor(I*W),B===!0&&(t.style.width=M+"px",t.style.height=I+"px"),this.setViewport(0,0,M,I)},this.getDrawingBufferSize=function(M){return M.set(V*W,ne*W).floor()},this.setDrawingBufferSize=function(M,I,B){V=M,ne=I,W=B,t.width=Math.floor(M*B),t.height=Math.floor(I*B),this.setViewport(0,0,M,I)},this.getCurrentViewport=function(M){return M.copy(P)},this.getViewport=function(M){return M.copy(Me)},this.setViewport=function(M,I,B,H){M.isVector4?Me.set(M.x,M.y,M.z,M.w):Me.set(M,I,B,H),oe.viewport(P.copy(Me).multiplyScalar(W).round())},this.getScissor=function(M){return M.copy(Ve)},this.setScissor=function(M,I,B,H){M.isVector4?Ve.set(M.x,M.y,M.z,M.w):Ve.set(M,I,B,H),oe.scissor(z.copy(Ve).multiplyScalar(W).round())},this.getScissorTest=function(){return tt},this.setScissorTest=function(M){oe.setScissorTest(tt=M)},this.setOpaqueSort=function(M){le=M},this.setTransparentSort=function(M){ge=M},this.getClearColor=function(M){return M.copy(Oe.getClearColor())},this.setClearColor=function(){Oe.setClearColor.apply(Oe,arguments)},this.getClearAlpha=function(){return Oe.getClearAlpha()},this.setClearAlpha=function(){Oe.setClearAlpha.apply(Oe,arguments)},this.clear=function(M=!0,I=!0,B=!0){let H=0;if(M){let O=!1;if(D!==null){const re=D.texture.format;O=re===No||re===Lo||re===Do}if(O){const re=D.texture.type,pe=re===Vn||re===gi||re===Ps||re===ts||re===Ro||re===Po,Ee=Oe.getClearColor(),Ae=Oe.getClearAlpha(),ze=Ee.r,Xe=Ee.g,Ce=Ee.b;pe?(g[0]=ze,g[1]=Xe,g[2]=Ce,g[3]=Ae,C.clearBufferuiv(C.COLOR,0,g)):(v[0]=ze,v[1]=Xe,v[2]=Ce,v[3]=Ae,C.clearBufferiv(C.COLOR,0,v))}else H|=C.COLOR_BUFFER_BIT}I&&(H|=C.DEPTH_BUFFER_BIT),B&&(H|=C.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),C.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",j,!1),t.removeEventListener("webglcontextrestored",me,!1),t.removeEventListener("webglcontextcreationerror",fe,!1),_e.dispose(),je.dispose(),ve.dispose(),x.dispose(),U.dispose(),q.dispose(),ut.dispose(),L.dispose(),Te.dispose(),$.dispose(),$.removeEventListener("sessionstart",al),$.removeEventListener("sessionend",ol),ii.stop()};function j(M){M.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),N=!0}function me(){console.log("THREE.WebGLRenderer: Context Restored."),N=!1;const M=Ie.autoReset,I=be.enabled,B=be.autoUpdate,H=be.needsUpdate,O=be.type;de(),Ie.autoReset=M,be.enabled=I,be.autoUpdate=B,be.needsUpdate=H,be.type=O}function fe(M){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function $e(M){const I=M.target;I.removeEventListener("dispose",$e),vt(I)}function vt(M){It(M),ve.remove(M)}function It(M){const I=ve.get(M).programs;I!==void 0&&(I.forEach(function(B){Te.releaseProgram(B)}),M.isShaderMaterial&&Te.releaseShaderCache(M))}this.renderBufferDirect=function(M,I,B,H,O,re){I===null&&(I=Qe);const pe=O.isMesh&&O.matrixWorld.determinant()<0,Ee=pu(M,I,B,H,O);oe.setMaterial(H,pe);let Ae=B.index,ze=1;if(H.wireframe===!0){if(Ae=Q.getWireframeAttribute(B),Ae===void 0)return;ze=2}const Xe=B.drawRange,Ce=B.attributes.position;let et=Xe.start*ze,dt=(Xe.start+Xe.count)*ze;re!==null&&(et=Math.max(et,re.start*ze),dt=Math.min(dt,(re.start+re.count)*ze)),Ae!==null?(et=Math.max(et,0),dt=Math.min(dt,Ae.count)):Ce!=null&&(et=Math.max(et,0),dt=Math.min(dt,Ce.count));const ft=dt-et;if(ft<0||ft===1/0)return;ut.setup(O,H,Ee,B,Ae);let qt,nt=Se;if(Ae!==null&&(qt=X.get(Ae),nt=Ze,nt.setIndex(qt)),O.isMesh)H.wireframe===!0?(oe.setLineWidth(H.wireframeLinewidth*ie()),nt.setMode(C.LINES)):nt.setMode(C.TRIANGLES);else if(O.isLine){let Pe=H.linewidth;Pe===void 0&&(Pe=1),oe.setLineWidth(Pe*ie()),O.isLineSegments?nt.setMode(C.LINES):O.isLineLoop?nt.setMode(C.LINE_LOOP):nt.setMode(C.LINE_STRIP)}else O.isPoints?nt.setMode(C.POINTS):O.isSprite&&nt.setMode(C.TRIANGLES);if(O.isBatchedMesh)if(O._multiDrawInstances!==null)nt.renderMultiDrawInstances(O._multiDrawStarts,O._multiDrawCounts,O._multiDrawCount,O._multiDrawInstances);else if(ee.get("WEBGL_multi_draw"))nt.renderMultiDraw(O._multiDrawStarts,O._multiDrawCounts,O._multiDrawCount);else{const Pe=O._multiDrawStarts,Cn=O._multiDrawCounts,it=O._multiDrawCount,on=Ae?X.get(Ae).bytesPerElement:1,Si=ve.get(H).currentProgram.getUniforms();for(let Zt=0;Zt<it;Zt++)Si.setValue(C,"_gl_DrawID",Zt),nt.render(Pe[Zt]/on,Cn[Zt])}else if(O.isInstancedMesh)nt.renderInstances(et,ft,O.count);else if(B.isInstancedBufferGeometry){const Pe=B._maxInstanceCount!==void 0?B._maxInstanceCount:1/0,Cn=Math.min(B.instanceCount,Pe);nt.renderInstances(et,ft,Cn)}else nt.render(et,ft)};function st(M,I,B){M.transparent===!0&&M.side===bn&&M.forceSinglePass===!1?(M.side=Wt,M.needsUpdate=!0,Vs(M,I,B),M.side=ti,M.needsUpdate=!0,Vs(M,I,B),M.side=bn):Vs(M,I,B)}this.compile=function(M,I,B=null){B===null&&(B=M),f=je.get(B),f.init(I),y.push(f),B.traverseVisible(function(O){O.isLight&&O.layers.test(I.layers)&&(f.pushLight(O),O.castShadow&&f.pushShadow(O))}),M!==B&&M.traverseVisible(function(O){O.isLight&&O.layers.test(I.layers)&&(f.pushLight(O),O.castShadow&&f.pushShadow(O))}),f.setupLights();const H=new Set;return M.traverse(function(O){if(!(O.isMesh||O.isPoints||O.isLine||O.isSprite))return;const re=O.material;if(re)if(Array.isArray(re))for(let pe=0;pe<re.length;pe++){const Ee=re[pe];st(Ee,B,O),H.add(Ee)}else st(re,B,O),H.add(re)}),y.pop(),f=null,H},this.compileAsync=function(M,I,B=null){const H=this.compile(M,I,B);return new Promise(O=>{function re(){if(H.forEach(function(pe){ve.get(pe).currentProgram.isReady()&&H.delete(pe)}),H.size===0){O(M);return}setTimeout(re,10)}ee.get("KHR_parallel_shader_compile")!==null?re():setTimeout(re,10)})};let an=null;function An(M){an&&an(M)}function al(){ii.stop()}function ol(){ii.start()}const ii=new Rh;ii.setAnimationLoop(An),typeof self<"u"&&ii.setContext(self),this.setAnimationLoop=function(M){an=M,$.setAnimationLoop(M),M===null?ii.stop():ii.start()},$.addEventListener("sessionstart",al),$.addEventListener("sessionend",ol),this.render=function(M,I){if(I!==void 0&&I.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(N===!0)return;if(M.matrixWorldAutoUpdate===!0&&M.updateMatrixWorld(),I.parent===null&&I.matrixWorldAutoUpdate===!0&&I.updateMatrixWorld(),$.enabled===!0&&$.isPresenting===!0&&($.cameraAutoUpdate===!0&&$.updateCamera(I),I=$.getCamera()),M.isScene===!0&&M.onBeforeRender(_,M,I,D),f=je.get(M,y.length),f.init(I),y.push(f),Ne.multiplyMatrices(I.projectionMatrix,I.matrixWorldInverse),Y.setFromProjectionMatrix(Ne),we=this.localClippingEnabled,se=te.init(this.clippingPlanes,we),m=_e.get(M,S.length),m.init(),S.push(m),$.enabled===!0&&$.isPresenting===!0){const re=_.xr.getDepthSensingMesh();re!==null&&Or(re,I,-1/0,_.sortObjects)}Or(M,I,0,_.sortObjects),m.finish(),_.sortObjects===!0&&m.sort(le,ge),J=$.enabled===!1||$.isPresenting===!1||$.hasDepthSensing()===!1,J&&Oe.addToRenderList(m,M),this.info.render.frame++,se===!0&&te.beginShadows();const B=f.state.shadowsArray;be.render(B,M,I),se===!0&&te.endShadows(),this.info.autoReset===!0&&this.info.reset();const H=m.opaque,O=m.transmissive;if(f.setupLights(),I.isArrayCamera){const re=I.cameras;if(O.length>0)for(let pe=0,Ee=re.length;pe<Ee;pe++){const Ae=re[pe];cl(H,O,M,Ae)}J&&Oe.render(M);for(let pe=0,Ee=re.length;pe<Ee;pe++){const Ae=re[pe];ll(m,M,Ae,Ae.viewport)}}else O.length>0&&cl(H,O,M,I),J&&Oe.render(M),ll(m,M,I);D!==null&&(T.updateMultisampleRenderTarget(D),T.updateRenderTargetMipmap(D)),M.isScene===!0&&M.onAfterRender(_,M,I),ut.resetDefaultState(),w=-1,b=null,y.pop(),y.length>0?(f=y[y.length-1],se===!0&&te.setGlobalState(_.clippingPlanes,f.state.camera)):f=null,S.pop(),S.length>0?m=S[S.length-1]:m=null};function Or(M,I,B,H){if(M.visible===!1)return;if(M.layers.test(I.layers)){if(M.isGroup)B=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(I);else if(M.isLight)f.pushLight(M),M.castShadow&&f.pushShadow(M);else if(M.isSprite){if(!M.frustumCulled||Y.intersectsSprite(M)){H&&Ue.setFromMatrixPosition(M.matrixWorld).applyMatrix4(Ne);const pe=q.update(M),Ee=M.material;Ee.visible&&m.push(M,pe,Ee,B,Ue.z,null)}}else if((M.isMesh||M.isLine||M.isPoints)&&(!M.frustumCulled||Y.intersectsObject(M))){const pe=q.update(M),Ee=M.material;if(H&&(M.boundingSphere!==void 0?(M.boundingSphere===null&&M.computeBoundingSphere(),Ue.copy(M.boundingSphere.center)):(pe.boundingSphere===null&&pe.computeBoundingSphere(),Ue.copy(pe.boundingSphere.center)),Ue.applyMatrix4(M.matrixWorld).applyMatrix4(Ne)),Array.isArray(Ee)){const Ae=pe.groups;for(let ze=0,Xe=Ae.length;ze<Xe;ze++){const Ce=Ae[ze],et=Ee[Ce.materialIndex];et&&et.visible&&m.push(M,pe,et,B,Ue.z,Ce)}}else Ee.visible&&m.push(M,pe,Ee,B,Ue.z,null)}}const re=M.children;for(let pe=0,Ee=re.length;pe<Ee;pe++)Or(re[pe],I,B,H)}function ll(M,I,B,H){const O=M.opaque,re=M.transmissive,pe=M.transparent;f.setupLightsView(B),se===!0&&te.setGlobalState(_.clippingPlanes,B),H&&oe.viewport(P.copy(H)),O.length>0&&Gs(O,I,B),re.length>0&&Gs(re,I,B),pe.length>0&&Gs(pe,I,B),oe.buffers.depth.setTest(!0),oe.buffers.depth.setMask(!0),oe.buffers.color.setMask(!0),oe.setPolygonOffset(!1)}function cl(M,I,B,H){if((B.isScene===!0?B.overrideMaterial:null)!==null)return;f.state.transmissionRenderTarget[H.id]===void 0&&(f.state.transmissionRenderTarget[H.id]=new vn(1,1,{generateMipmaps:!0,type:ee.has("EXT_color_buffer_half_float")||ee.has("EXT_color_buffer_float")?Hn:Vn,minFilter:mi,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Je.workingColorSpace}));const re=f.state.transmissionRenderTarget[H.id],pe=H.viewport||P;re.setSize(pe.z,pe.w);const Ee=_.getRenderTarget();_.setRenderTarget(re),_.getClearColor(G),K=_.getClearAlpha(),K<1&&_.setClearColor(16777215,.5),_.clear(),J&&Oe.render(B);const Ae=_.toneMapping;_.toneMapping=ei;const ze=H.viewport;if(H.viewport!==void 0&&(H.viewport=void 0),f.setupLightsView(H),se===!0&&te.setGlobalState(_.clippingPlanes,H),Gs(M,B,H),T.updateMultisampleRenderTarget(re),T.updateRenderTargetMipmap(re),ee.has("WEBGL_multisampled_render_to_texture")===!1){let Xe=!1;for(let Ce=0,et=I.length;Ce<et;Ce++){const dt=I[Ce],ft=dt.object,qt=dt.geometry,nt=dt.material,Pe=dt.group;if(nt.side===bn&&ft.layers.test(H.layers)){const Cn=nt.side;nt.side=Wt,nt.needsUpdate=!0,hl(ft,B,H,qt,nt,Pe),nt.side=Cn,nt.needsUpdate=!0,Xe=!0}}Xe===!0&&(T.updateMultisampleRenderTarget(re),T.updateRenderTargetMipmap(re))}_.setRenderTarget(Ee),_.setClearColor(G,K),ze!==void 0&&(H.viewport=ze),_.toneMapping=Ae}function Gs(M,I,B){const H=I.isScene===!0?I.overrideMaterial:null;for(let O=0,re=M.length;O<re;O++){const pe=M[O],Ee=pe.object,Ae=pe.geometry,ze=H===null?pe.material:H,Xe=pe.group;Ee.layers.test(B.layers)&&hl(Ee,I,B,Ae,ze,Xe)}}function hl(M,I,B,H,O,re){M.onBeforeRender(_,I,B,H,O,re),M.modelViewMatrix.multiplyMatrices(B.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),O.onBeforeRender(_,I,B,H,M,re),O.transparent===!0&&O.side===bn&&O.forceSinglePass===!1?(O.side=Wt,O.needsUpdate=!0,_.renderBufferDirect(B,I,H,O,M,re),O.side=ti,O.needsUpdate=!0,_.renderBufferDirect(B,I,H,O,M,re),O.side=bn):_.renderBufferDirect(B,I,H,O,M,re),M.onAfterRender(_,I,B,H,O,re)}function Vs(M,I,B){I.isScene!==!0&&(I=Qe);const H=ve.get(M),O=f.state.lights,re=f.state.shadowsArray,pe=O.state.version,Ee=Te.getParameters(M,O.state,re,I,B),Ae=Te.getProgramCacheKey(Ee);let ze=H.programs;H.environment=M.isMeshStandardMaterial?I.environment:null,H.fog=I.fog,H.envMap=(M.isMeshStandardMaterial?U:x).get(M.envMap||H.environment),H.envMapRotation=H.environment!==null&&M.envMap===null?I.environmentRotation:M.envMapRotation,ze===void 0&&(M.addEventListener("dispose",$e),ze=new Map,H.programs=ze);let Xe=ze.get(Ae);if(Xe!==void 0){if(H.currentProgram===Xe&&H.lightsStateVersion===pe)return dl(M,Ee),Xe}else Ee.uniforms=Te.getUniforms(M),M.onBeforeCompile(Ee,_),Xe=Te.acquireProgram(Ee,Ae),ze.set(Ae,Xe),H.uniforms=Ee.uniforms;const Ce=H.uniforms;return(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(Ce.clippingPlanes=te.uniform),dl(M,Ee),H.needsLights=gu(M),H.lightsStateVersion=pe,H.needsLights&&(Ce.ambientLightColor.value=O.state.ambient,Ce.lightProbe.value=O.state.probe,Ce.directionalLights.value=O.state.directional,Ce.directionalLightShadows.value=O.state.directionalShadow,Ce.spotLights.value=O.state.spot,Ce.spotLightShadows.value=O.state.spotShadow,Ce.rectAreaLights.value=O.state.rectArea,Ce.ltc_1.value=O.state.rectAreaLTC1,Ce.ltc_2.value=O.state.rectAreaLTC2,Ce.pointLights.value=O.state.point,Ce.pointLightShadows.value=O.state.pointShadow,Ce.hemisphereLights.value=O.state.hemi,Ce.directionalShadowMap.value=O.state.directionalShadowMap,Ce.directionalShadowMatrix.value=O.state.directionalShadowMatrix,Ce.spotShadowMap.value=O.state.spotShadowMap,Ce.spotLightMatrix.value=O.state.spotLightMatrix,Ce.spotLightMap.value=O.state.spotLightMap,Ce.pointShadowMap.value=O.state.pointShadowMap,Ce.pointShadowMatrix.value=O.state.pointShadowMatrix),H.currentProgram=Xe,H.uniformsList=null,Xe}function ul(M){if(M.uniformsList===null){const I=M.currentProgram.getUniforms();M.uniformsList=Sr.seqWithValue(I.seq,M.uniforms)}return M.uniformsList}function dl(M,I){const B=ve.get(M);B.outputColorSpace=I.outputColorSpace,B.batching=I.batching,B.batchingColor=I.batchingColor,B.instancing=I.instancing,B.instancingColor=I.instancingColor,B.instancingMorph=I.instancingMorph,B.skinning=I.skinning,B.morphTargets=I.morphTargets,B.morphNormals=I.morphNormals,B.morphColors=I.morphColors,B.morphTargetsCount=I.morphTargetsCount,B.numClippingPlanes=I.numClippingPlanes,B.numIntersection=I.numClipIntersection,B.vertexAlphas=I.vertexAlphas,B.vertexTangents=I.vertexTangents,B.toneMapping=I.toneMapping}function pu(M,I,B,H,O){I.isScene!==!0&&(I=Qe),T.resetTextureUnits();const re=I.fog,pe=H.isMeshStandardMaterial?I.environment:null,Ee=D===null?_.outputColorSpace:D.isXRRenderTarget===!0?D.texture.colorSpace:as,Ae=(H.isMeshStandardMaterial?U:x).get(H.envMap||pe),ze=H.vertexColors===!0&&!!B.attributes.color&&B.attributes.color.itemSize===4,Xe=!!B.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Ce=!!B.morphAttributes.position,et=!!B.morphAttributes.normal,dt=!!B.morphAttributes.color;let ft=ei;H.toneMapped&&(D===null||D.isXRRenderTarget===!0)&&(ft=_.toneMapping);const qt=B.morphAttributes.position||B.morphAttributes.normal||B.morphAttributes.color,nt=qt!==void 0?qt.length:0,Pe=ve.get(H),Cn=f.state.lights;if(se===!0&&(we===!0||M!==b)){const tn=M===b&&H.id===w;te.setState(H,M,tn)}let it=!1;H.version===Pe.__version?(Pe.needsLights&&Pe.lightsStateVersion!==Cn.state.version||Pe.outputColorSpace!==Ee||O.isBatchedMesh&&Pe.batching===!1||!O.isBatchedMesh&&Pe.batching===!0||O.isBatchedMesh&&Pe.batchingColor===!0&&O.colorTexture===null||O.isBatchedMesh&&Pe.batchingColor===!1&&O.colorTexture!==null||O.isInstancedMesh&&Pe.instancing===!1||!O.isInstancedMesh&&Pe.instancing===!0||O.isSkinnedMesh&&Pe.skinning===!1||!O.isSkinnedMesh&&Pe.skinning===!0||O.isInstancedMesh&&Pe.instancingColor===!0&&O.instanceColor===null||O.isInstancedMesh&&Pe.instancingColor===!1&&O.instanceColor!==null||O.isInstancedMesh&&Pe.instancingMorph===!0&&O.morphTexture===null||O.isInstancedMesh&&Pe.instancingMorph===!1&&O.morphTexture!==null||Pe.envMap!==Ae||H.fog===!0&&Pe.fog!==re||Pe.numClippingPlanes!==void 0&&(Pe.numClippingPlanes!==te.numPlanes||Pe.numIntersection!==te.numIntersection)||Pe.vertexAlphas!==ze||Pe.vertexTangents!==Xe||Pe.morphTargets!==Ce||Pe.morphNormals!==et||Pe.morphColors!==dt||Pe.toneMapping!==ft||Pe.morphTargetsCount!==nt)&&(it=!0):(it=!0,Pe.__version=H.version);let on=Pe.currentProgram;it===!0&&(on=Vs(H,I,O));let Si=!1,Zt=!1,hs=!1;const pt=on.getUniforms(),yn=Pe.uniforms;if(oe.useProgram(on.program)&&(Si=!0,Zt=!0,hs=!0),H.id!==w&&(w=H.id,Zt=!0),Si||b!==M){oe.buffers.depth.getReversed()?(ae.copy(M.projectionMatrix),Sd(ae),Md(ae),pt.setValue(C,"projectionMatrix",ae)):pt.setValue(C,"projectionMatrix",M.projectionMatrix),pt.setValue(C,"viewMatrix",M.matrixWorldInverse);const Wn=pt.map.cameraPosition;Wn!==void 0&&Wn.setValue(C,He.setFromMatrixPosition(M.matrixWorld)),ye.logarithmicDepthBuffer&&pt.setValue(C,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&pt.setValue(C,"isOrthographic",M.isOrthographicCamera===!0),b!==M&&(b=M,Zt=!0,hs=!0)}if(O.isSkinnedMesh){pt.setOptional(C,O,"bindMatrix"),pt.setOptional(C,O,"bindMatrixInverse");const tn=O.skeleton;tn&&(tn.boneTexture===null&&tn.computeBoneTexture(),pt.setValue(C,"boneTexture",tn.boneTexture,T))}O.isBatchedMesh&&(pt.setOptional(C,O,"batchingTexture"),pt.setValue(C,"batchingTexture",O._matricesTexture,T),pt.setOptional(C,O,"batchingIdTexture"),pt.setValue(C,"batchingIdTexture",O._indirectTexture,T),pt.setOptional(C,O,"batchingColorTexture"),O._colorsTexture!==null&&pt.setValue(C,"batchingColorTexture",O._colorsTexture,T));const us=B.morphAttributes;if((us.position!==void 0||us.normal!==void 0||us.color!==void 0)&&Fe.update(O,B,on),(Zt||Pe.receiveShadow!==O.receiveShadow)&&(Pe.receiveShadow=O.receiveShadow,pt.setValue(C,"receiveShadow",O.receiveShadow)),H.isMeshGouraudMaterial&&H.envMap!==null&&(yn.envMap.value=Ae,yn.flipEnvMap.value=Ae.isCubeTexture&&Ae.isRenderTargetTexture===!1?-1:1),H.isMeshStandardMaterial&&H.envMap===null&&I.environment!==null&&(yn.envMapIntensity.value=I.environmentIntensity),Zt&&(pt.setValue(C,"toneMappingExposure",_.toneMappingExposure),Pe.needsLights&&mu(yn,hs),re&&H.fog===!0&&ue.refreshFogUniforms(yn,re),ue.refreshMaterialUniforms(yn,H,W,ne,f.state.transmissionRenderTarget[M.id]),Sr.upload(C,ul(Pe),yn,T)),H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(Sr.upload(C,ul(Pe),yn,T),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&pt.setValue(C,"center",O.center),pt.setValue(C,"modelViewMatrix",O.modelViewMatrix),pt.setValue(C,"normalMatrix",O.normalMatrix),pt.setValue(C,"modelMatrix",O.matrixWorld),H.isShaderMaterial||H.isRawShaderMaterial){const tn=H.uniformsGroups;for(let Wn=0,$n=tn.length;Wn<$n;Wn++){const fl=tn[Wn];L.update(fl,on),L.bind(fl,on)}}return on}function mu(M,I){M.ambientLightColor.needsUpdate=I,M.lightProbe.needsUpdate=I,M.directionalLights.needsUpdate=I,M.directionalLightShadows.needsUpdate=I,M.pointLights.needsUpdate=I,M.pointLightShadows.needsUpdate=I,M.spotLights.needsUpdate=I,M.spotLightShadows.needsUpdate=I,M.rectAreaLights.needsUpdate=I,M.hemisphereLights.needsUpdate=I}function gu(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return A},this.getActiveMipmapLevel=function(){return R},this.getRenderTarget=function(){return D},this.setRenderTargetTextures=function(M,I,B){ve.get(M.texture).__webglTexture=I,ve.get(M.depthTexture).__webglTexture=B;const H=ve.get(M);H.__hasExternalTextures=!0,H.__autoAllocateDepthBuffer=B===void 0,H.__autoAllocateDepthBuffer||ee.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),H.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(M,I){const B=ve.get(M);B.__webglFramebuffer=I,B.__useDefaultFramebuffer=I===void 0},this.setRenderTarget=function(M,I=0,B=0){D=M,A=I,R=B;let H=!0,O=null,re=!1,pe=!1;if(M){const Ae=ve.get(M);if(Ae.__useDefaultFramebuffer!==void 0)oe.bindFramebuffer(C.FRAMEBUFFER,null),H=!1;else if(Ae.__webglFramebuffer===void 0)T.setupRenderTarget(M);else if(Ae.__hasExternalTextures)T.rebindTextures(M,ve.get(M.texture).__webglTexture,ve.get(M.depthTexture).__webglTexture);else if(M.depthBuffer){const Ce=M.depthTexture;if(Ae.__boundDepthTexture!==Ce){if(Ce!==null&&ve.has(Ce)&&(M.width!==Ce.image.width||M.height!==Ce.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");T.setupDepthRenderbuffer(M)}}const ze=M.texture;(ze.isData3DTexture||ze.isDataArrayTexture||ze.isCompressedArrayTexture)&&(pe=!0);const Xe=ve.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(Array.isArray(Xe[I])?O=Xe[I][B]:O=Xe[I],re=!0):M.samples>0&&T.useMultisampledRTT(M)===!1?O=ve.get(M).__webglMultisampledFramebuffer:Array.isArray(Xe)?O=Xe[B]:O=Xe,P.copy(M.viewport),z.copy(M.scissor),k=M.scissorTest}else P.copy(Me).multiplyScalar(W).floor(),z.copy(Ve).multiplyScalar(W).floor(),k=tt;if(oe.bindFramebuffer(C.FRAMEBUFFER,O)&&H&&oe.drawBuffers(M,O),oe.viewport(P),oe.scissor(z),oe.setScissorTest(k),re){const Ae=ve.get(M.texture);C.framebufferTexture2D(C.FRAMEBUFFER,C.COLOR_ATTACHMENT0,C.TEXTURE_CUBE_MAP_POSITIVE_X+I,Ae.__webglTexture,B)}else if(pe){const Ae=ve.get(M.texture),ze=I||0;C.framebufferTextureLayer(C.FRAMEBUFFER,C.COLOR_ATTACHMENT0,Ae.__webglTexture,B||0,ze)}w=-1},this.readRenderTargetPixels=function(M,I,B,H,O,re,pe){if(!(M&&M.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Ee=ve.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&pe!==void 0&&(Ee=Ee[pe]),Ee){oe.bindFramebuffer(C.FRAMEBUFFER,Ee);try{const Ae=M.texture,ze=Ae.format,Xe=Ae.type;if(!ye.textureFormatReadable(ze)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!ye.textureTypeReadable(Xe)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}I>=0&&I<=M.width-H&&B>=0&&B<=M.height-O&&C.readPixels(I,B,H,O,Ye.convert(ze),Ye.convert(Xe),re)}finally{const Ae=D!==null?ve.get(D).__webglFramebuffer:null;oe.bindFramebuffer(C.FRAMEBUFFER,Ae)}}},this.readRenderTargetPixelsAsync=async function(M,I,B,H,O,re,pe){if(!(M&&M.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Ee=ve.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&pe!==void 0&&(Ee=Ee[pe]),Ee){const Ae=M.texture,ze=Ae.format,Xe=Ae.type;if(!ye.textureFormatReadable(ze))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!ye.textureTypeReadable(Xe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(I>=0&&I<=M.width-H&&B>=0&&B<=M.height-O){oe.bindFramebuffer(C.FRAMEBUFFER,Ee);const Ce=C.createBuffer();C.bindBuffer(C.PIXEL_PACK_BUFFER,Ce),C.bufferData(C.PIXEL_PACK_BUFFER,re.byteLength,C.STREAM_READ),C.readPixels(I,B,H,O,Ye.convert(ze),Ye.convert(Xe),0);const et=D!==null?ve.get(D).__webglFramebuffer:null;oe.bindFramebuffer(C.FRAMEBUFFER,et);const dt=C.fenceSync(C.SYNC_GPU_COMMANDS_COMPLETE,0);return C.flush(),await bd(C,dt,4),C.bindBuffer(C.PIXEL_PACK_BUFFER,Ce),C.getBufferSubData(C.PIXEL_PACK_BUFFER,0,re),C.deleteBuffer(Ce),C.deleteSync(dt),re}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(M,I=null,B=0){M.isTexture!==!0&&(xs("WebGLRenderer: copyFramebufferToTexture function signature has changed."),I=arguments[0]||null,M=arguments[1]);const H=Math.pow(2,-B),O=Math.floor(M.image.width*H),re=Math.floor(M.image.height*H),pe=I!==null?I.x:0,Ee=I!==null?I.y:0;T.setTexture2D(M,0),C.copyTexSubImage2D(C.TEXTURE_2D,B,0,0,pe,Ee,O,re),oe.unbindTexture()},this.copyTextureToTexture=function(M,I,B=null,H=null,O=0){M.isTexture!==!0&&(xs("WebGLRenderer: copyTextureToTexture function signature has changed."),H=arguments[0]||null,M=arguments[1],I=arguments[2],O=arguments[3]||0,B=null);let re,pe,Ee,Ae,ze,Xe,Ce,et,dt;const ft=M.isCompressedTexture?M.mipmaps[O]:M.image;B!==null?(re=B.max.x-B.min.x,pe=B.max.y-B.min.y,Ee=B.isBox3?B.max.z-B.min.z:1,Ae=B.min.x,ze=B.min.y,Xe=B.isBox3?B.min.z:0):(re=ft.width,pe=ft.height,Ee=ft.depth||1,Ae=0,ze=0,Xe=0),H!==null?(Ce=H.x,et=H.y,dt=H.z):(Ce=0,et=0,dt=0);const qt=Ye.convert(I.format),nt=Ye.convert(I.type);let Pe;I.isData3DTexture?(T.setTexture3D(I,0),Pe=C.TEXTURE_3D):I.isDataArrayTexture||I.isCompressedArrayTexture?(T.setTexture2DArray(I,0),Pe=C.TEXTURE_2D_ARRAY):(T.setTexture2D(I,0),Pe=C.TEXTURE_2D),C.pixelStorei(C.UNPACK_FLIP_Y_WEBGL,I.flipY),C.pixelStorei(C.UNPACK_PREMULTIPLY_ALPHA_WEBGL,I.premultiplyAlpha),C.pixelStorei(C.UNPACK_ALIGNMENT,I.unpackAlignment);const Cn=C.getParameter(C.UNPACK_ROW_LENGTH),it=C.getParameter(C.UNPACK_IMAGE_HEIGHT),on=C.getParameter(C.UNPACK_SKIP_PIXELS),Si=C.getParameter(C.UNPACK_SKIP_ROWS),Zt=C.getParameter(C.UNPACK_SKIP_IMAGES);C.pixelStorei(C.UNPACK_ROW_LENGTH,ft.width),C.pixelStorei(C.UNPACK_IMAGE_HEIGHT,ft.height),C.pixelStorei(C.UNPACK_SKIP_PIXELS,Ae),C.pixelStorei(C.UNPACK_SKIP_ROWS,ze),C.pixelStorei(C.UNPACK_SKIP_IMAGES,Xe);const hs=M.isDataArrayTexture||M.isData3DTexture,pt=I.isDataArrayTexture||I.isData3DTexture;if(M.isRenderTargetTexture||M.isDepthTexture){const yn=ve.get(M),us=ve.get(I),tn=ve.get(yn.__renderTarget),Wn=ve.get(us.__renderTarget);oe.bindFramebuffer(C.READ_FRAMEBUFFER,tn.__webglFramebuffer),oe.bindFramebuffer(C.DRAW_FRAMEBUFFER,Wn.__webglFramebuffer);for(let $n=0;$n<Ee;$n++)hs&&C.framebufferTextureLayer(C.READ_FRAMEBUFFER,C.COLOR_ATTACHMENT0,ve.get(M).__webglTexture,O,Xe+$n),M.isDepthTexture?(pt&&C.framebufferTextureLayer(C.DRAW_FRAMEBUFFER,C.COLOR_ATTACHMENT0,ve.get(I).__webglTexture,O,dt+$n),C.blitFramebuffer(Ae,ze,re,pe,Ce,et,re,pe,C.DEPTH_BUFFER_BIT,C.NEAREST)):pt?C.copyTexSubImage3D(Pe,O,Ce,et,dt+$n,Ae,ze,re,pe):C.copyTexSubImage2D(Pe,O,Ce,et,dt+$n,Ae,ze,re,pe);oe.bindFramebuffer(C.READ_FRAMEBUFFER,null),oe.bindFramebuffer(C.DRAW_FRAMEBUFFER,null)}else pt?M.isDataTexture||M.isData3DTexture?C.texSubImage3D(Pe,O,Ce,et,dt,re,pe,Ee,qt,nt,ft.data):I.isCompressedArrayTexture?C.compressedTexSubImage3D(Pe,O,Ce,et,dt,re,pe,Ee,qt,ft.data):C.texSubImage3D(Pe,O,Ce,et,dt,re,pe,Ee,qt,nt,ft):M.isDataTexture?C.texSubImage2D(C.TEXTURE_2D,O,Ce,et,re,pe,qt,nt,ft.data):M.isCompressedTexture?C.compressedTexSubImage2D(C.TEXTURE_2D,O,Ce,et,ft.width,ft.height,qt,ft.data):C.texSubImage2D(C.TEXTURE_2D,O,Ce,et,re,pe,qt,nt,ft);C.pixelStorei(C.UNPACK_ROW_LENGTH,Cn),C.pixelStorei(C.UNPACK_IMAGE_HEIGHT,it),C.pixelStorei(C.UNPACK_SKIP_PIXELS,on),C.pixelStorei(C.UNPACK_SKIP_ROWS,Si),C.pixelStorei(C.UNPACK_SKIP_IMAGES,Zt),O===0&&I.generateMipmaps&&C.generateMipmap(Pe),oe.unbindTexture()},this.copyTextureToTexture3D=function(M,I,B=null,H=null,O=0){return M.isTexture!==!0&&(xs("WebGLRenderer: copyTextureToTexture3D function signature has changed."),B=arguments[0]||null,H=arguments[1]||null,M=arguments[2],I=arguments[3],O=arguments[4]||0),xs('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(M,I,B,H,O)},this.initRenderTarget=function(M){ve.get(M).__webglFramebuffer===void 0&&T.setupRenderTarget(M)},this.initTexture=function(M){M.isCubeTexture?T.setTextureCube(M,0):M.isData3DTexture?T.setTexture3D(M,0):M.isDataArrayTexture||M.isCompressedArrayTexture?T.setTexture2DArray(M,0):T.setTexture2D(M,0),oe.unbindTexture()},this.resetState=function(){A=0,R=0,D=null,oe.reset(),ut.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Fn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorspace=Je._getDrawingBufferColorSpace(e),t.unpackColorSpace=Je._getUnpackColorSpace()}}class Oh extends Nt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new wn,this.environmentIntensity=1,this.environmentRotation=new wn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}class zo extends $t{constructor(e,t,n,s,r,a,o,l,c){super(e,t,n,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class En{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(e,t){const n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){const t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){const e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const t=[];let n,s=this.getPoint(0),r=0;t.push(0);for(let a=1;a<=e;a++)n=this.getPoint(a/e),r+=n.distanceTo(s),t.push(r),s=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t){const n=this.getLengths();let s=0;const r=n.length;let a;t?a=t:a=e*n[r-1];let o=0,l=r-1,c;for(;o<=l;)if(s=Math.floor(o+(l-o)/2),c=n[s]-a,c<0)o=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===a)return s/(r-1);const h=n[s],d=n[s+1]-h,p=(a-h)/d;return(s+p)/(r-1)}getTangent(e,t){let s=e-1e-4,r=e+1e-4;s<0&&(s=0),r>1&&(r=1);const a=this.getPoint(s),o=this.getPoint(r),l=t||(a.isVector2?new Z:new E);return l.copy(o).sub(a).normalize(),l}getTangentAt(e,t){const n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t){const n=new E,s=[],r=[],a=[],o=new E,l=new ht;for(let p=0;p<=e;p++){const g=p/e;s[p]=this.getTangentAt(g,new E)}r[0]=new E,a[0]=new E;let c=Number.MAX_VALUE;const h=Math.abs(s[0].x),u=Math.abs(s[0].y),d=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],o),a[0].crossVectors(s[0],r[0]);for(let p=1;p<=e;p++){if(r[p]=r[p-1].clone(),a[p]=a[p-1].clone(),o.crossVectors(s[p-1],s[p]),o.length()>Number.EPSILON){o.normalize();const g=Math.acos(Mt(s[p-1].dot(s[p]),-1,1));r[p].applyMatrix4(l.makeRotationAxis(o,g))}a[p].crossVectors(s[p],r[p])}if(t===!0){let p=Math.acos(Mt(r[0].dot(r[e]),-1,1));p/=e,s[0].dot(o.crossVectors(r[0],r[e]))>0&&(p=-p);for(let g=1;g<=e;g++)r[g].applyMatrix4(l.makeRotationAxis(s[g],p*g)),a[g].crossVectors(s[g],r[g])}return{tangents:s,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){const e={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}}class Go extends En{constructor(e=0,t=0,n=1,s=1,r=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(e,t=new Z){const n=t,s=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(a?r=0:r=s),this.aClockwise===!0&&!a&&(r===s?r=-s:r=r-s);const o=this.aStartAngle+e*r;let l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=l-this.aX,p=c-this.aY;l=d*h-p*u+this.aX,c=d*u+p*h+this.aY}return n.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){const e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}}class Nv extends Go{constructor(e,t,n,s,r,a){super(e,t,n,n,s,r,a),this.isArcCurve=!0,this.type="ArcCurve"}}function Vo(){let i=0,e=0,t=0,n=0;function s(r,a,o,l){i=r,e=o,t=-3*r+3*a-2*o-l,n=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){s(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,u){let d=(a-r)/c-(o-r)/(c+h)+(o-a)/h,p=(o-a)/h-(l-a)/(h+u)+(l-o)/u;d*=h,p*=h,s(a,o,d,p)},calc:function(r){const a=r*r,o=a*r;return i+e*r+t*a+n*o}}}const ur=new E,ha=new Vo,ua=new Vo,da=new Vo;class Wo extends En{constructor(e=[],t=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=s}getPoint(e,t=new E){const n=t,s=this.points,r=s.length,a=(r-(this.closed?0:1))*e;let o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=s[(o-1)%r]:(ur.subVectors(s[0],s[1]).add(s[0]),c=ur);const u=s[o%r],d=s[(o+1)%r];if(this.closed||o+2<r?h=s[(o+2)%r]:(ur.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=ur),this.curveType==="centripetal"||this.curveType==="chordal"){const p=this.curveType==="chordal"?.5:.25;let g=Math.pow(c.distanceToSquared(u),p),v=Math.pow(u.distanceToSquared(d),p),m=Math.pow(d.distanceToSquared(h),p);v<1e-4&&(v=1),g<1e-4&&(g=v),m<1e-4&&(m=v),ha.initNonuniformCatmullRom(c.x,u.x,d.x,h.x,g,v,m),ua.initNonuniformCatmullRom(c.y,u.y,d.y,h.y,g,v,m),da.initNonuniformCatmullRom(c.z,u.z,d.z,h.z,g,v,m)}else this.curveType==="catmullrom"&&(ha.initCatmullRom(c.x,u.x,d.x,h.x,this.tension),ua.initCatmullRom(c.y,u.y,d.y,h.y,this.tension),da.initCatmullRom(c.z,u.z,d.z,h.z,this.tension));return n.set(ha.calc(l),ua.calc(l),da.calc(l)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(s.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const s=this.points[t];e.points.push(s.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(new E().fromArray(s))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}}function dc(i,e,t,n,s){const r=(n-e)*.5,a=(s-t)*.5,o=i*i,l=i*o;return(2*t-2*n+r+a)*l+(-3*t+3*n-2*r-a)*o+r*i+t}function Iv(i,e){const t=1-i;return t*t*e}function Ov(i,e){return 2*(1-i)*i*e}function Uv(i,e){return i*i*e}function Es(i,e,t,n){return Iv(i,e)+Ov(i,t)+Uv(i,n)}function kv(i,e){const t=1-i;return t*t*t*e}function Fv(i,e){const t=1-i;return 3*t*t*i*e}function Bv(i,e){return 3*(1-i)*i*i*e}function Hv(i,e){return i*i*i*e}function As(i,e,t,n,s){return kv(i,e)+Fv(i,t)+Bv(i,n)+Hv(i,s)}class Uh extends En{constructor(e=new Z,t=new Z,n=new Z,s=new Z){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new Z){const n=t,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(As(e,s.x,r.x,a.x,o.x),As(e,s.y,r.y,a.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class zv extends En{constructor(e=new E,t=new E,n=new E,s=new E){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new E){const n=t,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(As(e,s.x,r.x,a.x,o.x),As(e,s.y,r.y,a.y,o.y),As(e,s.z,r.z,a.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class kh extends En{constructor(e=new Z,t=new Z){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new Z){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new Z){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Gv extends En{constructor(e=new E,t=new E){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new E){const n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new E){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Fh extends En{constructor(e=new Z,t=new Z,n=new Z){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new Z){const n=t,s=this.v0,r=this.v1,a=this.v2;return n.set(Es(e,s.x,r.x,a.x),Es(e,s.y,r.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Bh extends En{constructor(e=new E,t=new E,n=new E){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new E){const n=t,s=this.v0,r=this.v1,a=this.v2;return n.set(Es(e,s.x,r.x,a.x),Es(e,s.y,r.y,a.y),Es(e,s.z,r.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Hh extends En{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new Z){const n=t,s=this.points,r=(s.length-1)*e,a=Math.floor(r),o=r-a,l=s[a===0?a:a-1],c=s[a],h=s[a>s.length-2?s.length-1:a+1],u=s[a>s.length-3?s.length-1:a+2];return n.set(dc(o,l.x,c.x,h.x,u.x),dc(o,l.y,c.y,h.y,u.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(s.clone())}return this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){const s=this.points[t];e.points.push(s.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){const s=e.points[t];this.points.push(new Z().fromArray(s))}return this}}var Er=Object.freeze({__proto__:null,ArcCurve:Nv,CatmullRomCurve3:Wo,CubicBezierCurve:Uh,CubicBezierCurve3:zv,EllipseCurve:Go,LineCurve:kh,LineCurve3:Gv,QuadraticBezierCurve:Fh,QuadraticBezierCurve3:Bh,SplineCurve:Hh});class Vv extends En{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){const e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){const n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Er[n](t,e))}return this}getPoint(e,t){const n=e*this.getLength(),s=this.getCurveLengths();let r=0;for(;r<s.length;){if(s[r]>=n){const a=s[r]-n,o=this.curves[r],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,t)}r++}return null}getLength(){const e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const e=[];let t=0;for(let n=0,s=this.curves.length;n<s;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){const t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){const t=[];let n;for(let s=0,r=this.curves;s<r.length;s++){const a=r[s],o=a.isEllipseCurve?e*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?e*a.points.length:e,l=a.getPoints(o);for(let c=0;c<l.length;c++){const h=l[c];n&&n.equals(h)||(t.push(h),n=h)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const s=e.curves[t];this.curves.push(s.clone())}return this.autoClose=e.autoClose,this}toJSON(){const e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){const s=this.curves[t];e.curves.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){const s=e.curves[t];this.curves.push(new Er[s.type]().fromJSON(s))}return this}}class uo extends Vv{constructor(e){super(),this.type="Path",this.currentPoint=new Z,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){const n=new kh(this.currentPoint.clone(),new Z(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,s){const r=new Fh(this.currentPoint.clone(),new Z(e,t),new Z(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(e,t,n,s,r,a){const o=new Uh(this.currentPoint.clone(),new Z(e,t),new Z(n,s),new Z(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(e){const t=[this.currentPoint.clone()].concat(e),n=new Hh(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,s,r,a){const o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(e+o,t+l,n,s,r,a),this}absarc(e,t,n,s,r,a){return this.absellipse(e,t,n,n,s,r,a),this}ellipse(e,t,n,s,r,a,o,l){const c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(e+c,t+h,n,s,r,a,o,l),this}absellipse(e,t,n,s,r,a,o,l){const c=new Go(e,t,n,s,r,a,o,l);if(this.curves.length>0){const u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);const h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){const e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}}class $o extends Xt{constructor(e=[new Z(0,-.5),new Z(.5,0),new Z(0,.5)],t=12,n=0,s=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:n,phiLength:s},t=Math.floor(t),s=Mt(s,0,Math.PI*2);const r=[],a=[],o=[],l=[],c=[],h=1/t,u=new E,d=new Z,p=new E,g=new E,v=new E;let m=0,f=0;for(let S=0;S<=e.length-1;S++)switch(S){case 0:m=e[S+1].x-e[S].x,f=e[S+1].y-e[S].y,p.x=f*1,p.y=-m,p.z=f*0,v.copy(p),p.normalize(),l.push(p.x,p.y,p.z);break;case e.length-1:l.push(v.x,v.y,v.z);break;default:m=e[S+1].x-e[S].x,f=e[S+1].y-e[S].y,p.x=f*1,p.y=-m,p.z=f*0,g.copy(p),p.x+=v.x,p.y+=v.y,p.z+=v.z,p.normalize(),l.push(p.x,p.y,p.z),v.copy(g)}for(let S=0;S<=t;S++){const y=n+S*h*s,_=Math.sin(y),N=Math.cos(y);for(let A=0;A<=e.length-1;A++){u.x=e[A].x*_,u.y=e[A].y,u.z=e[A].x*N,a.push(u.x,u.y,u.z),d.x=S/t,d.y=A/(e.length-1),o.push(d.x,d.y);const R=l[3*A+0]*_,D=l[3*A+1],w=l[3*A+0]*N;c.push(R,D,w)}}for(let S=0;S<t;S++)for(let y=0;y<e.length-1;y++){const _=y+S*e.length,N=_,A=_+e.length,R=_+e.length+1,D=_+1;r.push(N,A,D),r.push(R,D,A)}this.setIndex(r),this.setAttribute("position",new at(a,3)),this.setAttribute("uv",new at(o,2)),this.setAttribute("normal",new at(c,3))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new $o(e.points,e.segments,e.phiStart,e.phiLength)}}class Ar extends $o{constructor(e=1,t=1,n=4,s=8){const r=new uo;r.absarc(0,-t/2,e,Math.PI*1.5,0),r.absarc(0,t/2,e,0,Math.PI*.5),super(r.getPoints(n),s),this.type="CapsuleGeometry",this.parameters={radius:e,length:t,capSegments:n,radialSegments:s}}static fromJSON(e){return new Ar(e.radius,e.length,e.capSegments,e.radialSegments)}}class yt extends Xt{constructor(e=1,t=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;s=Math.floor(s),r=Math.floor(r);const h=[],u=[],d=[],p=[];let g=0;const v=[],m=n/2;let f=0;S(),a===!1&&(e>0&&y(!0),t>0&&y(!1)),this.setIndex(h),this.setAttribute("position",new at(u,3)),this.setAttribute("normal",new at(d,3)),this.setAttribute("uv",new at(p,2));function S(){const _=new E,N=new E;let A=0;const R=(t-e)/n;for(let D=0;D<=r;D++){const w=[],b=D/r,P=b*(t-e)+e;for(let z=0;z<=s;z++){const k=z/s,G=k*l+o,K=Math.sin(G),V=Math.cos(G);N.x=P*K,N.y=-b*n+m,N.z=P*V,u.push(N.x,N.y,N.z),_.set(K,R,V).normalize(),d.push(_.x,_.y,_.z),p.push(k,1-b),w.push(g++)}v.push(w)}for(let D=0;D<s;D++)for(let w=0;w<r;w++){const b=v[w][D],P=v[w+1][D],z=v[w+1][D+1],k=v[w][D+1];(e>0||w!==0)&&(h.push(b,P,k),A+=3),(t>0||w!==r-1)&&(h.push(P,z,k),A+=3)}c.addGroup(f,A,0),f+=A}function y(_){const N=g,A=new Z,R=new E;let D=0;const w=_===!0?e:t,b=_===!0?1:-1;for(let z=1;z<=s;z++)u.push(0,m*b,0),d.push(0,b,0),p.push(.5,.5),g++;const P=g;for(let z=0;z<=s;z++){const G=z/s*l+o,K=Math.cos(G),V=Math.sin(G);R.x=w*V,R.y=m*b,R.z=w*K,u.push(R.x,R.y,R.z),d.push(0,b,0),A.x=K*.5+.5,A.y=V*.5*b+.5,p.push(A.x,A.y),g++}for(let z=0;z<s;z++){const k=N+z,G=P+z;_===!0?h.push(G,G+1,k):h.push(G+1,G,k),D+=3}c.addGroup(f,D,_===!0?1:2),f+=D}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new yt(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Zi extends yt{constructor(e=1,t=1,n=32,s=1,r=!1,a=0,o=Math.PI*2){super(0,e,t,n,s,r,a,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(e){return new Zi(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Xo extends Xt{constructor(e=[],t=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:s};const r=[],a=[];o(s),c(n),h(),this.setAttribute("position",new at(r,3)),this.setAttribute("normal",new at(r.slice(),3)),this.setAttribute("uv",new at(a,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function o(S){const y=new E,_=new E,N=new E;for(let A=0;A<t.length;A+=3)p(t[A+0],y),p(t[A+1],_),p(t[A+2],N),l(y,_,N,S)}function l(S,y,_,N){const A=N+1,R=[];for(let D=0;D<=A;D++){R[D]=[];const w=S.clone().lerp(_,D/A),b=y.clone().lerp(_,D/A),P=A-D;for(let z=0;z<=P;z++)z===0&&D===A?R[D][z]=w:R[D][z]=w.clone().lerp(b,z/P)}for(let D=0;D<A;D++)for(let w=0;w<2*(A-D)-1;w++){const b=Math.floor(w/2);w%2===0?(d(R[D][b+1]),d(R[D+1][b]),d(R[D][b])):(d(R[D][b+1]),d(R[D+1][b+1]),d(R[D+1][b]))}}function c(S){const y=new E;for(let _=0;_<r.length;_+=3)y.x=r[_+0],y.y=r[_+1],y.z=r[_+2],y.normalize().multiplyScalar(S),r[_+0]=y.x,r[_+1]=y.y,r[_+2]=y.z}function h(){const S=new E;for(let y=0;y<r.length;y+=3){S.x=r[y+0],S.y=r[y+1],S.z=r[y+2];const _=m(S)/2/Math.PI+.5,N=f(S)/Math.PI+.5;a.push(_,1-N)}g(),u()}function u(){for(let S=0;S<a.length;S+=6){const y=a[S+0],_=a[S+2],N=a[S+4],A=Math.max(y,_,N),R=Math.min(y,_,N);A>.9&&R<.1&&(y<.2&&(a[S+0]+=1),_<.2&&(a[S+2]+=1),N<.2&&(a[S+4]+=1))}}function d(S){r.push(S.x,S.y,S.z)}function p(S,y){const _=S*3;y.x=e[_+0],y.y=e[_+1],y.z=e[_+2]}function g(){const S=new E,y=new E,_=new E,N=new E,A=new Z,R=new Z,D=new Z;for(let w=0,b=0;w<r.length;w+=9,b+=6){S.set(r[w+0],r[w+1],r[w+2]),y.set(r[w+3],r[w+4],r[w+5]),_.set(r[w+6],r[w+7],r[w+8]),A.set(a[b+0],a[b+1]),R.set(a[b+2],a[b+3]),D.set(a[b+4],a[b+5]),N.copy(S).add(y).add(_).divideScalar(3);const P=m(N);v(A,b+0,S,P),v(R,b+2,y,P),v(D,b+4,_,P)}}function v(S,y,_,N){N<0&&S.x===1&&(a[y]=S.x-1),_.x===0&&_.z===0&&(a[y]=N/2/Math.PI+.5)}function m(S){return Math.atan2(S.z,-S.x)}function f(S){return Math.atan2(-S.y,Math.sqrt(S.x*S.x+S.z*S.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Xo(e.vertices,e.indices,e.radius,e.details)}}class qo extends uo{constructor(e){super(e),this.uuid=bi(),this.type="Shape",this.holes=[]}getPointsHoles(e){const t=[];for(let n=0,s=this.holes.length;n<s;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const s=e.holes[t];this.holes.push(s.clone())}return this}toJSON(){const e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){const s=this.holes[t];e.holes.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){const s=e.holes[t];this.holes.push(new uo().fromJSON(s))}return this}}const Wv={triangulate:function(i,e,t=2){const n=e&&e.length,s=n?e[0]*t:i.length;let r=zh(i,0,s,t,!0);const a=[];if(!r||r.next===r.prev)return a;let o,l,c,h,u,d,p;if(n&&(r=Kv(i,e,r,t)),i.length>80*t){o=c=i[0],l=h=i[1];for(let g=t;g<s;g+=t)u=i[g],d=i[g+1],u<o&&(o=u),d<l&&(l=d),u>c&&(c=u),d>h&&(h=d);p=Math.max(c-o,h-l),p=p!==0?32767/p:0}return Ns(r,a,t,o,l,p,0),a}};function zh(i,e,t,n,s){let r,a;if(s===a0(i,e,t,n)>0)for(r=e;r<t;r+=n)a=fc(r,i[r],i[r+1],a);else for(r=t-n;r>=e;r-=n)a=fc(r,i[r],i[r+1],a);return a&&Nr(a,a.next)&&(Os(a),a=a.next),a}function _i(i,e){if(!i)return i;e||(e=i);let t=i,n;do if(n=!1,!t.steiner&&(Nr(t,t.next)||gt(t.prev,t,t.next)===0)){if(Os(t),t=e=t.prev,t===t.next)break;n=!0}else t=t.next;while(n||t!==e);return e}function Ns(i,e,t,n,s,r,a){if(!i)return;!a&&r&&e0(i,n,s,r);let o=i,l,c;for(;i.prev!==i.next;){if(l=i.prev,c=i.next,r?Xv(i,n,s,r):$v(i)){e.push(l.i/t|0),e.push(i.i/t|0),e.push(c.i/t|0),Os(i),i=c.next,o=c.next;continue}if(i=c,i===o){a?a===1?(i=qv(_i(i),e,t),Ns(i,e,t,n,s,r,2)):a===2&&Yv(i,e,t,n,s,r):Ns(_i(i),e,t,n,s,r,1);break}}}function $v(i){const e=i.prev,t=i,n=i.next;if(gt(e,t,n)>=0)return!1;const s=e.x,r=t.x,a=n.x,o=e.y,l=t.y,c=n.y,h=s<r?s<a?s:a:r<a?r:a,u=o<l?o<c?o:c:l<c?l:c,d=s>r?s>a?s:a:r>a?r:a,p=o>l?o>c?o:c:l>c?l:c;let g=n.next;for(;g!==e;){if(g.x>=h&&g.x<=d&&g.y>=u&&g.y<=p&&Wi(s,o,r,l,a,c,g.x,g.y)&&gt(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function Xv(i,e,t,n){const s=i.prev,r=i,a=i.next;if(gt(s,r,a)>=0)return!1;const o=s.x,l=r.x,c=a.x,h=s.y,u=r.y,d=a.y,p=o<l?o<c?o:c:l<c?l:c,g=h<u?h<d?h:d:u<d?u:d,v=o>l?o>c?o:c:l>c?l:c,m=h>u?h>d?h:d:u>d?u:d,f=fo(p,g,e,t,n),S=fo(v,m,e,t,n);let y=i.prevZ,_=i.nextZ;for(;y&&y.z>=f&&_&&_.z<=S;){if(y.x>=p&&y.x<=v&&y.y>=g&&y.y<=m&&y!==s&&y!==a&&Wi(o,h,l,u,c,d,y.x,y.y)&&gt(y.prev,y,y.next)>=0||(y=y.prevZ,_.x>=p&&_.x<=v&&_.y>=g&&_.y<=m&&_!==s&&_!==a&&Wi(o,h,l,u,c,d,_.x,_.y)&&gt(_.prev,_,_.next)>=0))return!1;_=_.nextZ}for(;y&&y.z>=f;){if(y.x>=p&&y.x<=v&&y.y>=g&&y.y<=m&&y!==s&&y!==a&&Wi(o,h,l,u,c,d,y.x,y.y)&&gt(y.prev,y,y.next)>=0)return!1;y=y.prevZ}for(;_&&_.z<=S;){if(_.x>=p&&_.x<=v&&_.y>=g&&_.y<=m&&_!==s&&_!==a&&Wi(o,h,l,u,c,d,_.x,_.y)&&gt(_.prev,_,_.next)>=0)return!1;_=_.nextZ}return!0}function qv(i,e,t){let n=i;do{const s=n.prev,r=n.next.next;!Nr(s,r)&&Gh(s,n,n.next,r)&&Is(s,r)&&Is(r,s)&&(e.push(s.i/t|0),e.push(n.i/t|0),e.push(r.i/t|0),Os(n),Os(n.next),n=i=r),n=n.next}while(n!==i);return _i(n)}function Yv(i,e,t,n,s,r){let a=i;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&i0(a,o)){let l=Vh(a,o);a=_i(a,a.next),l=_i(l,l.next),Ns(a,e,t,n,s,r,0),Ns(l,e,t,n,s,r,0);return}o=o.next}a=a.next}while(a!==i)}function Kv(i,e,t,n){const s=[];let r,a,o,l,c;for(r=0,a=e.length;r<a;r++)o=e[r]*n,l=r<a-1?e[r+1]*n:i.length,c=zh(i,o,l,n,!1),c===c.next&&(c.steiner=!0),s.push(n0(c));for(s.sort(jv),r=0;r<s.length;r++)t=Zv(s[r],t);return t}function jv(i,e){return i.x-e.x}function Zv(i,e){const t=Jv(i,e);if(!t)return e;const n=Vh(t,i);return _i(n,n.next),_i(t,t.next)}function Jv(i,e){let t=e,n=-1/0,s;const r=i.x,a=i.y;do{if(a<=t.y&&a>=t.next.y&&t.next.y!==t.y){const d=t.x+(a-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(d<=r&&d>n&&(n=d,s=t.x<t.next.x?t:t.next,d===r))return s}t=t.next}while(t!==e);if(!s)return null;const o=s,l=s.x,c=s.y;let h=1/0,u;t=s;do r>=t.x&&t.x>=l&&r!==t.x&&Wi(a<c?r:n,a,l,c,a<c?n:r,a,t.x,t.y)&&(u=Math.abs(a-t.y)/(r-t.x),Is(t,i)&&(u<h||u===h&&(t.x>s.x||t.x===s.x&&Qv(s,t)))&&(s=t,h=u)),t=t.next;while(t!==o);return s}function Qv(i,e){return gt(i.prev,i,e.prev)<0&&gt(e.next,i,i.next)<0}function e0(i,e,t,n){let s=i;do s.z===0&&(s.z=fo(s.x,s.y,e,t,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,t0(s)}function t0(i){let e,t,n,s,r,a,o,l,c=1;do{for(t=i,i=null,r=null,a=0;t;){for(a++,n=t,o=0,e=0;e<c&&(o++,n=n.nextZ,!!n);e++);for(l=c;o>0||l>0&&n;)o!==0&&(l===0||!n||t.z<=n.z)?(s=t,t=t.nextZ,o--):(s=n,n=n.nextZ,l--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;t=n}r.nextZ=null,c*=2}while(a>1);return i}function fo(i,e,t,n,s){return i=(i-t)*s|0,e=(e-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,i|e<<1}function n0(i){let e=i,t=i;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==i);return t}function Wi(i,e,t,n,s,r,a,o){return(s-a)*(e-o)>=(i-a)*(r-o)&&(i-a)*(n-o)>=(t-a)*(e-o)&&(t-a)*(r-o)>=(s-a)*(n-o)}function i0(i,e){return i.next.i!==e.i&&i.prev.i!==e.i&&!s0(i,e)&&(Is(i,e)&&Is(e,i)&&r0(i,e)&&(gt(i.prev,i,e.prev)||gt(i,e.prev,e))||Nr(i,e)&&gt(i.prev,i,i.next)>0&&gt(e.prev,e,e.next)>0)}function gt(i,e,t){return(e.y-i.y)*(t.x-e.x)-(e.x-i.x)*(t.y-e.y)}function Nr(i,e){return i.x===e.x&&i.y===e.y}function Gh(i,e,t,n){const s=fr(gt(i,e,t)),r=fr(gt(i,e,n)),a=fr(gt(t,n,i)),o=fr(gt(t,n,e));return!!(s!==r&&a!==o||s===0&&dr(i,t,e)||r===0&&dr(i,n,e)||a===0&&dr(t,i,n)||o===0&&dr(t,e,n))}function dr(i,e,t){return e.x<=Math.max(i.x,t.x)&&e.x>=Math.min(i.x,t.x)&&e.y<=Math.max(i.y,t.y)&&e.y>=Math.min(i.y,t.y)}function fr(i){return i>0?1:i<0?-1:0}function s0(i,e){let t=i;do{if(t.i!==i.i&&t.next.i!==i.i&&t.i!==e.i&&t.next.i!==e.i&&Gh(t,t.next,i,e))return!0;t=t.next}while(t!==i);return!1}function Is(i,e){return gt(i.prev,i,i.next)<0?gt(i,e,i.next)>=0&&gt(i,i.prev,e)>=0:gt(i,e,i.prev)<0||gt(i,i.next,e)<0}function r0(i,e){let t=i,n=!1;const s=(i.x+e.x)/2,r=(i.y+e.y)/2;do t.y>r!=t.next.y>r&&t.next.y!==t.y&&s<(t.next.x-t.x)*(r-t.y)/(t.next.y-t.y)+t.x&&(n=!n),t=t.next;while(t!==i);return n}function Vh(i,e){const t=new po(i.i,i.x,i.y),n=new po(e.i,e.x,e.y),s=i.next,r=e.prev;return i.next=e,e.prev=i,t.next=s,s.prev=t,n.next=t,t.prev=n,r.next=n,n.prev=r,n}function fc(i,e,t,n){const s=new po(i,e,t);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function Os(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function po(i,e,t){this.i=i,this.x=e,this.y=t,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function a0(i,e,t,n){let s=0;for(let r=e,a=t-n;r<t;r+=n)s+=(i[a]-i[r])*(i[r+1]+i[a+1]),a=r;return s}class Cs{static area(e){const t=e.length;let n=0;for(let s=t-1,r=0;r<t;s=r++)n+=e[s].x*e[r].y-e[r].x*e[s].y;return n*.5}static isClockWise(e){return Cs.area(e)<0}static triangulateShape(e,t){const n=[],s=[],r=[];pc(e),mc(n,e);let a=e.length;t.forEach(pc);for(let l=0;l<t.length;l++)s.push(a),a+=t[l].length,mc(n,t[l]);const o=Wv.triangulate(n,s);for(let l=0;l<o.length;l+=3)r.push(o.slice(l,l+3));return r}}function pc(i){const e=i.length;e>2&&i[e-1].equals(i[0])&&i.pop()}function mc(i,e){for(let t=0;t<e.length;t++)i.push(e[t].x),i.push(e[t].y)}class Ir extends Xt{constructor(e=new qo([new Z(.5,.5),new Z(-.5,.5),new Z(-.5,-.5),new Z(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];const n=this,s=[],r=[];for(let o=0,l=e.length;o<l;o++){const c=e[o];a(c)}this.setAttribute("position",new at(s,3)),this.setAttribute("uv",new at(r,2)),this.computeVertexNormals();function a(o){const l=[],c=t.curveSegments!==void 0?t.curveSegments:12,h=t.steps!==void 0?t.steps:1,u=t.depth!==void 0?t.depth:1;let d=t.bevelEnabled!==void 0?t.bevelEnabled:!0,p=t.bevelThickness!==void 0?t.bevelThickness:.2,g=t.bevelSize!==void 0?t.bevelSize:p-.1,v=t.bevelOffset!==void 0?t.bevelOffset:0,m=t.bevelSegments!==void 0?t.bevelSegments:3;const f=t.extrudePath,S=t.UVGenerator!==void 0?t.UVGenerator:o0;let y,_=!1,N,A,R,D;f&&(y=f.getSpacedPoints(h),_=!0,d=!1,N=f.computeFrenetFrames(h,!1),A=new E,R=new E,D=new E),d||(m=0,p=0,g=0,v=0);const w=o.extractPoints(c);let b=w.shape;const P=w.holes;if(!Cs.isClockWise(b)){b=b.reverse();for(let J=0,ie=P.length;J<ie;J++){const C=P[J];Cs.isClockWise(C)&&(P[J]=C.reverse())}}const k=Cs.triangulateShape(b,P),G=b;for(let J=0,ie=P.length;J<ie;J++){const C=P[J];b=b.concat(C)}function K(J,ie,C){return ie||console.error("THREE.ExtrudeGeometry: vec does not exist"),J.clone().addScaledVector(ie,C)}const V=b.length,ne=k.length;function W(J,ie,C){let Re,ee,ye;const oe=J.x-ie.x,Ie=J.y-ie.y,ve=C.x-J.x,T=C.y-J.y,x=oe*oe+Ie*Ie,U=oe*T-Ie*ve;if(Math.abs(U)>Number.EPSILON){const X=Math.sqrt(x),Q=Math.sqrt(ve*ve+T*T),q=ie.x-Ie/X,Te=ie.y+oe/X,ue=C.x-T/Q,_e=C.y+ve/Q,je=((ue-q)*T-(_e-Te)*ve)/(oe*T-Ie*ve);Re=q+oe*je-J.x,ee=Te+Ie*je-J.y;const te=Re*Re+ee*ee;if(te<=2)return new Z(Re,ee);ye=Math.sqrt(te/2)}else{let X=!1;oe>Number.EPSILON?ve>Number.EPSILON&&(X=!0):oe<-Number.EPSILON?ve<-Number.EPSILON&&(X=!0):Math.sign(Ie)===Math.sign(T)&&(X=!0),X?(Re=-Ie,ee=oe,ye=Math.sqrt(x)):(Re=oe,ee=Ie,ye=Math.sqrt(x/2))}return new Z(Re/ye,ee/ye)}const le=[];for(let J=0,ie=G.length,C=ie-1,Re=J+1;J<ie;J++,C++,Re++)C===ie&&(C=0),Re===ie&&(Re=0),le[J]=W(G[J],G[C],G[Re]);const ge=[];let Me,Ve=le.concat();for(let J=0,ie=P.length;J<ie;J++){const C=P[J];Me=[];for(let Re=0,ee=C.length,ye=ee-1,oe=Re+1;Re<ee;Re++,ye++,oe++)ye===ee&&(ye=0),oe===ee&&(oe=0),Me[Re]=W(C[Re],C[ye],C[oe]);ge.push(Me),Ve=Ve.concat(Me)}for(let J=0;J<m;J++){const ie=J/m,C=p*Math.cos(ie*Math.PI/2),Re=g*Math.sin(ie*Math.PI/2)+v;for(let ee=0,ye=G.length;ee<ye;ee++){const oe=K(G[ee],le[ee],Re);ae(oe.x,oe.y,-C)}for(let ee=0,ye=P.length;ee<ye;ee++){const oe=P[ee];Me=ge[ee];for(let Ie=0,ve=oe.length;Ie<ve;Ie++){const T=K(oe[Ie],Me[Ie],Re);ae(T.x,T.y,-C)}}}const tt=g+v;for(let J=0;J<V;J++){const ie=d?K(b[J],Ve[J],tt):b[J];_?(R.copy(N.normals[0]).multiplyScalar(ie.x),A.copy(N.binormals[0]).multiplyScalar(ie.y),D.copy(y[0]).add(R).add(A),ae(D.x,D.y,D.z)):ae(ie.x,ie.y,0)}for(let J=1;J<=h;J++)for(let ie=0;ie<V;ie++){const C=d?K(b[ie],Ve[ie],tt):b[ie];_?(R.copy(N.normals[J]).multiplyScalar(C.x),A.copy(N.binormals[J]).multiplyScalar(C.y),D.copy(y[J]).add(R).add(A),ae(D.x,D.y,D.z)):ae(C.x,C.y,u/h*J)}for(let J=m-1;J>=0;J--){const ie=J/m,C=p*Math.cos(ie*Math.PI/2),Re=g*Math.sin(ie*Math.PI/2)+v;for(let ee=0,ye=G.length;ee<ye;ee++){const oe=K(G[ee],le[ee],Re);ae(oe.x,oe.y,u+C)}for(let ee=0,ye=P.length;ee<ye;ee++){const oe=P[ee];Me=ge[ee];for(let Ie=0,ve=oe.length;Ie<ve;Ie++){const T=K(oe[Ie],Me[Ie],Re);_?ae(T.x,T.y+y[h-1].y,y[h-1].x+C):ae(T.x,T.y,u+C)}}}Y(),se();function Y(){const J=s.length/3;if(d){let ie=0,C=V*ie;for(let Re=0;Re<ne;Re++){const ee=k[Re];Ne(ee[2]+C,ee[1]+C,ee[0]+C)}ie=h+m*2,C=V*ie;for(let Re=0;Re<ne;Re++){const ee=k[Re];Ne(ee[0]+C,ee[1]+C,ee[2]+C)}}else{for(let ie=0;ie<ne;ie++){const C=k[ie];Ne(C[2],C[1],C[0])}for(let ie=0;ie<ne;ie++){const C=k[ie];Ne(C[0]+V*h,C[1]+V*h,C[2]+V*h)}}n.addGroup(J,s.length/3-J,0)}function se(){const J=s.length/3;let ie=0;we(G,ie),ie+=G.length;for(let C=0,Re=P.length;C<Re;C++){const ee=P[C];we(ee,ie),ie+=ee.length}n.addGroup(J,s.length/3-J,1)}function we(J,ie){let C=J.length;for(;--C>=0;){const Re=C;let ee=C-1;ee<0&&(ee=J.length-1);for(let ye=0,oe=h+m*2;ye<oe;ye++){const Ie=V*ye,ve=V*(ye+1),T=ie+Re+Ie,x=ie+ee+Ie,U=ie+ee+ve,X=ie+Re+ve;He(T,x,U,X)}}}function ae(J,ie,C){l.push(J),l.push(ie),l.push(C)}function Ne(J,ie,C){Ue(J),Ue(ie),Ue(C);const Re=s.length/3,ee=S.generateTopUV(n,s,Re-3,Re-2,Re-1);Qe(ee[0]),Qe(ee[1]),Qe(ee[2])}function He(J,ie,C,Re){Ue(J),Ue(ie),Ue(Re),Ue(ie),Ue(C),Ue(Re);const ee=s.length/3,ye=S.generateSideWallUV(n,s,ee-6,ee-3,ee-2,ee-1);Qe(ye[0]),Qe(ye[1]),Qe(ye[3]),Qe(ye[1]),Qe(ye[2]),Qe(ye[3])}function Ue(J){s.push(l[J*3+0]),s.push(l[J*3+1]),s.push(l[J*3+2])}function Qe(J){r.push(J.x),r.push(J.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON(),t=this.parameters.shapes,n=this.parameters.options;return l0(t,n,e)}static fromJSON(e,t){const n=[];for(let r=0,a=e.shapes.length;r<a;r++){const o=t[e.shapes[r]];n.push(o)}const s=e.options.extrudePath;return s!==void 0&&(e.options.extrudePath=new Er[s.type]().fromJSON(s)),new Ir(n,e.options)}}const o0={generateTopUV:function(i,e,t,n,s){const r=e[t*3],a=e[t*3+1],o=e[n*3],l=e[n*3+1],c=e[s*3],h=e[s*3+1];return[new Z(r,a),new Z(o,l),new Z(c,h)]},generateSideWallUV:function(i,e,t,n,s,r){const a=e[t*3],o=e[t*3+1],l=e[t*3+2],c=e[n*3],h=e[n*3+1],u=e[n*3+2],d=e[s*3],p=e[s*3+1],g=e[s*3+2],v=e[r*3],m=e[r*3+1],f=e[r*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new Z(a,1-l),new Z(c,1-u),new Z(d,1-g),new Z(v,1-f)]:[new Z(o,1-l),new Z(h,1-u),new Z(p,1-g),new Z(m,1-f)]}};function l0(i,e,t){if(t.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){const r=i[n];t.shapes.push(r.uuid)}else t.shapes.push(i.uuid);return t.options=Object.assign({},e),e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}class Yo extends Xo{constructor(e=1,t=0){const n=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],s=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(n,s,e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new Yo(e.radius,e.detail)}}class At extends Xt{constructor(e=1,t=32,n=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let c=0;const h=[],u=new E,d=new E,p=[],g=[],v=[],m=[];for(let f=0;f<=n;f++){const S=[],y=f/n;let _=0;f===0&&a===0?_=.5/t:f===n&&l===Math.PI&&(_=-.5/t);for(let N=0;N<=t;N++){const A=N/t;u.x=-e*Math.cos(s+A*r)*Math.sin(a+y*o),u.y=e*Math.cos(a+y*o),u.z=e*Math.sin(s+A*r)*Math.sin(a+y*o),g.push(u.x,u.y,u.z),d.copy(u).normalize(),v.push(d.x,d.y,d.z),m.push(A+_,1-y),S.push(c++)}h.push(S)}for(let f=0;f<n;f++)for(let S=0;S<t;S++){const y=h[f][S+1],_=h[f][S],N=h[f+1][S],A=h[f+1][S+1];(f!==0||a>0)&&p.push(y,_,A),(f!==n-1||l<Math.PI)&&p.push(_,N,A)}this.setIndex(p),this.setAttribute("position",new at(g,3)),this.setAttribute("normal",new at(v,3)),this.setAttribute("uv",new at(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new At(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class jt extends Xt{constructor(e=1,t=.4,n=12,s=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:s,arc:r},n=Math.floor(n),s=Math.floor(s);const a=[],o=[],l=[],c=[],h=new E,u=new E,d=new E;for(let p=0;p<=n;p++)for(let g=0;g<=s;g++){const v=g/s*r,m=p/n*Math.PI*2;u.x=(e+t*Math.cos(m))*Math.cos(v),u.y=(e+t*Math.cos(m))*Math.sin(v),u.z=t*Math.sin(m),o.push(u.x,u.y,u.z),h.x=e*Math.cos(v),h.y=e*Math.sin(v),d.subVectors(u,h).normalize(),l.push(d.x,d.y,d.z),c.push(g/s),c.push(p/n)}for(let p=1;p<=n;p++)for(let g=1;g<=s;g++){const v=(s+1)*p+g-1,m=(s+1)*(p-1)+g-1,f=(s+1)*(p-1)+g,S=(s+1)*p+g;a.push(v,m,S),a.push(m,f,S)}this.setIndex(a),this.setAttribute("position",new at(o,3)),this.setAttribute("normal",new at(l,3)),this.setAttribute("uv",new at(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new jt(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}}class Cr extends Xt{constructor(e=new Bh(new E(-1,-1,0),new E(-1,1,0),new E(1,1,0)),t=64,n=1,s=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:s,closed:r};const a=e.computeFrenetFrames(t,r);this.tangents=a.tangents,this.normals=a.normals,this.binormals=a.binormals;const o=new E,l=new E,c=new Z;let h=new E;const u=[],d=[],p=[],g=[];v(),this.setIndex(g),this.setAttribute("position",new at(u,3)),this.setAttribute("normal",new at(d,3)),this.setAttribute("uv",new at(p,2));function v(){for(let y=0;y<t;y++)m(y);m(r===!1?t:0),S(),f()}function m(y){h=e.getPointAt(y/t,h);const _=a.normals[y],N=a.binormals[y];for(let A=0;A<=s;A++){const R=A/s*Math.PI*2,D=Math.sin(R),w=-Math.cos(R);l.x=w*_.x+D*N.x,l.y=w*_.y+D*N.y,l.z=w*_.z+D*N.z,l.normalize(),d.push(l.x,l.y,l.z),o.x=h.x+n*l.x,o.y=h.y+n*l.y,o.z=h.z+n*l.z,u.push(o.x,o.y,o.z)}}function f(){for(let y=1;y<=t;y++)for(let _=1;_<=s;_++){const N=(s+1)*(y-1)+(_-1),A=(s+1)*y+(_-1),R=(s+1)*y+_,D=(s+1)*(y-1)+_;g.push(N,A,D),g.push(A,R,D)}}function S(){for(let y=0;y<=t;y++)for(let _=0;_<=s;_++)c.x=y/t,c.y=_/s,p.push(c.x,c.y)}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new Cr(new Er[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}}class c0 extends Vt{static get type(){return"RawShaderMaterial"}constructor(e){super(e),this.isRawShaderMaterial=!0}}class Us extends Hs{static get type(){return"MeshStandardMaterial"}constructor(e){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new Ge(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ge(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=_h,this.normalScale=new Z(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new wn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class mo extends Us{static get type(){return"MeshPhysicalMaterial"}constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new Z(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Mt(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Ge(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Ge(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Ge(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class Ko extends Nt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Ge(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(t.object.target=this.target.uuid),t}}class h0 extends Ko{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Nt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ge(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}}const fa=new ht,gc=new E,vc=new E;class Wh{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Z(512,512),this.map=null,this.mapPass=null,this.matrix=new ht,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Fo,this._frameExtents=new Z(1,1),this._viewportCount=1,this._viewports=[new lt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;gc.setFromMatrixPosition(e.matrixWorld),t.position.copy(gc),vc.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(vc),t.updateMatrixWorld(),fa.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(fa),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(fa)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}const _c=new ht,gs=new E,pa=new E;class u0 extends Wh{constructor(){super(new en(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new Z(4,2),this._viewportCount=6,this._viewports=[new lt(2,1,1,1),new lt(0,1,1,1),new lt(3,1,1,1),new lt(1,1,1,1),new lt(3,0,1,1),new lt(1,0,1,1)],this._cubeDirections=[new E(1,0,0),new E(-1,0,0),new E(0,0,1),new E(0,0,-1),new E(0,1,0),new E(0,-1,0)],this._cubeUps=[new E(0,1,0),new E(0,1,0),new E(0,1,0),new E(0,1,0),new E(0,0,1),new E(0,0,-1)]}updateMatrices(e,t=0){const n=this.camera,s=this.matrix,r=e.distance||n.far;r!==n.far&&(n.far=r,n.updateProjectionMatrix()),gs.setFromMatrixPosition(e.matrixWorld),n.position.copy(gs),pa.copy(n.position),pa.add(this._cubeDirections[t]),n.up.copy(this._cubeUps[t]),n.lookAt(pa),n.updateMatrixWorld(),s.makeTranslation(-gs.x,-gs.y,-gs.z),_c.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(_c)}}class d0 extends Ko{constructor(e,t,n=0,s=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new u0}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}}class f0 extends Wh{constructor(){super(new Bo(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class p0 extends Ko{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Nt.DEFAULT_UP),this.updateMatrix(),this.target=new Nt,this.shadow=new f0}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}class $h{constructor(e=!0){this.autoStart=e,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=yc(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const t=yc();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}}function yc(){return performance.now()}const xc=new ht;class m0{constructor(e,t,n=0,s=1/0){this.ray=new Uo(e,t),this.near=n,this.far=s,this.camera=null,this.layers=new ko,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):console.error("THREE.Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return xc.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(xc),this}intersectObject(e,t=!0,n=[]){return go(e,this,n,t),n.sort(bc),n}intersectObjects(e,t=!0,n=[]){for(let s=0,r=e.length;s<r;s++)go(e[s],this,n,t);return n.sort(bc),n}}function bc(i,e){return i.distance-e.distance}function go(i,e,t,n){let s=!0;if(i.layers.test(e.layers)&&i.raycast(e,t)===!1&&(s=!1),s===!0&&n===!0){const r=i.children;for(let a=0,o=r.length;a<o;a++)go(r[a],e,t,!0)}}class Sc{constructor(e=1,t=0,n=0){return this.radius=e,this.phi=t,this.theta=n,this}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(Mt(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}class g0 extends xi{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(){}disconnect(){}dispose(){}update(){}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Eo}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Eo);const jo={"index.html:metaDescription":"A simulation of how a country onboards to the WHO Global Digital Health Certification Network.","index.html:title":"Join the Network · GDHCN onboarding simulation","settings.ts:DEFAULTS.country":"Country XC","settings.ts:domains.and":" and ","settings.ts:domains.none":"no trust domain yet","settings.ts:letter.zero":"The Letter for joining with no trust domain","settings.ts:letter.one":"{n} Letter","settings.ts:letter.other":"{n} Letters","ui.ts:navBrand":"GDHCN","ui.ts:navBrandTitle":"Back to the start","ui.ts:navTitle":"Join the Network","ui.ts:navUseCases":"▶ Use cases","ui.ts:navSettings":"⚙ Settings","ui.ts:navLang":"Language","ui.ts:title.eyebrow":"WHO Global Digital Health Certification Network","ui.ts:title.h1":"Join the Network","ui.ts:title.lede":"Take your country from a first email to live on the production Trust Network Gateway, the way the WHO SMART Trust guidance sets it out.","ui.ts:title.countryLabel":"Your country","ui.ts:title.codeLabel":"3-letter code","ui.ts:title.codeHint":"ISO 3166 alpha-3 where one exists. Used in your repository names.","ui.ts:title.advancedSummary":"Your team: who does what","ui.ts:title.teamBusiness":"Business Owner","ui.ts:title.teamKeymaster":"Key Master","ui.ts:title.teamLegal":"Legal","ui.ts:title.teamTechnical":"Technical","ui.ts:title.avatarBusiness":"BO","ui.ts:title.avatarKeymaster":"KM","ui.ts:title.avatarLegal":"LG","ui.ts:title.avatarTechnical":"TC","ui.ts:title.resetSample":"Reset to the sample country (Country XC)","ui.ts:title.countryFallback":"Your country","ui.ts:title.gridCountry":"your ministry, your servers, your private keys","ui.ts:title.gridNetworkName":"Trust Network Gateway","ui.ts:title.gridNetwork":"public keys and trust lists","ui.ts:title.gridWhoName":"WHO","ui.ts:title.gridWho":"Secretariat, Operations, the offline Trust Anchor","ui.ts:title.gridGithubName":"GitHub","ui.ts:title.gridGithub":"where your public keys wait for tng-bot","ui.ts:title.smallLead":"Each moment asks your team to make a call. Wrong calls send things back, sometimes much later. Roads matter:","ui.ts:title.smallPaper":"paper travels by email","ui.ts:title.smallData":"keys travel by data","ui.ts:title.start":"Start onboarding","ui.ts:title.watchDemo":"▶ Watch the demo","ui.ts:title.explore":"🧭 Explore the world","ui.ts:title.fine":"Based on WHO SMART Trust (smart.who.int/trust). The sample country and people are fictional. Game days are illustrative, not WHO timelines.","ui.ts:title.sideEyebrow":"See it in action","ui.ts:title.sideLede":"Short films showing what onboarding involves and what the network does once a country is live.","ui.ts:title.sideDemoLength":"3 min","ui.ts:title.sideDemoTag":"Narrated demo · this game","ui.ts:title.sideDemoTitle":"How onboarding works","ui.ts:title.sideDemoSub":"The ideal path from first email to go-live, in nine steps","ui.ts:title.sideDownload":"⬇ Download the narrated demo as MP4 (6 MB)","ui.ts:menu.restart":"Restart from the beginning","ui.ts:menu.jumpLabel":"Jump to a phase (facilitator)","ui.ts:menu.phaseButton":"{p} · {name}","ui.ts:menu.about":"About this simulation","ui.ts:about.h2":"About this simulation","ui.ts:about.p1":"A learning tool that turns the WHO SMART Trust onboarding process into choices a country team makes. Step numbers refer to the published process at smart.who.int/trust, which remains the authority. The GDHCN Administrative and Operational Framework is authoritative for definitions.","ui.ts:about.p2":"Simplifications: steps are grouped into moments, some checks are shown at a convenient point in the story, and game days are illustrative.","ui.ts:about.close":"Close","ui.ts:about.cats":"🐾 Cats found: {n} of 3","ui.ts:about.builtBy":"Built by","ui.ts:about.osforge":"OS Forge","ui.ts:stats.days":"game days","ui.ts:stats.detours":"detours","ui.ts:stats.resetView":"Reset the view","ui.ts:strip.home":"⌂ Home","ui.ts:strip.homeTitle":"Back to the title screen","ui.ts:strip.restart":"↺ Restart","ui.ts:strip.restartTitle":"Restart onboarding from the first step","ui.ts:strip.phase.A":"Apply","ui.ts:strip.phase.B":"Prepare keys","ui.ts:strip.phase.C":"WHO checks and setup","ui.ts:strip.phase.D":"Test and go live","ui.ts:strip.phase.E":"Stay live","refs:openInIg":"Open this step in the SMART Trust guide","refs:page.concepts_certificate_governance":"Certificate governance","ui.ts:hud.role":"{name} · {title}","ui.ts:desk.whoName":"WHO","ui.ts:desk.whoSub":"Watch what WHO does","ui.ts:desk.tried":"tried","ui.ts:desk.send":"Send the Letter to WHO","ui.ts:desk.watch":"Watch","ui.ts:desk.fix":"Fix it and resend","ui.ts:desk.tryAgain":"Try again","ui.ts:desk.back":"← Back, undo this","ui.ts:desk.catTitle":"…","ui.ts:desk.extraWrong":"Should not be there:","ui.ts:desk.extraMissing":"Missing:","ui.ts:desk.extraDomain":"Pick at least one trust domain.","ui.ts:desk.sumRemove":"{n} to remove","ui.ts:desk.sumMissing":"{n} missing","ui.ts:desk.sumDomain":"pick at least one trust domain","ui.ts:returned.by":"Returned by {by}","ui.ts:returned.days":"+{days} days","ui.ts:returned.origin":"This goes back to an earlier call: {origin}. It looked fine at the time.","ui.ts:returned.what":"What happened.","ui.ts:returned.why":"Why.","ui.ts:returned.fix":"The fix.","ui.ts:confirm.lost":"Your progress in this run ({days} game days, {n} detour{n:|s}) will be lost.","ui.ts:confirm.restartTitle":"Restart onboarding?","ui.ts:confirm.restartBody":"You start again at the Statement of Interest, with the same country and team.","ui.ts:confirm.restartOk":"↺ Restart","ui.ts:confirm.homeTitle":"Go back to the start?","ui.ts:confirm.homeBody":"You return to the title screen; your country and team names are kept.","ui.ts:confirm.homeOk":"⌂ Go home","ui.ts:confirm.cancel":"Cancel","ui.ts:dashboard.years":"{n} years","ui.ts:dashboard.months":"{n} months","ui.ts:dashboard.days":"{n} days","ui.ts:debrief.eyebrow":"Debrief · {country} is live","ui.ts:debrief.h1Detours":"Live, with {n} detour{n:|s}","ui.ts:debrief.h1Clean":"Live, first time","ui.ts:debrief.kpiDays":"game days","ui.ts:debrief.kpiIdeal":"ideal route","ui.ts:debrief.kpiLost":"days on detours","ui.ts:debrief.yourRoute":"Your route","ui.ts:debrief.sentBack":"What sent things back","ui.ts:debrief.origin":"Decision made earlier, at: {origin}","ui.ts:debrief.keysTitle":"Where the keys live","ui.ts:debrief.countryKeeps":"{country} keeps","ui.ts:debrief.keep1":"SCA private key, offline in the vault","ui.ts:debrief.keep2":"TLS and Upload private keys","ui.ts:debrief.keep3":"Document Signer private keys","ui.ts:debrief.githubCarries":"GitHub carries","ui.ts:debrief.github1":"Public keys only (PEM)","ui.ts:debrief.github2":"A GPG-signed tag","ui.ts:debrief.github3":"Read by tng-bot-dev (UAT) and tng-bot (PROD)","ui.ts:debrief.whoHolds":"WHO holds","ui.ts:debrief.who1":"The Trust Anchor, offline and air-gapped","ui.ts:debrief.who2":"Your verified people and GPG keys","ui.ts:debrief.gatewayPublishes":"The Gateway publishes","ui.ts:debrief.gateway1":"Whitelisted public keys","ui.ts:debrief.gateway2":"Trust lists for every participant","ui.ts:debrief.learnTitle":"What to take back to your team","ui.ts:debrief.finish":"Finish","ui.ts:debrief.print":"Print this debrief","ui.ts:splash.eyebrow":"Simulation complete","ui.ts:splash.h1":"Congratulations. {country} is live.","ui.ts:splash.liveIn":"Live in: {domains}.","ui.ts:splash.liveNone":"Live on the Trust Network Gateway, with no trust domain yet. Join one whenever you are ready: each trust domain has its own Letter of Application.","ui.ts:splash.lede":"You took {country} from a Statement of Interest to the production Trust Network Gateway: eligibility, keys, the Letter of Application, identity checks, WHO's offline signing, testing and go-live.","ui.ts:splash.takeFurther":"Take it further","ui.ts:splash.link1.title":"WHO Global Digital Health Certification Network","ui.ts:splash.link1.sub":"The live GDHCN page at WHO","ui.ts:splash.link2.title":"WHO SMART Trust implementation guide","ui.ts:splash.link2.sub":"The technical specification behind the network","ui.ts:splash.link3.title":"Onboarding process","ui.ts:splash.link3.sub":"The steps this simulation follows","ui.ts:splash.link4.title":"Onboarding checklist","ui.ts:splash.link4.sub":"Tools, certificates, repositories and tests, hands-on","ui.ts:splash.link5.title":"smart-trust on GitHub","ui.ts:splash.link5.sub":"Source of the guide, with participant data","ui.ts:splash.link6.title":"tng-participant-template","ui.ts:splash.link6.sub":"Template for your private key repositories","ui.ts:splash.link7.title":"gdhcn-support@who.int","ui.ts:splash.link7.sub":"Technical help during onboarding","ui.ts:splash.link8.title":"WHO Onboarding Wizard (Windows)","ui.ts:splash.link8.sub":"Repository, GPG and certificate steps on Windows","ui.ts:splash.link9.title":"Letter of Application templates","ui.ts:splash.link9.sub":"One per trust domain, in several languages","ui.ts:splash.link10.title":"gdhcn-secretariat@who.int","ui.ts:splash.link10.sub":"Governance: Statement of Interest and Letters","ui.ts:splash.perfect":"A perfect run","ui.ts:splash.fine":"This is a learning simulation. The WHO SMART Trust guide and the GDHCN Administrative and Operational Framework are the authority.","ui.ts:splash.again":"Play again","ui.ts:splash.demo":"▶ Watch the demo","ui.ts:dev.chip":"DEV","ui.ts:dev.end":"⏭ End","ui.ts:dev.endTitle":"Jump to the end (dev)","ui.ts:dev.reviewerTools":"Reviewer tools","ui.ts:dev.toggle":"Dev mode","ui.ts:dev.toggleHint":"clickable strip stops, previews, jump to end","ui.ts:dev.preview":'preview: {kind} for "{text}{more}"',"ui.ts:dev.previewDelayed":"delayed set-back","ui.ts:dev.previewNow":"set-back","ui.ts:dev.previewEyebrow":"Dev preview · not counted","ui.ts:dev.previewClose":"Close preview","ui.ts:dev.previewOrigin":"This would surface later, at its check. The call is made at: {origin}.","explore.ts:hint.title":"Explore the world","explore.ts:hint.rotate":"Rotate","explore.ts:hint.rotateHow":"Drag","explore.ts:hint.move":"Move","explore.ts:hint.moveHow":"<kbd>Shift</kbd> + drag, or the arrow keys <i>(touch: two-finger drag)</i>","explore.ts:hint.zoom":"Zoom","explore.ts:hint.zoomHow":"Scroll or pinch","explore.ts:hint.click":"Click any building to see what happens there.","explore.ts:hint.closeAria":"Hide tips","explore.ts:bar.back":"← Back","explore.ts:bar.reset":"⟲ Reset view","explore.ts:bar.resetTitle":"Back to the overview","explore.ts:bar.start":"Start onboarding ▶","explore.ts:card.closeAria":"Close","explore.ts:card.holds":"What lives here","explore.ts:card.here":"In the game, this is where you","explore.ts:HOLDS.ministry":"The four named representatives, the Statement of Interest and the Letter of Application.","explore.ts:HOLDS.backend":"Private keys: TLS, Upload and Document Signer keys. The SCA private key, offline in the vault.","explore.ts:HOLDS.github":"Public keys (PEM) and the GPG-signed tag, in a private repository per environment on [[github|GitHub]].","explore.ts:HOLDS.uat":"Test copies of your public keys, auto-signed and whitelisted, plus the test trust list.","explore.ts:HOLDS.prod":"Your whitelisted production public keys and the trust lists other countries download.","explore.ts:HOLDS.secretariat":"Your application, the Letter of Application and the verified identities of your team.","explore.ts:HOLDS.ops":"The WHO Trust Anchor, kept offline in the air-gapped room, and the pull requests tng-bot raises.","explore.ts:HOLDS.dashboard":"The expiry dates of every participant's certificates, per environment.","World.ts:place.ministry.name":"Ministry of Health","World.ts:place.ministry.blurb":"People and paperwork: Business Owner, Legal, Technical and Key Master representatives.","World.ts:place.backend.name":"Country backend","World.ts:place.backend.blurb":"Your servers. Private TLS and Upload keys, Document Signers, and the offline SCA vault.","World.ts:place.secretariat.name":"GDHCN Secretariat","World.ts:place.secretariat.blurb":"Governance: gdhcn-secretariat@who.int. Technical help: gdhcn-support@who.int. Eligibility, Letters of Application and identity checks.","World.ts:place.ops.name":"WHO Operations","World.ts:place.ops.blurb":"tng-bot, pull requests, and the air-gapped room where the WHO Trust Anchor signs PROD keys.","World.ts:place.uat.name":"UAT gateway","World.ts:place.uat.blurb":"The test gateway. Keys are auto-signed. Connectivity and dry-run tests happen here.","World.ts:place.prod.name":"PROD gateway","World.ts:place.prod.blurb":"The production gateway. Holds whitelisted public keys and publishes trust lists.","World.ts:place.dashboard.name":"Certificate expiry dashboard","World.ts:place.dashboard.blurb":"WHO-run dashboards (DEV, UAT, PROD) showing when each participant's certificates expire. A view, not a reminder service.","World.ts:place.github.name":"Private repos","World.ts:place.github.blurb":"{country}'s private repositories (UAT, PROD). Public keys only.","World.ts:territory.country":"COUNTRY XC","World.ts:territory.network":"TRUST NETWORK GATEWAY","World.ts:territory.who":"WHO","World.ts:territory.github":"GITHUB · third party","World.ts:territory.dashboard":"EXPIRY DASHBOARD · WHO","World.ts:sub.vault":"Offline SCA vault","World.ts:sub.airgap":"Air-gapped signing","page.ts:gallery.eyebrow":"Use cases","page.ts:closeAria":"Close","page.ts:gallery.h1":"The network in people's lives","page.ts:gallery.lede":"Two short animated films follow people whose health records cross a border between two fictional countries, Nordavia and Coralia. Each one shows what the Global Digital Health Certification Network does, and what it never does.","page.ts:detail.back":"← All use cases","page.ts:detail.whatFilm":"What the film shows","page.ts:detail.howHelps":"How the GDHCN helps here","page.ts:detail.why":"Why this use case","page.ts:detail.play":"Play the onboarding game","page.ts:detail.next":"Next: {title} →","page.ts:detail.filmLanguage":"Film language","page.ts:detail.langEn":"English","page.ts:detail.langFr":"Français","page.ts:detail.fine":"Nordavia and Coralia are fictional. The films are illustrations; the WHO SMART Trust guide is the authority on how the network works.","data.ts:icvp.title":"Mary's Yellow Card","data.ts:icvp.subtitle":"A digital yellow fever certificate that any border can check","data.ts:icvp.tag":"Digital ICVP · vaccination certificate","data.ts:icvp.minutes":"4 min","data.ts:icvp.summary":"Mary lives in Nordavia and is travelling to Coralia, which asks for proof of yellow fever vaccination. At the travel clinic she is vaccinated and the nurse records it as usual. Behind the screen, Nordavia turns that record into a standard digital vaccination certificate (the International Certificate of Vaccination or Prophylaxis, ICVP), signs it with a key that never leaves the country, and gives Mary a QR code on her phone and on her paper yellow card. At the border in Coralia, the port health officer scans it and the check passes in seconds. A forged card, signed with a key no trusted country published, fails.","data.ts:icvp.idea":"The certificate carries its own proof. The network carries trust, not data.","data.ts:icvp.how1":"Nordavia joined the network once: it proved who it is and shared only its public keys, which the network added to a trust list.","data.ts:icvp.how2":"Coralia keeps a copy of that trust list, so its officer checks the signature, that the key hasn't been revoked, and the vaccination rules, with no call to Nordavia or to the network. It works offline.","data.ts:icvp.how3":"The QR code carries the certificate itself, with only what a border needs to know. Nobody can change it without breaking the signature.","data.ts:icvp.how4":"The network never carries Mary's vaccination record and never sees her name.","data.ts:icvp.why":"Vaccination certificates for travel are one of the first uses of the network, and the same signed code works whether it is shown on a phone or printed on the paper yellow card.","data.ts:maternal.title":"Amina's Journey","data.ts:maternal.subtitle":"A mother's care record that can safely cross a border","data.ts:maternal.tag":"International Patient Summary · maternal care","data.ts:maternal.minutes":"4 min","data.ts:maternal.summary":"Amina is seven months pregnant in Nordavia and plans to give birth near her mother, across the border in Coralia. Her antenatal care, including a penicillin allergy, stays in Nordavia as a standard International Patient Summary. What she carries is a signed QR code that points to that summary and holds no medical details. When labour comes early at a hospital she has never seen, the midwife scans the code with Amina's consent, checks the signature against Nordavia's public key, confirms her identity, and only then fetches the summary from Nordavia. The allergy is right there.","data.ts:maternal.idea":"The QR code points to the record; it is not the record. The network carries trust, not data.","data.ts:maternal.how1":"Nordavia's signature on the code is checked against the public keys the network publishes, so Coralia knows the reference is genuine.","data.ts:maternal.how2":"The summary stays at home, held by Nordavia under its own rules, and is fetched directly from Nordavia only for an authorised health worker, with consent.","data.ts:maternal.how3":"The network never carries Amina's health information and never sees her name.","data.ts:maternal.how4":"Her baby's birth and first vaccines are recorded in Coralia in a record of his own, and Nordavia's clinic carries on his schedule with no gaps and no repeated doses.","data.ts:maternal.why":"Continuity of care across borders matters most in the first 1,000 days of a child's life, and the International Patient Summary already supports it at summary level.","main.ts:demoCountryName":"The Country","main.ts:catToast":"🐾 Cat {n} of 3 found.","cat.ts:SETBACK_LINES.1":"Even the cat knows the SCA private key stays in the vault.","cat.ts:SETBACK_LINES.2":"The cat suggests reading the Letter of Application twice.","cat.ts:SETBACK_LINES.3":"Mrrp. Detours happen. That's what WHO's checks are for.","cat.ts:SETBACK_LINES.4":"The cat has filed this under lessons learned.","cat.ts:SETBACK_LINES.5":"The cat would like to see that tag signed properly.","cat.ts:SETBACK_LINES.6":"The cat is not angry. The cat is disappointed.","cat.ts:WORLD_CATS.country":"The Key Master's cat, in disguise. Only steals fish, never private keys.","cat.ts:WORLD_CATS.gateway":"Asleep on the warm Gateway. Trust lists are very cosy.","cat.ts:WORLD_CATS.who":"The Secretariat's cat. Has read the Administrative and Operational Framework twice.","feedback.ts:button.title":"Send feedback on this screen","feedback.ts:button.label":"💬 Feedback","feedback.ts:panel.head":"Send feedback","feedback.ts:panel.closeAria":"Close","feedback.ts:panel.where":"About: {where}","feedback.ts:panel.whereSteps":"({steps})","feedback.ts:ctx.titleScreen":"Title screen","feedback.ts:ctx.debrief":"Debrief","feedback.ts:ctx.splash":"Completion splash","feedback.ts:ctx.game":"Game · {phase} · {title}","feedback.ts:kind.label":"What kind?","feedback.ts:TYPES.1":"Accuracy (does not match WHO guidance)","feedback.ts:TYPES.2":"Unclear or confusing","feedback.ts:TYPES.3":"Bug or display problem","feedback.ts:TYPES.4":"Idea or suggestion","feedback.ts:TYPES.5":"Works well","feedback.ts:comment.label":"Your comment","feedback.ts:comment.placeholder":"What did you notice? Quote the wording if it's about the text.","feedback.ts:name.label":"Name","feedback.ts:org.label":"Organisation","feedback.ts:email.label":"Email (optional, if you'd like a reply)","feedback.ts:send":"Send","feedback.ts:status.notConnected":"Feedback is not connected on this copy of the game.","feedback.ts:status.empty":"Please write a comment first.","feedback.ts:status.sending":"Sending…","feedback.ts:status.saved":"Thank you, your comment was saved.","feedback.ts:status.failed":"Couldn't send. Check your connection and try again; your comment is still here.","feedback.ts:fine":"Comments go to the OS Forge review sheet with the screen you were on. Name and email are optional.","Game.ts:fixed":"Fixed and resent.","Game.ts:live":"<b>{country} is live</b> on the production Trust Network Gateway.","Demo.ts:badge":"DEMO · the ideal path, no mistakes","Demo.ts:bar.back":"Previous","Demo.ts:bar.pause":"Pause","Demo.ts:bar.next":"Next","Demo.ts:bar.voice":"Narration on or off","Demo.ts:bar.captionsOnly":"No narration in this language yet: captions only","Demo.ts:bar.speed":"Playback speed","Demo.ts:bar.exit":"Leave the demo","Demo.ts:tapForSound":"🔊 Tap for sound","Demo.ts:meta":"{i} of {total}","Demo.ts:beat1.title":"Ask to join","Demo.ts:beat1.body":"The Country's Ministry of Health emails a Statement of Interest to the GDHCN Secretariat. WHO checks that the Country is eligible and accepts the Terms of Participation, then invites it to onboard and sends the technical specifications.","Demo.ts:beat2.title":"Name the team, make the keys","Demo.ts:beat2.body":"The Country names four people: a Business Owner, a Legal representative, a Technical lead, and a Key Master, who runs the Country's keys. The Key Master creates a Signing CA, a TLS and an Upload certificate for testing, and a separate set for production. The Signing CA's private key goes into an offline vault and never leaves the Country.","Demo.ts:beat3.title":"Public keys to GitHub","Demo.ts:beat3.body":"Each authorised person creates a GPG key with their official email address. The Technical lead puts the public keys, never the private ones, in private GitHub repositories, and invites WHO's bots: tng-bot-dev for testing, and tng-bot for production. The Key Master signs the release tag from the terminal.","Demo.ts:beat4.title":"Send the Letter of Application","Demo.ts:beat4.body":"Before production, the Legal representative sends a Letter of Application for each trust domain the Country joins, or one Letter for joining with no trust domain yet. It names the four contacts, the GPG key fingerprints and the production repository. The certificates themselves stay in the repository for tng-bot to collect.","Demo.ts:beat5.title":"WHO verifies the people","Demo.ts:beat5.body":"WHO confirms the named people face to face, or through the diplomatic channel, and checks that the email inside every GPG key matches the Letter.","Demo.ts:beat6.title":"tng-bot collects the keys","Demo.ts:beat6.body":"WHO Operations takes over. tng-bot clones the signed tag, verifies it against the onboarded GPG keys, and collects the public keys. Test keys are signed automatically and whitelisted.","Demo.ts:beat7.title":"WHO signs PROD offline","Demo.ts:beat7.body":"Production keys are verified by WHO, and signed with the WHO Trust Anchor in an air-gapped process. The Trust Anchor's private key never sits on the online gateway.","Demo.ts:beat8.title":"Test before going live","Demo.ts:beat8.body":"The Technical lead connects to a test gateway with the TLS client certificate. Testing can run on DEV, UAT or PROD. The dry run uploads a Document Signer Certificate, revokes one, downloads the trust list and validates samples. When it passes, WHO opens production.","Demo.ts:beat9.title":"Go live","Demo.ts:beat9.body":"A Document Signer Certificate, signed by the Signing CA, is packaged, signed with the Upload certificate, uploaded to production and found in the trust list. One is revoked to prove that works, the results go by email, and a confirmation tells the Country and WHO that onboarding is complete. From here, renewing certificates on time is the Country's job.","Demo.ts:cast.business.role":"Business Owner","Demo.ts:cast.business.duty":"Owns the use cases","Demo.ts:cast.legal.role":"Legal representative","Demo.ts:cast.legal.duty":"WHO's contact on legal and policy","Demo.ts:cast.technical.role":"Technical lead","Demo.ts:cast.technical.duty":"Security, infrastructure, conformance","Demo.ts:cast.keymaster.role":"Key Master","Demo.ts:cast.keymaster.duty":"Runs the Country's keys","Demo.ts:cast.certsChip":"Signing CA · TLS · Upload for UAT and for PROD","Demo.ts:cast.vaultChip":"🔒 SCA key: offline vault","Demo.ts:parcel.1a":"Statement of Interest","Demo.ts:parcel.1b":"Invitation + technical specs","Demo.ts:parcel.2":"Key generation","Demo.ts:parcel.3":"Public keys (PEM) + signed tag","Demo.ts:parcel.4":"Letter of Application","Demo.ts:parcel.5":"Identities confirmed","Demo.ts:parcel.6a":"Public keys, tag verified","Demo.ts:parcel.6b":"UAT keys: auto-signed","Demo.ts:parcel.7":"PROD keys: signed offline","Demo.ts:parcel.8a":"mTLS · GET /trustList","Demo.ts:parcel.8b":"Upload · revoke · download","Demo.ts:parcel.9a":"CMS package (DSC)","Demo.ts:parcel.9b":"Trust list: DSC present","Demo.ts:parcel.9c":"Revoke one DSC","Demo.ts:parcel.9d":"Test results","Demo.ts:parcel.9e":"Onboarding complete","Demo.ts:end.eyebrow":"Demo complete","Demo.ts:end.h1":"The Country is live","Demo.ts:end.lede":"That is the whole journey on the ideal path. In the game, your team makes each call, and wrong calls come back, sometimes much later.","Demo.ts:end.play":"Play it yourself","Demo.ts:end.again":"Watch again","Demo.ts:end.title":"Back to the start","Demo.ts:feedbackContext":"Demo · beat {i} · {title}"},Mc=" ";function v0(i){return i.replace(/ +([:;!?»])/g,`${Mc}$1`).replace(/(«) +/g,`$1${Mc}`)}const ss=i=>wt()==="fr"?v0(i):i;function Xh(i,e){return/^[AEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜHaeiouyàâäéèêëîïôöùûüh]/.test(e.trim())?`${i==="De"?"D":"d"}'${e}`:`${i} ${e}`}function _0(i){if(wt()!=="en"){const t=Sa(i);if(t!==void 0)return t}const e=jo[i];return e===void 0?i:e}function y0(i,e){return e?(wt()==="fr"?i.replace(/\b(de|De) \{(\w+)\}/g,(n,s,r)=>r in e?Xh(s,String(e[r])):n):i).replace(/\{(\w+)(?::([^|}]*)\|([^}]*))?\}/g,(n,s,r,a)=>s in e?r!==void 0?Number(e[s])===1?r:a??"":String(e[s]):n):i}function Le(i,e){return ss(y0(_0(i),e))}const x0=i=>jo[i]??i,b0=(i,e=1)=>i.toLocaleString(wt()==="ar"?"ar-u-nu-latn":wt(),{minimumFractionDigits:e,maximumFractionDigits:e}),wc={type:"change"},Zo={type:"start"},qh={type:"end"},pr=new Uo,Tc=new Jn,S0=Math.cos(70*br.DEG2RAD),Tt=new E,Yt=2*Math.PI,ot={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},ma=1e-6;class M0 extends g0{constructor(e,t=null){super(e,t),this.state=ot.NONE,this.enabled=!0,this.target=new E,this.cursor=new E,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:qi.ROTATE,MIDDLE:qi.DOLLY,RIGHT:qi.PAN},this.touches={ONE:Gi.ROTATE,TWO:Gi.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new E,this._lastQuaternion=new vi,this._lastTargetPosition=new E,this._quat=new vi().setFromUnitVectors(e.up,new E(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Sc,this._sphericalDelta=new Sc,this._scale=1,this._panOffset=new E,this._rotateStart=new Z,this._rotateEnd=new Z,this._rotateDelta=new Z,this._panStart=new Z,this._panEnd=new Z,this._panDelta=new Z,this._dollyStart=new Z,this._dollyEnd=new Z,this._dollyDelta=new Z,this._dollyDirection=new E,this._mouse=new Z,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=T0.bind(this),this._onPointerDown=w0.bind(this),this._onPointerUp=E0.bind(this),this._onContextMenu=N0.bind(this),this._onMouseWheel=R0.bind(this),this._onKeyDown=P0.bind(this),this._onTouchStart=D0.bind(this),this._onTouchMove=L0.bind(this),this._onMouseDown=A0.bind(this),this._onMouseMove=C0.bind(this),this._interceptControlDown=I0.bind(this),this._interceptControlUp=O0.bind(this),this.domElement!==null&&this.connect(),this.update()}connect(){this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(wc),this.update(),this.state=ot.NONE}update(e=null){const t=this.object.position;Tt.copy(t).sub(this.target),Tt.applyQuaternion(this._quat),this._spherical.setFromVector3(Tt),this.autoRotate&&this.state===ot.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(n)&&isFinite(s)&&(n<-Math.PI?n+=Yt:n>Math.PI&&(n-=Yt),s<-Math.PI?s+=Yt:s>Math.PI&&(s-=Yt),n<=s?this._spherical.theta=Math.max(n,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+s)/2?Math.max(n,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const a=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=a!=this._spherical.radius}if(Tt.setFromSpherical(this._spherical),Tt.applyQuaternion(this._quatInverse),t.copy(this.target).add(Tt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let a=null;if(this.object.isPerspectiveCamera){const o=Tt.length();a=this._clampDistance(o*this._scale);const l=o-a;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){const o=new E(this._mouse.x,this._mouse.y,0);o.unproject(this.object);const l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;const c=new E(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(o),this.object.updateMatrixWorld(),a=Tt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;a!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(a).add(this.object.position):(pr.origin.copy(this.object.position),pr.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(pr.direction))<S0?this.object.lookAt(this.target):(Tc.setFromNormalAndCoplanarPoint(this.object.up,this.target),pr.intersectPlane(Tc,this.target))))}else if(this.object.isOrthographicCamera){const a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),a!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>ma||8*(1-this._lastQuaternion.dot(this.object.quaternion))>ma||this._lastTargetPosition.distanceToSquared(this.target)>ma?(this.dispatchEvent(wc),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?Yt/60*this.autoRotateSpeed*e:Yt/60/60*this.autoRotateSpeed}_getZoomScale(e){const t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Tt.setFromMatrixColumn(t,0),Tt.multiplyScalar(-e),this._panOffset.add(Tt)}_panUp(e,t){this.screenSpacePanning===!0?Tt.setFromMatrixColumn(t,1):(Tt.setFromMatrixColumn(t,0),Tt.crossVectors(this.object.up,Tt)),Tt.multiplyScalar(e),this._panOffset.add(Tt)}_pan(e,t){const n=this.domElement;if(this.object.isPerspectiveCamera){const s=this.object.position;Tt.copy(s).sub(this.target);let r=Tt.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/n.clientHeight,this.object.matrix),this._panUp(2*t*r/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const n=this.domElement.getBoundingClientRect(),s=e-n.left,r=t-n.top,a=n.width,o=n.height;this._mouse.x=s/a*2-1,this._mouse.y=-(r/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(Yt*this._rotateDelta.x/t.clientHeight),this._rotateUp(Yt*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateUp(Yt*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateUp(-Yt*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateLeft(Yt*this.rotateSpeed/this.domElement.clientHeight):this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateLeft(-Yt*this.rotateSpeed/this.domElement.clientHeight):this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._rotateStart.set(n,s)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panStart.set(n,s)}}_handleTouchStartDolly(e){const t=this._getSecondPointerPosition(e),n=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(n*n+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{const n=this._getSecondPointerPosition(e),s=.5*(e.pageX+n.x),r=.5*(e.pageY+n.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(Yt*this._rotateDelta.x/t.clientHeight),this._rotateUp(Yt*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panEnd.set(n,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){const t=this._getSecondPointerPosition(e),n=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(n*n+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new Z,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){const t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){const t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}}function w0(i){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(i.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(i)&&(this._addPointer(i),i.pointerType==="touch"?this._onTouchStart(i):this._onMouseDown(i)))}function T0(i){this.enabled!==!1&&(i.pointerType==="touch"?this._onTouchMove(i):this._onMouseMove(i))}function E0(i){switch(this._removePointer(i),this._pointers.length){case 0:this.domElement.releasePointerCapture(i.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(qh),this.state=ot.NONE;break;case 1:const e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function A0(i){let e;switch(i.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case qi.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(i),this.state=ot.DOLLY;break;case qi.ROTATE:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=ot.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=ot.ROTATE}break;case qi.PAN:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=ot.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=ot.PAN}break;default:this.state=ot.NONE}this.state!==ot.NONE&&this.dispatchEvent(Zo)}function C0(i){switch(this.state){case ot.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(i);break;case ot.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(i);break;case ot.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(i);break}}function R0(i){this.enabled===!1||this.enableZoom===!1||this.state!==ot.NONE||(i.preventDefault(),this.dispatchEvent(Zo),this._handleMouseWheel(this._customWheelEvent(i)),this.dispatchEvent(qh))}function P0(i){this.enabled===!1||this.enablePan===!1||this._handleKeyDown(i)}function D0(i){switch(this._trackPointer(i),this._pointers.length){case 1:switch(this.touches.ONE){case Gi.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(i),this.state=ot.TOUCH_ROTATE;break;case Gi.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(i),this.state=ot.TOUCH_PAN;break;default:this.state=ot.NONE}break;case 2:switch(this.touches.TWO){case Gi.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(i),this.state=ot.TOUCH_DOLLY_PAN;break;case Gi.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(i),this.state=ot.TOUCH_DOLLY_ROTATE;break;default:this.state=ot.NONE}break;default:this.state=ot.NONE}this.state!==ot.NONE&&this.dispatchEvent(Zo)}function L0(i){switch(this._trackPointer(i),this.state){case ot.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(i),this.update();break;case ot.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(i),this.update();break;case ot.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(i),this.update();break;case ot.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(i),this.update();break;default:this.state=ot.NONE}}function N0(i){this.enabled!==!1&&i.preventDefault()}function I0(i){i.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function O0(i){i.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}class U0 extends Oh{constructor(){super();const e=new mt;e.deleteAttribute("uv");const t=new Us({side:Wt}),n=new Us,s=new d0(16777215,900,28,2);s.position.set(.418,16.199,.3),this.add(s);const r=new ke(e,t);r.position.set(-.757,13.219,.717),r.scale.set(31.713,28.305,28.591),this.add(r);const a=new ke(e,n);a.position.set(-10.906,2.009,1.846),a.rotation.set(0,-.195,0),a.scale.set(2.328,7.905,4.651),this.add(a);const o=new ke(e,n);o.position.set(-5.607,-.754,-.758),o.rotation.set(0,.994,0),o.scale.set(1.97,1.534,3.955),this.add(o);const l=new ke(e,n);l.position.set(6.167,.857,7.803),l.rotation.set(0,.561,0),l.scale.set(3.927,6.285,3.687),this.add(l);const c=new ke(e,n);c.position.set(-2.017,.018,6.124),c.rotation.set(0,.333,0),c.scale.set(2.002,4.566,2.064),this.add(c);const h=new ke(e,n);h.position.set(2.291,-.756,-2.621),h.rotation.set(0,-.286,0),h.scale.set(1.546,1.552,1.496),this.add(h);const u=new ke(e,n);u.position.set(-2.193,-.369,-5.547),u.rotation.set(0,.516,0),u.scale.set(3.875,3.487,2.986),this.add(u);const d=new ke(e,ki(50));d.position.set(-16.116,14.37,8.208),d.scale.set(.1,2.428,2.739),this.add(d);const p=new ke(e,ki(50));p.position.set(-16.109,18.021,-8.207),p.scale.set(.1,2.425,2.751),this.add(p);const g=new ke(e,ki(17));g.position.set(14.904,12.198,-1.832),g.scale.set(.15,4.265,6.331),this.add(g);const v=new ke(e,ki(43));v.position.set(-.462,8.89,14.52),v.scale.set(4.38,5.441,.088),this.add(v);const m=new ke(e,ki(20));m.position.set(3.235,11.486,-12.541),m.scale.set(2.5,2,.1),this.add(m);const f=new ke(e,ki(100));f.position.set(0,20,0),f.scale.set(1,.1,1),this.add(f)}dispose(){const e=new Set;this.traverse(t=>{t.isMesh&&(e.add(t.geometry),e.add(t.material))});for(const t of e)t.dispose()}}function ki(i){const e=new Tn;return e.color.setScalar(i),e}class Ec extends Nt{constructor(e=document.createElement("div")){super(),this.isCSS2DObject=!0,this.element=e,this.element.style.position="absolute",this.element.style.userSelect="none",this.element.setAttribute("draggable",!1),this.center=new Z(.5,.5),this.addEventListener("removed",function(){this.traverse(function(t){t.element instanceof t.element.ownerDocument.defaultView.Element&&t.element.parentNode!==null&&t.element.remove()})})}copy(e,t){return super.copy(e,t),this.element=e.element.cloneNode(!0),this.center=e.center,this}}const Fi=new E,Ac=new ht,Cc=new ht,Rc=new E,Pc=new E;class k0{constructor(e={}){const t=this;let n,s,r,a;const o={objects:new WeakMap},l=e.element!==void 0?e.element:document.createElement("div");l.style.overflow="hidden",this.domElement=l,this.getSize=function(){return{width:n,height:s}},this.render=function(g,v){g.matrixWorldAutoUpdate===!0&&g.updateMatrixWorld(),v.parent===null&&v.matrixWorldAutoUpdate===!0&&v.updateMatrixWorld(),Ac.copy(v.matrixWorldInverse),Cc.multiplyMatrices(v.projectionMatrix,Ac),h(g,g,v),p(g)},this.setSize=function(g,v){n=g,s=v,r=n/2,a=s/2,l.style.width=g+"px",l.style.height=v+"px"};function c(g){g.isCSS2DObject&&(g.element.style.display="none");for(let v=0,m=g.children.length;v<m;v++)c(g.children[v])}function h(g,v,m){if(g.visible===!1){c(g);return}if(g.isCSS2DObject){Fi.setFromMatrixPosition(g.matrixWorld),Fi.applyMatrix4(Cc);const f=Fi.z>=-1&&Fi.z<=1&&g.layers.test(m.layers)===!0,S=g.element;S.style.display=f===!0?"":"none",f===!0&&(g.onBeforeRender(t,v,m),S.style.transform="translate("+-100*g.center.x+"%,"+-100*g.center.y+"%)translate("+(Fi.x*r+r)+"px,"+(-Fi.y*a+a)+"px)",S.parentNode!==l&&l.appendChild(S),g.onAfterRender(t,v,m));const y={distanceToCameraSquared:u(m,g)};o.objects.set(g,y)}for(let f=0,S=g.children.length;f<S;f++)h(g.children[f],v,m)}function u(g,v){return Rc.setFromMatrixPosition(g.matrixWorld),Pc.setFromMatrixPosition(v.matrixWorld),Rc.distanceToSquared(Pc)}function d(g){const v=[];return g.traverseVisible(function(m){m.isCSS2DObject&&v.push(m)}),v}function p(g){const v=d(g).sort(function(f,S){if(f.renderOrder!==S.renderOrder)return S.renderOrder-f.renderOrder;const y=o.objects.get(f).distanceToCameraSquared,_=o.objects.get(S).distanceToCameraSquared;return y-_}),m=v.length;for(let f=0,S=v.length;f<S;f++)v[f].element.style.zIndex=m-f}}}const Yh={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class ls{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const F0=new Bo(-1,1,1,-1,0,1);class B0 extends Xt{constructor(){super(),this.setAttribute("position",new at([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new at([0,2,0,0,2,0],2))}}const H0=new B0;class Jo{constructor(e){this._mesh=new ke(H0,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,F0)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class z0 extends ls{constructor(e,t){super(),this.textureID=t!==void 0?t:"tDiffuse",e instanceof Vt?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=Ls.clone(e.uniforms),this.material=new Vt({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this.fsQuad=new Jo(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this.fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}class Dc extends ls{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){const s=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(s.REPLACE,s.REPLACE,s.REPLACE),r.buffers.stencil.setFunc(s.ALWAYS,a,4294967295),r.buffers.stencil.setClear(o),r.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(s.EQUAL,1,4294967295),r.buffers.stencil.setOp(s.KEEP,s.KEEP,s.KEEP),r.buffers.stencil.setLocked(!0)}}class G0 extends ls{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class V0{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){const n=e.getSize(new Z);this._width=n.width,this._height=n.height,t=new vn(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:Hn}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new z0(Yh),this.copyPass.material.blending=Bn,this.clock=new $h}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const t=this.renderer.getRenderTarget();let n=!1;for(let s=0,r=this.passes.length;s<r;s++){const a=this.passes[s];if(a.enabled!==!1){if(a.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(s),a.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),a.needsSwap){if(n){const o=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}Dc!==void 0&&(a instanceof Dc?n=!0:a instanceof G0&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){const t=this.renderer.getSize(new Z);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;const n=this._width*this._pixelRatio,s=this._height*this._pixelRatio;this.renderTarget1.setSize(n,s),this.renderTarget2.setSize(n,s);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(n,s)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class W0 extends ls{constructor(e,t,n=null,s=null,r=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=s,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new Ge}render(e,t,n){const s=e.autoClear;e.autoClear=!1;let r,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=s}}const $0={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Ge(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class rs extends ls{constructor(e,t,n,s){super(),this.strength=t!==void 0?t:1,this.radius=n,this.threshold=s,this.resolution=e!==void 0?new Z(e.x,e.y):new Z(256,256),this.clearColor=new Ge(0,0,0),this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new vn(r,a,{type:Hn}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let u=0;u<this.nMips;u++){const d=new vn(r,a,{type:Hn});d.texture.name="UnrealBloomPass.h"+u,d.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(d);const p=new vn(r,a,{type:Hn});p.texture.name="UnrealBloomPass.v"+u,p.texture.generateMipmaps=!1,this.renderTargetsVertical.push(p),r=Math.round(r/2),a=Math.round(a/2)}const o=$0;this.highPassUniforms=Ls.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=s,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new Vt({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];const l=[3,5,7,9,11];r=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let u=0;u<this.nMips;u++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(l[u])),this.separableBlurMaterials[u].uniforms.invSize.value=new Z(1/r,1/a),r=Math.round(r/2),a=Math.round(a/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;const c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new E(1,1,1),new E(1,1,1),new E(1,1,1),new E(1,1,1),new E(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors;const h=Yh;this.copyUniforms=Ls.clone(h.uniforms),this.blendMaterial=new Vt({uniforms:this.copyUniforms,vertexShader:h.vertexShader,fragmentShader:h.fragmentShader,blending:Ma,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new Ge,this.oldClearAlpha=1,this.basic=new Tn,this.fsQuad=new Jo(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this.basic.dispose(),this.fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),s=Math.round(t/2);this.renderTargetBright.setSize(n,s);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(n,s),this.renderTargetsVertical[r].setSize(n,s),this.separableBlurMaterials[r].uniforms.invSize.value=new Z(1/n,1/s),n=Math.round(n/2),s=Math.round(s/2)}render(e,t,n,s,r){e.getClearColor(this._oldClearColor),this.oldClearAlpha=e.getClearAlpha();const a=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),r&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=n.texture,e.setRenderTarget(null),e.clear(),this.fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this.fsQuad.render(e);let o=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this.fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[l].uniforms.direction.value=rs.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this.fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=rs.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this.fsQuad.render(e),o=this.renderTargetsVertical[l];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this.fsQuad.render(e),this.fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(n),this.fsQuad.render(e)),e.setClearColor(this._oldClearColor,this.oldClearAlpha),e.autoClear=a}getSeperableBlurMaterial(e){const t=[];for(let n=0;n<e;n++)t.push(.39894*Math.exp(-.5*n*n/(e*e))/e);return new Vt({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new Z(.5,.5)},direction:{value:new Z(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}getCompositeMaterial(e){return new Vt({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}rs.BlurDirectionX=new Z(1,0);rs.BlurDirectionY=new Z(0,1);const X0={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`
	
		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class q0 extends ls{constructor(){super();const e=X0;this.uniforms=Ls.clone(e.uniforms),this.material=new c0({name:e.name,uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader}),this.fsQuad=new Jo(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},Je.getTransfer(this._outputColorSpace)===rt&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===nh?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===ih?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===sh?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===Ao?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===rh?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===ah&&(this.material.defines.NEUTRAL_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}const vs=new E;function sn(i,e,t,n,s,r){const a=2*Math.PI*s/4,o=Math.max(r-2*s,0),l=Math.PI/4;vs.copy(e),vs[n]=0,vs.normalize();const c=.5*a/(a+o),h=1-vs.angleTo(i)/l;return Math.sign(vs[t])===1?h*c:o/(a+o)+c+c*(1-h)}class Lt extends mt{constructor(e=1,t=1,n=1,s=2,r=.1){if(s=s*2+1,r=Math.min(e/2,t/2,n/2,r),super(1,1,1,s,s,s),s===1)return;const a=this.toNonIndexed();this.index=null,this.attributes.position=a.attributes.position,this.attributes.normal=a.attributes.normal,this.attributes.uv=a.attributes.uv;const o=new E,l=new E,c=new E(e,t,n).divideScalar(2).subScalar(r),h=this.attributes.position.array,u=this.attributes.normal.array,d=this.attributes.uv.array,p=h.length/6,g=new E,v=.5/s;for(let m=0,f=0;m<h.length;m+=3,f+=2)switch(o.fromArray(h,m),l.copy(o),l.x-=Math.sign(l.x)*v,l.y-=Math.sign(l.y)*v,l.z-=Math.sign(l.z)*v,l.normalize(),h[m+0]=c.x*Math.sign(o.x)+l.x*r,h[m+1]=c.y*Math.sign(o.y)+l.y*r,h[m+2]=c.z*Math.sign(o.z)+l.z*r,u[m+0]=l.x,u[m+1]=l.y,u[m+2]=l.z,Math.floor(m/p)){case 0:g.set(1,0,0),d[f+0]=sn(g,l,"z","y",r,n),d[f+1]=1-sn(g,l,"y","z",r,t);break;case 1:g.set(-1,0,0),d[f+0]=1-sn(g,l,"z","y",r,n),d[f+1]=1-sn(g,l,"y","z",r,t);break;case 2:g.set(0,1,0),d[f+0]=1-sn(g,l,"x","z",r,e),d[f+1]=sn(g,l,"z","x",r,n);break;case 3:g.set(0,-1,0),d[f+0]=1-sn(g,l,"x","z",r,e),d[f+1]=1-sn(g,l,"z","x",r,n);break;case 4:g.set(0,0,1),d[f+0]=1-sn(g,l,"x","y",r,e),d[f+1]=1-sn(g,l,"y","x",r,t);break;case 5:g.set(0,0,-1),d[f+0]=sn(g,l,"x","y",r,e),d[f+1]=1-sn(g,l,"y","x",r,t);break}}}const We={base:"#4f5490",top:"#5f65a2",plot:"#e9ebf7",white:"#f4f4fb",trim:"#e1e4f4",window:"#7d95e0",dome:"#6f8ce0",domeLight:"#86a2ea",tree:"#5fae5b",trunk:"#8a6a4a",country:"#f2b64a",network:"#45d6c2",who:"#6f9cf0",github:"#b39cf5",paper:"#f39a4a",red:"#ff5a5f",green:"#4fe0a0"},Be=(i,e={})=>new Us({color:i,roughness:.55,metalness:0,...e}),xt=(i,e=2.2)=>new Tn({color:new Ge(i).multiplyScalar(e),toneMapped:!1});function ce(i,e,t,n=0,s=0,r=0,a=!0){const o=new ke(e,t);return o.position.set(n,s,r),o.castShadow=a,o.receiveShadow=!0,i.add(o),o}function Kt(i,e,t,n=1,s=.32){ce(i,new yt(.06*n,.08*n,.35*n,8),Be(We.trunk),e,s+.17*n,t),ce(i,new At(.32*n,20,16),Be(We.tree,{roughness:.7}),e,s+.62*n,t).scale.set(1,1.35,1)}function Kh(i,e=512,t=128,n="#dfe8ff",s="#3953a8"){const r=document.createElement("canvas");r.width=e,r.height=t;const a=r.getContext("2d");a.fillStyle=n,a.beginPath(),a.roundRect(4,4,e-8,t-8,24),a.fill(),a.strokeStyle="#ffffff",a.lineWidth=8,a.stroke(),a.fillStyle=s,a.font=`800 ${Math.floor(t*.5)}px system-ui, Helvetica, Arial`,a.textAlign="center",a.textBaseline="middle",a.fillText(i,e/2,t/2+3);const o=new zo(r);return o.colorSpace=Gt,o.anisotropy=8,o}function vo(i,e,t,n,s,r=We.dome){const a=new ct;a.position.set(t,n,s),i.add(a),ce(a,new At(e,48,24,0,Math.PI*2,0,Math.PI/2),Be(r,{roughness:.35}));const o=Be("#e2e8ff",{roughness:.4});for(let l=0;l<4;l++){const c=ce(a,new jt(e*1.005,e*.022,6,48,Math.PI),o);c.rotation.y=l*Math.PI/4}for(const l of[.35,.8]){const c=ce(a,new jt(e*Math.cos(l)*1.005,e*.022,6,48),o,0,e*Math.sin(l),0);c.rotation.x=Math.PI/2}return a}function Y0(i,e,t,n=8,s=.45){const r=[],a=i/2-t,o=e/2-t,l=[[a,o,0],[-a,o,Math.PI/2],[-a,-o,Math.PI],[a,-o,3*Math.PI/2]],c=(d,p)=>{const g=Math.max(1,Math.round(d.distanceTo(p)/s));for(let v=1;v<g;v++)r.push(d.clone().lerp(p,v/g))};let h=null,u=null;for(const[d,p,g]of l){const v=new E(d+Math.cos(g)*t,0,p+Math.sin(g)*t);h?c(h,v):u=v;for(let m=0;m<=n;m++){const f=g+m/n*(Math.PI/2);r.push(new E(d+Math.cos(f)*t,0,p+Math.sin(f)*t))}h=r[r.length-1]}return h&&u&&c(h,u),r}function ga(i,e,t,n,s,r){const a=new ct;a.position.set(e,0,t),i.add(a),ce(a,new Lt(n,.9,s,6,.6),Be(We.base),0,-.35,0),ce(a,new Lt(n-.3,.2,s-.3,4,.12),Be(We.top),0,.12,0);const o=Y0(n-.9,s-.9,.9),l=xt(r,2),c=new mt(1,.07,.09);for(let h=0;h<o.length;h+=2){const u=o[h],d=o[(h+1)%o.length],p=new ke(c,l);p.position.set((u.x+d.x)/2,.25,(u.z+d.z)/2),p.scale.x=Math.max(.05,u.distanceTo(d)),p.rotation.y=-Math.atan2(d.z-u.z,d.x-u.x),a.add(p)}return{group:a,dashMat:l}}function K0(i,e,t,n,s){return ce(i,new Lt(n,.1,s,3,.05),Be(We.plot),e,.27,t)}function j0(){const i=new ct,e=new ct;e.position.set(0,.1,-.4),i.add(e);const t=Be(We.white),n=Be(We.trim),s=Be(We.window,{roughness:.3});ce(e,new Lt(4,1.4,2.4,3,.06),t,0,.92,0),ce(e,new Lt(4.2,.15,2.6,2,.04),n,0,1.69,0);for(let o=0;o<6;o++)ce(e,new yt(.1,.11,1.2,16),t,-1+o*.4,.82,1.5);ce(e,new mt(2.6,.22,.6),n,0,1.53,1.45);const r=new ke(new ni(2.4,.18),new Tn({map:jh("XC")}));r.position.set(0,1.53,1.751),e.add(r),i.userData.sign=r;const a=new qo;a.moveTo(-1.35,0),a.lineTo(1.35,0),a.lineTo(0,.5),a.closePath(),ce(e,new Ir(a,{depth:.55,bevelEnabled:!1}),t,0,1.64,1.2),ce(e,new mt(2.8,.08,.35),n,0,.26,1.95),ce(e,new mt(2.6,.08,.3),n,0,.34,1.75);for(const o of[-1.75,-1.4,1.4,1.75])for(const l of[.65,1.2])ce(e,new mt(.2,.3,.03),s,o,l,1.21,!1);for(const o of[-.8,-.27,.27,.8])for(const l of[.65,1.2])ce(e,new mt(.03,.3,.2),s,2.01,l,o,!1),ce(e,new mt(.03,.3,.2),s,-2.01,l,o,!1);return ce(e,new yt(.5,.5,.3,32),t,0,1.9,0),vo(e,.48,0,2.05,0),ce(e,new yt(.02,.02,.7,8),Be("#9aa0c8"),0,2.85,0),ce(e,new mt(.32,.2,.01),Be("#f2b64a"),.17,3.08,0),Kt(i,-2.6,1.6,.8),Kt(i,2.6,1.6,.8),i}const jh=i=>Kh(i?`MINISTRY OF HEALTH · ${i}`:"MINISTRY OF HEALTH",1024,80,"#e1e4f4","#3d4a8a");function Z0(){const i=new ct,e=Be("#dfe2f6",{roughness:.4}),t=[We.network,"#8fb4ff","#7cf0b0"];[[-1.9,-.3],[-.7,-.5],[.5,-.3]].forEach(([r,a],o)=>{ce(i,new Lt(1,1.8,1,3,.12),e,r,1.22,a);for(let l=0;l<4;l++)ce(i,new mt(.6,.06,.02),xt(t[(o+l)%3],1.7),r,.65+l*.38,a+.51,!1)});const n=new ct;n.position.set(2.1,0,.1),i.add(n),ce(n,new Lt(1.3,1.4,1.2,4,.16),Be("#3a3f72",{roughness:.35}),0,1.02,0);const s=ce(n,new jt(.36,.05,12,48),xt(We.country,2.2),0,1.02,.61,!1);s.rotation.z=Math.PI/4;for(let r=0;r<3;r++){const a=ce(n,new mt(.5,.05,.04),Be("#c9cdea"),0,1.02,.63,!1);a.rotation.z=r*Math.PI/3}return ce(n,new yt(.75,.75,.06,40),Be("#2f335f"),0,.33,0),i}function J0(){const i=new ct;ce(i,new yt(1.3,1.3,1.2,48),Be("#e9ecfb"),0,.92,-.3),ce(i,new yt(1.33,1.33,.16,48,1,!0),xt(We.network,1.8),0,1,-.3,!1),ce(i,new yt(1.36,1.36,.12,48),Be("#dfe3f7"),0,1.54,-.3),vo(i,1.25,0,1.6,-.3);for(const[n,s,r]of[[-2.1,.4,.85],[2.1,.2,.8]])ce(i,new yt(r,r,.55,40),Be("#e9ecfb"),n,.6,s),ce(i,new yt(r+.03,r+.03,.12,40,1,!0),xt(We.network,1.6),n,.65,s,!1),vo(i,r*.95,n,.88,s,We.domeLight);const e=ce(i,new mt(1.5,.55,.1),Be("#ffffff"),0,.72,1.45),t=new ke(new ni(1.4,.45),new Tn({map:Kh("WHO")}));return t.position.z=.051,e.add(t),Kt(i,-2.6,-1.3,.9),Kt(i,2.7,-1.2,.8),i}function Q0(){const i=new ct;ce(i,new Lt(2.4,1.5,1.8,3,.1),Be(We.white),-1.4,1.07,-.2),ce(i,new Lt(2.6,.14,2,2,.05),Be(We.trim),-1.4,1.88,-.2);for(const s of[-2.1,-1.4,-.7])ce(i,new mt(.45,.32,.03),xt("#8fb4ff",1.4),s,1.15,.71,!1);const e=new ct;e.position.set(1.3,0,0),i.add(e),ce(e,new yt(1.25,1.25,.08,48),Be("#2f335f"),0,.36,0);const t=new ke(new Lt(2,1.7,2,4,.14),new mo({color:"#dfe8ff",roughness:.08,transmission:.7,thickness:.4,transparent:!0,opacity:.55}));t.position.y=1.25,e.add(t),ce(e,new yt(.22,.3,.6,24),Be("#e9ecfb"),0,.7,0);const n=ce(e,new Yo(.32,0),xt("#7fb0ff",2.4),0,1.4,0,!1);return ce(e,new Lt(.6,.6,.6,3,.08),Be("#3a3f72"),1.55,.62,.55),ce(e,new jt(.15,.03,8,32),xt("#7fb0ff",2),1.55,.62,.86,!1),{group:i,anchor:n}}function Lc(i,e){const t=new ct;ce(t,new yt(1.35*i,1.45*i,.35,64),Be("#e9ecfb"),0,.5,0);const n=ce(t,new jt(1.08*i,.07,16,96),xt(e,2.4),0,.7,0,!1);n.rotation.x=Math.PI/2,ce(t,new yt(1*i,1*i,.06,64),Be("#f7f8ff"),0,.68,0);for(let u=0;u<4;u++){const d=u/4*Math.PI*2+Math.PI/4,p=Math.cos(d)*1.75*i,g=Math.sin(d)*1.75*i;ce(t,new Lt(.42,.9,.42,2,.08),Be("#dfe2f6"),p,.77,g),ce(t,new mt(.3,.05,.02),xt(e,1.8),p,.95,g+.22,!1)}const s=new ct;s.position.set(0,2.3,0),t.add(s);const r=new qo;for(let u=0;u<=120;u++){const d=u/120*Math.PI*2,p=.62+.05*Math.cos(12*d);u?r.lineTo(Math.cos(d)*p,Math.sin(d)*p):r.moveTo(Math.cos(d)*p,Math.sin(d)*p)}const a=new Ir(r,{depth:.14,bevelEnabled:!0,bevelThickness:.04,bevelSize:.04,bevelSegments:4});a.center(),ce(s,a,Be("#5f7fe0",{roughness:.3}));const o=ce(s,new yt(.44,.44,.2,48),Be("#8ff0dc",{emissive:"#4fd8bf",emissiveIntensity:.5,roughness:.3}));o.rotation.x=Math.PI/2;const l=Be("#ffffff",{emissive:"#ffffff",emissiveIntensity:.3}),c=ce(s,new Ar(.05,.14,4,12),l,-.13,-.07,.12);c.rotation.z=Math.PI/4;const h=ce(s,new Ar(.05,.36,4,12),l,.08,.01,.12);return h.rotation.z=-.75,s.scale.setScalar(i),{group:t,ring:n,badge:s}}function e_(i){const e=new ct,t=10;for(let s=0;s<t;s++){const r=s/t*Math.PI*2;ce(e,new yt(.06,.08,.7,12),Be("#e9ecfb"),Math.cos(r)*i,.67,Math.sin(r)*i),ce(e,new At(.09,12,12),xt(We.red,2),Math.cos(r)*i,1.05,Math.sin(r)*i,!1)}const n=ce(e,new jt(i,.035,8,96),xt(We.red,1.8),0,.95,0,!1);return n.rotation.x=Math.PI/2,e}function t_(){const i=new ct,e=Be("#a9b2ee",{roughness:.35});for(const[t,n]of[[-1,0],[1,0]])for(let s=0;s<3;s++)ce(i,new Lt(1.2,.42,1.2,3,.14),e,t,.57+s*.5,n),s<2&&ce(i,new mt(1,.05,1),xt(We.github,1.8),t,.82+s*.5,n,!1);return i}function n_(){const i=document.createElement("canvas");i.width=700,i.height=400;const e=i.getContext("2d");e.fillStyle="#141833",e.fillRect(0,0,700,400),e.fillStyle="#8f9bd0",e.font="800 34px system-ui, Helvetica, Arial",e.fillText("CERTIFICATE EXPIRY",36,62),["DEV","UAT","PROD"].forEach((s,r)=>{e.fillStyle=r===2?"#2f5fb4":"#22284a",e.beginPath(),e.roundRect(450+r*72,34,64,34,8),e.fill(),e.fillStyle=r===2?"#ffffff":"#8f9bd0",e.font="700 20px system-ui, Helvetica, Arial",e.fillText(s,462+r*72+(s==="PROD"?-4:2),58)}),[["SCA",.75,We.green],["DSC",.4,We.green],["TLS",.23,We.green],["UPLOAD",.04,We.red]].forEach(([s,r,a],o)=>{const l=120+o*66;e.fillStyle="#d6ddff",e.font="700 26px system-ui, Helvetica, Arial",e.fillText(s,36,l+22),e.fillStyle="#22284a",e.beginPath(),e.roundRect(180,l,480,28,14),e.fill(),e.fillStyle=a,e.beginPath(),e.roundRect(180,l,Math.max(28,480*r),28,14),e.fill()});const n=new zo(i);return n.colorSpace=Gt,n.anisotropy=8,n}function i_(){const i=new ct;ce(i,new yt(.9,1,.12,40),Be("#2f335f"),0,.38,0),ce(i,new yt(.1,.12,1.2,16),Be("#c9cdea"),0,1,-.1);const e=new ct;e.position.set(0,2.05,0),e.rotation.x=-.3,i.add(e),ce(e,new Lt(3,1.8,.14,3,.06),Be("#3a3f72",{roughness:.35}));const t=new ke(new ni(2.8,1.6),new Tn({map:n_(),toneMapped:!1}));return t.position.z=.071,e.add(t),ce(e,new mt(2.9,.05,.02),xt(We.who,1.8),0,-.93,.07,!1),i}function s_(i=!1,e={}){const t=new ct,n=Be("#e8a35c",{roughness:.8}),s=Be("#fff3e3",{roughness:.8}),r=Be("#f2a7b0");if(i){ce(t,new At(.16,20,14),n,0,.09,0).scale.set(1.35,.6,1),ce(t,new At(.095,18,12),n,.17,.08,.06).scale.set(1,.85,1);for(const c of[-1,1]){const h=ce(t,new Zi(.035,.07,8),n,.2,.15,.06+c*.05);h.rotation.z=-.5}const l=ce(t,new jt(.17,.028,8,24,Math.PI*1.1),n,0,.05,0);l.rotation.x=Math.PI/2,l.rotation.z=.4}else{if(ce(t,new At(.15,20,14),n,0,.15,0).scale.set(1,1.15,.85),ce(t,new At(.08,14,10),s,0,.17,.09),ce(t,new At(.105,18,12),n,0,.35,.04),e.bandit){const l=Be("#17171c",{roughness:.7}),c=Be("#fffbe8",{roughness:.4});ce(t,new At(.109,20,8,Math.PI/2-1.75,3.5,1.28,.6),l,0,.35,.04,!1);for(const h of[-1,1])ce(t,new At(.02,12,8),c,h*.04,.36,.142,!1).scale.set(1,1.15,.5)}for(const l of[-1,1])ce(t,new Zi(.04,.08,8),n,l*.06,.45,.04),ce(t,new Zi(.022,.045,8),r,l*.06,.445,.055);const o=ce(t,new jt(.12,.025,8,20,Math.PI),n,-.12,.08,-.04);o.rotation.y=Math.PI/2}return t}class r_{constructor(e=.5){xe(this,"group",new ct);xe(this,"body",new ct);xe(this,"eyeCanvas",document.createElement("canvas"));xe(this,"eyeTex");xe(this,"arms",[]);xe(this,"ring");xe(this,"tip");xe(this,"beam");xe(this,"mood","idle");xe(this,"moodT",0);xe(this,"nextBlink",2);xe(this,"blinkT",-1);xe(this,"path",null);const s=new mo({color:"#f7f8fc",roughness:.18,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:.55});this.group.add(this.body),this.body.scale.setScalar(e);const r=new At(1,64,48),a=r.attributes.position;for(let S=0;S<a.count;S++){const y=a.getY(S);if(y<0){const _=1+y*.42;a.setX(S,a.getX(S)*_),a.setZ(S,a.getZ(S)*_)}}r.computeVertexNormals();const o=new ke(r,s);o.scale.set(.82,1.12,.82),o.castShadow=!0,this.body.add(o);const l=new ke(new jt(.82*.995,.012,8,96),xt("#62e6d2",1.6));l.rotation.x=Math.PI/2,l.position.y=-.05,this.body.add(l),this.eyeCanvas.width=1024,this.eyeCanvas.height=384,this.eyeTex=new zo(this.eyeCanvas),this.eyeTex.colorSpace=Gt;const c=2.1,h=new ke(new At(1,64,32,Math.PI/2-c/2,c,.62,.66),new mo({color:"#0b1026",roughness:.3,clearcoat:.7,clearcoatRoughness:.12,emissive:"#ffffff",emissiveMap:this.eyeTex,emissiveIntensity:2.6,envMapIntensity:.08}));h.scale.set(.82*1.012,1.12*1.012,.82*1.012),this.body.add(h);const u=new ke(new yt(.018,.018,.32,12),s);u.position.y=1.12+.12,this.body.add(u),this.tip=new ke(new At(.07,20,20),xt("#62e6d2",2.4)),this.tip.position.y=1.12+.31,this.body.add(this.tip);const d=new ct;this.body.add(d);const p=xt("#62e6d2",2);d.add(new ke(new jt(.075,.018,10,32),p));const g=new ke(new mt(.16,.03,.02),p);g.position.x=.15,d.add(g);const v=new ke(new mt(.03,.06,.02),p);v.position.set(.2,-.035,0),d.add(v),d.position.set(-.05,-.38,.82*.83),d.rotation.x=-.32;const m=new At(.22,32,24);for(const S of[-1,1]){const y=new ct;y.position.set(S*(.82+.08),0,0),this.body.add(y);const _=new ke(m,s);_.scale.set(.45,1.9,.75),_.position.y=-.3,y.add(_),y.userData.s=S,this.arms.push(y)}this.ring=new ke(new jt(.34,.025,12,64),xt("#62e6d2",2.2)),this.ring.rotation.x=Math.PI/2,this.ring.position.y=-1.6,this.body.add(this.ring);const f=new Zi(.55,1.7,48,1,!0);f.translate(0,-.85,0),this.beam=new ke(f,new Tn({color:"#79e8ff",transparent:!0,opacity:.18,side:bn,depthWrite:!1})),this.beam.rotation.x=-.6,this.beam.position.set(0,-.2,.82+.3),this.body.add(this.beam),this.drawEyes()}setMood(e){this.mood=e,this.moodT=0,this.drawEyes()}cancel(){const e=this.path;e&&(this.path=null,this.group.position.copy(e.curve.getPointAt(1)),this.group.rotation.y=0,e.done())}flyAlong(e,t=6){const n=new Wo(e,!1,"centripetal"),s=Math.max(1.2,n.getLength()/t);return new Promise(r=>{this.path={curve:n,u:0,dur:s,done:r}})}update(e,t){if(this.moodT+=t,this.path){const a=this.path;a.u=Math.min(1,a.u+t/a.dur);const o=a.u<.5?2*a.u*a.u:1-Math.pow(-2*a.u+2,2)/2,l=a.curve.getPointAt(o),c=a.curve.getPointAt(Math.min(1,o+.01));this.group.position.copy(l),c.distanceToSquared(l)>1e-6&&(this.group.rotation.y=Math.atan2(c.x-l.x,c.z-l.z)),a.u>=1&&(this.path=null,this.group.rotation.y=0,a.done())}const n=Math.sin(e*1.6)*.06,s=this.mood==="happy"?Math.abs(Math.sin(this.moodT*6))*.12*Math.max(0,1-this.moodT/1.5):0;this.body.position.y=n+s,this.body.position.x=this.mood==="error"&&this.moodT<.8?Math.sin(this.moodT*40)*.04*(1-this.moodT/.8):0,this.body.rotation.y=this.mood==="happy"&&this.moodT<1.2?this.moodT/1.2*Math.PI*2:0,this.body.rotation.z=Math.sin(e*1.1)*.04;for(const a of this.arms){const o=a.userData.s;a.rotation.z=o*(.18+Math.sin(e*1.6+o)*.08+(this.mood==="happy"?.6:0))}const r=this.mood==="error"?"#ff5a5f":this.mood==="happy"?"#7cf0b0":"#62e6d2";this.ring.material.color.set(r).multiplyScalar(1.8+Math.sin(e*3)*.4),this.tip.material.color.copy(this.ring.material.color),this.beam.visible=this.mood==="checking",this.beam.visible&&(this.beam.rotation.y=Math.sin(e*2.2)*.3),e>this.nextBlink&&this.blinkT<0&&this.mood!=="checking"&&(this.blinkT=0,this.drawEyes(!0)),this.blinkT>=0&&(this.blinkT+=t,this.blinkT>.13&&(this.blinkT=-1,this.nextBlink=e+2.5+Math.random()*2.5,this.drawEyes()))}drawEyes(e=!1){const t=this.eyeCanvas.getContext("2d"),n=this.eyeCanvas.width,s=this.eyeCanvas.height;t.clearRect(0,0,n,s),t.fillStyle="#000",t.fillRect(0,0,n,s);const r={idle:"#79e8ff",happy:"#7cf0b0",checking:"#79e8ff",error:"#ff5a5f"}[this.mood];t.fillStyle=r,t.strokeStyle=r,t.shadowColor=r,t.shadowBlur=28,t.lineCap="round",t.lineWidth=40;const a=s/2+6;for(const o of[n/2-150,n/2+150]){if(t.beginPath(),e){t.moveTo(o-65,a),t.lineTo(o+65,a),t.stroke();continue}if(this.mood==="happy")t.arc(o,a+60,90,Math.PI*1.1,Math.PI*1.9),t.stroke();else if(this.mood==="checking")t.roundRect(o-80,a-28,160,56,28),t.fill();else if(this.mood==="error"){const l=o<n/2?1:-1;t.moveTo(o-60*l,a-70),t.lineTo(o+50*l,a),t.lineTo(o-60*l,a+70),t.stroke()}else t.roundRect(o-62,a-120,124,240,60),t.fill()}this.eyeTex.needsUpdate=!0}}function Nc(i){i.dataset.tip="github",i.tabIndex=0,i.classList.add("has-tip")}const un=-.74,va=i=>i.map(([e,t,n])=>[-e,t,n]);class a_{constructor(e){xe(this,"places",{});xe(this,"bot",new r_(.5));xe(this,"renderer");xe(this,"labels");xe(this,"composer");xe(this,"scene",new Oh);xe(this,"camera");xe(this,"controls");xe(this,"routes",{});xe(this,"flashing",new Map);xe(this,"fly",null);xe(this,"parcels",[]);xe(this,"countryLabel");xe(this,"ministrySignMesh");xe(this,"timeScale",1);xe(this,"clock",new $h);xe(this,"home",{pos:new E,target:new E(0,0,1.8)});xe(this,"marker");xe(this,"prodBarrier");xe(this,"badges",[]);xe(this,"gatewayRings",[]);xe(this,"anchor");xe(this,"onPlaceClick",null);xe(this,"onCatClick",null);xe(this,"cats",new Map);xe(this,"lastView",{where:"home",opts:{}});xe(this,"loop",()=>{var r;const e=Math.min(this.clock.getDelta(),.25)*this.timeScale,t=this.clock.elapsedTime;for(const a of this.badges)a.position.y=2.3+Math.sin(t*1.4)*.12,a.rotation.y=Math.sin(t*.6)*.35;for(const a of this.gatewayRings){const o=a.userData.flash,l=(r=a.userData).base??(r.base=a.material.color.clone());a.material.color.copy(o&&t<o.until?o.color:l).multiplyScalar(.85+.15*Math.sin(t*2))}const n=this.anchor.userData.pulseUntil??0;this.anchor.rotation.y=t*(t<n?3:.6),this.anchor.position.y=1.4+Math.sin(t*1.3)*.06;const s=new Ge(We.red).multiplyScalar(2.6);for(const[a,o]of Object.entries(this.routes)){const l=this.flashing.get(a)??0;o.mat.color.copy(t<l?s.clone().multiplyScalar(.7+.3*Math.sin(t*10)):o.base);for(const c of o.dots)c.m.position.copy(o.curve.getPointAt((t*.06+c.off)%1))}if(this.marker.visible&&(this.marker.scale.setScalar(1+Math.sin(t*2.4)*.03),this.marker.material.opacity=1),this.parcels=this.parcels.filter(a=>a.update(e)),this.bot.update(t,e),this.fly){const a=this.fly;a.u=Math.min(a.u+e/a.dur,1);const o=a.u<.5?4*a.u**3:1-Math.pow(-2*a.u+2,3)/2;this.camera.position.lerpVectors(a.p0,a.p1,o),this.controls.target.lerpVectors(a.t0,a.t1,o),a.u>=1&&(this.fly=null,a.done())}this.controls.update(),this.clampView(),this.composer.render(),this.labels.render(this.scene,this.camera),requestAnimationFrame(this.loop)});this.renderer=new Lv({antialias:!0}),this.renderer.setPixelRatio(Math.min(devicePixelRatio,2)),this.renderer.setSize(innerWidth,innerHeight),this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=eh,this.renderer.toneMapping=Ao,this.renderer.toneMappingExposure=1.2,e.appendChild(this.renderer.domElement),this.labels=new k0,this.labels.setSize(innerWidth,innerHeight),Object.assign(this.labels.domElement.style,{position:"fixed",inset:"0",pointerEvents:"none"}),e.appendChild(this.labels.domElement),this.scene.background=new Ge("#eceef7");const n=new co(this.renderer).fromScene(new U0,.04).texture;this.bot.group.traverse(a=>{const o=a.material;o&&"envMap"in o&&(o.envMap=n)}),this.camera=new en(30,innerWidth/innerHeight,.1,400),this.fitHome(),this.camera.position.copy(this.home.pos),this.controls=new M0(this.camera,this.renderer.domElement),this.controls.target.copy(this.home.target),this.controls.enableDamping=!0,this.controls.maxPolarAngle=1.25,this.controls.enablePan=!0,this.controls.keyPanSpeed=20,this.renderer.domElement.tabIndex=0,this.renderer.domElement.style.outline="none",this.controls.listenToKeyEvents(this.renderer.domElement),this.controls.minDistance=6,this.controls.maxDistance=90,this.controls.screenSpacePanning=!1,this.scene.add(new h0("#ffffff","#aeb3dc",1.1));const s=new p0("#ffffff",1.5);s.position.set(-12,30,14),s.castShadow=!0,s.shadow.mapSize.set(2048,2048),Object.assign(s.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:90}),s.shadow.radius=8,s.shadow.bias=-4e-4,this.scene.add(s);const r=new ke(new ni(600,600),new Us({color:"#f1f2fa",roughness:1}));r.rotation.x=-Math.PI/2,r.position.y=-.8,r.receiveShadow=!0,this.scene.add(r),this.buildWorld(),this.buildRoutes(),this.hideCats(),this.marker=new ke(new jt(3.1,.06,12,128),xt("#ffffff",1.6)),this.marker.rotation.x=Math.PI/2,this.marker.visible=!1,this.scene.add(this.marker),this.prodBarrier=e_(2.6),this.prodBarrier.position.copy(this.places.prod.pos).setY(0),this.scene.add(this.prodBarrier),this.bot.group.position.copy(this.places.ops.pos).add(new E(0,2.4,1.8)),this.scene.add(this.bot.group),this.composer=new V0(this.renderer),this.composer.addPass(new W0(this.scene,this.camera)),this.composer.addPass(new rs(new Z(innerWidth,innerHeight),.6,.35,1)),this.composer.addPass(new q0),this.bindPointer(),addEventListener("resize",()=>this.resize()),this.loop()}label(e,t,n,s,r,a="w-label"){const o=document.createElement("div");o.className=a,o.textContent=t;const l=new Ec(o);return l.position.set(n,s,r),e.add(l),o}place(e,t,n,s,r,a,o){a.position.set(s,0,r),o.add(a),this.places[e]={pos:new E(s,0,r),name:t,blurb:n,group:a};const l=e==="uat"||e==="prod",c=this.label(this.scene,t,s+(l?2.6:0),l?1.4:3.6,r);e==="github"&&Nc(c)}buildWorld(){const e=this.scene;ga(e,-10,0,9,15,We.country),ga(e,0,0,8,13,We.network),ga(e,10,0,9,15,We.who);const t=new ct;t.position.set(0,0,11),e.add(t),ce(t,new Lt(7,.9,4.4,6,.42),Be(We.base),0,-.35,0),ce(t,new Lt(6.7,.2,4.1,4,.09),Be("#dfe2f4"),0,.12,0),this.countryLabel=this.label(e,Le("World.ts:territory.country"),-10,0,-9.6,"w-territory t-country"),this.label(e,Le("World.ts:territory.network"),0,0,-8.4,"w-territory t-network"),this.label(e,Le("World.ts:territory.who"),10,0,-9.6,"w-territory t-who"),Nc(this.label(e,Le("World.ts:territory.github"),0,.4,13.7,"w-territory t-github"));const n=new ct;n.position.set(10,0,11),e.add(n),ce(n,new Lt(5.6,.9,4.4,6,.42),Be(We.base),0,-.35,0),ce(n,new Lt(5.3,.2,4.1,4,.09),Be("#dfe2f4"),0,.12,0),this.label(e,Le("World.ts:territory.dashboard"),10,.4,13.7,"w-territory t-who");for(const[l,c]of[[-10,-3.6],[-10,3.6],[10,-3.6],[10,3.6]])K0(e,l,c,6.6,5.2);const s=j0();this.ministrySignMesh=s.userData.sign,this.place("ministry",Le("World.ts:place.ministry.name"),Le("World.ts:place.ministry.blurb"),-10,-3.6,s,e),this.place("backend",Le("World.ts:place.backend.name"),Le("World.ts:place.backend.blurb"),-10,3.6,Z0(),e),this.place("secretariat",Le("World.ts:place.secretariat.name"),Le("World.ts:place.secretariat.blurb"),10,-3.6,J0(),e);const r=Q0();this.anchor=r.anchor,this.place("ops",Le("World.ts:place.ops.name"),Le("World.ts:place.ops.blurb"),10,3.6,r.group,e);const a=Lc(.8,"#8ff6ff");this.place("uat",Le("World.ts:place.uat.name"),Le("World.ts:place.uat.blurb"),0,-3,a.group,e);const o=Lc(1,"#8ff6ff");this.place("prod",Le("World.ts:place.prod.name"),Le("World.ts:place.prod.blurb"),0,3,o.group,e),this.badges.push(a.badge,o.badge),this.gatewayRings.push(a.ring,o.ring),this.place("dashboard",Le("World.ts:place.dashboard.name"),Le("World.ts:place.dashboard.blurb"),10,11,i_(),e),this.place("github",Le("World.ts:place.github.name"),Le("World.ts:place.github.blurb",{country:Le("settings.ts:DEFAULTS.country")}),0,11,t_(),e),this.label(e,Le("World.ts:sub.vault"),-7.9,2.6,3.7,"w-sub"),this.label(e,Le("World.ts:sub.airgap"),11.3,2.8,3.6,"w-sub"),Kt(e,-13.5,-6.5,.9),Kt(e,-13.6,6.6,1),Kt(e,13.6,-6.6,1),Kt(e,13.5,6.5,.9),Kt(e,-6.3,.2,.8),Kt(e,6.3,-.2,.8),Kt(e,5.5,9.5,.9,-.8),Kt(e,-6,10.5,1,-.8),Kt(e,17,2,1.1,-.8),Kt(e,-17,-2,1,-.8)}route(e,t,n,s=!1){const r=new Wo(t.map(l=>new E(l[0],l[1],l[2])),!1,s?"centripetal":"catmullrom",.15),a=xt(n,s?3:2.6);if(s){const l=Math.floor(r.getLength()/.42),c=new At(.1,10,10);for(let h=0;h<=l;h++){const u=new ke(c,a);u.position.copy(r.getPointAt(h/l)),this.scene.add(u)}}else this.scene.add(new ke(new Cr(r,320,.065,8,!1),a)),this.scene.add(new ke(new Cr(r,320,.14,8,!1),new Tn({color:n,transparent:!0,opacity:.25,depthWrite:!1})));const o={curve:r,mat:a,base:a.color.clone(),length:r.getLength(),dots:[]};for(let l=0;l<2;l++){const c=new ke(new At(.1,12,12),xt("#ffffff",3));this.scene.add(c),o.dots.push({m:c,off:l/2+Math.random()*.2})}this.routes[e]=o}buildRoutes(){this.route("paper",[[-9.4,2.6,-4.4],[-9.4,2.2,-7.6],[-9.3,1.7,-10],[-8.6,1.5,-10.7],[0,1.5,-10.7],[8.6,1.5,-10.7],[9.3,1.7,-10],[9.4,2.2,-7.6],[9.4,2.6,-4.4]],We.paper,!0),this.route("ministry-backend",[[-12.2,.32,-1.2],[-12.2,.32,1.2]],We.country),this.route("secretariat-ops",[[12.2,.32,-1.2],[12.2,.32,1.2]],We.who);const e=[[-7.2,.3,1.6],[-6,.3,1.6],[-5.55,.05,1.6],[-5.1,un,1.5],[-4.75,un,1],[-4.75,un,-2.4],[-4.5,un,-2.95],[-4,.05,-3],[-3.4,.3,-3],[-1.9,.3,-3]],t=[[-7.2,.3,5.6],[-6,.3,5.6],[-5.55,.05,5.6],[-5,un,5.3],[-4.6,un,3.6],[-4.3,un,3.1],[-4,.05,3],[-3.4,.3,3],[-2.4,.3,3]],n=[[-10,.3,5.6],[-10,.3,6.7],[-10,.05,7.25],[-10,un,7.7],[-10,un,10.3],[-9.4,un,11],[-4,un,11],[-3.5,.05,11],[-2.9,.3,11],[-2,.3,11]];this.route("backend-uat",e,We.network),this.route("backend-prod",t,We.network),this.route("backend-github",n,We.github),this.route("github-ops",va(n).reverse(),We.github),this.route("ops-uat",va(e),We.who),this.route("ops-prod",va(t),We.who)}fitHome(){const e=Math.max(1,1.7/this.camera.aspect);this.home.pos.set(0,30,33).multiplyScalar(e)}resize(){this.camera.aspect=innerWidth/innerHeight,this.camera.updateProjectionMatrix(),this.fitHome(),this.renderer.setSize(innerWidth,innerHeight),this.composer.setSize(innerWidth,innerHeight),this.labels.setSize(innerWidth,innerHeight)}resetView(){return this.flyTo(this.lastView.where,{...this.lastView.opts,dur:1})}flyTo(e,t={}){var a;this.lastView={where:e,opts:{desk:t.desk,caption:t.caption}};let n,s;const r=t.caption?new E(-2.2,0,2.6):new E;if(e==="home")n=this.home.pos.clone().add(r),s=this.home.target.clone().add(r);else{const o=innerWidth<820,l=t.desk&&!o?3.2:0;s=this.places[e].pos.clone().add(new E(l,1,t.desk&&o?2.2:0)).add(r);const c=Math.min(2.4,Math.max(1,1.3/this.camera.aspect));n=s.clone().add(new E(0,11.5,14.5).multiplyScalar(c*(t.zoomOut??1)))}return(a=this.fly)==null||a.done(),new Promise(o=>{this.fly={p0:this.camera.position.clone(),t0:this.controls.target.clone(),p1:n,t1:s,u:0,dur:t.dur??1.4,done:o}})}mark(e){this.marker.visible=!!e,e&&this.marker.position.copy(this.places[e].pos).setY(.36)}pointOn(e,t){const n=e.reduce((o,[l])=>o+this.routes[l].length,0);let s=t*n;for(const[o,l]of e){const c=this.routes[o];if(s<=c.length){const h=s/c.length;return c.curve.getPointAt(l>0?h:1-h)}s-=c.length}const[r,a]=e[e.length-1];return this.routes[r].curve.getPointAt(a>0?1:0)}travel(e,t,n,s={}){const r=new ct;this.scene.add(r);const a={paper:We.paper,key:We.github,data:We.network};ce(r,new At(.2,16,16),xt(a[n],2.8),0,0,0,!1);const o=document.createElement("div");o.className=`w-parcel k-${n}`,o.innerHTML=`<span class="w-parcel-dot"></span>${t}`;const l=new Ec(o);l.position.set(0,.9,0),r.add(l);const c=e.reduce((g,[v])=>g+this.routes[v].length,0),h=Math.max(1.8,c/9),u=e.slice().reverse().map(([g,v])=>[g,-v]);let d="go",p=0;return new Promise(g=>{this.parcels.push({cancel:()=>{r.removeFromParent(),o.remove(),g()},update:v=>{if(p+=v,d==="go"||d==="return"){const m=Math.min(p/h,1),f=m<.5?2*m*m:1-Math.pow(-2*m+2,2)/2;if(r.position.copy(this.pointOn(d==="go"?e:u,f)).y+=.4,m>=1)if(d==="go"&&s.bounce)d="hold",p=0,o.classList.add("bad"),o.innerHTML=`<span class="w-parcel-dot"></span>${s.bounce}`,e.forEach(([S])=>this.flashing.set(S,this.clock.elapsedTime+2.6/this.timeScale));else return r.removeFromParent(),o.remove(),g(),!1}else p>1.2&&(d="return",p=0);return!0}})})}setNames(e,t){var s;this.countryLabel.textContent=e.toUpperCase();const n=this.ministrySignMesh.material;(s=n.map)==null||s.dispose(),n.map=jh(t.toUpperCase()),n.needsUpdate=!0,this.places.github.blurb=Le("World.ts:place.github.blurb",{country:e})}cancelAll(){for(const t of this.parcels)t.cancel();this.parcels=[],this.bot.cancel();const e=this.fly;this.fly=null,e==null||e.done()}setProdOpen(e){this.prodBarrier.visible=!e}pulseGateway(e,t){const n=this.gatewayRings[e==="uat"?0:1];n.userData.flash={color:new Ge(t).multiplyScalar(3),until:this.clock.elapsedTime+2.5/this.timeScale}}pulseAnchor(){this.anchor.userData.pulseUntil=this.clock.elapsedTime+3/this.timeScale}botTo(e){const t=this.routes["github-ops"],n=[];for(let r=0;r<=12;r++)n.push(t.curve.getPointAt(r/12).clone().add(new E(0,2.2,0)));e==="github"&&n.reverse(),n[0]=this.bot.group.position.clone();const s=e==="github"?new E(0,2.6,12.2):this.places.ops.pos.clone().add(new E(0,2.4,1.8));return n.push(s),this.bot.flyAlong(n)}reset(){this.cancelAll(),this.setProdOpen(!1),this.bot.setMood("idle"),this.bot.group.position.copy(this.places.ops.pos).add(new E(0,2.4,1.8)),this.mark(null)}hideCats(){const e=[["country",!1,-7.9,.32,2.7,Math.PI],["gateway",!0,-.95,.68,2.35,.6],["who",!1,10.4,.32,-5.75,Math.PI*.9]];for(const[t,n,s,r,a,o]of e){const l=s_(n,{bandit:t==="country"});l.position.set(s,r,a),l.rotation.y=o,this.scene.add(l),this.cats.set(l,t)}}bindPointer(){const e=new m0,t=new Z,n=()=>Object.entries(this.places),s=l=>{t.set(l.clientX/innerWidth*2-1,-(l.clientY/innerHeight)*2+1),e.setFromCamera(t,this.camera);const c=e.intersectObjects(n().map(([,u])=>u.group),!0);if(!c.length)return null;let h=c[0].object;for(;h;){const u=n().find(([,d])=>d.group===h);if(u)return u[0];h=h.parent}return null},r=l=>{var u;t.set(l.clientX/innerWidth*2-1,-(l.clientY/innerHeight)*2+1),e.setFromCamera(t,this.camera);let h=((u=e.intersectObjects([...this.cats.keys()],!0)[0])==null?void 0:u.object)??null;for(;h;){const d=this.cats.get(h);if(d)return d;h=h.parent}return null};let a=null;const o=this.renderer.domElement;o.addEventListener("pointerdown",l=>{a=[l.clientX,l.clientY]}),o.addEventListener("pointerup",l=>{var u;if(!a||Math.hypot(l.clientX-a[0],l.clientY-a[1])>5)return;const c=r(l);if(c){(u=this.onCatClick)==null||u.call(this,c);return}const h=s(l);h&&this.onPlaceClick&&this.onPlaceClick(h)}),o.addEventListener("pointermove",l=>{o.style.cursor=r(l)||s(l)?"pointer":"grab"})}clampView(){const e=this.controls.target;if(!Number.isFinite(this.camera.position.x+this.camera.position.y+this.camera.position.z+e.x+e.y+e.z)){this.fly=null,this.camera.position.copy(this.home.pos),e.copy(this.home.target);return}const t=new E(br.clamp(e.x,-17,17),br.clamp(e.y,-.6,4),br.clamp(e.z,-12,16));if(t.equals(e))return;const n=t.clone().sub(e);e.copy(t),this.camera.position.add(n)}}const o_=["GDHCN.ONB.Apply#A.P.Interest"],l_=["GDHCN.ONB.Apply#A.S.Check"],c_=["GDHCN.ONB.Apply#A.P.Letter","GDHCN.TrustDomain.Join#J.P.Letter"],h_=["GDHCN.ONB.Apply#A.P.Letter","GDHCN.ONB.VerifyLetter#V.S.Check"],u_=["GDHCN.ONB.PrepareKeys#K.Certs"],d_=["GDHCN.ONB.PrepareKeys#K.Certs"],f_=["GDHCN.ONB.PrepareKeys#K.Certs","page:concepts_certificate_governance"],p_=["GDHCN.ONB.PrepareKeys#K.Gpg","GDHCN.ONB.VerifyLetter#V.S.Gpg"],m_=["GDHCN.ONB.PrepareKeys#K.Repo"],g_=["GDHCN.ONB.PrepareKeys#K.Publish"],v_=["GDHCN.ONB.PrepareKeys#K.Invite","GDHCN.ONB.PrepareKeys#K.Accept"],__=["GDHCN.ONB.VerifyLetter#V.S.Check","GDHCN.ONB.VerifyLetter#V.P.Correct"],y_=["GDHCN.ONB.ConveyLetter#C.P.Country","GDHCN.ONB.ConveyLetter#C.S.Meet","GDHCN.ONB.VerifyLetter#V.S.Gpg"],x_=["GDHCN.ONB.RegisterKeys#R.B.Pr","GDHCN.ONB.RegisterKeys#R.O.Verify"],b_=["GDHCN.ONB.RegisterKeys#R.T.Sign"],S_=["GDHCN.ONB.ConnectTest#X.P.Connect"],M_=["GDHCN.ONB.GoLive#G.P.UAT","GDHCN.ONB.ConnectTest#X.P.Test"],w_=["GDHCN.ONB.GoLive#G.P.PROD","GDHCN.ONB.ConnectTest#X.P.Test"],T_=["GDHCN.ONB.ChangeKeys#CK.P.Keys","page:concepts_certificate_governance"],Zh={soi:o_,eligibility:l_,domains:c_,team:h_,tools:u_,certs:d_,sca:f_,gpg:p_,repos:m_,tag:g_,invite:v_,letter:__,identity:y_,collect:x_,airgap:b_,connect:S_,dryrun:M_,prod:w_,renew:T_,"demo:beat1":["GDHCN.ONB.Apply#A.P.Interest","GDHCN.ONB.Apply#A.S.Check"],"demo:beat2":["GDHCN.ONB.PrepareKeys#K.Certs","GDHCN.ONB.PrepareKeys#K.Gpg"],"demo:beat3":["GDHCN.ONB.PrepareKeys#K.Repo","GDHCN.ONB.PrepareKeys#K.Publish"],"demo:beat4":["GDHCN.ONB.Apply#A.P.Letter","GDHCN.ONB.PrepareKeys#K.Invite"],"demo:beat5":["GDHCN.ONB.ConveyLetter#C.P.Country","GDHCN.ONB.VerifyLetter#V.S.Check","GDHCN.ONB.VerifyLetter#V.S.Gpg"],"demo:beat6":["GDHCN.ONB.RegisterKeys#R.B.Pr","GDHCN.ONB.RegisterKeys#R.O.Verify"],"demo:beat7":["GDHCN.ONB.RegisterKeys#R.T.Sign"],"demo:beat8":["GDHCN.ONB.GoLive#G.P.UAT","GDHCN.ONB.ConnectTest#X.P.Test"],"demo:beat9":["GDHCN.ONB.GoLive#G.P.PROD","GDHCN.ONB.GoLive#G.P.Done"]},E_="https://litlfred.github.io/smart-trust/",A_="concepts_onboarding_process_full.html",C_={"GDHCN.ONB.Apply":{title:{en:"Apply and be verified",ar:"تقديم الطلب والخضوع للتحقق",es:"Presentar la solicitud y ser verificado",fr:"Présenter sa candidature et la faire vérifier",ru:"Подать заявку и пройти проверку",zh:"申请并接受验证"},anchor:"gdhcn-onb-apply",tasks:{"A.P.Interest":{en:"Send the Statement of Interest",ar:"إرسال بيان الاهتمام",es:"Enviar la Declaración de interés",fr:"Envoyer la déclaration d’intérêt",ru:"Направить Заявление о заинтересованности",zh:"发送意向声明"},"A.P.Result":{en:"Receive the result of the check",ar:"تلقّي نتيجة الفحص",es:"Recibir el resultado de la comprobación",fr:"Recevoir le résultat de l’examen",ru:"Получить результат проверки",zh:"接收核查结果"},"A.P.Modify":{en:"Modify the data",ar:"تعديل البيانات",es:"Modificar los datos",fr:"Modifier les données",ru:"Изменить данные",zh:"修改数据"},"A.P.Keys":{en:"Prepare keys and repository",ar:"إعداد المفاتيح والمستودع",es:"Preparar las claves y el repositorio",fr:"Préparer les clés et le dépôt",ru:"Подготовить ключи и репозиторий",zh:"准备密钥和存储库"},"A.P.Letter":{en:"Convey the Letter of Application",ar:"إيصال خطاب الطلب",es:"Remitir la Carta de solicitud",fr:"Transmettre la lettre de candidature",ru:"Передать Письмо-заявку",zh:"递交申请函"},"A.S.Check":{en:"Validate the data and the Terms of Participation",ar:"التحقق من صحة البيانات وشروط المشاركة",es:"Validar los datos y los Términos de participación",fr:"Valider les données et les Conditions de participation",ru:"Проверить данные и Условия участия",zh:"验证数据和参与条款"},"A.S.Reject":{en:"Reject by email",ar:"الرفض بالبريد الإلكتروني",es:"Rechazar por correo electrónico",fr:"Rejeter par courriel",ru:"Отклонить по электронной почте",zh:"通过电子邮件拒绝"},"A.S.Invite":{en:"Invite to start onboarding",ar:"الدعوة إلى بدء الانضمام",es:"Invitar a iniciar la incorporación",fr:"Inviter à commencer l’intégration",ru:"Пригласить начать подключение",zh:"邀请开始入网"},"A.S.Letter":{en:"Verify the Letter of Application",ar:"التحقق من خطاب الطلب",es:"Verificar la Carta de solicitud",fr:"Vérifier la lettre de candidature",ru:"Проверить Письмо-заявку",zh:"验证申请函"}}},"GDHCN.ONB.ChangeKeys":{title:{en:"Report a change",ar:"الإبلاغ عن تغيير",es:"Comunicar un cambio",fr:"Signaler un changement",ru:"Сообщить об изменении",zh:"报告变更"},anchor:"gdhcn-onb-changekeys",tasks:{"CK.P.Reps":{en:"Notify the new representatives",ar:"الإخطار بالممثلين الجدد",es:"Notificar los nuevos representantes",fr:"Notifier les nouveaux représentants",ru:"Уведомить о новых представителях",zh:"通知新代表"},"CK.P.Keys":{en:"Prepare the new key material",ar:"إعداد مواد المفاتيح الجديدة",es:"Preparar el nuevo material de claves",fr:"Préparer le nouveau matériel de clés",ru:"Подготовить новый ключевой материал",zh:"准备新的密钥材料"},"CK.P.Send":{en:"Convey the change by secure channel",ar:"إيصال التغيير عبر قناة آمنة",es:"Transmitir el cambio por un canal seguro",fr:"Transmettre le changement par un canal sécurisé",ru:"Передать изменение по защищённому каналу",zh:"通过安全渠道递交变更"},"CK.S.Reps":{en:"Record the new representatives",ar:"تسجيل الممثلين الجدد",es:"Registrar los nuevos representantes",fr:"Enregistrer les nouveaux représentants",ru:"Зарегистрировать новых представителей",zh:"记录新代表"},"CK.S.Keys":{en:"Verify the change",ar:"التحقق من التغيير",es:"Verificar el cambio",fr:"Vérifier le changement",ru:"Проверить изменение",zh:"验证该变更"},"CK.S.Hand":{en:"Send the new keys to the operator",ar:"إرسال المفاتيح الجديدة إلى المشغّل",es:"Enviar las nuevas claves al operador",fr:"Envoyer les nouvelles clés à l’opérateur",ru:"Направить новые ключи оператору",zh:"将新密钥发送给运营方"},"CK.O.Keys":{en:"Register the keys",ar:"تسجيل المفاتيح",es:"Registrar las claves",fr:"Enregistrer les clés",ru:"Зарегистрировать ключи",zh:"注册密钥"}}},"GDHCN.ONB.ConnectTest":{title:{en:"Connect and test",ar:"الربط والاختبار",es:"Conectar y probar",fr:"Se connecter et tester",ru:"Подключиться и пройти тестирование",zh:"连接并测试"},anchor:"gdhcn-onb-connecttest",tasks:{"X.P.Connect":{en:"Connect to the gateway",ar:"الربط ببوابة الربط",es:"Conectarse a la puerta de enlace",fr:"Se connecter à la passerelle",ru:"Подключиться к шлюзу",zh:"连接网关"},"X.P.Fix":{en:"Correct the connection with the operations team",ar:"تصحيح الربط مع فريق العمليات",es:"Corregir la conexión con el equipo de operaciones",fr:"Corriger la connexion avec l'équipe des opérations",ru:"Исправить подключение совместно с группой эксплуатации",zh:"与运维团队一起纠正连接"},"X.P.Test":{en:"Run the test",ar:"إجراء الاختبار",es:"Ejecutar la prueba",fr:"Exécuter le test",ru:"Провести тест",zh:"运行测试"},"X.P.Send":{en:"Send the test results",ar:"إرسال نتائج الاختبار",es:"Enviar los resultados de la prueba",fr:"Envoyer les résultats des tests",ru:"Направить результаты теста",zh:"发送测试结果"},"X.P.Result":{en:"Receive the check result",ar:"تلقّي نتيجة الفحص",es:"Recibir el resultado de la comprobación",fr:"Recevoir le résultat de la vérification",ru:"Получить результат проверки",zh:"接收核查结果"},"X.O.White":{en:"Whitelist the certificates",ar:"إدراج الشهادات في القائمة البيضاء",es:"Incluir los certificados en la lista blanca",fr:"Mettre les certificats sur liste blanche",ru:"Внести сертификаты в список разрешённых",zh:"将证书加入白名单"},"X.O.Inform":{en:"Send the connection information",ar:"إرسال معلومات الربط",es:"Enviar la información de conexión",fr:"Envoyer les informations de connexion",ru:"Направить информацию для подключения",zh:"发送连接信息"},"X.O.Recv":{en:"Receive the test results",ar:"تلقّي نتائج الاختبار",es:"Recibir los resultados de la prueba",fr:"Recevoir les résultats des tests",ru:"Получить результаты теста",zh:"接收测试结果"},"X.O.Check":{en:"Check the test results",ar:"فحص نتائج الاختبار",es:"Comprobar los resultados de la prueba",fr:"Vérifier les résultats des tests",ru:"Проверить результаты теста",zh:"核查测试结果"},"X.O.Fix":{en:"Agree corrective actions",ar:"الاتفاق على الإجراءات التصحيحية",es:"Acordar las medidas correctivas",fr:"Convenir des mesures correctives",ru:"Согласовать корректирующие действия",zh:"商定纠正措施"}}},"GDHCN.ONB.ConveyLetter":{title:{en:"Convey the Letter",ar:"إيصال الخطاب",es:"Transmitir la Carta",fr:"Transmettre la Lettre",ru:"Передать Письмо-заявку",zh:"递交申请函"},anchor:"gdhcn-onb-conveyletter",tasks:{"C.P.Country":{en:"Meet WHO in country with passport",ar:"مقابلة منظمة الصحة العالمية (WHO) داخل البلد مع جواز السفر",es:"Reunirse con la OMS en el país con el pasaporte",fr:"Rencontrer l’OMS dans le pays, muni de son passeport",ru:"Встретиться с представителями ВОЗ в стране, имея при себе паспорт",zh:"持护照在国内会晤 WHO"},"C.P.Assembly":{en:"Meet WHO at a governing body with passport",ar:"مقابلة منظمة الصحة العالمية (WHO) في جهاز رئاسي مع جواز السفر",es:"Reunirse con la OMS en un órgano deliberante con el pasaporte",fr:"Rencontrer l’OMS lors d’une réunion d’un organe directeur, muni de son passeport",ru:"Встретиться с представителями ВОЗ на заседании руководящего органа, имея при себе паспорт",zh:"持护照在理事机构会议上会晤 WHO"},"C.S.Meet":{en:"Meet the representative and check passport",ar:"مقابلة الممثل والتحقق من جواز السفر",es:"Reunirse con el representante y comprobar el pasaporte",fr:"Rencontrer le représentant et vérifier son passeport",ru:"Встретиться с представителем и проверить паспорт",zh:"会晤代表并核查护照"},"C.S.Pouch":{en:"Send the Letter by diplomatic pouch",ar:"إرسال الخطاب بالحقيبة الدبلوماسية",es:"Enviar la Carta por valija diplomática",fr:"Envoyer la Lettre par valise diplomatique",ru:"Направить Письмо-заявку дипломатической почтой",zh:"通过外交邮袋寄送申请函"},"C.S.Assembly":{en:"Meet the delegate and check passport",ar:"مقابلة المندوب والتحقق من جواز السفر",es:"Reunirse con el delegado y comprobar el pasaporte",fr:"Rencontrer le délégué et vérifier son passeport",ru:"Встретиться с делегатом и проверить паспорт",zh:"会晤正式代表并核查护照"}}},"GDHCN.ONB.GoLive":{title:{en:"Go live",ar:"بدء التشغيل الفعلي",es:"Puesta en producción",fr:"Passer en production",ru:"Ввести в эксплуатацию",zh:"上线"},anchor:"gdhcn-onb-golive",tasks:{"G.P.UAT":{en:"Connect and run the dry run in UAT",ar:"الربط وإجراء التشغيل التجريبي في UAT",es:"Conectarse y realizar el ensayo en UAT",fr:"Se connecter et effectuer l'essai à blanc en UAT",ru:"Подключиться и провести пробный прогон в UAT",zh:"在 UAT 中连接并进行试运行"},"G.P.PROD":{en:"Connect and run the readiness test in PROD",ar:"الربط وإجراء اختبار الجاهزية في PROD",es:"Conectarse y realizar la prueba de preparación en PROD",fr:"Se connecter et effectuer le test de préparation en PROD",ru:"Подключиться и провести тест готовности в PROD",zh:"在 PROD 中连接并运行就绪测试"},"G.P.Done":{en:"Receive the onboarding confirmation",ar:"تلقّي تأكيد الانضمام",es:"Recibir la confirmación de incorporación",fr:"Recevoir la confirmation d'intégration",ru:"Получить подтверждение подключения",zh:"接收入网确认"},"G.O.UAT":{en:"Whitelist and check the UAT dry run",ar:"الإدراج في القائمة البيضاء وفحص التشغيل التجريبي في UAT",es:"Incluir en la lista blanca y comprobar el ensayo en UAT",fr:"Mettre sur liste blanche et vérifier l'essai à blanc en UAT",ru:"Внести в список разрешённых и проверить пробный прогон в UAT",zh:"加入白名单并核查 UAT 试运行"},"G.O.PROD":{en:"Whitelist and check the PROD readiness test",ar:"الإدراج في القائمة البيضاء وفحص اختبار الجاهزية في PROD",es:"Incluir en la lista blanca y comprobar la prueba de preparación en PROD",fr:"Mettre sur liste blanche et vérifier le test de préparation en PROD",ru:"Внести в список разрешённых и проверить тест готовности в PROD",zh:"加入白名单并核查 PROD 就绪测试"},"G.O.Confirm":{en:"Confirm Production Readiness",ar:"تأكيد الجاهزية للإنتاج",es:"Confirmar la preparación para producción",fr:"Confirmer la préparation à la production",ru:"Подтвердить готовность к эксплуатации в PROD",zh:"确认生产就绪"}}},"GDHCN.ONB.PrepareKeys":{title:{en:"Prepare keys and repository",ar:"إعداد المفاتيح والمستودع",es:"Preparar las claves y el repositorio",fr:"Préparer les clés et le dépôt",ru:"Подготовить ключи и репозиторий",zh:"准备密钥和存储库"},anchor:"gdhcn-onb-preparekeys",tasks:{"K.Certs":{en:"Create the TLS, upload and SCA certificates",ar:"إنشاء شهادات TLS والرفع وSCA",es:"Crear los certificados TLS, de carga (upload) y SCA",fr:"Créer les certificats TLS, de téléversement et de SCA",ru:"Создать сертификаты TLS, загрузки и SCA",zh:"创建 TLS、上传和 SCA 证书"},"K.Gpg":{en:"Create a GPG key for each authorized person",ar:"إنشاء مفتاح GPG لكل شخص مفوَّض",es:"Crear una clave GPG para cada persona autorizada",fr:"Créer une clé GPG pour chaque personne autorisée",ru:"Создать ключ GPG для каждого уполномоченного лица",zh:"为每位授权人员创建 GPG 密钥"},"K.Repo":{en:"Create the private GitHub repository",ar:"إنشاء مستودع GitHub الخاص",es:"Crear el repositorio privado de GitHub",fr:"Créer le dépôt GitHub privé",ru:"Создать закрытый репозиторий GitHub",zh:"创建私有 GitHub 存储库"},"K.Publish":{en:"Commit the public keys and sign a tag",ar:"إيداع المفاتيح العمومية وتوقيع وسم",es:"Hacer commit de las claves públicas y firmar una etiqueta (tag)",fr:"Valider les clés publiques et signer une étiquette",ru:"Зафиксировать открытые ключи и подписать тег",zh:"提交（commit）公钥并签署标签（tag）"},"K.Invite":{en:"Invite the GitHub bot",ar:"دعوة روبوت GitHub",es:"Invitar al bot de GitHub",fr:"Inviter le bot GitHub",ru:"Пригласить бота GitHub",zh:"邀请 GitHub 机器人"},"K.Accept":{en:"Receive the acceptance",ar:"تلقّي القبول",es:"Recibir la aceptación",fr:"Recevoir l’acceptation",ru:"Получить подтверждение принятия",zh:"接收接受确认"},"KB.Accept":{en:"Accept the invitation",ar:"قبول الدعوة",es:"Aceptar la invitación",fr:"Accepter l’invitation",ru:"Принять приглашение",zh:"接受邀请"}}},"GDHCN.ONB.RegisterKeys":{title:{en:"Verify and sign PROD keys",ar:"التحقق من مفاتيح PROD وتوقيعها",es:"Verificar y firmar las claves de PROD",fr:"Vérifier et signer les clés PROD",ru:"Проверить и подписать ключи PROD",zh:"验证并签名 PROD 密钥"},anchor:"gdhcn-onb-registerkeys",tasks:{"R.T.Sign":{en:"Verify the PR and sign air-gapped",ar:"التحقق من PR والتوقيع في بيئة معزولة",es:"Verificar la PR y firmar en un entorno aislado (air-gapped)",fr:"Vérifier la PR et signer sur un poste isolé du réseau",ru:"Проверить PR и подписать в изолированной среде",zh:"验证 PR 并在物理隔离环境中签名"},"R.O.Config":{en:"Add the data to the configuration files",ar:"إضافة البيانات إلى ملفات التهيئة",es:"Añadir los datos a los archivos de configuración",fr:"Ajouter les données aux fichiers de configuration",ru:"Добавить данные в файлы конфигурации",zh:"将数据添加到配置文件"},"R.O.Sig":{en:"Receive the signed keys",ar:"تلقّي المفاتيح الموقَّعة",es:"Recibir las claves firmadas",fr:"Recevoir les clés signées",ru:"Получить подписанные ключи",zh:"接收已签名的密钥"},"R.O.Verify":{en:"Verify the pull request",ar:"التحقق من طلب السحب",es:"Verificar la pull request",fr:"Vérifier la demande de tirage",ru:"Проверить запрос на слияние",zh:"验证拉取请求"},"R.O.Fail":{en:"Send the failure",ar:"إرسال الإخفاق",es:"Enviar el fallo",fr:"Envoyer l'échec",ru:"Направить сообщение о неудаче",zh:"发送失败结果"},"R.B.Pr":{en:"Pull the key material and open a PR",ar:"سحب مواد المفاتيح وفتح PR",es:"Obtener el material de claves y abrir una PR",fr:"Récupérer le matériel de clés et ouvrir une demande de tirage (PR)",ru:"Получить ключевой материал и открыть запрос на слияние (PR)",zh:"拉取密钥材料并开启 PR"},"R.B.Auto":{en:"Sign the keys automatically",ar:"توقيع المفاتيح آلياً",es:"Firmar las claves automáticamente",fr:"Signer les clés automatiquement",ru:"Автоматически подписать ключи",zh:"自动签名密钥"},"R.P.Fix":{en:"Correct the key material",ar:"تصحيح مواد المفاتيح",es:"Corregir el material de claves",fr:"Corriger le matériel de clés",ru:"Исправить ключевой материал",zh:"纠正密钥材料"}}},"GDHCN.ONB.Terminate":{title:{en:"Leave the GDHCN",ar:"مغادرة GDHCN",es:"Retirarse de la GDHCN",fr:"Quitter le GDHCN",ru:"Выйти из GDHCN",zh:"退出 GDHCN"},anchor:"gdhcn-onb-terminate",tasks:{"E.P.Notice":{en:"Send written notice by diplomatic channel",ar:"إرسال إشعار كتابي عبر القناة الدبلوماسية",es:"Enviar notificación por escrito por vía diplomática",fr:"Envoyer une notification écrite par la voie diplomatique",ru:"Направить письменное уведомление по дипломатическим каналам",zh:"通过外交渠道发送书面通知"},"E.S.Inform":{en:"Inform the other Participants",ar:"إبلاغ المشاركين الآخرين",es:"Informar a los demás Participantes",fr:"Informer les autres Participants",ru:"Проинформировать других Участников",zh:"告知其他参与方"},"E.S.Term":{en:"Terminate the participation",ar:"إنهاء المشاركة",es:"Terminar la participación",fr:"Résilier la participation",ru:"Прекратить участие",zh:"终止该参与"}}},"GDHCN.ONB.VerifyLetter":{title:{en:"Convey and correct the Letter",ar:"إيصال الخطاب وتصحيحه",es:"Transmitir y corregir la Carta",fr:"Transmettre et corriger la Lettre",ru:"Передать и исправить Письмо-заявку",zh:"递交并更正申请函"},anchor:"gdhcn-onb-verifyletter",tasks:{"V.P.Convey":{en:"Convey the Letter",ar:"إيصال الخطاب",es:"Transmitir la Carta",fr:"Transmettre la Lettre",ru:"Передать Письмо-заявку",zh:"递交申请函"},"V.P.Correct":{en:"Correct the Letter",ar:"تصحيح الخطاب",es:"Corregir la Carta",fr:"Corriger la Lettre",ru:"Исправить Письмо-заявку",zh:"更正申请函"},"V.S.Receive":{en:"Receive the Letter",ar:"تلقّي الخطاب",es:"Recibir la Carta",fr:"Recevoir la Lettre",ru:"Получить Письмо-заявку",zh:"接收申请函"},"V.S.Check":{en:"Verify accuracy, eligibility and rules",ar:"التحقق من الدقة والأهلية والقواعد",es:"Verificar la exactitud, la elegibilidad y las reglas",fr:"Vérifier l’exactitude, l’admissibilité et les règles",ru:"Проверить точность, правомочность и соблюдение правил",zh:"验证准确性、资格和规则"},"V.S.Fail":{en:"Inform the Participant of the failure",ar:"إبلاغ المشارك بالإخفاق",es:"Informar al Participante del fallo",fr:"Informer le Participant de l’échec",ru:"Сообщить Участнику о неудаче",zh:"告知参与方验证失败"},"V.S.Gpg":{en:"Check each GPG key",ar:"فحص كل مفتاح GPG",es:"Comprobar cada clave GPG",fr:"Vérifier chaque clé GPG",ru:"Проверить каждый ключ GPG",zh:"核查每个 GPG 密钥"},"V.S.Collect":{en:"Collect the information for the operator",ar:"جمع المعلومات للمشغّل",es:"Reunir la información para el operador",fr:"Recueillir les informations destinées à l’opérateur",ru:"Собрать информацию для оператора",zh:"为运营方收集信息"}}},"GDHCN.ONB":{title:{en:"Join the GDHCN",ar:"الانضمام إلى GDHCN",es:"Incorporarse a la GDHCN",fr:"Rejoindre le GDHCN",ru:"Присоединиться к GDHCN",zh:"加入 GDHCN"},anchor:"gdhcn-onb",tasks:{"T.P.Apply":{en:"Apply and be verified",ar:"تقديم الطلب والخضوع للتحقق",es:"Presentar la solicitud y ser verificado",fr:"Postuler et être vérifié",ru:"Подать заявку и пройти проверку",zh:"申请并接受验证"},"T.P.Live":{en:"Go live",ar:"بدء التشغيل الفعلي",es:"Puesta en producción",fr:"Passer en production",ru:"Ввести в эксплуатацию",zh:"上线"},"T.O.Setup":{en:"Register the keys",ar:"تسجيل المفاتيح",es:"Registrar las claves",fr:"Enregistrer les clés",ru:"Зарегистрировать ключи",zh:"注册密钥"},"T.O.Live":{en:"Whitelist and check the tests",ar:"الإدراج في القائمة البيضاء وفحص الاختبارات",es:"Incluir en la lista blanca y comprobar las pruebas",fr:"Mettre sur liste blanche et vérifier les tests",ru:"Внести в список разрешённых и проверить тесты",zh:"加入白名单并核查测试"},"T.S.Apply":{en:"Check the application and the Letter",ar:"فحص الطلب والخطاب",es:"Comprobar la solicitud y la Carta",fr:"Examiner la candidature et la lettre",ru:"Проверить заявку и Письмо-заявку",zh:"核查申请和申请函"},"T.S.Handover":{en:"Send onboarding information to the operator",ar:"إرسال معلومات الانضمام إلى المشغّل",es:"Enviar la información de incorporación al operador",fr:"Envoyer les informations d'intégration à l'opérateur",ru:"Направить оператору информацию о подключении",zh:"将入网信息发送给运营方"},"T.S.Ready":{en:"Receive the readiness confirmation",ar:"تلقّي تأكيد الجاهزية",es:"Recibir la confirmación de preparación",fr:"Recevoir la confirmation de préparation",ru:"Получить подтверждение готовности",zh:"接收就绪确认"},"T.S.Record":{en:"Record the Participant as onboarded",ar:"تسجيل المشارك بوصفه منضمّاً",es:"Registrar al Participante como integrado",fr:"Enregistrer le participant comme intégré",ru:"Зарегистрировать Участника как подключённого",zh:"将参与方记录为已入网"}}},"GDHCN.TrustDomain.Join":{title:{en:"Join a further Trust Domain",ar:"الانضمام إلى نطاق ثقة إضافي",es:"Unirse a un Ámbito de confianza adicional",fr:"Rejoindre un Domaine de confiance supplémentaire",ru:"Присоединиться к дополнительному Домену доверия",zh:"加入另一个信任域"},anchor:"gdhcn-trustdomain-join",tasks:{"J.P.Letter":{en:"Convey the Letter for it",ar:"إيصال الخطاب الخاص به",es:"Transmitir la Carta correspondiente",fr:"Transmettre la Lettre correspondante",ru:"Передать Письмо-заявку для него",zh:"为其递交申请函"},"J.P.Live":{en:"Go live",ar:"بدء التشغيل الفعلي",es:"Puesta en producción",fr:"Passer en production",ru:"Ввести в эксплуатацию",zh:"上线"},"J.O.Keys":{en:"Register the keys",ar:"تسجيل المفاتيح",es:"Registrar las claves",fr:"Enregistrer les clés",ru:"Зарегистрировать ключи",zh:"注册密钥"},"J.O.Live":{en:"Whitelist and check the tests",ar:"الإدراج في القائمة البيضاء وفحص الاختبارات",es:"Incluir en la lista blanca y comprobar las pruebas",fr:"Inscrire sur la liste blanche et contrôler les tests",ru:"Внести в список разрешённых и проверить тесты",zh:"加入白名单并核查测试"},"J.S.Letter":{en:"Verify the Letter",ar:"التحقق من الخطاب",es:"Verificar la Carta",fr:"Vérifier la Lettre",ru:"Проверить Письмо-заявку",zh:"验证申请函"},"J.S.Hand":{en:"Send onboarding information to the operator",ar:"إرسال معلومات الانضمام إلى المشغّل",es:"Enviar la información de incorporación al operador",fr:"Envoyer les informations d’intégration à l’opérateur",ru:"Направить оператору информацию о подключении",zh:"将入网信息发送给运营方"}}},"GDHCN.TrustDomain.Propose":{title:{en:"Propose a Trust Domain",ar:"اقتراح نطاق ثقة",es:"Proponer un Ámbito de confianza",fr:"Proposer un Domaine de confiance",ru:"Предложить Домен доверия",zh:"提出信任域"},anchor:"gdhcn-trustdomain-propose",tasks:{"TP.Draft":{en:"Describe the proposed Trust Domain",ar:"وصف نطاق الثقة المقترح",es:"Describir el Ámbito de confianza propuesto",fr:"Décrire le Domaine de confiance proposé",ru:"Описать предлагаемый Домен доверия",zh:"描述拟议的信任域"},"TP.Send":{en:"Propose it to the Secretariat",ar:"اقتراحه على الأمانة",es:"Proponerlo a la Secretaría",fr:"Le proposer au Secrétariat",ru:"Направить предложение Секретариату",zh:"向秘书处提出"},"TP.Recv":{en:"Receive the published Annex",ar:"تلقّي الملحق المنشور",es:"Recibir el anexo publicado",fr:"Recevoir l’annexe publiée",ru:"Получить опубликованное приложение",zh:"接收已发布的附件"},"TS.Review":{en:"Review the proposal",ar:"مراجعة المقترح",es:"Examinar la propuesta",fr:"Examiner la proposition",ru:"Рассмотреть предложение",zh:"审查提案"},"TS.Annex":{en:"Adopt the Trust Domain as an Annex",ar:"اعتماد نطاق الثقة بوصفه ملحقاً",es:"Adoptar el Ámbito de confianza como anexo",fr:"Adopter le Domaine de confiance en tant qu’annexe",ru:"Утвердить Домен доверия в качестве приложения",zh:"将信任域作为附件通过"},"TS.Publish":{en:"Publish and notify the representatives",ar:"النشر وإخطار الممثلين",es:"Publicar y notificar a los representantes",fr:"Publier et notifier les représentants",ru:"Опубликовать и уведомить представителей",zh:"发布并通知各代表"}}}},R_=[{code:"DDCC",name:"Digital Documentation of COVID-19 Certificates (DDCC)",description:"Defined in Annex I of the GDHCN Administrative and Operational Framework 1.2. It covers the utilization of COVID-19 Vaccine Certificates and Test Certificates.",page:"Binary-TrustDomain-DDCC.html"},{code:"IPS-PILGRIMAGE",name:"IPS for Pilgrimage",description:"**No Framework annex yet.** The GDHCN Administrative and Operational Framework 1.2 defines only the DDCC Trust Domain (Annex I). This instance is drafted from the [IPS Pilgrimage IG](http://smart.who.int/ips-pilgrimage), where data exchange is mediated by the pilgrim on the basis of consent.",page:"Binary-TrustDomain-IPS-PILGRIMAGE.html"}],Rs={igBase:E_,processPage:A_,processes:C_,trustDomains:R_},P_=Rs.processes,Ic=i=>i[wt()]??i.en;function Jh(i){if(i.startsWith("page:")){const s=i.slice(5);return{process:Le(`refs:page.${s}`),task:"",href:`${Rs.igBase}${s}.html`}}const[e,t]=i.split("#"),n=P_[e];return{process:Ic(n.title),task:Ic(n.tasks[t]),href:`${Rs.igBase}${Rs.processPage}#${n.anchor}`}}const _a=i=>i.replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]);function Qh(i){return i.map(Jh).map(e=>e.task?`${e.process} › ${e.task}`:e.process).join("; ")}function fi(i){return i.map(Jh).map(e=>`<a class="chip steps" href="${_a(e.href)}" target="_blank" rel="noopener" title="${_a(Le("refs:openInIg"))}">${_a(e.task?`${e.process} › ${e.task}`:e.process)}</a>`).join(" ")}const Oc=Rs.trustDomains,Et=Zh,D_=[{code:"ICVP",text:"ICVP · Yellow fever vaccination (International Certificate of Vaccination or Prophylaxis) · in development"},{code:"PH4H",text:"PH4H · Pan-American Highway for Digital Health (the Americas)"}];function L_(){const i=new Set(Oc.map(e=>e.code));return[...Oc.map(e=>({text:`${e.code} · ${e.name}`,required:!1,domain:e.code})),...D_.filter(e=>!i.has(e.code)).map(e=>({text:e.text,required:!1,domain:e.code}))]}const Rr={A:"Apply",B:"Prepare keys",C:"WHO checks and setup",D:"Test and go live",E:"Stay live"},Gn={business:{name:"Dr Zawadi Nkosi",title:"Business Owner",initials:"ZN",job:"Accountable for the country's participation and its use cases. Puts the team together and signs off."},keymaster:{name:"Kwame Mensah",title:"Key Master",initials:"KM",job:"Creates and safeguards the country's keys and certificates (the PKI)."},legal:{name:"Sara Diallo",title:"Legal",initials:"SD",job:"WHO's contact on legal and policy matters. Prepares the Letter of Application."},technical:{name:"Tendai Banda",title:"Technical",initials:"TB",job:"Runs the backend, its security and the connection tests with the Gateway."},who:{name:"WHO",title:"WHO does this part",initials:"WHO"}},_t=[{id:"soi",phase:"A",title:"Say you want to join",steps:Et.soi,place:"ministry",role:"business",type:"choice",brief:"{country} wants to issue digital health certificates that other countries can verify. The first move is a formal Statement of Interest to WHO.",docs:[{kind:"letter",title:"Statement of Interest",lines:["From: Ministry of Health, {country}","To: WHO GDHCN Secretariat","{country} wishes to join the Global Digital Health Certification Network as a Participant."]}],prompt:"How do you send it?",choices:[{id:"email",correct:!0,text:"Email it to gdhcn-secretariat@who.int"},{id:"gateway",text:"Upload it to the Trust Network Gateway",consequence:{title:"Wrong road",by:"Trust Network Gateway",steps:["GDHCN.ONB.Apply#A.P.Interest"],what:"The Gateway refused the connection. {country} has no certificates registered, and the Gateway only accepts signed key material over mTLS.",why:"Paperwork travels by email to the Secretariat. The Gateway carries keys, never letters.",days:3,travel:{legs:[["backend-uat",1]],label:"Statement of Interest",kind:"paper"}}},{id:"github",text:"Put it in a GitHub repository for WHO to find",consequence:{title:"Nobody is looking there",by:"WHO Secretariat",steps:["GDHCN.ONB.Apply#A.P.Interest"],what:"No one at WHO watches a repository it hasn't been told about. tng-bot only reads repositories it is invited to, much later in onboarding.",why:"The Statement of Interest goes to gdhcn-secretariat@who.int.",days:4,travel:{legs:[["backend-github",1]],label:"Statement of Interest",kind:"paper"}}}],success:{travel:[{legs:[["paper",1]],label:"Statement of Interest",kind:"paper"}],note:"Received by the GDHCN Secretariat."},days:2,learn:"Onboarding starts with an email: the Statement of Interest goes to gdhcn-secretariat@who.int."},{id:"eligibility",phase:"A",title:"Prove you are eligible",steps:Et.eligibility,place:"ministry",role:"legal",type:"choice",brief:"WHO checks that the applicant is eligible and accepts the [[top|Terms of Participation (TOP)]]. {legalFirst}, your Legal representative, prepares the response.",docs:[{kind:"note",title:"Terms of Participation",lines:["[[top|TOP0]] · Share credentials for an mTLS connection to the Gateway","TOP1 · Follow the PKI technical specifications","TOP2 · Follow the certificate and API specifications for each trust domain","TOP3 · Meet the policy and regulatory standards for each trust domain","TOP4 · Provide your mandate and legal framework if WHO asks"]}],prompt:"Who applies, and on what terms?",choices:[{id:"ministry",correct:!0,text:"The Ministry of Health applies as the government health authority and accepts TOP0 to TOP4"},{id:"vendor",text:"Your software vendor applies on the ministry's behalf, with no delegation from the ministry",consequence:{title:"Application rejected",by:"WHO Secretariat",steps:["GDHCN.ONB.Apply#A.S.Check"],what:"WHO rejected the application by email. The applicant must be an eligible party, such as a ministry or an officially delegated health agency.",why:"Eligibility is checked before anything technical happens. Correct the details and apply again.",days:10,travel:{legs:[["paper",1]],label:"Application",kind:"paper"}}},{id:"partial",text:"Accept TOP0 to TOP2 now and leave the legal and policy terms for later",consequence:{title:"Application rejected",by:"WHO Secretariat",steps:["GDHCN.ONB.Apply#A.S.Check"],what:"WHO rejected it. Compliance with the Terms of Participation is part of the eligibility check.",why:"The policy and regulatory commitments are part of joining, not an optional extra.",days:7,travel:{legs:[["paper",1]],label:"Application",kind:"paper"}}}],success:{travel:[{legs:[["paper",-1]],label:"Invitation + technical specs",kind:"paper"}],note:"WHO invites {country} to onboard and sends the technical specifications for UAT and PROD (DEV is optional)."},days:10,learn:"Eligibility and the Terms of Participation are checked before any keys exist."},{id:"domains",phase:"A",title:"Choose your trust domains",steps:Et.domains,place:"ministry",role:"legal",type:"checklist",brief:"A country can join the GDHCN for zero, one or more trust domains. Each trust domain has its own Letter of Application and its own legal and policy requirements ([[top|TOP2 and TOP3]]). With none, {country} joins the Trust Network Gateway now and joins trust domains later. {legalFirst} confirms which ones {country} has the mandate for.",prompt:"Tick every trust domain {country} applies for now, or none.",checklist:{note:'Ticking none is allowed: {country} then joins with the Letter for no trust domain, and applies for a trust domain later through "Join a further Trust Domain".',button:"Confirm trust domains",minDomains:0,items:[...L_(),{text:"No need to choose: one application covers every trust domain",required:!1,why:"Each trust domain has its own Letter and its own legal and policy requirements. Apply for each one you join, now or later."}],consequence:{title:"Trust domain unclear",by:"WHO Secretariat",steps:["GDHCN.ONB.Apply#A.P.Letter","GDHCN.TrustDomain.Join#J.P.Letter"],what:"WHO couldn't tell which trust domains {country} is applying for.",why:"",days:3,travel:{legs:[["paper",1]],label:"Application",kind:"paper"}}},success:{note:"Applying for: {domains}."},days:3,learn:"Countries choose zero, one or more trust domains. Each has its own Letter and legal requirements, and more can be joined later."},{id:"team",phase:"A",title:"Name your team",steps:Et.team,place:"ministry",role:"business",type:"choice",brief:"WHO needs named people it can verify. {business}, the Business Owner, puts the team together.",docs:[{kind:"note",title:"{country} representatives",lines:["business","keymaster","legal","technical"].map(i=>`${Gn[i].title} · {${i}} · ${Gn[i].job}`)}],prompt:"How do you set the team up for onboarding?",choices:[{id:"four",correct:!0,text:"Name all four, each with an official government email address"},{id:"later",text:"Let the software vendor handle the keys and name the people later",consequence:{title:"The Letter can't be finished",by:"WHO Secretariat",steps:["GDHCN.ONB.Apply#A.P.Letter"],what:"The Letter of Application must name the people authorised to provide {country}'s key material, with their contact details. It can't go out with a blank.",why:"WHO verifies the named people in person or through the diplomatic channel, so they have to be named up front.",days:4}}],success:{note:"Four named representatives, each with an official address."},days:3,learn:"Four named roles carry onboarding: Business Owner, Key Master, Legal and Technical."},{id:"tools",phase:"B",title:"Set up the workbench",steps:Et.tools,place:"backend",role:"technical",type:"choice",brief:`{technicalFirst} sets up the tools: OpenSSL, cURL, Git, [[gpg|GPG]] and a [[github|GitHub]] account. On Windows, WHO's <a href="https://github.com/WorldHealthOrganization/GDHCNOnboardingWizard" target="_blank" rel="noopener">Onboarding Wizard</a> can do the repository, GPG and certificate steps for you.`,docs:[{kind:"terminal",title:"{technicalFirst}'s laptop",lines:["$ openssl version","OpenSSL 3.0.13 30 Jan 2024","$ git --version","git version 2.45.1","$ curl --version","curl 8.5.0 (x86_64-pc-linux-gnu) libcurl/8.5.0 OpenSSL/3.0.13","$ gpg --version","bash: gpg: command not found"],mark:[7]}],prompt:"GPG is missing. Do you need every tool?",choices:[{id:"all",correct:!0,text:"Install GPG too: every named person needs a GPG key, and the release tag must be signed"},{id:"nogpg",flag:"nogpg",text:"Skip GPG; Git and OpenSSL cover what we need"},{id:"skip",text:"Skip cURL; WHO tests the connection for us",consequence:{title:"It's your test",by:"WHO onboarding team",steps:["GDHCN.ONB.ConnectTest#X.P.Test"],what:"The connectivity test is run by the participant, from its own backend, with its own TLS certificate.",why:"You prove your backend can reach the Gateway. The operations team supports you if it fails.",days:2}}],success:{note:"Workbench ready."},days:2,learn:"Set up every tool before you start: OpenSSL, cURL, Git and GPG. On Windows, WHO's Onboarding Wizard can help."},{id:"certs",phase:"B",title:"Create your certificates",steps:Et.certs,place:"backend",role:"keymaster",type:"choice",brief:"{keymasterFirst} creates {country}'s certificates. Each environment needs its own [[sca|Signing CA (SCA)]], [[tls|TLS client certificate]] and [[upload|Upload certificate]]: [[dev]] (optional), [[uat]] and [[prod]].",docs:[{kind:"cert",title:"SCA · Signing CA",lines:["{country}'s trust anchor","Issues [[dsc|Document Signer Certificates (DSCs)]]"]},{kind:"cert",title:"TLS client certificate",lines:["Proves your backend's identity to the Gateway (mTLS)"]},{kind:"cert",title:"Upload certificate",lines:["Signs the packages you upload to the Gateway"]}],prompt:"How many sets do you create?",choices:[{id:"two",correct:!0,text:"A separate set for each environment: DEV (optional), UAT and PROD"},{id:"one",flag:"reuse",text:"One set, used in DEV, UAT and PROD; less to manage"},{id:"tls",text:"Only the TLS certificate for now; the rest can wait",consequence:{title:"Key material incomplete",by:"WHO Secretariat",steps:["GDHCN.ONB.PrepareKeys#K.Certs","GDHCN.ONB.Apply#A.P.Letter"],what:"tng-bot collects your SCA, TLS and Upload certificates from your GitHub repository, and two of them aren't there.",why:"All three are prepared for every environment you onboard to.",days:3}}],success:{note:"A separate set for each environment, never shared."},days:3,learn:"Never reuse keys or certificates between production and test environments."},{id:"sca",phase:"B",title:"Protect the trust anchor",steps:Et.sca,place:"backend",role:"keymaster",type:"choice",brief:"The SCA's private key is the root of trust for every Document Signer Certificate {country} will ever issue.",docs:[{kind:"key",title:"SCA private key",lines:["Signs Document Signer Certificates","Whoever holds it can speak for {country}"]}],prompt:"Where does it live?",choices:[{id:"vault",correct:!0,text:"Offline, in the vault, under multi-person control"},{id:"server",text:"On the backend server, so signing is quick",consequence:{title:"Trust anchor exposed",by:"Your own security review",steps:["page:concepts_certificate_governance"],what:"An online server can be compromised. If the SCA key leaks, every certificate it vouches for is in doubt.",why:"Keep the SCA offline, with more than one person needed to use it. A hardware security module or smart card adds further protection.",days:6}},{id:"repo",text:"In the GitHub repo next to the public keys, so nothing gets lost",consequence:{title:"Private key published",by:"Your own security review",steps:["GDHCN.ONB.PrepareKeys#K.Publish","GDHCN.ONB.PrepareKeys#K.Repo"],what:"A private key left the country. It has to be treated as compromised: revoke it, regenerate, and prepare the key material again.",why:"Only public keys go to GitHub. Private keys never cross the {country} boundary.",days:12,travel:{legs:[["backend-github",1]],label:"SCA private key",kind:"key"}}}],success:{note:"SCA private key locked in the offline vault."},days:1,learn:"Private keys stay inside {country}, and the SCA key stays offline."},{id:"gpg",phase:"B",title:"Create GPG keys",steps:Et.gpg,place:"backend",role:"keymaster",type:"choice",brief:"Every person authorised to provide key material needs a [[gpg|GPG key]] for each environment. WHO will compare it with the Letter of Application.",docs:[{kind:"key",title:"New GPG key · {keymaster}",lines:["Algorithm: RSA 4096","Email: ?"],mark:[1]}],prompt:"Which email goes in {keymasterFirst}'s GPG key?",choices:[{id:"official",correct:!0,text:"{keymasterEmail}, the address in the Letter and verified on {keymasterFirst}'s GitHub account"},{id:"gmail",flag:"gmail",text:"{keymasterPersonal}; their personal key is already set up"},{id:"shared",text:"One shared team key with it-team@{domain}",consequence:{title:"Shared key refused",by:"WHO Secretariat",steps:["GDHCN.ONB.PrepareKeys#K.Gpg","GDHCN.ONB.VerifyLetter#V.S.Gpg"],what:"GPG keys are created per authorised person and per environment.",why:"WHO verifies each named person and their own key.",days:3}}],checks:[{flag:"nogpg",consequence:{title:"GPG isn't installed",by:"Your own workbench",steps:["GDHCN.ONB.PrepareKeys#K.Gpg"],what:"{keymasterFirst} can't create a GPG key: GPG was never installed on the workbench.",why:"Every named person signs with a GPG key, and tng-bot only accepts a GPG-signed tag.",days:2},fix:"{technicalFirst} installs GPG, then {keymasterFirst} creates the key."}],success:{note:"GPG keys created for each authorised person, per environment."},days:1,learn:"The email inside each GPG key must match the email in the Letter of Application."},{id:"repos",phase:"B",title:"Set up the private repos",steps:Et.repos,place:"github",role:"technical",type:"choice",brief:"{technicalFirst} creates the [[repo|private GitHub repositories]] that [[tngbot|WHO's bot]] will read.",docs:[{kind:"note",title:"Repository setup",lines:["tng-{code3Lower}-uat · public keys (PEM)","tng-{code3Lower}-prod · public keys (PEM)","Invite: ?"],mark:[2]}],prompt:"How do you set them up?",choices:[{id:"right",correct:!0,text:"A private repo per environment; invite tng-bot-dev to UAT and tng-bot to PROD"},{id:"public",text:"Make them public so WHO can find them easily",consequence:{title:"Repositories must be private",by:"WHO Operations",steps:["GDHCN.ONB.PrepareKeys#K.Repo"],what:"The repositories have to be private.",why:"Private repositories hide the uploader's identity.",days:2}},{id:"onebot",text:"Invite tng-bot to both repositories",consequence:{title:"Wrong bot for UAT",by:"tng-bot",steps:["GDHCN.ONB.PrepareKeys#K.Repo"],what:"Nothing arrived in UAT.",why:"tng-bot serves PROD. tng-bot-dev serves DEV and UAT.",days:2,bot:!0}}],success:{travel:[{legs:[["backend-github",1]],label:"Public keys (PEM)",kind:"key"}],note:"Public keys are in the repos. tng-bot-dev and tng-bot are invited."},days:1,learn:"Public keys travel through private GitHub repos: tng-bot-dev reads UAT, tng-bot reads PROD."},{id:"tag",phase:"B",title:"Sign the tag",steps:Et.tag,place:"github",role:"keymaster",type:"choice",brief:"WHO's bot takes the latest git tag and checks its signature against your onboarded GPG keys. {keymasterFirst} marks the version WHO should use.",docs:[{kind:"note",title:"Release v1.0",lines:["GitHub website: Releases → Create a new tag","Terminal: git tag -s v1.0"]}],prompt:"How do you create the tag?",choices:[{id:"terminal",correct:!0,text:"Sign it from the terminal with git tag -s, using {keymasterFirst}'s GPG key"},{id:"web",flag:"webtag",text:"Create it on the GitHub website; it's quicker"},{id:"none",text:"Skip the tag; the bot will take the latest commit",consequence:{title:"Nothing to collect",by:"tng-bot",steps:["GDHCN.ONB.PrepareKeys#K.Publish"],what:"tng-bot clones the latest tag. With no tag, there is nothing to take over.",why:"Tag each version you want WHO to use, and sign it.",days:2,bot:!0}}],success:{note:"Signed tag v1.0 pushed."},days:1,learn:"Sign the git tag locally, from the terminal or an IDE. Tags made on the GitHub website can't be verified by tng-bot."},{id:"invite",phase:"B",title:"Beat the 7-day clock",steps:Et.invite,place:"ministry",role:"business",type:"choice",brief:"The bot invitations expire after 7 days. WHO has to accept them in that window, and it only knows to look if you tell it. The Letter of Application is a separate step and can follow later.",docs:[{kind:"email",title:"GitHub · invitations sent",lines:["tng-bot-dev invited to tng-{code3Lower}-uat","tng-bot invited to tng-{code3Lower}-prod","Expires in 7 days"],mark:[2]}],prompt:"What do you do?",choices:[{id:"now",correct:!0,text:"Email gdhcn-support@who.int that the bot invitations are waiting, so WHO accepts them this week"},{id:"wait",text:"Hold everything until the Letter is signed at next month's management meeting",consequence:{title:"Invitations expired",by:"GitHub",steps:["GDHCN.ONB.PrepareKeys#K.Invite","GDHCN.ONB.PrepareKeys#K.Accept"],what:"The invitations lapsed before WHO accepted them.",why:"The bot invitations don't wait for the Letter. Re-invite tng-bot and tng-bot-dev, then tell WHO straight away.",days:5}},{id:"silent",text:"Do nothing; WHO watches GitHub and will see them",consequence:{title:"Invitations expired",by:"GitHub",steps:["GDHCN.ONB.PrepareKeys#K.Invite","GDHCN.ONB.PrepareKeys#K.Accept"],what:"Nobody at WHO knew the invitations were there, and they lapsed.",why:"Tell WHO by email when the invitations are ready. Re-invite tng-bot and tng-bot-dev and restart the 7-day clock.",days:5}}],success:{note:"WHO told; bot invitations accepted in time."},days:2,learn:"Bot invitations expire after 7 days, so tell WHO they're ready. The Letter of Application can follow later."},{id:"letter",phase:"B",title:"Assemble the Letter of Application",steps:Et.letter,place:"ministry",role:"legal",type:"checklist",brief:"{legalFirst} prepares the Letters of Application ({domainLetters}; trust domains: {domains}). Keep it to the basics. The Letter names the people and points to the PROD repository; certificates and public keys live in GitHub.",prompt:"Tick everything that belongs in the Letter, then send it.",checklist:{items:[{text:"The PROD private repository name",required:!0},{text:"GPG public key fingerprints of the named people",required:!0},{text:"The four named contacts (Business Owner, Key Master, Legal, Technical) with official email addresses",required:!0},{text:"Private repository URLs for UAT and DEV",required:!1,why:"Testing needs no Letter. Only the PROD repository goes in."},{text:"SCA, TLS and Upload certificates",required:!1,why:"Certificates live in your GitHub repository, where tng-bot collects them."},{text:"{country}'s ISO participant code",required:!1,why:"WHO generates the ISO participant codes and matches them itself."},{text:"The SCA private key",required:!1,why:"Private keys never leave {country}."},{text:"The GitHub access token, so WHO can log in",required:!1,why:"WHO never needs your GitHub login. The bot is invited instead."},{text:"Scanned passports of the team",required:!1,why:"Identity is checked face to face or through the diplomatic channel (Convey the Letter)."},{text:"A statement accepting other participants' keys in the gateway lists",required:!1,why:"Not part of the WHO Letter templates."}],consequence:{title:"Letter returned",by:"WHO Secretariat",steps:["GDHCN.ONB.VerifyLetter#V.S.Check","GDHCN.ONB.VerifyLetter#V.P.Correct"],what:"WHO's checks on the Letter failed.",why:"",days:4,travel:{legs:[["paper",1]],label:"Letter of Application",kind:"paper"}}},success:{travel:[{legs:[["paper",1]],label:"Letter of Application",kind:"paper"}],note:"{domainLetters} of Application received by WHO."},days:3,learn:"The Letter names the people, their GPG keys and the PROD repository. Certificates stay in GitHub."},{id:"identity",phase:"C",title:"Prove who you are",steps:Et.identity,place:"ministry",role:"business",type:"choice",brief:"Before anyone can provide key material for {country}, WHO verifies the named people. Then it checks each GPG key.",prompt:"How do your representatives prove who they are?",choices:[{id:"f2f",correct:!0,text:"Meet WHO face to face with passports, or confirm through the diplomatic channel"},{id:"scan",text:"Email scanned passports to the GDHCN Secretariat",consequence:{title:"Not an accepted channel",by:"WHO Secretariat",steps:["GDHCN.ONB.ConveyLetter#C.P.Country","GDHCN.ONB.ConveyLetter#C.S.Meet"],what:"WHO can't verify identity from an emailed scan.",why:"Named people are confirmed face to face or by a signed diplomatic confirmation.",days:4}}],checks:[{flag:"gmail",consequence:{title:"Email mismatch",by:"WHO Secretariat",steps:["GDHCN.ONB.VerifyLetter#V.S.Gpg"],what:"{keymasterFirst}'s GPG key says {keymasterPersonal}. The Letter says {keymasterEmail}.",why:"WHO checks that the email inside every GPG key matches the email in the Letter of Application.",days:6,travel:{legs:[["paper",1]],label:"{keymasterFirst}'s GPG key",kind:"paper"}},fix:"{keymasterFirst} creates a new GPG key with the ministry address, signs the tag again and resends."}],success:{travel:[{legs:[["paper",-1]],label:"Identities confirmed",kind:"paper"}],note:"Identities confirmed and GPG keys checked."},days:10,learn:"WHO verifies people in person or diplomatically, then checks every GPG key against the Letter."},{id:"collect",phase:"C",title:"tng-bot collects your keys",steps:Et.collect,place:"github",role:"who",type:"watch",brief:"WHO passes {country}'s details to Operations. tng-bot clones your latest tag and checks its signature. For UAT, the keys are signed automatically and whitelisted.",prompt:"Watch tng-bot collect your keys.",checks:[{flag:"webtag",consequence:{title:"Signature can't be verified",by:"tng-bot",steps:["GDHCN.ONB.RegisterKeys#R.B.Pr"],what:"The tag was created on the GitHub website, which signs with GitHub's own key, not {keymasterFirst}'s.",why:"tng-bot verifies the tag against the GPG keys WHO onboarded. Sign tags locally, from the terminal or an IDE.",days:3,bot:!0},fix:"{keymasterFirst} creates the tag again from the terminal with git tag -s."}],success:{effect:"bot-collect",travel:[{legs:[["ops-uat",1]],label:"UAT keys: auto-signed",kind:"key"}],note:"UAT keys whitelisted on the UAT gateway."},days:3,learn:"tng-bot collects public keys from your repos, and UAT keys are signed automatically."},{id:"airgap",phase:"C",title:"WHO signs PROD offline",steps:Et.airgap,place:"ops",role:"who",type:"choice",brief:"PROD is different. WHO verifies the pull request, then signs your PROD keys with its [[anchor|Trust Anchor]] in an air-gapped process. The Trust Anchor's private key is never on the [[gateway|online gateway]].",prompt:"Your team asks how to speed this up. What do you say?",choices:[{id:"wait",correct:!0,text:"Wait for WHO's air-gapped signing and get ready for testing"},{id:"online",text:"Ask WHO to put the Trust Anchor on the gateway so PROD can be signed automatically",consequence:{title:"Not how trust works",by:"WHO Operations",steps:["GDHCN.ONB.RegisterKeys#R.T.Sign"],what:"WHO declined.",why:"The Trust Anchor's private key is kept offline. Every participant in the network relies on that separation.",days:2}}],checks:[{flag:"reuse",consequence:{title:"Same certificates in UAT and PROD",by:"WHO Operations",steps:["GDHCN.ONB.RegisterKeys#R.O.Verify"],what:"WHO's verification found {country}'s UAT certificates in the PROD request.",why:"Certificates and keys must never be reused between production and non-production. A test key can't become a production key.",days:6,travel:{legs:[["github-ops",1]],label:"PROD keys",kind:"key"}},fix:"{keymasterFirst} creates a fresh PROD set, updates the PROD repo and signs a new tag."}],success:{travel:[{legs:[["ops-prod",1]],label:"PROD keys: signed offline",kind:"key"}],note:"PROD keys signed offline. PROD whitelisting finishes, and the PROD gateway opens to you, only after the UAT dry run passes."},days:5,learn:"WHO's Trust Anchor stays offline, and PROD keys are signed in an air-gapped process."},{id:"connect",phase:"D",title:"Connect to UAT",steps:Et.connect,place:"backend",role:"technical",type:"choice",brief:"{technicalFirst} connects {country}'s backend to the [[uat|UAT]] gateway for the first time. Testing can run on [[dev|DEV]], UAT or [[prod|PROD]]; this example uses UAT.",docs:[{kind:"terminal",title:"Connectivity test",lines:["$ curl -v https://tng-uat.who.int/trustList \\","    --cert ????.pem --key ????_key.pem"],mark:[1]}],prompt:"Which certificate proves your backend's identity to the Gateway?",choices:[{id:"tls",correct:!0,text:"The TLS client certificate and its key"},{id:"upload",text:"The Upload certificate",consequence:{title:"Handshake failed",by:"UAT gateway",steps:["GDHCN.ONB.ConnectTest#X.P.Connect"],what:"The Gateway refused the connection.",why:"The TLS client certificate authenticates your backend (mTLS). The Upload certificate signs data packages.",days:1,travel:{legs:[["backend-uat",1]],label:"Upload certificate",kind:"data"}}},{id:"sca",text:"The SCA certificate",consequence:{title:"Wrong key, wrong place",by:"UAT gateway",steps:["GDHCN.ONB.ConnectTest#X.P.Connect"],what:"The connection failed, and the SCA key had to come out of the vault to try it.",why:"The SCA stays offline and signs Document Signer Certificates. Connections use the TLS certificate.",days:2,travel:{legs:[["backend-uat",1]],label:"SCA certificate",kind:"data"}}}],success:{travel:[{legs:[["backend-uat",1]],label:"GET /trustList (mTLS)",kind:"data"},{legs:[["backend-uat",-1]],label:"Trust list",kind:"data"}],note:"Connected. The UAT trust list came back."},days:1,learn:"Your TLS client certificate is what opens the mTLS connection to the Gateway."},{id:"dryrun",phase:"D",title:"Run the UAT dry run",steps:Et.dryrun,place:"backend",role:"technical",type:"choice",brief:"The dry run on UAT rehearses everything you'll do in production, including the bad day.",docs:[{kind:"note",title:"Dry-run checklist",lines:["a) Upload one or more DSCs","b) Delete (revoke) at least one DSC","c) Upload it again if needed","d) Download the trust list","e) Provide sample VDHCs","f) Validate sample VDHCs"]}],prompt:"What do you send to the onboarding team?",choices:[{id:"full",correct:!0,text:"Results for the full dry run, revocation included"},{id:"partial",text:"Upload and download only; revocation can wait for production",consequence:{title:"Dry run incomplete",by:"WHO onboarding team",steps:["GDHCN.ONB.GoLive#G.P.UAT","GDHCN.ONB.ConnectTest#X.P.Test"],what:"The onboarding team sent the results back.",why:"Revoking a DSC is part of the dry run. It is the move you'll need on your worst day.",days:3,travel:{legs:[["paper",1]],label:"Dry-run results",kind:"paper"}}}],success:{effect:"prod-open",travel:[{legs:[["backend-uat",1]],label:"Upload · revoke · download",kind:"data"},{legs:[["paper",1]],label:"Dry-run results",kind:"paper"}],note:"Dry run passed. WHO opens the PROD gateway to {country}."},days:3,learn:"The UAT dry run includes revocation: upload, revoke, download, then validate sample certificates."},{id:"prod",phase:"D",title:"Production readiness test",steps:Et.prod,place:"backend",role:"keymaster",type:"choice",brief:"{keymasterFirst} creates a Document Signer Certificate (DSC) signed by the SCA, offline, and wraps it in a CMS package to upload to PROD. The test then checks the trust list, revokes a DSC, and the results go to the service provider by email.",docs:[{kind:"note",title:"Production Readiness Test",lines:["a) Create a DSC, signed by the SCA","b) Wrap it in a CMS package","c) Upload the package to the PROD gateway","d) Download the trust list and check your DSC is there","e) Delete (revoke) at least one DSC","f) Upload it again if the DSC is needed","Then: email the results to the service provider"]},{kind:"terminal",title:"Build the CMS package",lines:["> openssl cms -sign -nodetach -in cert.der \\","    -signer ????.crt -inkey ????.key -out signed.der"],mark:[1]}],prompt:"Which certificate signs the CMS package?",choices:[{id:"upload",correct:!0,text:"The Upload certificate"},{id:"tls",text:"The TLS certificate",consequence:{title:"Upload rejected",by:"PROD gateway",steps:["GDHCN.ONB.GoLive#G.P.PROD"],what:"The Gateway rejected the package.",why:"Packages are signed with the Upload certificate. TLS only opens the connection.",days:2,travel:{legs:[["backend-prod",1]],label:"CMS package",kind:"data"}}},{id:"sca",text:"The SCA",consequence:{title:"Upload rejected",by:"PROD gateway",steps:["GDHCN.ONB.GoLive#G.P.PROD"],what:"The Gateway rejected the package.",why:"The SCA signs the DSC itself, offline. The package around it is signed with the Upload certificate.",days:2,travel:{legs:[["backend-prod",1]],label:"CMS package",kind:"data"}}}],success:{effect:"live",travel:[{legs:[["backend-prod",1]],label:"CMS package (DSC)",kind:"data"},{legs:[["backend-prod",-1]],label:"Trust list: {code} DSC present",kind:"data"},{legs:[["backend-prod",1]],label:"Delete a DSC (revocation)",kind:"data"},{legs:[["backend-prod",1]],label:"DSC uploaded again",kind:"data"},{legs:[["paper",1]],label:"Test results by email",kind:"paper"},{legs:[["paper",-1]],label:"Onboarding complete",kind:"paper"}],note:"Production Readiness Test passed. A confirmation email tells {country} and WHO that onboarding is complete."},days:3,learn:"In production, the SCA signs the DSC and the Upload certificate signs the package. The test also revokes a DSC, and the results go by email."},{id:"renew",phase:"E",title:"Stay live",steps:Et.renew,place:"dashboard",role:"keymaster",type:"choice",brief:"{country} is live. Its certificates expire: recommended validity is about 4 years for the SCA, 2 for a DSC, and 1 to 2 for Upload and TLS. WHO's certificate expiry dashboard (one each for DEV, UAT and PROD) shows {country}'s Upload certificate has 21 days left.",docs:[{kind:"dashboard",title:"Certificate expiry · PROD · {code}",lines:["SCA|1100","DSC|540","TLS client|330","Upload|21"],mark:[3]}],prompt:"Who makes sure they are renewed in time?",choices:[{id:"us",correct:!0,text:"We do. We track expiry ourselves, renew in good time (for example a month before expiry) and send WHO the new certificate"},{id:"who",text:"WHO will send a reminder before anything expires",consequence:{title:"Expired",by:"The network",steps:["page:concepts_certificate_governance"],what:"{country}'s Upload and TLS certificates expired. Uploads stopped and the backend lost its connection.",why:"The dashboard shows expiry dates, but no one sends reminders: each participant tracks its own certificates. Upload and TLS certificates must be renewed in good time, for example a month before expiry, and the new ones sent to WHO.",days:30}}],success:{note:"New Upload certificate made and sent to WHO. Renewal dates are in the team calendar."},days:0,learn:"Renewing certificates on time is {country}'s job for as long as it stays in the network."}];function N_(i){return[...i.matchAll(/[^.[\]]+/g)].map(e=>e[0])}function I_(i,e){if(i!=null)return Array.isArray(i)?/^\d+$/.test(e)?i[Number(e)]:i.find(t=>t&&typeof t=="object"&&(t.id===e||t.flag===e)):typeof i=="object"?i[e]:void 0}function eu(i,e){let t=i;for(const n of e)t=I_(t,n);return t}function O_(i,e,t){const n=eu(i,e.slice(0,-1)),s=e[e.length-1];if(!n||typeof n!="object")return!1;if(Array.isArray(n)){const r=/^\d+$/.test(s)?Number(s):n.findIndex(a=>(a==null?void 0:a.id)===s||(a==null?void 0:a.flag)===s);return r<0||typeof n[r]!="string"?!1:(n[r]=t,!0)}return typeof n[s]!="string"?!1:(n[s]=t,!0)}const tu=()=>Object.fromEntries(yu("scenario:"));function U_(i){var n;if(wt()==="en")return i;const e=tu(),t=new Map(i.map(s=>[s.id,s]));for(const[s,r]of Object.entries(e)){const a=N_(s),o=t.get(a[0]);if(!o)continue;const l=a.slice(1),c=l[0]==="docs"&&((n=eu(o,l.slice(0,2)))==null?void 0:n.kind)==="terminal";O_(o,l,c?r:ss(r))}return i}function k_(i,e){if(wt()==="en")return;const t=tu();for(const n of Object.keys(i)){const s=t[`phases.${n}`];s&&(i[n]=ss(s))}for(const n of Object.keys(e))for(const s of["name","title","initials","job"]){const r=t[`roles.${n}.${s}`];r&&(e[n][s]=ss(r))}}const fn={country:Le("settings.ts:DEFAULTS.country"),code:"XXC",names:{business:"Dr Zawadi Nkosi",keymaster:"Kwame Mensah",legal:"Sara Diallo",technical:"Tendai Banda"}},nu=["DDCC"];let Un=[...nu];const F_=()=>Un,B_=i=>{Un=[...i]},Uc=()=>{Un=[...nu]},iu=i=>i.length<2?i.join(""):`${i.slice(0,-1).join(", ")}${Le("settings.ts:domains.and")}${i[i.length-1]}`,H_=new Set(["domains","domainCount","domainLetters"]),su="gdhcn-game-settings";k_(Rr,Gn);const z_=U_(structuredClone(_t));let Qo=structuredClone(fn);function G_(){try{const i=localStorage.getItem(su);if(i){const e=JSON.parse(i);(e.country===jo["settings.ts:DEFAULTS.country"]||e.country==="Pays XC")&&(e.country=fn.country);const t=typeof e.code=="string"&&e.code.length===2?ru(e.code):e.code;return{...fn,...e,...t?{code:t}:{},names:{...fn.names,...e.names??{}}}}}catch{}return structuredClone(fn)}function V_(i){try{localStorage.setItem(su,JSON.stringify(i))}catch{}}const yi=()=>Qo,el=Object.fromEntries("AD:AND AE:ARE AF:AFG AG:ATG AI:AIA AL:ALB AM:ARM AO:AGO AQ:ATA AR:ARG AS:ASM AT:AUT AU:AUS AW:ABW AX:ALA AZ:AZE BA:BIH BB:BRB BD:BGD BE:BEL BF:BFA BG:BGR BH:BHR BI:BDI BJ:BEN BL:BLM BM:BMU BN:BRN BO:BOL BQ:BES BR:BRA BS:BHS BT:BTN BV:BVT BW:BWA BY:BLR BZ:BLZ CA:CAN CC:CCK CD:COD CF:CAF CG:COG CH:CHE CI:CIV CK:COK CL:CHL CM:CMR CN:CHN CO:COL CR:CRI CU:CUB CV:CPV CW:CUW CX:CXR CY:CYP CZ:CZE DE:DEU DJ:DJI DK:DNK DM:DMA DO:DOM DZ:DZA EC:ECU EE:EST EG:EGY EH:ESH ER:ERI ES:ESP ET:ETH FI:FIN FJ:FJI FK:FLK FM:FSM FO:FRO FR:FRA GA:GAB GB:GBR GD:GRD GE:GEO GF:GUF GG:GGY GH:GHA GI:GIB GL:GRL GM:GMB GN:GIN GP:GLP GQ:GNQ GR:GRC GS:SGS GT:GTM GU:GUM GW:GNB GY:GUY HK:HKG HM:HMD HN:HND HR:HRV HT:HTI HU:HUN ID:IDN IE:IRL IL:ISR IM:IMN IN:IND IO:IOT IQ:IRQ IR:IRN IS:ISL IT:ITA JE:JEY JM:JAM JO:JOR JP:JPN KE:KEN KG:KGZ KH:KHM KI:KIR KM:COM KN:KNA KP:PRK KR:KOR KW:KWT KY:CYM KZ:KAZ LA:LAO LB:LBN LC:LCA LI:LIE LK:LKA LR:LBR LS:LSO LT:LTU LU:LUX LV:LVA LY:LBY MA:MAR MC:MCO MD:MDA ME:MNE MF:MAF MG:MDG MH:MHL MK:MKD ML:MLI MM:MMR MN:MNG MO:MAC MP:MNP MQ:MTQ MR:MRT MS:MSR MT:MLT MU:MUS MV:MDV MW:MWI MX:MEX MY:MYS MZ:MOZ NA:NAM NC:NCL NE:NER NF:NFK NG:NGA NI:NIC NL:NLD NO:NOR NP:NPL NR:NRU NU:NIU NZ:NZL OM:OMN PA:PAN PE:PER PF:PYF PG:PNG PH:PHL PK:PAK PL:POL PM:SPM PN:PCN PR:PRI PS:PSE PT:PRT PW:PLW PY:PRY QA:QAT RE:REU RO:ROU RS:SRB RU:RUS RW:RWA SA:SAU SB:SLB SC:SYC SD:SDN SE:SWE SG:SGP SH:SHN SI:SVN SJ:SJM SK:SVK SL:SLE SM:SMR SN:SEN SO:SOM SR:SUR SS:SSD ST:STP SV:SLV SX:SXM SY:SYR SZ:SWZ TC:TCA TD:TCD TF:ATF TG:TGO TH:THA TJ:TJK TK:TKL TL:TLS TM:TKM TN:TUN TO:TON TR:TUR TT:TTO TV:TUV TW:TWN TZ:TZA UA:UKR UG:UGA UM:UMI US:USA UY:URY UZ:UZB VA:VAT VC:VCT VE:VEN VG:VGB VI:VIR VN:VNM VU:VUT WF:WLF WS:WSM YE:YEM YT:MYT ZA:ZAF ZM:ZMB ZW:ZWE".split(" ").map(i=>i.split(":"))),_o=i=>i.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/['’`]/g,"").replace(/[^a-z0-9]+/g," ").trim().replace(/^the /,""),W_={"ivory coast":"CIV","cote d'ivoire":"CIV",drc:"COD","democratic republic of the congo":"COD","dr congo":"COD","republic of the congo":"COG","congo-brazzaville":"COG",tanzania:"TZA",turkey:"TUR",turkiye:"TUR",uk:"GBR","great britain":"GBR",britain:"GBR",usa:"USA",america:"USA","united states of america":"USA",russia:"RUS","south korea":"KOR",korea:"KOR","north korea":"PRK",eswatini:"SWZ",swaziland:"SWZ","cape verde":"CPV","cabo verde":"CPV",laos:"LAO",vietnam:"VNM","viet nam":"VNM",syria:"SYR",iran:"IRN",bolivia:"BOL",venezuela:"VEN","czech republic":"CZE",czechia:"CZE","the gambia":"GMB",gambia:"GMB"};let _s;function $_(){if(!_s){_s=new Map;try{const i=new Intl.DisplayNames(["en"],{type:"region"});for(const[e,t]of Object.entries(el)){const n=i.of(e);n&&n!==e&&_s.set(_o(n),t)}}catch{}for(const[i,e]of Object.entries(W_))_s.set(_o(i),e)}return _s}const X_=new Set(Object.values(el));function q_(i){const e=i.normalize("NFD").replace(/[^A-Za-z]/g,"").toUpperCase(),t=[...e.slice(1)].filter(r=>!"AEIOU".includes(r)),n=r=>(r+"XXX").slice(0,3);return[n(e.slice(0,3)),n(e.slice(0,1)+t.slice(0,2).join("")),n(e.slice(0,2)),n(e.slice(0,1))].find(r=>!X_.has(r))??"XXC"}function ya(i){const e=_o(i);if(!e)return"";const t=$_(),n=t.get(e);if(n)return n;if(e.length>=4){const s=new Set([...t].filter(([r])=>r.startsWith(e)).map(([,r])=>r));if(s.size===1)return[...s][0]}return q_(i)}function ru(i){const e=i.toUpperCase();return e.length===3?e:el[e]??`X${e}`.slice(0,3)}const Y_=i=>i.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z]/g,""),tl=i=>i.replace(/^(?:(?:dr|prof|mr|mrs|ms|hon|pr|mme|mlle)\.?|m\.)\s+/i,"").trim().split(/\s+/),xa=i=>tl(i)[0]??i,K_=i=>tl(i).slice(0,2).map(e=>e[0]??"").join("").toUpperCase();function j_(i){const e=i.code.toUpperCase(),t=ru(e),n="health.gov",s=tl(i.names.keymaster).map(Y_).filter(Boolean),r=s.length>1?`${s[0]}.${s[s.length-1]}`:s[0]??"keymaster";return{country:i.country,code:t,codeLower:t.toLowerCase(),code3:t,code3Lower:t.toLowerCase(),domain:n,business:i.names.business,keymaster:i.names.keymaster,legal:i.names.legal,technical:i.names.technical,keymasterFirst:xa(i.names.keymaster),legalFirst:xa(i.names.legal),technicalFirst:xa(i.names.technical),keymasterEmail:`${r}@${n}`,keymasterPersonal:`${r}@gmail.com`,domains:Un.length?iu(Un):Le("settings.ts:domains.none"),domainCount:String(Un.length),domainLetters:Le(Un.length===0?"settings.ts:letter.zero":Un.length===1?"settings.ts:letter.one":"settings.ts:letter.other",{n:Un.length})}}function ks(i,e=Qo,t=!1){const n=j_(e);return wt()==="fr"&&(i=i.replace(/\b(de|De) \{country\}/g,(s,r)=>Xh(r,n.country))),i.replace(/\{(\w+)\}/g,(s,r)=>(t&&H_.has(r)?void 0:n[r])??s)}function Z_(i){return{...i,brief:ks(i.brief),prompt:ks(i.prompt)}}function yo(i,e){return typeof i=="string"?ks(i,e,!0):Array.isArray(i)?i.map(t=>yo(t,e)):i&&typeof i=="object"?Object.fromEntries(Object.entries(i).map(([t,n])=>[t,yo(n,e)])):i}function J_(i){Qo=i,_t.splice(0,_t.length,...yo(z_,i));for(const e of Object.keys(i.names))Gn[e].name=i.names[e],Gn[e].initials=K_(i.names[e])||Gn[e].initials}const au="gdhcn-dev-unlocked",nl="gdhcn-dev-on",ou=i=>{try{return localStorage.getItem(i)==="1"}catch{return!1}},xo=(i,e)=>{try{localStorage.setItem(i,e?"1":"0")}catch{}};/(^|[#&])dev\b/.test(location.hash)&&(xo(au,!0),xo(nl,!0));const lu=()=>ou(au),$i=()=>lu()&&ou(nl),Q_=i=>xo(nl,i);function kc(i){location.hash=i==="end"?"end":`m=${i}`,location.reload()}const Fc=i=>i>=5?"gloomy":i>=2?"sad":"meh",Bc=[1,2,3,4,5,6].map(i=>Le(`cat.ts:SETBACK_LINES.${i}`)),ey=()=>Bc[Math.floor(Math.random()*Bc.length)];function bo(i){const e="#2f3466";return`<svg viewBox="0 0 72 64" width="72" height="64" aria-hidden="true" class="cat cat-${i}">
    ${i==="gloomy"?`<g class="cat-cloud"><path d="M22 2 a6 6 0 0 1 11 -2 a7 7 0 0 1 13 2 a5 5 0 0 1 0 10 h-24 a5 5 0 0 1 0 -10z" fill="#c9cde6"/>
       <path d="M27 14 l-1.5 3.5 M35 14 l-1.5 3.5 M43 14 l-1.5 3.5" stroke="#6f9cf0" stroke-width="2" stroke-linecap="round"/></g>`:""}${i==="crown"?'<path d="M25 9 l4 -8 l7 6 l7 -6 l4 8 z" fill="#f2b64a" stroke="#c98a12" stroke-width="1.5" stroke-linejoin="round"/>':""}
    <path d="M14 64 q-2 -26 22 -26 q24 0 22 26" fill="#fff" stroke="${e}" stroke-width="2.4"/>
    <path d="${i==="crown"?"M58 56 q14 -6 8 -20":"M58 58 q12 2 10 -8"}" fill="none" stroke="${e}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M18 22 q-4 20 18 22 q22 -2 18 -22 q-4 -6 -18 -6 q-14 0 -18 6z" fill="#fff" stroke="${e}" stroke-width="2.4"/>
    <path d="${i==="meh"||i==="crown"?"M18 22 L22 8 L30 18 M42 18 L50 8 L54 22":i==="sad"?"M17 24 L15 12 L28 19 M44 19 L57 12 L55 24":"M18 27 L5 29 L22 19 M50 19 L67 29 L54 27"}" fill="#fff" stroke="${e}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="${i==="crown"?"M27 31 q3 -4 6 0 M39 31 q3 -4 6 0":i==="meh"?"M27 31 h6 M39 31 h6":"M27 30 q3 4 6 0 M39 30 q3 4 6 0"}" fill="none" stroke="${e}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="${i==="crown"?"M33 37 q3 3 6 0":"M33 39 q3 -3 6 0"}" fill="none" stroke="${e}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M24 35 h-8 M24 38 l-7 2 M48 35 h8 M48 38 l7 2" stroke="${e}" stroke-width="1.2" stroke-linecap="round"/>
    ${i==="gloomy"?'<path d="M45 34 q2 4 0 6 q-2 -2 0 -6z" fill="#6f9cf0"/>':""}
  </svg>`}function cu(){try{const i=window.AudioContext??window.webkitAudioContext,e=new i,t=e.createOscillator(),n=e.createGain();t.type="triangle";const s=e.currentTime;t.frequency.setValueAtTime(420,s),t.frequency.exponentialRampToValueAtTime(700,s+.09),t.frequency.exponentialRampToValueAtTime(520,s+.22),n.gain.setValueAtTime(1e-4,s),n.gain.exponentialRampToValueAtTime(.12,s+.03),n.gain.exponentialRampToValueAtTime(1e-4,s+.26),t.connect(n).connect(e.destination),t.start(s),t.stop(s+.28),setTimeout(()=>e.close(),500)}catch{}}const hu="gdhcn-cats-found",ty={country:Le("cat.ts:WORLD_CATS.country"),gateway:Le("cat.ts:WORLD_CATS.gateway"),who:Le("cat.ts:WORLD_CATS.who")};function So(){try{return JSON.parse(localStorage.getItem(hu)??"[]")}catch{return[]}}function ny(i){const e=new Set(So());e.add(i);try{localStorage.setItem(hu,JSON.stringify([...e]))}catch{}return e.size}const kt=i=>Le(`data.ts:${i}`),Ss=[{id:"icvp",title:kt("icvp.title"),subtitle:kt("icvp.subtitle"),tag:kt("icvp.tag"),video:"video/icvp-marys-yellow-card.mp4",videoFr:"video/icvp-marys-yellow-card-fr.mp4",poster:"video/icvp-marys-yellow-card.jpg",posterFr:"video/icvp-marys-yellow-card-fr.jpg",minutes:kt("icvp.minutes"),summary:kt("icvp.summary"),idea:kt("icvp.idea"),how:[1,2,3,4].map(i=>kt(`icvp.how${i}`)),why:kt("icvp.why")},{id:"maternal",title:kt("maternal.title"),subtitle:kt("maternal.subtitle"),tag:kt("maternal.tag"),video:"video/maternal-aminas-journey.mp4",videoFr:"video/maternal-aminas-journey-fr.mp4",poster:"video/maternal-aminas-journey.jpg",posterFr:"video/maternal-aminas-journey-fr.jpg",minutes:kt("maternal.minutes"),summary:kt("maternal.summary"),idea:kt("maternal.idea"),how:[1,2,3,4].map(i=>kt(`maternal.how${i}`)),why:kt("maternal.why")}],iy={github:{term:"GitHub",def:"GitHub is a website for storing code and files in repositories, with a full history of every change. In GDHCN onboarding, each country keeps its public keys and certificates in its own private GitHub repositories, and WHO's tng-bot collects them from there."},repo:{term:"Private repository",def:"A folder on GitHub with version history. Private means only the people and bots you invite can see it."},top:{term:"Terms of Participation (TOP)",def:"The five commitments, TOP0 to TOP4, that every GDHCN participant accepts: from following the technical specifications to meeting legal and policy standards."},sca:{term:"SCA · Signing Certificate Authority",def:"Your country's own trust anchor. Its private key signs your Document Signer Certificates and is kept offline."},dsc:{term:"DSC · Document Signer Certificate",def:"Signs the health documents, such as vaccination certificates, that verifiers check."},tls:{term:"TLS client certificate",def:"Proves your backend's identity when it connects to the Gateway (mutual TLS)."},upload:{term:"Upload certificate",def:"Signs the packages of certificates your country uploads to the Gateway."},dev:{term:"DEV",def:"Development environment. Optional, for early technical trials."},uat:{term:"UAT",def:"User Acceptance Testing: the test gateway where you prove everything works before production. Test keys only."},prod:{term:"PROD",def:"Production: the live Trust Network Gateway. Real keys, signed offline by WHO."},tngbot:{term:"tng-bot",def:"WHO's automated GitHub account. tng-bot-dev serves DEV and UAT; tng-bot serves PROD. It only reads repositories it is invited to."},gpg:{term:"GPG key",def:"A personal key pair each named person uses to sign. WHO checks the email inside it against the Letter of Application."},anchor:{term:"Trust Anchor",def:"WHO's top-level key that signs every country's PROD keys. It is kept offline, never on the Gateway."},gateway:{term:"Trust Network Gateway",def:"WHO's server where participants exchange public keys and trust lists."}},il=Object.fromEntries(Object.entries(iy).map(([i,e])=>[i,{term:ss(Sa(`glossary:${i}.term`)??e.term),def:ss(Sa(`glossary:${i}.def`)??e.def)}])),uu=/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,sy=i=>i.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");function du(i,e){var t;return e??((t=il[i])==null?void 0:t.term)??i}function Dt(i){return i.replace(uu,(e,t,n)=>{const s=t.trim(),r=du(s,n);return il[s]?`<span class="tip" tabindex="0" data-tip="${sy(s)}">${r}</span>`:r})}function Fs(i){return i.replace(uu,(e,t,n)=>du(t.trim(),n))}const Hc=i=>{const[e,...t]=i.split(" ");return t.length?`${e} <span>${t.join(" ")}</span>`:`<span>${i}</span>`},F=(i,e)=>Le(`ui.ts:${i}`,e),ry=i=>{const e=document.createElement("template");return e.innerHTML=i.trim(),e.content.firstElementChild},fu=["A","B","C","D","E"];class ay{constructor(e){xe(this,"hudEl");xe(this,"statsEl");xe(this,"stripEl");xe(this,"routeEl");xe(this,"deskEl");xe(this,"toastEl");xe(this,"menuEl");xe(this,"detourCount",0);var n;this.root=e,this.hudEl=this.mount('<div id="hud" class="glass hidden"></div>'),this.statsEl=this.mount(`<div id="stats" class="glass hidden">
      <div class="stat"><span class="stat-n" id="days">0</span><span class="stat-l">${F("stats.days")}</span></div>
      <div class="stat"><span class="stat-n bad" id="detours">0</span><span class="stat-l">${F("stats.detours")}</span></div>
      <button id="reset-view" title="${F("stats.resetView")}">⟲</button></div>`),this.statsEl.querySelector("#reset-view").addEventListener("click",()=>dispatchEvent(new CustomEvent("reset-view"))),this.stripEl=this.mount(`<div id="strip" class="glass hidden">
      <button class="strip-btn" data-leave="home" title="${F("strip.homeTitle")}">${Hc(F("strip.home"))}</button>
      <div class="strip-route"></div>
      <button class="strip-btn" data-leave="restart" title="${F("strip.restartTitle")}">${Hc(F("strip.restart"))}</button></div>`),this.routeEl=this.stripEl.querySelector(".strip-route"),this.stripEl.querySelectorAll("[data-leave]").forEach(s=>s.addEventListener("click",async()=>{const r=s.dataset.leave;await this.confirmLeave(r)&&t(r)})),this.deskEl=this.mount('<div id="desk" class="glass"></div>'),this.toastEl=this.mount('<div id="toast" class="glass"></div>'),this.mount(`<nav id="topnav" class="glass">
      <a class="nav-brand" href="./" data-go="home" title="${F("navBrandTitle")}">${F("navBrand")}</a>
      <span class="nav-title">${F("navTitle")}</span>
      <div class="nav-items">
        ${$i()?`<span class="dev-chip">${F("dev.chip")}</span><button class="nav-btn" data-go="end" title="${F("dev.endTitle")}">${F("dev.end")}</button>`:""}
        <button class="nav-btn" data-go="usecases">${F("navUseCases")}</button>
        <button class="nav-btn" id="settings-btn" aria-haspopup="true">${F("navSettings")}</button>
        <div class="lang-switch" role="group" aria-label="${F("navLang")}">
          ${xu.map(s=>`<button type="button" data-lang="${s}" lang="${s}" title="${pl[s]}" aria-label="${pl[s]}" aria-pressed="${wt()===s}">${bu[s]}</button>`).join("")}
        </div>
      </div></nav>`),this.menuEl=this.mount(`<div id="menu" class="glass">
      <button data-go="restart">${F("menu.restart")}</button>
      <div class="menu-l">${F("menu.jumpLabel")}</div>
      ${fu.map(s=>`<button data-go="${s}">${F("menu.phaseButton",{p:s,name:Rr[s]})}</button>`).join("")}
      <button data-go="about">${F("menu.about")}</button>
      ${lu()?`<div class="menu-l">${F("dev.reviewerTools")}</div>
      <label class="menu-toggle"><input type="checkbox" id="dev-toggle" ${$i()?"checked":""}> ${F("dev.toggle")} <span>${F("dev.toggleHint")}</span></label>`:""}
      </div>`),document.getElementById("settings-btn").addEventListener("click",()=>this.menuEl.classList.toggle("open")),(n=document.getElementById("dev-toggle"))==null||n.addEventListener("change",s=>{Q_(s.target.checked),location.reload()});const t=s=>{if(this.menuEl.classList.remove("open"),s==="about"){this.about();return}if(s==="end"){kc("end");return}if(s==="usecases"){dispatchEvent(new CustomEvent("open-usecases"));return}if(s==="home"){location.hash="",location.reload();return}location.hash=s==="restart"?"restart":`phase=${s}`,location.reload()};this.menuEl.addEventListener("click",s=>{const r=s.target.dataset.go;r&&t(r)}),document.getElementById("topnav").addEventListener("click",s=>{var o,l;const r=(o=s.target.closest("[data-lang]"))==null?void 0:o.dataset.lang;if(r){r!==wt()&&Su(r)&&Mu(r);return}const a=(l=s.target.closest("[data-go]"))==null?void 0:l.dataset.go;a&&(s.preventDefault(),t(a))})}mount(e){const t=ry(e);return this.root.appendChild(t),t}title(e){const t=e.names,n=this.mount(`<div id="title" class="overlay">
      <div class="title-wrap">
      <div class="title-card glass">
        <div class="eyebrow">${F("title.eyebrow")}</div>
        <h1>${F("title.h1")}</h1>
        <p class="lede">${F("title.lede")}</p>
        <div class="setup">
          <label class="f-country">${F("title.countryLabel")}<input id="s-country" maxlength="32" autocomplete="off"></label>
          <label class="f-code">${F("title.codeLabel")}<input id="s-code" maxlength="3" autocomplete="off"></label>
        </div>
        <p class="code-hint">${F("title.codeHint")}</p>
        <details class="adv"><summary>${F("title.advancedSummary")}</summary>
          <div class="team">
            ${[["business","Business","BO"],["keymaster","Keymaster","KM"],["legal","Legal","LG"],["technical","Technical","TC"]].map(([u,d])=>`<label><span class="avatar r-${u}">${F(`title.avatar${d}`)}</span>${F(`title.team${d}`)}<input data-p="${u}"><span class="job">${Gn[u].job}</span></label>`).join("")}
          </div>
          <button class="link reset" type="button">${F("title.resetSample")}</button>
        </details>
        <div class="title-grid">
          <div><span class="dot c-country"></span><b class="t-cname"></b><br>${F("title.gridCountry")}</div>
          <div><span class="dot c-network"></span><b>${F("title.gridNetworkName")}</b><br>${F("title.gridNetwork")}</div>
          <div><span class="dot c-who"></span><b>${F("title.gridWhoName")}</b><br>${F("title.gridWho")}</div>
          <div><span class="dot c-github"></span><b>${F("title.gridGithubName")}</b><br>${F("title.gridGithub")}</div>
        </div>
        <p class="small">${F("title.smallLead")} <span class="paper">${F("title.smallPaper")}</span>, <span class="data">${F("title.smallData")}</span>.</p>
        <div class="title-actions"><button class="primary" id="start">${F("title.start")}</button><button class="ghost" id="watch-demo">${F("title.watchDemo")}</button><button class="ghost" id="explore-btn">${F("title.explore")}</button></div>
        <p class="fine">${F("title.fine")}</p>
      </div>
      <aside class="title-side glass">
        <div class="eyebrow">${F("title.sideEyebrow")}</div>
        <p class="side-lede">${F("title.sideLede")}</p>
        <button class="side-tile" id="side-demo">
          <span class="side-thumb" style="background-image:url('./video/demo-overview.jpg')"><span class="uc-play">▶</span><span class="uc-len">${F("title.sideDemoLength")}</span></span>
          <span class="side-text"><span class="uc-tag">${F("title.sideDemoTag")}</span><b>${F("title.sideDemoTitle")}</b><span class="uc-sub">${F("title.sideDemoSub")}</span></span>
        </button>
        ${wt()==="en"?`<a class="side-dl" href="./video/join-the-network-demo-en.mp4" download>${F("title.sideDownload")}</a>`:""}
        ${Ss.map(u=>`<button class="side-tile" data-uc="${u.id}">
          <span class="side-thumb" style="background-image:url('./${wt()==="fr"?u.posterFr??u.poster:u.poster}')"><span class="uc-play">▶</span><span class="uc-len">${u.minutes}</span></span>
          <span class="side-text"><span class="uc-tag">${u.tag}</span><b>${u.title}</b><span class="uc-sub">${u.subtitle}</span></span>
        </button>`).join("")}
      </aside>
      </div></div>`),s=u=>n.querySelector(u),r=s("#s-country"),a=s("#s-code"),o=[...n.querySelectorAll(".team input")];let l=e.code!==ya(e.country)&&!(e.country===fn.country&&e.code===fn.code);const c=u=>{r.value=u.country,a.value=u.code,o.forEach(d=>{d.value=u.names[d.dataset.p]}),s(".t-cname").textContent=u.country};c({...e,names:t}),r.addEventListener("input",()=>{l||(a.value=ya(r.value)),s(".t-cname").textContent=r.value||F("title.countryFallback")}),a.addEventListener("input",()=>{a.value=a.value.toUpperCase().replace(/[^A-Z]/g,""),l=a.value!==""}),s(".reset").addEventListener("click",()=>{l=!1,c(structuredClone(fn))});const h=()=>{const u={...fn.names};o.forEach(v=>{v.value.trim()&&(u[v.dataset.p]=v.value.trim())});const d=r.value.trim()||fn.country,p=a.value.trim().toUpperCase(),g=r.value.trim()?ya(d):fn.code;return{country:d,code:p.length===3?p:g,names:u}};return new Promise(u=>{const d=p=>{n.classList.add("gone"),setTimeout(()=>n.remove(),500),u({mode:p,settings:h()})};s("#start").addEventListener("click",()=>d("play")),s("#watch-demo").addEventListener("click",()=>d("demo")),s("#explore-btn").addEventListener("click",()=>d("explore")),s("#side-demo").addEventListener("click",()=>d("demo")),n.querySelectorAll(".side-tile[data-uc]").forEach(p=>p.addEventListener("click",()=>dispatchEvent(new CustomEvent("open-usecase",{detail:p.dataset.uc}))))})}about(){const e=this.mount(`<div class="overlay"><div class="title-card glass">
      <h2>${F("about.h2")}</h2>
      <p>${F("about.p1")}</p>
      <p>${F("about.p2")}</p>
      <button class="primary">${F("about.close")}</button>
      ${So().length?`<p class="built-by">${F("about.cats",{n:So().length})}</p>`:""}
      <p class="built-by">${F("about.builtBy")} <a href="https://osforge.co.za" target="_blank" rel="noopener">${F("about.osforge")}</a></p></div></div>`);e.querySelector("button").addEventListener("click",()=>e.remove())}showChrome(){for(const e of[this.hudEl,this.statsEl,this.stripEl])e.classList.remove("hidden")}hud(e){const t=Gn[e.role];this.hudEl.innerHTML=`
      <div class="hud-top"><span class="chip phase-${e.phase}">${e.phase} · ${Rr[e.phase]}</span>${fi(e.steps)}</div>
      <div class="hud-title">${e.title}</div>
      <div class="hud-role"><span class="avatar r-${e.role}">${t.initials}</span>${e.role==="who"?t.title:F("hud.role",{name:t.name,title:t.title})}</div>`}stats(e,t){this.detourCount=t,this.statsEl.querySelector("#days").textContent=String(e),this.statsEl.querySelector("#detours").textContent=String(t)}strip(e,t){this.routeEl.innerHTML=zc(e,t,!1),$i()&&(this.stripEl.classList.add("dev"),this.routeEl.querySelectorAll("[data-i]").forEach(n=>n.addEventListener("click",()=>kc(Number(n.dataset.i)))))}confirmLeave(e){const t=this.statsEl.querySelector("#days").textContent,n=F("confirm.lost",{days:t??0,n:this.detourCount}),s=e==="restart"?{h:F("confirm.restartTitle"),p:`${n} ${F("confirm.restartBody")}`,ok:F("confirm.restartOk")}:{h:F("confirm.homeTitle"),p:`${n} ${F("confirm.homeBody")}`,ok:F("confirm.homeOk")},r=this.mount(`<div class="overlay confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-h"><div class="title-card glass">
      <h2 id="confirm-h">${s.h}</h2><p>${s.p}</p>
      <div class="confirm-actions"><button class="primary" data-ok>${s.ok}</button><button class="ghost" data-cancel>${F("confirm.cancel")}</button></div></div></div>`);return new Promise(a=>{const o=c=>{removeEventListener("keydown",l),r.remove(),a(c)},l=c=>{c.key==="Escape"&&o(!1)};addEventListener("keydown",l),r.querySelector("[data-ok]").addEventListener("click",()=>o(!0)),r.querySelector("[data-cancel]").addEventListener("click",()=>o(!1)),r.addEventListener("click",c=>{c.target===r&&o(!1)}),r.querySelector("[data-cancel]").focus()})}openDesk(e,t=""){this.deskEl.className=`glass open ${t}`,this.deskEl.innerHTML=e,this.deskEl.scrollTop=0}hideDesk(){this.deskEl.className="glass"}header(e){const t=Gn[e.role];return`<div class="desk-head"><span class="avatar r-${e.role}">${t.initials}</span>
      <div><div class="desk-who">${e.role==="who"?F("desk.whoName"):t.name}</div><div class="desk-sub">${e.role==="who"?F("desk.whoSub"):t.title}</div></div>
      ${fi(e.steps)}</div>
      <h2>${e.title}</h2><p class="brief">${Dt(e.brief)}</p>
      ${e.docs?`<div class="docs">${e.docs.map(fy).join("")}</div>`:""}`}ask(e,t){const n=e.choices.map(r=>`<button class="choice" data-id="${r.id}" ${t.has(r.id)?"disabled":""}>${r.text}${t.has(r.id)?`<span class="tried">${F("desk.tried")}</span>`:""}</button>`).join(""),s=$i()?e.choices.filter(r=>!r.correct).map(r=>`<button class="dev-preview" data-p="${r.id}">${F("dev.preview",{kind:F(r.flag?"dev.previewDelayed":"dev.previewNow"),text:Fs(r.text).slice(0,48),more:r.text.length>48?"…":""})}</button>`).join(""):"";return this.openDesk(`${this.header(e)}<div class="prompt">${Dt(e.prompt)}</div><div class="choices">${hy(n)}</div>${s?`<div class="dev-previews"><span class="dev-chip">${F("dev.chip")}</span>${s}</div>`:""}`),this.deskEl.querySelectorAll(".dev-preview").forEach(r=>r.addEventListener("click",()=>{const a=e.choices.find(o=>o.id===r.dataset.p);if(a.consequence)this.preview(a.consequence);else if(a.flag){const o=_t.flatMap(l=>l.checks??[]).find(l=>l.flag===a.flag);o&&this.preview(o.consequence,{fix:o.fix,origin:e.title})}})),new Promise(r=>{this.deskEl.querySelectorAll(".choice").forEach(a=>a.addEventListener("click",()=>r(a.dataset.id)))})}checklist(e,t){const n=e.checklist,s=new Set((t==null?void 0:t.picked)??[]),r=n.items.map((c,h)=>{const u=t==null?void 0:t.wrong.includes(h),d=(t==null?void 0:t.missing.includes(h))||(t==null?void 0:t.noDomains)&&!!c.domain;return`<label class="${`check${u?" bad":""}${d?" warn":""}`}" data-i="${h}"><input type="checkbox" value="${h}"${s.has(h)?" checked":""}><span>${c.text}${u&&c.why?`<small class="check-why">${c.why}</small>`:""}</span></label>`}).join("");this.openDesk(`${this.header(e)}<div class="prompt">${Dt(e.prompt)}</div><div class="checks">${r}</div>
      ${n.note?`<p class="check-note">${n.note}</p>`:""}
      ${t?'<div class="check-sum"></div>':""}
      <button class="primary send">${n.button??F("desk.send")}</button>`);const a=[...this.deskEl.querySelectorAll(".check input")],o=this.deskEl.querySelector(".check-sum"),l=()=>{if(!t)return;const c=g=>a[g].checked;let h=0,u=0;a.forEach((g,v)=>{const m=g.closest("label");t.wrong.includes(v)&&(m.classList.toggle("bad",g.checked),g.checked&&h++),t.missing.includes(v)&&(m.classList.toggle("warn",!g.checked),g.checked||u++)});let d=!1;t.noDomains&&(d=!n.items.some((g,v)=>g.domain&&c(v)),a.forEach((g,v)=>{n.items[v].domain&&g.closest("label").classList.toggle("warn",d)}));const p=[h?F("desk.sumRemove",{n:h}):"",u?F("desk.sumMissing",{n:u}):"",d?F("desk.sumDomain"):""].filter(Boolean);o.textContent=p.join(", "),o.hidden=!p.length};return a.forEach(c=>c.addEventListener("change",l)),l(),new Promise(c=>{this.deskEl.querySelector(".send").addEventListener("click",()=>{c(a.filter(h=>h.checked).map(h=>Number(h.value)))})})}watch(e){return this.openDesk(`${this.header(e)}<div class="prompt">${Dt(e.prompt)}</div><button class="primary go">${F("desk.watch")}</button>`),new Promise(t=>this.deskEl.querySelector(".go").addEventListener("click",()=>t()))}bindCat(e){const t=e.querySelector(".desk-cat");t==null||t.addEventListener("click",()=>{cu(),t.classList.remove("mrrp"),t.offsetWidth,t.classList.add("mrrp"),this.toast(`🐾 ${ey()}`,"info",3200)})}preview(e,t={}){const n=this.mount(`<div class="overlay"><div class="title-card glass preview-card">
      <div class="eyebrow">${F("dev.previewEyebrow")}</div>
      <div class="ret-head"><span class="ret-icon">!</span><div><div class="ret-by">${F("returned.by",{by:e.by})}</div><div class="desk-sub">${fi(e.steps)}</div></div><span class="chip bad">${F("returned.days",{days:e.days})}</span></div>
      <h2>${e.title}</h2>
      ${t.origin?`<p class="origin">${F("dev.previewOrigin",{origin:`<b>${t.origin}</b>`})}</p>`:""}
      <p><b>${F("returned.what")}</b> ${Dt(e.what)}</p>${e.why?`<p><b>${F("returned.why")}</b> ${Dt(e.why)}</p>`:""}${t.fix?`<p class="fix"><b>${F("returned.fix")}</b> ${Dt(t.fix)}</p>`:""}
      <button class="primary">${F("dev.previewClose")}</button>
      <button class="desk-cat">${bo(Fc(this.detourCount))}</button></div></div>`);n.querySelector("button").addEventListener("click",()=>n.remove()),this.bindCat(n)}returned(e,t={}){var n;return this.openDesk(`<div class="ret-head"><span class="ret-icon">!</span><div><div class="ret-by">${F("returned.by",{by:e.by})}</div><div class="desk-sub">${fi(e.steps)}</div></div><span class="chip bad">${F("returned.days",{days:e.days})}</span></div>
      <h2>${e.title}</h2>
      ${t.origin?`<p class="origin">${F("returned.origin",{origin:`<b>${t.origin}</b>`})}</p>`:""}
      <p><b>${F("returned.what")}</b> ${Dt(e.what)}</p>
      ${(n=t.extra)!=null&&n.length?`<ul class="extra">${t.extra.map(s=>`<li>${Dt(s)}</li>`).join("")}</ul>`:""}
      ${e.why?`<p><b>${F("returned.why")}</b> ${Dt(e.why)}</p>`:""}
      ${t.fix?`<p class="fix"><b>${F("returned.fix")}</b> ${Dt(t.fix)}</p>`:""}
      <div class="ret-actions"><button class="primary go">${t.fix?F("desk.fix"):F("desk.tryAgain")}</button><button class="ghost back">${F("desk.back")}</button></div>
      ${`<button class="desk-cat" title="${F("desk.catTitle")}">${bo(Fc(this.detourCount))}</button>`}`,"returned"),this.bindCat(this.deskEl),new Promise(s=>{for(const r of["go","back"])this.deskEl.querySelector(`.${r}`).addEventListener("click",()=>{this.hideDesk(),s(r)})})}toast(e,t="ok",n=3200){this.toastEl.className=`glass show t-${t}`,this.toastEl.innerHTML=e,clearTimeout(this.toastEl._t),this.toastEl._t=setTimeout(()=>{this.toastEl.className="glass"},n)}debrief(e){const t=e.detours.reduce((s,r)=>s+r.days,0),n=this.mount(`<div id="debrief" class="overlay"><div class="debrief-card glass">
      <div class="eyebrow">${F("debrief.eyebrow",{country:yi().country})}</div>
      <h1>${e.detours.length?F("debrief.h1Detours",{n:e.detours.length}):F("debrief.h1Clean")}</h1>
      <div class="kpis">
        <div><span>${e.days}</span>${F("debrief.kpiDays")}</div>
        <div><span>${e.ideal}</span>${F("debrief.kpiIdeal")}</div>
        <div><span class="bad">+${t}</span>${F("debrief.kpiLost")}</div>
      </div>
      <h3>${F("debrief.yourRoute")}</h3>
      <div class="route">${zc(_t.length,e.detours,!0)}</div>
      ${e.detours.length?`<h3>${F("debrief.sentBack")}</h3><ol class="detours">${e.detours.map(s=>`<li><b>${s.title}</b> ${fi(s.steps)} <span class="chip bad">+${s.days}</span><br>${Dt(s.why)}${s.origin?`<br><span class="origin-l">${F("debrief.origin",{origin:Fs(s.origin)})}</span>`:""}</li>`).join("")}</ol>`:""}
      <h3>${F("debrief.keysTitle")}</h3>
      <div class="keys">
        <div class="k-col c-country"><b>${F("debrief.countryKeeps",{country:yi().country})}</b><ul><li>${F("debrief.keep1")}</li><li>${F("debrief.keep2")}</li><li>${F("debrief.keep3")}</li></ul></div>
        <div class="k-col c-github"><b>${F("debrief.githubCarries")}</b><ul><li>${F("debrief.github1")}</li><li>${F("debrief.github2")}</li><li>${F("debrief.github3")}</li></ul></div>
        <div class="k-col c-who"><b>${F("debrief.whoHolds")}</b><ul><li>${F("debrief.who1")}</li><li>${F("debrief.who2")}</li></ul></div>
        <div class="k-col c-network"><b>${F("debrief.gatewayPublishes")}</b><ul><li>${F("debrief.gateway1")}</li><li>${F("debrief.gateway2")}</li></ul></div>
      </div>
      <h3>${F("debrief.learnTitle")}</h3>
      <ol class="learn">${_t.filter(s=>s.learn).map(s=>`<li>${Dt(s.learn)}</li>`).join("")}</ol>
      <div class="debrief-actions"><button class="primary again">${F("debrief.finish")}</button><button class="ghost print">${F("debrief.print")}</button></div>
    </div></div>`);return n.querySelector(".print").addEventListener("click",()=>window.print()),new Promise(s=>n.querySelector(".again").addEventListener("click",()=>{n.remove(),s()}))}}const oy=[{href:"https://www.who.int/initiatives/global-digital-health-certification-network",k:1},{href:"https://smart.who.int/trust/",k:2},{href:"https://smart.who.int/trust/concepts_onboarding.html",k:3},{href:"https://smart.who.int/trust/concepts_onboarding_checklist.html",k:4},{href:"https://github.com/WorldHealthOrganization/smart-trust",k:5},{href:"https://github.com/WorldHealthOrganization/tng-participant-template",k:6},{href:"mailto:gdhcn-support@who.int",k:7},{href:"https://github.com/WorldHealthOrganization/GDHCNOnboardingWizard",k:8},{href:"https://smart.who.int/trust/concepts_onboarding.html#letters-of-application",k:9},{href:"mailto:gdhcn-secretariat@who.int",k:10}],ly=[1,2,3,4,5,6,8,9,10,7];function cy(i,e=1,t=["DDCC"]){const n=document.createElement("div");return n.id="splash",n.className="overlay",n.innerHTML=`<div class="splash-card glass">
    <div class="splash-badge-wrap"><div class="splash-badge" aria-hidden="true">✓</div>${e===0?`<span class="splash-cat" title="${F("splash.perfect")}">${bo("crown")}</span>`:""}</div>
    <div class="eyebrow">${F("splash.eyebrow")}</div>
    <h1>${F("splash.h1",{country:yi().country})}</h1>
    <p class="lede">${t.length?F("splash.liveIn",{domains:iu(t)}):F("splash.liveNone")}</p>
    <p class="lede">${F("splash.lede",{country:yi().country})}</p>
    <h3>${F("splash.takeFurther")}</h3>
    <div class="splash-links">${ly.map(s=>oy.find(r=>r.k===s)).map(s=>`<a href="${s.href}" target="_blank" rel="noopener"><b>${F(`splash.link${s.k}.title`)}</b><span>${F(`splash.link${s.k}.sub`)}</span></a>`).join("")}</div>
    <p class="fine">${F("splash.fine")}</p>
    <div class="title-actions"><button class="primary" data-n="again">${F("splash.again")}</button><button class="ghost" data-n="demo">${F("splash.demo")}</button></div>
  </div>`,i.appendChild(n),new Promise(s=>n.addEventListener("click",r=>{const a=r.target.dataset.n;a&&(n.remove(),s(a))}))}function hy(i){const e=document.createElement("div");e.innerHTML=i;const t=[...e.children];for(let n=t.length-1;n>0;n--){const s=Math.floor(Math.random()*(n+1));[t[n],t[s]]=[t[s],t[n]]}return t.map(n=>n.outerHTML).join("")}const uy='<svg class="dash-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2.5"/><path d="M6 13l3-3 3 2 5-5"/><path d="M8 21h8M12 17v4"/></svg>';function dy(i){const e=n=>n>=730?F("dashboard.years",{n:b0(n/365)}):n>=60?F("dashboard.months",{n:Math.round(n/30)}):F("dashboard.days",{n}),t=i.lines.map((n,s)=>{var h;const[r,a]=n.split("|"),o=Number(a),l=o<=31?"bad":o<=90?"warn":"ok",c=Math.max(3,Math.min(100,o/1460*100));return`<div class="dash-row ${(h=i.mark)!=null&&h.includes(s)?"mark":""}"><span class="dash-l">${Dt(r)}</span>
      <span class="dash-bar"><i class="g-${l}" style="width:${c}%"></i></span><span class="dash-n g-${l}">${e(o)}</span></div>`}).join("");return`<div class="doc d-dashboard"><div class="doc-title">${uy}${Dt(i.title)}</div>
    <div class="dash-tabs"><span>DEV</span><span>UAT</span><span class="on">PROD</span></div>${t}</div>`}function fy(i){if(i.kind==="dashboard")return dy(i);const e=i.lines.map((t,n)=>{var s;return`<div class="${(s=i.mark)!=null&&s.includes(n)?"mark":""}">${Dt(t)}</div>`}).join("");return`<div class="doc d-${i.kind}"><div class="doc-title">${Dt(i.title)}</div>${e}</div>`}function zc(i,e,t){const a=t?70:24,o=_t.length,l=_t.map((v,m)=>30+940*m/(o-1)),c=[],h=[];for(const v of fu){const m=_t.map((y,_)=>y.phase===v?_:-1).filter(y=>y>=0);if(!m.length)continue;const f=l[m[0]],S=l[m[m.length-1]];h.push(`<text x="${(f+S)/2}" y="${a+26}" class="s-label ${m.includes(i)&&!t?"on":""}">${v} · ${F(`strip.phase.${v}`)}</text>`),c.push(`<line x1="${f-8}" y1="${a}" x2="${S+8}" y2="${a}" class="s-phase p-${v}"/>`)}const u=t?970:l[Math.min(i,o-1)],d=new Map;e.forEach(v=>d.set(v.index,(d.get(v.index)??0)+v.days));const p=[...d.entries()].map(([v,m])=>{const f=l[v],S=t?18+Math.min(m,30)*1.4:14;return`<path d="M${f-14},${a} C${f-14},${a-S} ${f+14},${a-S} ${f+14},${a}" class="s-loop"/>`+(t?`<text x="${f}" y="${a-S-4}" class="s-loop-t">+${m}</text>`:"")}).join(""),g=l.map((v,m)=>{const f=m<i||t?"done":m===i?"now":"",S=t?"":`<circle cx="${v}" cy="${a}" r="16" class="s-hit" data-i="${m}"><title>${m+1}. ${Fs(_t[m].title)}</title></circle>`;return`<circle cx="${v}" cy="${a}" r="${m===i&&!t?9:5.5}" class="s-dot ${f}"><title>${Fs(_t[m].title)}</title></circle>${S}`}).join("");return`<svg viewBox="0 0 1000 ${t?110:56}" preserveAspectRatio="none">
    <line x1="22" y1="${a}" x2="978" y2="${a}" class="s-track"/>
    ${c.join("")}
    <line x1="22" y1="${a}" x2="${u}" y2="${a}" class="s-done"/>
    ${p}${g}${h.join("")}
  </svg>`}const bt=(i,e)=>Le(`feedback.ts:${i}`,e),Gc="",Vc="gdhcn-feedback-who";let rn={mode:"title",where:bt("ctx.titleScreen")};function Mr(i){rn=i}const py=[1,2,3,4,5].map(i=>({value:x0(`feedback.ts:TYPES.${i}`),label:bt(`TYPES.${i}`)}));function my(i){const e=document.createElement("button");e.id="fb-btn",e.className="glass",e.title=bt("button.title"),e.innerHTML=`💬 <span>${bt("button.label").replace(/^💬\s*/u,"")}</span>`,i.appendChild(e);const t=document.createElement("div");t.id="fb-panel",t.className="glass",t.innerHTML=`
    <div class="fb-head"><b>${bt("panel.head")}</b><button class="fb-x" aria-label="${bt("panel.closeAria")}">✕</button></div>
    <div class="fb-where"></div>
    <label>${bt("kind.label")}<select name="type">${py.map(l=>`<option value="${l.value}">${l.label}</option>`).join("")}</select></label>
    <label>${bt("comment.label")}<textarea name="comment" rows="5" maxlength="4000" placeholder="${bt("comment.placeholder")}"></textarea></label>
    <div class="fb-row">
      <label>${bt("name.label")}<input name="name" maxlength="200" autocomplete="name"></label>
      <label>${bt("org.label")}<input name="org" maxlength="200" autocomplete="organization"></label>
    </div>
    <label>${bt("email.label")}<input name="email" type="email" maxlength="200" autocomplete="email"></label>
    <input name="website" class="fb-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="fb-actions"><button class="primary fb-send">${bt("send")}</button><span class="fb-status"></span></div>
    <p class="fb-fine">${bt("fine")}</p>`,i.appendChild(t);const n=l=>t.querySelector(l),s=l=>t.querySelector(`[name="${l}"]`),r=n(".fb-status");try{const l=JSON.parse(localStorage.getItem(Vc)??"{}");for(const c of["name","org","email"])l[c]&&(s(c).value=l[c])}catch{}const a=()=>{n(".fb-where").textContent=`${bt("panel.where",{where:rn.where??rn.mode})}${rn.steps?` ${bt("panel.whereSteps",{steps:rn.steps})}`:""}`,r.textContent=bt("status.notConnected"),n(".fb-send").disabled=!Gc,t.classList.add("open"),s("comment").focus()},o=()=>t.classList.remove("open");e.addEventListener("click",()=>t.classList.contains("open")?o():a()),n(".fb-x").addEventListener("click",o),n(".fb-send").addEventListener("click",async()=>{const l=s("comment").value.trim();if(!l){r.textContent=bt("status.empty"),s("comment").focus();return}const c={type:t.querySelector("select").value,comment:l,name:s("name").value,org:s("org").value,email:s("email").value,website:s("website").value,where:rn.where??"",phase:rn.phase??"",moment:rn.moment??"",steps:rn.steps??"",mode:rn.mode,country:`${yi().country} (${yi().code})`,days:rn.days??"",detours:rn.detours??"",page:location.href,browser:navigator.userAgent};try{localStorage.setItem(Vc,JSON.stringify({name:c.name,org:c.org,email:c.email}))}catch{}const h=n(".fb-send");h.disabled=!0,r.textContent=bt("status.sending");try{const u=await fetch(Gc,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(c)}),d=await u.json().catch(()=>({ok:u.ok}));if(!d.ok)throw new Error(d.error??"not saved");s("comment").value="",r.textContent=bt("status.saved"),setTimeout(o,1600)}catch{r.textContent=bt("status.failed")}finally{h.disabled=!1}})}const Bi=i=>new Promise(e=>setTimeout(e,i)),Wc=Le("ui.ts:desk.extraWrong");class gy{constructor(e,t){xe(this,"index",0);xe(this,"days",0);xe(this,"flags",new Set);xe(this,"detours",[]);xe(this,"flaggedAt",new Map);this.world=e,this.ui=t}async run(e=0){for(Uc(),this.ui.showChrome(),this.idealStateBefore(e),this.index=e;this.index<_t.length;this.index++)await this.play(_t[this.index]);await this.finish()}async end(){Uc(),this.ui.showChrome(),this.idealStateBefore(_t.length),this.index=_t.length,await this.finish()}idealStateBefore(e){this.days=_t.slice(0,e).reduce((n,s)=>n+s.days,0);const t=_t.findIndex(n=>n.success.effect==="prod-open");this.world.setProdOpen(t>=0&&e>t)}async finish(){this.world.mark(null),this.ui.hideDesk(),await this.world.flyTo("home"),this.ui.strip(_t.length,this.detours);const e=_t.reduce((n,s)=>n+s.days,0);Mr({mode:"debrief",where:Le("feedback.ts:ctx.debrief"),days:this.days,detours:this.detours.length}),await this.ui.debrief({days:this.days,ideal:e,detours:this.detours}),Mr({mode:"debrief",where:Le("feedback.ts:ctx.splash"),days:this.days,detours:this.detours.length});const t=await cy(document.getElementById("app"),this.detours.length,F_());location.hash=t==="demo"?"demo":"",location.reload()}refresh(e){Mr({mode:"game",where:Le("feedback.ts:ctx.game",{phase:e.phase,title:e.title}),phase:`${e.phase} · ${Rr[e.phase]}`,moment:`${e.id} · ${e.title}`,steps:Qh(e.steps),days:this.days,detours:this.detours.length}),this.ui.hud(e),this.ui.stats(this.days,this.detours.length),this.ui.strip(this.index,this.detours)}async play(e){e=Z_(e),this.refresh(e),this.world.mark(e.place),await this.world.flyTo(e.place,{desk:!0});const t=new Set;let n;for(;;){if(e.type==="watch"){await this.ui.watch(e);break}if(e.type==="checklist"){const a=e.checklist,o=new Set(await this.ui.checklist(e,n)),l=a.items,c=l.flatMap((g,v)=>g.required&&!o.has(v)?[v]:[]),h=l.flatMap((g,v)=>!g.required&&!g.domain&&o.has(v)?[v]:[]),u=l.flatMap((g,v)=>g.domain&&o.has(v)?[g.domain]:[]),d=u.length<(a.minDomains??0);if(!c.length&&!h.length&&!d){a.minDomains!==void 0&&B_(u);break}const p=[...h.map(g=>`${Wc} ${l[g].text}. ${l[g].why??""}`),...c.map(g=>`${Le("ui.ts:desk.extraMissing")} ${l[g].text}`),...d?[Le("ui.ts:desk.extraDomain")]:[]];n={picked:[...o],wrong:h,missing:c,noDomains:d},await this.setBack(e,a.consequence,{extra:p});continue}const s=await this.ui.ask(e,t),r=e.choices.find(a=>a.id===s);if(r.correct)break;if(r.flag){this.flags.add(r.flag),this.flaggedAt.set(r.flag,e.title);break}t.add(r.id),await this.setBack(e,r.consequence)}this.ui.hideDesk(),await this.succeed(e),this.days+=e.days,this.ui.stats(this.days,this.detours.length)}async setBack(e,t,n={}){var a;this.ui.hideDesk(),t.travel&&(await this.world.flyTo("home",{dur:1.1}),await this.world.travel(t.travel.legs,t.travel.label,t.travel.kind,{bounce:t.title})),t.bot&&this.world.bot.setMood("error"),this.days+=t.days;const s=t.why||((a=n.extra)==null?void 0:a.filter(o=>o.startsWith(Wc)).join(" "))||t.what,r={index:this.index,title:t.title,steps:t.steps,why:s,days:t.days,origin:n.origin};this.detours.push(r),this.refresh(e),t.travel&&await this.world.flyTo(e.place,{desk:!0,dur:1.1}),await this.ui.returned(t,n)==="back"&&(this.detours.splice(this.detours.indexOf(r),1),this.days-=t.days,this.refresh(e)),t.bot&&this.world.bot.setMood("idle")}async send(e){await this.world.travel(e.legs,e.label,e.kind)}async succeed(e){var n;const t=e.success;t.effect==="bot-collect"&&await this.botCollect(e);for(const s of e.checks??[])s.flag==="webtag"||!this.flags.has(s.flag)||(await this.setBack(e,s.consequence,{fix:s.fix,origin:this.flaggedAt.get(s.flag)}),this.flags.delete(s.flag),this.ui.toast(Le("Game.ts:fixed"),"info",2200));if((n=t.travel)!=null&&n.length){await this.world.flyTo("home",{dur:1.2});for(const s of t.travel)await this.send(s)}if(e.id==="airgap"&&this.world.pulseAnchor(),t.effect==="prod-open"&&(this.world.setProdOpen(!0),this.world.pulseGateway("prod","#4fe0a0")),t.effect==="live"){this.world.pulseGateway("prod","#4fe0a0"),this.world.bot.setMood("happy"),this.ui.toast(Le("Game.ts:live",{country:yi().country}),"ok",4200),await Bi(2200),this.world.bot.setMood("idle");return}this.ui.toast(Fs(ks(t.note)),"ok"),await Bi(900)}async botCollect(e){var s;const t=this.world.bot;await this.world.flyTo("github",{dur:1.2,zoomOut:1.15}),await this.world.botTo("github"),t.setMood("checking"),await Bi(2200);const n=(s=e.checks)==null?void 0:s.find(r=>r.flag==="webtag");n&&this.flags.has("webtag")&&(t.setMood("error"),await Bi(900),await this.setBack(e,n.consequence,{fix:n.fix,origin:this.flaggedAt.get("webtag")}),this.flags.delete("webtag"),await this.world.flyTo("github",{dur:1,zoomOut:1.15}),t.setMood("checking"),await Bi(1800)),t.setMood("happy"),await Bi(1400),await this.world.travel([["github-ops",1]],Le("Demo.ts:parcel.6a"),"key"),await this.world.botTo("ops"),t.setMood("idle")}}const In=Zh,De=(i,e)=>Le(`Demo.ts:${i}`,e);let dn=1;const Xi=i=>new Promise(e=>{let t=i,n=performance.now();const s=()=>{const r=performance.now();t-=(r-n)*dn,n=r,t<=0?e():setTimeout(s,Math.min(t/dn,50))};setTimeout(s,Math.min(i/dn,50))}),Hi=[{title:De("beat1.title"),steps:In["demo:beat1"],place:"home",body:De("beat1.body"),run:async(i,e)=>{await i.travel([["paper",1]],De("parcel.1a"),"paper"),!e()&&await i.travel([["paper",-1]],De("parcel.1b"),"paper")}},{title:De("beat2.title"),steps:In["demo:beat2"],place:"backend",cast:!0,body:De("beat2.body"),run:async i=>{await i.travel([["ministry-backend",1]],De("parcel.2"),"key")}},{title:De("beat3.title"),steps:In["demo:beat3"],place:"home",body:De("beat3.body"),run:async i=>{await i.travel([["backend-github",1]],De("parcel.3"),"key")}},{title:De("beat4.title"),steps:In["demo:beat4"],place:"home",body:De("beat4.body"),run:async i=>{await i.travel([["paper",1]],De("parcel.4"),"paper")}},{title:De("beat5.title"),steps:In["demo:beat5"],place:"secretariat",body:De("beat5.body"),run:async(i,e)=>{await Xi(1800),!e()&&(await i.flyTo("home",{dur:1.1,caption:!0}),!e()&&await i.travel([["paper",-1]],De("parcel.5"),"paper"))}},{title:De("beat6.title"),steps:In["demo:beat6"],place:"github",body:De("beat6.body"),run:async(i,e)=>{await i.botTo("github"),!e()&&(i.bot.setMood("checking"),await Xi(2e3),!e()&&(i.bot.setMood("happy"),await Xi(1200),!e()&&(await i.travel([["github-ops",1]],De("parcel.6a"),"key"),!e()&&(await i.botTo("ops"),i.bot.setMood("idle"),!e()&&(await i.flyTo("home",{dur:1.1,caption:!0}),!e()&&await i.travel([["ops-uat",1]],De("parcel.6b"),"key"))))))}},{title:De("beat7.title"),steps:In["demo:beat7"],place:"ops",body:De("beat7.body"),run:async(i,e)=>{i.pulseAnchor(),await Xi(2200),!e()&&(await i.flyTo("home",{dur:1.1,caption:!0}),!e()&&await i.travel([["ops-prod",1]],De("parcel.7"),"key"))}},{title:De("beat8.title"),steps:In["demo:beat8"],place:"home",body:De("beat8.body"),run:async(i,e)=>{await i.travel([["backend-uat",1]],De("parcel.8a"),"data"),!e()&&(await i.travel([["backend-uat",1]],De("parcel.8b"),"data"),!e()&&(i.setProdOpen(!0),i.pulseGateway("prod","#4fe0a0")))}},{title:De("beat9.title"),steps:In["demo:beat9"],place:"home",prodOpen:!0,body:De("beat9.body"),run:async(i,e)=>{await i.travel([["backend-prod",1]],De("parcel.9a"),"data"),!e()&&(await i.travel([["backend-prod",-1]],De("parcel.9b"),"data"),!e()&&(await i.travel([["backend-prod",1]],De("parcel.9c"),"data"),!e()&&(await i.travel([["paper",1]],De("parcel.9d"),"paper"),!e()&&(i.pulseGateway("prod","#4fe0a0"),await i.travel([["paper",-1]],De("parcel.9e"),"paper"),!e()&&i.bot.setMood("happy")))))}}],$c="gdhcn-demo-voice",vy=["en","fr"],Xc="gdhcn-demo-speed",qc=[1,1.25,1.5,2],ba=new Map;function _y(i){return ba.has(i)||ba.set(i,fetch(i,{method:"HEAD"}).then(e=>e.ok&&(e.headers.get("content-type")??"").startsWith("audio")).catch(()=>!1)),ba.get(i)}const yy={business:'<path d="M4 8h16v11H4z"/><path d="M9 8V5h6v3"/><path d="M4 13h16"/>',legal:'<path d="M12 4v16"/><path d="M7 20h10"/><path d="M5 8h14"/><path d="M5 8l-3 6a3 3 0 0 0 6 0z"/><path d="M19 8l-3 6a3 3 0 0 0 6 0z"/>',technical:'<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/><path d="M10 9l-2 2 2 2"/><path d="M14 9l2 2-2 2"/>',keymaster:'<circle cx="8" cy="12" r="4"/><path d="M12 12h9"/><path d="M18 12v3"/><path d="M21 12v2"/>'},Yc={en:{roles:[3.1,4.3,6.8,8.7],certs:13.8,vault:20.7},fr:{roles:[2.5,4.1,5.8,7.4],certs:10.5,vault:19.4}},sl=Yc[wt()]??Yc.en,mr=["business","legal","technical","keymaster"].map((i,e)=>({k:i,role:De(`cast.${i}.role`),duty:De(`cast.${i}.duty`),at:sl.roles[e]})),xy=sl.certs,by=sl.vault;class Sy{constructor(e,t){xe(this,"el");xe(this,"i",0);xe(this,"gen",0);xe(this,"paused",!1);xe(this,"sound",!0);xe(this,"speaking",!1);xe(this,"audio",new Audio);xe(this,"finished");this.world=e;try{this.sound=localStorage.getItem($c)!=="0"}catch{}this.audio.preload="auto",this.audio.addEventListener("playing",()=>{this.speaking=!0});for(const r of["ended","error"])this.audio.addEventListener(r,()=>{this.speaking=!1});this.el=document.createElement("div"),this.el.id="demo",this.el.innerHTML=`
      <div class="demo-badge glass">${De("badge")}</div>
      <div class="demo-caption glass"><div class="demo-meta"></div><h2></h2><p></p></div>
      <div class="demo-bar glass">
        <button data-a="back" title="${De("bar.back")}">⏮</button>
        <button data-a="play" title="${De("bar.pause")}" class="demo-play">⏸</button>
        <button data-a="next" title="${De("bar.next")}">⏭</button>
        <div class="demo-dots">${Hi.map((r,a)=>`<button data-i="${a}" title="${Hi[a].title}"></button>`).join("")}</div>
        <select class="demo-speed" aria-label="${De("bar.speed")}" title="${De("bar.speed")}">${qc.map(r=>`<option value="${r}">${r}×</option>`).join("")}</select>
        <button data-a="voice" title="${vy.includes(wt())?De("bar.voice"):De("bar.captionsOnly")}" class="demo-voice"></button>
        <button data-a="exit" title="${De("bar.exit")}">✕</button>
      </div>
      <button class="demo-tap glass" hidden>${De("tapForSound")}</button>`,t.appendChild(this.el),this.el.querySelector(".demo-tap").addEventListener("click",()=>this.unblock()),this.el.querySelector(".demo-bar").addEventListener("click",r=>{const a=r.target.closest("button");if(a){if(a.dataset.i)return this.play(Number(a.dataset.i));switch(a.dataset.a){case"back":return this.play(Math.max(0,this.i-1));case"next":return this.i<Hi.length-1?this.play(this.i+1):this.end();case"play":return this.togglePause();case"voice":return this.toggleVoice();case"exit":return this.stop(),this.finished("title")}}}),this.renderVoice();let n=1;try{n=Number(sessionStorage.getItem(Xc))}catch{}const s=this.el.querySelector(".demo-speed");this.setSpeed(qc.includes(n)?n:1),s.value=String(dn),s.addEventListener("change",()=>{this.setSpeed(Number(s.value));try{sessionStorage.setItem(Xc,String(dn))}catch{}s.blur()})}setSpeed(e){dn=e,this.world.timeScale=e;const t=this.audio;t.playbackRate=e,t.preservesPitch=!0,t.mozPreservesPitch=!0,t.webkitPreservesPitch=!0}resetSpeed(){dn=1,this.world.timeScale=1}run(){return new Promise(e=>{this.finished=e,this.play(0)})}async play(e){const t=++this.gen,n=()=>t!==this.gen;this.i=e,this.paused=!1,this.el.querySelector(".demo-play").textContent="⏸";const s=Hi[e];this.world.cancelAll(),this.world.reset(),this.world.setProdOpen(!!s.prodOpen),this.world.mark(s.place==="home"?null:s.place);const r=s.body;Mr({mode:"demo",where:De("feedbackContext",{i:e+1,title:s.title}),moment:`beat ${e+1} · ${s.title}`,steps:Qh(s.steps)}),this.caption(e,s,r),this.narrate(e);const a=performance.now();if(this.showCast(s.cast?t:0,a),await this.world.flyTo(s.place,{dur:1.3,caption:!0}),n()||(await s.run(this.world,n),n()))return;const o=Math.min(11e3,Math.max(4500,r.length*55));for(;!n()&&((performance.now()-a)*dn<o||this.paused||this.sound&&this.speaking);)await Xi(200);n()||await Xi(600),!n()&&(e<Hi.length-1?this.play(e+1):this.end())}showCast(e,t){var o;if((o=this.el.querySelector(".demo-cast"))==null||o.remove(),!e)return;const n=document.createElement("div");n.className="demo-cast",n.innerHTML=mr.map(l=>`<div class="cast-tile c-${l.k}" data-k="${l.k}">
        <div class="cast-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${yy[l.k]}</svg></div>
        <div class="cast-role">${l.role}</div><div class="cast-duty">${l.duty}</div>
        ${l.k==="keymaster"?`<div class="cast-chips"><span class="chip-certs">${De("cast.certsChip")}</span><span class="chip-vault">${De("cast.vaultChip")}</span></div>`:""}
      </div>`).join(""),this.el.appendChild(n);const s=[...n.querySelectorAll(".cast-tile")],r=()=>{if(e!==this.gen||!n.isConnected){clearInterval(a);return}const l=this.audio,c=l.currentTime>0||!l.paused?l.currentTime:(performance.now()-t)*dn/1e3;s.forEach((h,u)=>{const d=c>=mr[u].at,p=d&&(u===mr.length-1||c<mr[u+1].at);h.classList.toggle("lit",d),h.classList.toggle("now",p)}),n.classList.toggle("certs",c>=xy),n.classList.toggle("vault",c>=by)},a=setInterval(r,100);r()}caption(e,t,n){const s=this.el.querySelector(".demo-caption");s.classList.remove("in"),s.offsetWidth,s.classList.add("in"),s.querySelector(".demo-meta").innerHTML=`<span>${De("meta",{i:e+1,total:Hi.length})}</span>${fi(t.steps)}`,s.querySelector("h2").textContent=t.title,s.querySelector("p").textContent=n,this.el.querySelectorAll(".demo-dots button").forEach((r,a)=>{r.className=a<e?"done":a===e?"now":""})}togglePause(){this.paused=!this.paused,this.el.querySelector(".demo-play").textContent=this.paused?"▶":"⏸",this.paused?this.audio.pause():this.sound&&this.speaking&&this.audio.play().catch(e=>this.blocked(e))}toggleVoice(){this.sound=!this.sound;try{localStorage.setItem($c,this.sound?"1":"0")}catch{}this.renderVoice(),this.audio.muted=!this.sound,this.sound&&this.speaking&&!this.paused&&this.audio.play().catch(e=>this.blocked(e))}renderVoice(){const e=this.el.querySelector(".demo-voice");e.textContent=this.sound?"🔊":"🔈",e.classList.toggle("on",this.sound)}narrate(e){this.audio.pause();const t=`audio/demo/${wt()==="en"?"":`${wt()}/`}beat-${String(e+1).padStart(2,"0")}.mp3`;if(wt()!=="en"){this.audio.removeAttribute("src"),this.audio.load(),this.speaking=!1;const n=this.gen;_y(`./${t}`).then(s=>{!s||n!==this.gen||(this.audio.src=`./${t}`,this.audio.muted=!this.sound,this.audio.playbackRate=dn,this.speaking=!0,this.audio.play().catch(r=>this.blocked(r)))});return}this.audio.src=`./${t}`,this.audio.muted=!this.sound,this.audio.playbackRate=dn,this.speaking=!0,this.audio.play().catch(n=>this.blocked(n))}blocked(e){(e==null?void 0:e.name)!=="AbortError"&&(this.speaking=!1,this.sound&&(this.el.querySelector(".demo-tap").hidden=!1))}unblock(){this.el.querySelector(".demo-tap").hidden=!0,this.sound=!0,this.renderVoice(),this.audio.muted=!1,this.audio.currentTime=0,this.speaking=!0,this.audio.play().catch(e=>this.blocked(e))}stop(){var e;this.gen++,this.resetSpeed(),(e=this.el.querySelector(".demo-cast"))==null||e.remove(),this.audio.pause(),this.world.cancelAll(),this.el.remove()}end(){this.gen++,this.resetSpeed(),this.audio.pause();const e=document.createElement("div");e.className="overlay",e.innerHTML=`<div class="title-card glass">
      <div class="eyebrow">${De("end.eyebrow")}</div>
      <h1>${De("end.h1")}</h1>
      <p class="lede">${De("end.lede")}</p>
      <div class="title-actions"><button class="primary" data-n="play">${De("end.play")}</button><button class="ghost" data-n="again">${De("end.again")}</button><button class="ghost" data-n="title">${De("end.title")}</button></div>
    </div>`,this.el.appendChild(e),e.addEventListener("click",t=>{const n=t.target.dataset.n;n&&(this.stop(),this.finished(n))})}}const Bt=(i,e)=>Le(`page.ts:${i}`,e),ys=i=>`./${i}`;class My{constructor(e){xe(this,"el");xe(this,"prevHash","");this.el=document.createElement("div"),this.el.id="usecases",this.el.className="overlay",this.el.hidden=!0,e.appendChild(this.el),this.el.addEventListener("click",t=>{const n=t.target.closest("[data-lang]");if(n){this.setLang(n.dataset.lang==="fr"?"fr":"en");return}const s=t.target.closest("[data-uc],[data-a]");if(!s){t.target===this.el&&this.close();return}s.dataset.uc?this.open(s.dataset.uc):s.dataset.a==="gallery"?this.open():s.dataset.a==="close"?this.close():s.dataset.a==="play"&&(this.close(),location.hash="",location.reload())}),addEventListener("keydown",t=>{t.key==="Escape"&&!this.el.hidden&&this.close()})}openFromHash(){const e=/^#usecases?(?:\/([\w-]+))?$/.exec(location.hash);return e?(this.open(e[1]),!0):!1}open(e){this.el.hidden&&(this.prevHash=/^#usecase/.test(location.hash)?"":location.hash),this.stopVideo();const t=e?Ss.find(n=>n.id===e):void 0;this.el.innerHTML=t?this.detail(t):this.gallery(),this.el.hidden=!1,this.el.scrollTop=0,history.replaceState(null,"",t?`#usecase/${t.id}`:"#usecases")}close(){this.stopVideo(),this.el.hidden=!0,history.replaceState(null,"",this.prevHash||location.pathname)}stopVideo(){var e;(e=this.el.querySelector("video"))==null||e.pause()}getLang(){try{const e=sessionStorage.getItem("uc-lang");if(e==="fr"||e==="en")return e}catch{}return wt()==="fr"?"fr":"en"}setLang(e){var r;try{sessionStorage.setItem("uc-lang",e)}catch{}const t=this.el.querySelector("video.uc-video"),n=(r=/^#usecase\/([\w-]+)/.exec(location.hash))==null?void 0:r[1],s=Ss.find(a=>a.id===n);!t||!(s!=null&&s.videoFr)||(t.pause(),t.poster=ys(e==="fr"?s.posterFr??s.poster:s.poster),t.src=ys(e==="fr"?s.videoFr:s.video),t.load(),t.currentTime=0,this.el.querySelectorAll("[data-lang]").forEach(a=>a.setAttribute("aria-pressed",String(a.dataset.lang===e))))}gallery(){return`<div class="uc-card glass">
      <div class="uc-top"><div class="eyebrow">${Bt("gallery.eyebrow")}</div><button class="uc-x" data-a="close" aria-label="${Bt("closeAria")}">✕</button></div>
      <h1>${Bt("gallery.h1")}</h1>
      <p class="lede">${Bt("gallery.lede")}</p>
      <div class="uc-grid">${Ss.map(e=>`
        <button class="uc-tile" data-uc="${e.id}">
          <span class="uc-thumb" style="background-image:url('${ys(wt()==="fr"?e.posterFr??e.poster:e.poster)}')"><span class="uc-play">▶</span><span class="uc-len">${e.minutes}</span></span>
          <span class="uc-tag">${e.tag}</span>
          <b>${e.title}</b>
          <span class="uc-sub">${e.subtitle}</span>
        </button>`).join("")}
      </div></div>`}detail(e){const t=Ss.filter(a=>a.id!==e.id),n=e.videoFr?this.getLang():"en",s=n==="fr"&&e.videoFr?e.videoFr:e.video,r=e.videoFr?`<div class="uc-lang" role="group" aria-label="${Bt("detail.filmLanguage")}">
        <button type="button" data-lang="en" aria-pressed="${n==="en"}" lang="en">${Bt("detail.langEn")}</button>
        <button type="button" data-lang="fr" aria-pressed="${n==="fr"}" lang="fr">${Bt("detail.langFr")}</button>
      </div>`:"";return`<div class="uc-card glass">
      <div class="uc-top"><button class="nav-btn" data-a="gallery">${Bt("detail.back")}</button><button class="uc-x" data-a="close" aria-label="${Bt("closeAria")}">✕</button></div>
      <div class="uc-tag">${e.tag}</div>
      <h1>${e.title}</h1>
      <p class="uc-sub big">${e.subtitle}</p>
      ${r}
      <video class="uc-video" controls playsinline preload="none" poster="${ys(n==="fr"?e.posterFr??e.poster:e.poster)}" src="${ys(s)}"></video>
      <blockquote class="uc-idea">${e.idea}</blockquote>
      <h3>${Bt("detail.whatFilm")}</h3>
      <p>${e.summary}</p>
      <h3>${Bt("detail.howHelps")}</h3>
      <ul class="uc-how">${e.how.map(a=>`<li>${a}</li>`).join("")}</ul>
      <h3>${Bt("detail.why")}</h3>
      <p>${e.why}</p>
      <div class="title-actions">
        <button class="primary" data-a="play">${Bt("detail.play")}</button>
        ${t.map(a=>`<button class="ghost" data-uc="${a.id}">${Bt("detail.next",{title:a.title})}</button>`).join("")}
      </div>
      <p class="fine">${Bt("detail.fine")}</p>
    </div>`}}const Ft=i=>Le(`explore.ts:${i}`),wy=["ministry","backend","github","uat","prod","secretariat","ops","dashboard"],Ty=Object.fromEntries(wy.map(i=>[i,Le(`explore.ts:HOLDS.${i}`)])),Ey=["ministry","backend","github","uat","prod","secretariat","ops","dashboard"];function Ay(i,e){const t=document.createElement("div");t.id="explore",t.innerHTML=`
    <div class="ex-hint glass">
      <b>${Ft("hint.title")}</b>
      <div class="ex-keys">
        <span class="k">${Ft("hint.rotate")}</span><span>${Ft("hint.rotateHow")}</span>
        <span class="k">${Ft("hint.move")}</span><span>${Ft("hint.moveHow")}</span>
        <span class="k">${Ft("hint.zoom")}</span><span>${Ft("hint.zoomHow")}</span>
      </div>
      <span>${Ft("hint.click")}</span>
      <button class="ex-hint-x" aria-label="${Ft("hint.closeAria")}">✕</button>
    </div>
    <div class="ex-card glass" hidden></div>
    <div class="ex-bar">
      <button class="nav-btn" data-a="back">${Ft("bar.back")}</button>
      <div class="ex-chips">${Ey.map(c=>`<button class="ex-chip" data-p="${c}">${i.places[c].name}</button>`).join("")}</div>
      <button class="nav-btn" data-a="reset" title="${Ft("bar.resetTitle")}">${Ft("bar.reset")}</button>
      <button class="primary" data-a="start">${Ft("bar.start")}</button>
    </div>`,e.appendChild(t);const n=t.querySelector(".ex-card"),s=t.querySelector(".ex-hint"),r=()=>s.classList.add("gone"),a=setTimeout(r,9e3),o=c=>{clearTimeout(a),r();const h=i.places[c],u=_t.filter(d=>d.place===c);n.innerHTML=`<button class="ex-x" aria-label="${Ft("card.closeAria")}">✕</button>
      <div class="eyebrow">${h.name}</div>
      <p>${ks(h.blurb)}</p>
      <h4>${Ft("card.holds")}</h4><p>${Dt(Ty[c])}</p>
      ${u.length?`<h4>${Ft("card.here")}</h4><ul>${u.map(d=>`<li>${d.title} ${fi(d.steps)}</li>`).join("")}</ul>`:""}`,n.hidden=!1,t.querySelectorAll(".ex-chip").forEach(d=>d.classList.toggle("on",d.dataset.p===c)),i.mark(c),i.flyTo(c,{dur:1.1})},l=i.onPlaceClick;return i.onPlaceClick=c=>o(c),i.mark(null),i.flyTo("home",{dur:1}),new Promise(c=>{const h=u=>{clearTimeout(a),i.onPlaceClick=l,i.mark(null),t.remove(),c(u)};t.addEventListener("click",u=>{const d=u.target.closest("button");if(d){if(d.dataset.p)return o(d.dataset.p);if(d.classList.contains("ex-x")){n.hidden=!0,i.mark(null),t.querySelectorAll(".ex-chip.on").forEach(p=>p.classList.remove("on"));return}if(d.classList.contains("ex-hint-x"))return r();switch(d.dataset.a){case"reset":n.hidden=!0,i.mark(null),i.flyTo("home",{dur:1});return;case"start":return h("start");case"back":return h("back")}}})})}function Cy(){const i=document.createElement("div");i.id="tip-pop",i.setAttribute("role","tooltip"),i.hidden=!0,document.body.appendChild(i);let e=null;const t=r=>{var a;return((a=r==null?void 0:r.closest)==null?void 0:a.call(r,"[data-tip]"))??null},n=()=>{i.hidden=!0,e==null||e.removeAttribute("aria-describedby"),e=null},s=r=>{const a=il[r.dataset.tip??""];if(!a)return;e==null||e.removeAttribute("aria-describedby"),e=r,i.id="tip-pop",i.innerHTML="<b></b><span></span>",i.querySelector("b").textContent=a.term,i.querySelector("span").textContent=a.def,r.setAttribute("aria-describedby","tip-pop"),i.hidden=!1;const o=r.getBoundingClientRect(),l=i.offsetWidth,c=i.offsetHeight,h=10;let u=o.left+o.width/2-l/2;u=Math.max(h,Math.min(u,innerWidth-l-h));let d=o.bottom+8;d+c>innerHeight-h&&(d=Math.max(h,o.top-c-8)),i.style.left=`${u}px`,i.style.top=`${d}px`};document.addEventListener("pointerover",r=>{if(r.pointerType!=="mouse")return;const a=t(r.target);a&&s(a)}),document.addEventListener("pointerout",r=>{r.pointerType==="mouse"&&t(r.target)&&!t(r.relatedTarget)&&n()}),document.addEventListener("focusin",r=>{const a=t(r.target);a&&s(a)}),document.addEventListener("focusout",r=>{t(r.target)&&n()}),document.addEventListener("pointerdown",r=>{if(r.pointerType==="mouse")return;const a=t(r.target);a&&a!==e?s(a):n()}),document.addEventListener("keydown",r=>{r.key==="Escape"&&n()}),addEventListener("resize",n),document.addEventListener("scroll",n,!0)}document.title=Le("index.html:title");var jc;(jc=document.querySelector('meta[name="description"]'))==null||jc.setAttribute("content",Le("index.html:metaDescription"));const cs=document.getElementById("app"),_n=new a_(cs),zs=new ay(cs),Ms=new gy(_n,zs);my(cs);Cy();const rl=new My(cs);addEventListener("open-usecases",()=>rl.open());addEventListener("open-usecase",i=>rl.open(i.detail));addEventListener("reset-view",()=>_n.resetView());_n.onCatClick=i=>{cu();const e=ny(i);zs.toast(`<b>${Le("main.ts:catToast",{n:e})}</b><br>${ty[i]}`,"info",5200)};_n.onPlaceClick=i=>{const e=_n.places[i];zs.toast(`<b>${e.name}</b><br>${e.blurb}`,"info",5e3)};function Kc(i){J_(i),_n.setNames(i.country,i.code)}async function Mo(){_n.reset(),_n.setNames(Le("main.ts:demoCountryName"),"");const i=await new Sy(_n,cs).run();if(i==="again")return Mo();location.hash=i==="play"?"phase=A":"",location.reload()}var Zc;const wo=(Zc=/phase=([A-E])/.exec(location.hash))==null?void 0:Zc[1];var Jc;const To=$i()?(Jc=/(?:^#|&)m=(\d+)/.exec(location.hash))==null?void 0:Jc[1]:void 0,Ry=To!==void 0?Math.min(Number(To),_t.length-1):wo?Math.max(0,_t.findIndex(i=>i.phase===wo)):0;(async()=>{const i=G_();if(Kc(i),rl.openFromHash(),location.hash==="#demo")return Mo();if($i()&&location.hash==="#end")return Ms.end();if(wo||To!==void 0)return Ms.run(Ry);if(location.hash==="#restart")return history.replaceState(null,"",location.pathname+location.search),Ms.run(0);let e=i;for(;;){const{mode:t,settings:n}=await zs.title(e);if(V_(n),Kc(n),e=n,t==="demo")return Mo();if(!(t==="explore"&&await Ay(_n,cs)==="back"))return Ms.run(0)}})();window.__game={world:_n,ui:zs,game:Ms};
