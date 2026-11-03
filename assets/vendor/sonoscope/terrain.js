var SonoscopeTerrain=(()=>{var w=Object.defineProperty;var P=Object.getOwnPropertyDescriptor;var K=Object.getOwnPropertyNames;var _=Object.prototype.hasOwnProperty;var Y=(e,t)=>{for(var i in t)w(e,i,{get:t[i],enumerable:!0})},z=(e,t,i,A)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of K(t))!_.call(e,r)&&r!==i&&w(e,r,{get:()=>t[r],enumerable:!(A=P(t,r))||A.enumerable});return e};var V=e=>z(w({},"__esModule",{value:!0}),e);var se={};Y(se,{TerrainSpectrogramProgram:()=>p,WebGL2SpectrogramRenderer:()=>L,buildColorMap:()=>v,computeTerrainCamera:()=>b,lookAt:()=>R,multiplyMat4:()=>k,perspective:()=>D,terrainVerticesForTile:()=>J});var H=[[31,119,180,255],[174,199,232,255],[255,127,14,255],[255,187,120,255],[44,160,44,255],[152,223,138,255],[214,39,40,255],[255,152,150,255],[148,103,189,255],[197,176,213,255],[140,86,75,255],[196,156,148,255],[227,119,194,255],[247,182,210,255],[127,127,127,255],[199,199,199,255],[188,189,34,255],[219,219,141,255],[23,190,207,255],[158,218,229,255]],B={viridis:[[0,68,1,84],[.33,49,104,142],[.66,53,183,121],[1,253,231,37]],magma:[[0,0,0,4],[.33,87,15,109],[.66,187,55,84],[1,252,253,191]],inferno:[[0,0,0,4],[.33,120,28,109],[.66,237,105,37],[1,252,255,164]],plasma:[[0,13,8,135],[.33,126,3,168],[.66,240,89,97],[1,240,249,33]],cividis:[[0,0,32,77],[.25,65,83,102],[.5,124,123,120],[.75,197,180,99],[1,255,234,70]],turbo:[[0,48,18,59],[.25,50,101,214],[.5,37,213,118],[.75,249,210,60],[1,122,4,3]],gray:[[0,0,0,0],[1,255,255,255]],gray_r:[[0,255,255,255],[1,0,0,0]],gray_inverted:[[0,255,255,255],[1,0,0,0]],inverse_gray:[[0,255,255,255],[1,0,0,0]],greys:[[0,255,255,255],[.25,240,240,240],[.5,189,189,189],[.75,99,99,99],[1,0,0,0]],greys_r:[[0,0,0,0],[.25,99,99,99],[.5,189,189,189],[.75,240,240,240],[1,255,255,255]],gist_yarg:[[0,255,255,255],[1,0,0,0]],binary:[[0,255,255,255],[1,0,0,0]],bone:[[0,0,0,0],[.375,84,84,116],[.75,166,198,198],[1,255,255,255]],purples:[[0,252,251,253],[.25,239,237,245],[.5,188,189,220],[.75,117,107,177],[1,63,0,125]],blues:[[0,247,251,255],[.25,198,219,239],[.5,107,174,214],[.75,33,113,181],[1,8,48,107]],greens:[[0,247,252,245],[.25,199,233,192],[.5,116,196,118],[.75,35,139,69],[1,0,68,27]],oranges:[[0,255,245,235],[.25,254,230,206],[.5,253,141,60],[.75,217,72,1],[1,127,39,4]],reds:[[0,255,245,240],[.25,252,187,161],[.5,251,106,74],[.75,203,24,29],[1,103,0,13]],ylorbr:[[0,255,255,229],[.25,254,217,142],[.5,254,153,41],[.75,204,76,2],[1,102,37,6]],ylorrd:[[0,255,255,204],[.25,254,217,118],[.5,253,141,60],[.75,227,26,28],[1,128,0,38]],orrd:[[0,254,240,217],[.25,253,204,138],[.5,252,141,89],[.75,227,74,51],[1,153,0,0]],purd:[[0,247,244,249],[.25,215,181,216],[.5,223,101,176],[.75,206,18,86],[1,103,0,31]],rdpu:[[0,254,235,226],[.25,251,180,185],[.5,247,104,161],[.75,174,1,126],[1,73,0,106]],bupu:[[0,247,252,253],[.25,191,211,230],[.5,140,150,198],[.75,136,65,157],[1,77,0,75]],gnbu:[[0,240,249,232],[.25,186,228,188],[.5,123,204,196],[.75,43,140,190],[1,8,64,129]],pubu:[[0,255,247,251],[.25,208,209,230],[.5,103,169,207],[.75,2,129,138],[1,2,56,88]],ylgnbu:[[0,255,255,217],[.25,199,233,180],[.5,65,182,196],[.75,29,145,192],[1,8,29,88]],pubugn:[[0,255,247,251],[.25,208,209,230],[.5,103,169,207],[.75,1,108,89],[1,1,70,54]],bugn:[[0,247,252,253],[.25,204,236,230],[.5,102,194,164],[.75,41,153,112],[1,0,68,27]],ylgn:[[0,255,255,229],[.25,217,240,163],[.5,120,198,121],[.75,35,132,67],[1,0,69,41]],ocean:[[0,0,17,0],[.2,0,51,68],[.4,0,102,119],[.6,51,153,153],[.8,170,204,204],[1,255,255,255]],gist_earth:[[0,0,0,0],[.2,36,73,143],[.4,52,147,98],[.6,160,192,112],[.8,192,144,96],[1,255,255,255]],terrain:[[0,51,51,153],[.2,0,153,153],[.4,51,204,51],[.6,204,204,102],[.8,153,102,51],[1,255,255,255]],gist_stern:[[0,0,0,0],[.2,255,255,255],[.4,218,0,0],[.6,255,170,0],[.8,0,218,0],[1,0,100,255]],gnuplot:[[0,0,0,0],[.2,60,0,140],[.4,180,0,140],[.6,230,100,0],[.8,255,220,0],[1,255,255,255]],gnuplot2:[[0,0,0,0],[.25,0,0,160],[.5,0,140,200],[.75,120,220,100],[.9,255,255,100],[1,255,255,255]],cmrmap:[[0,0,0,0],[.15,26,40,128],[.35,110,30,130],[.55,180,40,60],[.75,220,130,30],[.9,230,210,100],[1,255,255,255]],cubehelix:[[0,0,0,0],[.2,24,45,96],[.4,41,117,107],[.6,126,162,80],[.8,220,160,150],[1,255,255,255]],brg:[[0,0,0,255],[.25,128,0,128],[.5,255,0,0],[.75,128,128,0],[1,0,255,0]],gist_rainbow:[[0,255,0,255],[.16,0,0,255],[.33,0,255,255],[.5,0,255,0],[.66,255,255,0],[.83,255,128,0],[1,255,0,0]],rainbow:[[0,128,0,255],[.2,0,0,255],[.4,0,255,128],[.6,128,255,0],[.75,255,255,0],[.88,255,128,0],[1,255,0,0]],jet:[[0,0,0,143],[.15,0,0,255],[.4,0,255,255],[.65,255,255,0],[.85,255,0,0],[1,128,0,0]],nipy_spectral:[[0,0,0,0],[.12,90,0,140],[.25,0,0,200],[.4,0,160,200],[.55,0,180,0],[.7,220,220,0],[.85,240,0,0],[1,200,200,200]],gist_ncar:[[0,0,0,128],[.15,0,128,255],[.3,0,255,128],[.45,128,255,0],[.6,255,255,0],[.75,255,0,0],[.9,255,0,255],[1,255,255,255]]};function W(e){if(Array.isArray(e))return[e[0]??0,e[1]??0,e[2]??0,e[3]??255];let t=e.trim().toLowerCase();if(t==="transparent")return[0,0,0,0];let i=/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(t);if(i)return[Number.parseInt(i[1],16),Number.parseInt(i[2],16),Number.parseInt(i[3],16),255];let A=/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(t);if(A)return[Number.parseInt(A[1],16),Number.parseInt(A[2],16),Number.parseInt(A[3],16),Number.parseInt(A[4],16)];let r=/^#([\da-f])([\da-f])([\da-f])$/i.exec(t);if(r)return[Number.parseInt(r[1]+r[1],16),Number.parseInt(r[2]+r[2],16),Number.parseInt(r[3]+r[3],16),255];let n=/^#([\da-f])([\da-f])([\da-f])([\da-f])$/i.exec(t);if(n)return[Number.parseInt(n[1]+n[1],16),Number.parseInt(n[2]+n[2],16),Number.parseInt(n[3]+n[3],16),Number.parseInt(n[4]+n[4],16)];let a=/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(t);if(a){let s=Math.round(Number.parseFloat(a[1])),g=Math.round(Number.parseFloat(a[2])),o=Math.round(Number.parseFloat(a[3])),l=255;if(a[4]!==void 0){let h=Number.parseFloat(a[4]);l=Math.round(h<=1?255*h:h)}return[s,g,o,Math.max(0,Math.min(255,l))]}throw new Error(`Unsupported color format: ${e}`)}function Q(e,t,i,A){let r=(Math.max(0,Math.min(1,e/255))**t-.5)*i+.5+A;return Math.round(255*Math.max(0,Math.min(1,r)))}function y(e,t=1,i=1,A=0){let r=[...e].sort((n,a)=>n[0]-a[0]);return Array.from({length:256},(n,a)=>{let s=a/255,g=r.find(I=>I[0]>=s)??r[r.length-1],o=[...r].reverse().find(I=>I[0]<=s)??r[0],l=(s-o[0])/(g[0]-o[0]||1),h=Math.round(o[1]+(g[1]-o[1])*l),c=Math.round(o[2]+(g[2]-o[2])*l),u=Math.round(o[3]+(g[3]-o[3])*l);return[Q(h,t,i,A),Q(c,t,i,A),Q(u,t,i,A),255]})}function v(e){let t=typeof e=="string"?e.toLowerCase():"base"in e?e.base.toLowerCase():void 0,i=typeof e=="object"?e.gamma??1:1,A=typeof e=="object"?e.contrast??1:1,r=typeof e=="object"?e.brightness??0:0;if(t==="tab20")return(function(n=1,a=1,s=0){return Array.from({length:256},(g,o)=>{let l=Math.min(19,Math.floor(o/256*20)),h=H[l];return[Q(h[0],n,a,s),Q(h[1],n,a,s),Q(h[2],n,a,s),h[3]]})})(i,A,r);if(t&&t in B)return y(B[t],i,A,r);if(t){let n=t.endsWith("_r")?t.slice(0,-2):t.endsWith("_inverted")?t.slice(0,-9):void 0;if(n&&n in B)return y(B[n].map(([a,s,g,o])=>[1-a,s,g,o]),i,A,r)}return y(typeof e=="object"&&"points"in e?e.points.map(n=>{let a=W(n.color);return[n.at,a[0],a[1],a[2]]}):B.viridis,i,A,r)}function S(e){return 10**(e/20)}function x(e){return S(e)**2}function j(e){return e.mode==="magnitude"?{min:S(e.min),max:S(e.max)}:e.mode==="power"?{min:x(e.min),max:x(e.max)}:{min:e.min,max:e.max}}var ce={autoRender:!0,renderer:"auto",backend:"auto",channel:0,windowSize:1024,fftSize:1024,hopSize:256,window:"hann",frequencyScale:"linear",valueMode:"db",minDb:-100,maxDb:0,valueGamma:1,clampValues:!0,tileMaxCells:2**17,maxCachedTiles:64,prefetchTiles:8,colorMap:"viridis",transforms:[]};function X(e,t){if(t==="power"&&e.power)return{values:e.power,binCount:e.binCount};if(t==="db"&&e.db)return{values:e.db,binCount:e.binCount};if(t==="power"){let i=new Float32Array(e.magnitude.length);for(let A=0;A<i.length;A++)i[A]=e.magnitude[A]**2;return{values:i,binCount:e.binCount}}if(t==="db"){let i=new Float32Array(e.magnitude.length);for(let A=0;A<i.length;A++)i[A]=20*Math.log10(Math.max(1e-12,Math.abs(e.magnitude[A])));return{values:i,binCount:e.binCount}}return{values:e.magnitude,binCount:e.binCount}}function T(e){return typeof e.createShader=="function"&&typeof e.createProgram=="function"&&typeof e.texImage2D=="function"}function M(e,t,i,A){let r=e.createShader(t);if(!r)throw new Error(A==="spectrogram"?"Unable to create WebGL2 shader":"Failed to create WebGL shader object");if(e.shaderSource(r,i),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS))return r;let n=e.getShaderInfoLog(r);throw e.deleteShader(r),A==="waveform"?new Error(`WebGL shader compile failed: ${n||"Unknown shader compilation error"}`):new Error(`Unable to compile WebGL2 ${t===e.VERTEX_SHADER?"vertex":t===e.FRAGMENT_SHADER?"fragment":"unknown"} shader: ${n?.trim()||"unknown shader error"}
${(function(a){return a.split(`
`).map((s,g)=>`${String(g+1).padStart(3," ")}: ${s}`).join(`
`)})(i)}`)}function O(e,t,i,A){let r=M(e,e.VERTEX_SHADER,t,A),n=M(e,e.FRAGMENT_SHADER,i,A),a=e.createProgram();if(!a)throw e.deleteShader(r),e.deleteShader(n),new Error(A==="spectrogram"?"Unable to create WebGL2 program":"Failed to create WebGL program object");if(e.attachShader(a,r),e.attachShader(a,n),e.linkProgram(a),e.deleteShader(r),e.deleteShader(n),e.getProgramParameter(a,e.LINK_STATUS))return a;let s=e.getProgramInfoLog(a);throw e.deleteProgram(a),new Error(A==="spectrogram"?`Unable to link WebGL2 program: ${s??"unknown program error"}`:`WebGL program link failed: ${s||"Unknown program link error"}`)}var Z=class{gl;program;position;tileUv;uniformLocations=new Map;constructor(e,t,i){this.gl=e;let A=O(e,t,i,"spectrogram");this.program=A,this.position=e.getAttribLocation(A,"a_position"),this.tileUv=e.getAttribLocation(A,"a_tileUv")}use(){this.gl.useProgram(this.program)}delete(){this.gl.deleteProgram(this.program),this.uniformLocations.clear()}location(e){let t=this.uniformLocations.get(e);return t===void 0&&(t=this.gl.getUniformLocation(this.program,e),this.uniformLocations.set(e,t)),t}uniform1i(e,t){let i=this.location(e);i&&this.gl.uniform1i(i,t)}uniform1f(e,t){let i=this.location(e);i&&this.gl.uniform1f(i,t)}uniform2f(e,t,i){let A=this.location(e);A&&this.gl.uniform2f(A,t,i)}uniform3f(e,t,i,A){let r=this.location(e);r&&this.gl.uniform3f(r,t,i,A)}uniformMat4(e,t){let i=this.location(e);i&&this.gl.uniformMatrix4fv(i,!1,t)}uniform4f(e,t,i,A,r){let n=this.location(e);n&&this.gl.uniform4f(n,t,i,A,r)}};function $(e){return e==="log"?1:e==="mel"?2:0}var ee=`uniform sampler2D u_tile;
uniform sampler2D u_colormap;
uniform vec4 u_viewport;
uniform vec2 u_tileTimeRange;
uniform vec2 u_tileFrequencyRange;
uniform vec2 u_tileSize;
uniform vec2 u_canvasSize;
uniform vec4 u_valueScale;
uniform float u_frequencyScale;
uniform float u_overlayMode;`,F=`float hzToMel(float hz) { return 1127.01048 * log(1.0 + hz / 700.0); }
float melToHz(float mel) { return 700.0 * (pow(10.0, mel / 2595.0) - 1.0); }
float hzToScale(float hz, float scale) {
  if (scale == 1.0) return log(max(1.0, hz)) / log(10.0);
  if (scale == 2.0) return hzToMel(hz);
  return hz;
}
float scaleToHz(float value, float scale) {
  if (scale == 1.0) return pow(10.0, value);
  if (scale == 2.0) return melToHz(value);
  return value;
}`,te=`if (u_overlayMode == 1.0) {
    float hatch = step(0.84, fract((gl_FragCoord.x + gl_FragCoord.y) / 12.0));
    outColor = mix(vec4(0.059, 0.09, 0.165, 1.0), vec4(0.278, 0.333, 0.412, 1.0), hatch);
    return;
  }

  if (u_overlayMode == 2.0) {
    outColor = vec4(1.0, 1.0, 1.0, 0.9);
    return;
  }`,q=class{name;shader;gl;vertexBuffer;vao;constructor(e,t,i,A,r){this.name=A,this.gl=e,this.shader=new Z(e,t,i);let n=e.createBuffer();if(!n)throw new Error(`Unable to initialize WebGL2 ${A} resources`);this.vertexBuffer=n,this.vao=typeof e.createVertexArray=="function"?e.createVertexArray():null,r&&this.setFullViewportQuad(),this.vao&&this.setupVao()}delete(){this.vao&&this.gl.deleteVertexArray(this.vao),this.gl.deleteBuffer(this.vertexBuffer),this.shader.delete()}beginPaint(e,t,i){let A=this.gl;i?A.enable(A.DEPTH_TEST):A.disable(A.DEPTH_TEST),A.disable(A.BLEND),A.clearColor(e[0],e[1],e[2],e[3]),A.clear(t),this.shader.use(),this.vao?A.bindVertexArray(this.vao):this.bindAttributes()}bindCommonUniforms(e,t,i){let A=this.gl;A.activeTexture(A.TEXTURE1),A.bindTexture(A.TEXTURE_2D,i.colorMapTexture),this.shader.uniform1i("u_colormap",1),this.shader.uniform4f("u_viewport",e.viewport.startTime,e.viewport.endTime,e.viewport.minFrequency??0,e.viewport.maxFrequency??24e3),this.shader.uniform2f("u_canvasSize",t.deviceWidth,t.deviceHeight),this.shader.uniform1f("u_frequencyScale",$(e.frequencyScale))}endPaint(e){let t=this.gl;e&&t.disable(t.DEPTH_TEST),this.vao&&t.bindVertexArray(null)}drawQuad(){this.gl.drawArrays(this.gl.TRIANGLE_STRIP,0,4)}setupVao(){this.vao&&(this.gl.bindVertexArray(this.vao),this.bindAttributes(),this.gl.bindVertexArray(null))}bindAttributes(){let e=this.gl;e.bindBuffer(e.ARRAY_BUFFER,this.vertexBuffer),this.shader.position>=0&&(e.enableVertexAttribArray(this.shader.position),e.vertexAttribPointer(this.shader.position,2,e.FLOAT,!1,16,0)),this.shader.tileUv>=0&&(e.enableVertexAttribArray(this.shader.tileUv),e.vertexAttribPointer(this.shader.tileUv,2,e.FLOAT,!1,16,8))}setFullViewportQuad(){let e=this.gl;e.bindBuffer(e.ARRAY_BUFFER,this.vertexBuffer),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]),e.STATIC_DRAW)}},Ae=`#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`,ie=`#version 300 es
precision highp float;

out vec4 outColor;

${ee}

${F}

void main() {
  ${te}
  float globalX = gl_FragCoord.x / max(1.0, u_canvasSize.x);
  float canvasY = 1.0 - gl_FragCoord.y / max(1.0, u_canvasSize.y);
  float time = mix(u_viewport.x, u_viewport.y, globalX);
  if (time < u_tileTimeRange.x || time > u_tileTimeRange.y) discard;
  float minScale = hzToScale(u_viewport.z, u_frequencyScale);
  float maxScale = hzToScale(u_viewport.w, u_frequencyScale);
  float frequency = scaleToHz(mix(maxScale, minScale, canvasY), u_frequencyScale);
  float frequencyStep = (u_tileFrequencyRange.y - u_tileFrequencyRange.x) / max(1.0, u_tileSize.y - 1.0);
  if (frequency > u_tileFrequencyRange.x && frequency <= u_tileFrequencyRange.x + frequencyStep * 0.5 + 0.000001) {
    outColor = texture(u_colormap, vec2(0.0, 0.5));
    return;
  }
  float hopDuration = (u_tileTimeRange.y - u_tileTimeRange.x) / max(1.0, u_tileSize.x);
  float framePosition = clamp((time - u_tileTimeRange.x) / max(0.000001, hopDuration), 0.0, max(0.0, u_tileSize.x - 1.0));
  float binPosition = clamp((frequency - u_tileFrequencyRange.x) / max(0.000001, u_tileFrequencyRange.y - u_tileFrequencyRange.x) * max(1.0, u_tileSize.y - 1.0), 0.0, max(0.0, u_tileSize.y - 1.0));
  int frame0 = int(floor(framePosition));
  int frame1 = int(ceil(framePosition));
  int bin0 = int(floor(binPosition));
  int bin1 = int(ceil(binPosition));
  float frameFraction = fract(framePosition);
  float binFraction = fract(binPosition);
  float low0 = texelFetch(u_tile, ivec2(frame0, bin0), 0).r;
  float low1 = texelFetch(u_tile, ivec2(frame1, bin0), 0).r;
  float high0 = texelFetch(u_tile, ivec2(frame0, bin1), 0).r;
  float high1 = texelFetch(u_tile, ivec2(frame1, bin1), 0).r;
  float normalized = mix(mix(low0, low1, frameFraction), mix(high0, high1, frameFraction), binFraction);
  outColor = texture(u_colormap, vec2(clamp(normalized, 0.0, 1.0), 0.5));
}`;var L=class G{gl;kind="webgl2";program;colorMapTexture;tileTextures=new Map;matrixIds=new WeakMap;nextMatrixId=1;colorMapKey="";constructor(t,i){this.gl=t,this.program=i;let A=t.createTexture();if(!A)throw new Error("Unable to initialize WebGL2 renderer resources");this.colorMapTexture=A}static create(t,i){let A=t.getContext("webgl2");return A&&T(A)?new G(A,i):void 0}static diagnose(t){let i=t.getContext("webgl2");return i?T(i)?N(i,i.VERTEX_SHADER,Ae)??N(i,i.FRAGMENT_SHADER,ie):'canvas.getContext("webgl2") did not return a usable WebGL2RenderingContext':'canvas.getContext("webgl2") returned null'}invalidate(){for(let t of this.tileTextures.values())this.gl.deleteTexture(t.texture);this.tileTextures.clear()}setProgram(t){this.program!==t&&(this.program?.delete(),this.program=t)}render(t){if(this.gl.isContextLost())throw new Error("WebGL2 context is lost; create a new renderer to recover");this.paint(t,this.programFor(t))}destroy(){this.invalidate(),this.gl.deleteTexture(this.colorMapTexture),this.program?.delete(),this.program=void 0}paint(t,i){let A=(function(r){let n=Math.max(1,r.width||1),a=Math.max(1,r.height||1);return{width:n,height:a,dpr:1,deviceWidth:n,deviceHeight:a}})(t.canvas);this.updateColorMap(t.colorMap),this.gl.viewport(0,0,A.deviceWidth,A.deviceHeight),i.paint(t,A,this.renderResources(t)),this.throwOnError("render")}programFor(t){return t.webglProgram??this.requireProgram()}requireProgram(){if(!this.program)throw new Error("WebGL2 renderer has been destroyed");return this.program}renderResources(t){return{colorMapTexture:this.colorMapTexture,tiles:t.tiles,textureForTile:(i,A)=>this.textureForTile(i,A)}}matrixId(t){let i=this.matrixIds.get(t);return i===void 0&&(i=this.nextMatrixId++,this.matrixIds.set(t,i)),i}textureForTile(t,i){let A=`${this.matrixId(t)}:${i.mode}:${i.min}:${i.max}:${i.gamma}:${i.clamp}`,r=this.tileTextures.get(A);if(r)return r;let n=this.gl,a=n.createTexture();if(!a)throw new Error("Unable to create WebGL2 tile texture");let s=Math.max(1,t.frameCount),g=Math.max(1,t.binCount),o=t.frameCount>0&&t.binCount>0?(function(c,u){if(c.frameCount===0||c.binCount===0)return new Uint8Array(4);let I=X(c,u.mode).values,C=new Uint8Array(c.frameCount*c.binCount*4);for(let d=0;d<c.frameCount;d++)for(let m=0;m<c.binCount;m++){let f=4*(m*c.frameCount+d),E=ne(I[d*c.binCount+m],u);C[f]=E,C[f+1]=E,C[f+2]=E,C[f+3]=255}return C})(t,i):new Uint8Array(4),l=n.getParameter(n.ACTIVE_TEXTURE);n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,a),n.pixelStorei(n.UNPACK_ALIGNMENT,1),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE),n.texImage2D(n.TEXTURE_2D,0,n.RGBA,s,g,0,n.RGBA,n.UNSIGNED_BYTE,o),this.throwOnError("tile texture upload"),n.activeTexture(l);let h={texture:a,width:s,height:g};return this.tileTextures.set(A,h),h}updateColorMap(t){let i=JSON.stringify(t);if(i===this.colorMapKey)return;this.colorMapKey=i;let A=new Uint8Array(v(t).flat()),r=this.gl;r.bindTexture(r.TEXTURE_2D,this.colorMapTexture),r.pixelStorei(r.UNPACK_ALIGNMENT,1),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,256,1,0,r.RGBA,r.UNSIGNED_BYTE,A)}throwOnError(t){let i=this.gl.getError();if(i!==this.gl.NO_ERROR)throw new Error(`WebGL2 renderer ${t} failed with GL error 0x${i.toString(16)}`)}};function N(e,t,i){try{let A=M(e,t,i,"spectrogram");return void e.deleteShader(A)}catch(A){return A instanceof Error?A.message:String(A)}}function ne(e,t){let{min:i,max:A}=j(t),r=(e-i)/(A-i||1);return t.clamp&&(r=Math.max(0,Math.min(1,r))),r=Math.max(0,r)**t.gamma,Math.max(0,Math.min(255,Math.round(255*r)))}function D(e,t,i,A){let r=1/Math.tan(e/2),n=1/(i-A);return new Float32Array([r/t,0,0,0,0,r,0,0,0,0,(A+i)*n,-1,0,0,2*A*i*n,0])}function R(e,t,i){let A=e[0]-t[0],r=e[1]-t[1],n=e[2]-t[2],a=Math.hypot(A,r,n)||1;A/=a,r/=a,n/=a;let s=i[1]*n-i[2]*r,g=i[2]*A-i[0]*n,o=i[0]*r-i[1]*A;a=Math.hypot(s,g,o)||1,s/=a,g/=a,o/=a;let l=r*o-n*g,h=n*s-A*o,c=A*g-r*s;return new Float32Array([s,l,A,0,g,h,r,0,o,c,n,0,-(s*e[0]+g*e[1]+o*e[2]),-(l*e[0]+h*e[1]+c*e[2]),-(A*e[0]+r*e[1]+n*e[2]),1])}function k(e,t){let i=new Float32Array(16);for(let A=0;A<4;A++)for(let r=0;r<4;r++){let n=0;for(let a=0;a<4;a++)n+=(e[a*4+r]??0)*(t[A*4+a]??0);i[A*4+r]=n}return i}function J(e,t=96,i=96){let A=Math.max(2,Math.min(t,e.frameCount)),r=Math.max(2,Math.min(i,e.binCount)),n=new Float32Array((A-1)*(r-1)*6*4),a=0;for(let s=0;s<r-1;s++){let g=s/(r-1),o=(s+1)/(r-1);for(let l=0;l<A-1;l++){let h=l/(A-1),c=(l+1)/(A-1);n[a]=h,n[a+1]=g,n[a+2]=h,n[a+3]=g,n[a+4]=c,n[a+5]=g,n[a+6]=c,n[a+7]=g,n[a+8]=h,n[a+9]=o,n[a+10]=h,n[a+11]=o,n[a+12]=c,n[a+13]=g,n[a+14]=c,n[a+15]=g,n[a+16]=c,n[a+17]=o,n[a+18]=c,n[a+19]=o,n[a+20]=h,n[a+21]=o,n[a+22]=h,n[a+23]=o,a+=24}}return n}function U(e){let t=e.times.length>1?(e.times[e.times.length-1]-e.times[0])/Math.max(1,e.frameCount-1):e.sampleRate>0?(e.timeEnd-e.timeStart)/e.frameCount:0,i=e.times.length>0?e.times[0]:e.timeStart;return{startTime:i,endTime:i+e.frameCount*t}}function b(e){let t=e.cameraTarget??[0,0,0];if(e.cameraEye)return{eye:e.cameraEye,target:t,up:e.cameraUp??[0,0,1]};let i=e.cameraPitch??0,A=e.cameraYaw??0,r=e.cameraDistance??2.5,n=i*Math.PI/180,a=A*Math.PI/180,s=Math.sin(n),g=Math.cos(n),o=Math.sin(a),l=Math.cos(a),h=e.cameraHeight!==void 0?e.cameraHeight:r*g,c=r*s,u=[t[0]+c*o||0,t[1]-c*l||0,t[2]+h||0],I=e.cameraUp??[-g*o||0,g*l||0,s||0];return{eye:u,target:t,up:I}}function re(e,t,i,A,r){let n=t*Math.PI/180;return k(D(n,e,.1,100),R(i,A,r))}var ae=`#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_tileUv;
out vec2 v_tileUv;
out float v_height;

uniform sampler2D u_tile;
uniform vec2 u_tileTimeRange;
uniform vec2 u_terrainTimeRange;
uniform vec2 u_tileFrequencyRange;
uniform vec2 u_canvasSize;
uniform vec4 u_viewport;
uniform float u_frequencyScale;
uniform float u_terrainHeight;
uniform float u_heightGamma;
uniform float u_smoothing;
uniform float u_aspect;
uniform mat4 u_viewProjection;
uniform vec2 u_tileSize;

${F}

void main() {
  float minScale = hzToScale(u_viewport.z, u_frequencyScale);
  float maxScale = hzToScale(u_viewport.w, u_frequencyScale);
  float frequency = scaleToHz(mix(minScale, maxScale, a_tileUv.y), u_frequencyScale);
  float frequencyUv = clamp((frequency - u_tileFrequencyRange.x) / max(0.000001, u_tileFrequencyRange.y - u_tileFrequencyRange.x), 0.0, 1.0);
  v_tileUv = vec2(a_tileUv.x, frequencyUv);
  vec2 stepUv = 1.0 / max(vec2(1.0), u_tileSize - 1.0);
  float h0 = texture(u_tile, v_tileUv).r;
  float h1 = texture(u_tile, clamp(v_tileUv + vec2(stepUv.x, 0.0), 0.0, 1.0)).r;
  float h2 = texture(u_tile, clamp(v_tileUv - vec2(stepUv.x, 0.0), 0.0, 1.0)).r;
  float h3 = texture(u_tile, clamp(v_tileUv + vec2(0.0, stepUv.y), 0.0, 1.0)).r;
  float h4 = texture(u_tile, clamp(v_tileUv - vec2(0.0, stepUv.y), 0.0, 1.0)).r;
  float neighbors = (h1 + h2 + h3 + h4) * 0.25;
  float heightValue = mix(h0, neighbors, clamp(u_smoothing, 0.0, 1.0));
  v_height = heightValue;
  float tileTime = mix(u_tileTimeRange.x, u_tileTimeRange.y, a_tileUv.x);
  float viewportX = (tileTime - u_terrainTimeRange.x) / max(0.000001, u_terrainTimeRange.y - u_terrainTimeRange.x);
  float liftedHeight = pow(clamp(heightValue, 0.0, 1.0), u_heightGamma) * (u_terrainHeight * 0.5);
  // Ground plane lies in X-Y: time spans along X (scaled by aspect to fill canvas),
  // frequency spans along Y (low frequencies at foreground -Y, high frequencies at background +Y),
  // and audio energy / amplitude lifts vertically along the Z axis.
  vec3 worldPosition = vec3(
    (viewportX * 2.0 - 1.0) * (u_aspect * 1.05),
    (a_tileUv.y - 0.5) * 1.9,
    liftedHeight
  );
  gl_Position = u_viewProjection * vec4(worldPosition, 1.0);
}`,oe=`#version 300 es
precision highp float;

in vec2 v_tileUv;
in float v_height;
out vec4 outColor;

uniform sampler2D u_tile;
uniform sampler2D u_colormap;
uniform vec2 u_tileSize;
uniform float u_ambientLight;
uniform float u_diffuseLight;
uniform vec3 u_lightDirection;

void main() {
  vec2 stepSize = 2.0 / max(vec2(1.0), u_tileSize - 1.0);
  float left = texture(u_tile, clamp(v_tileUv - vec2(stepSize.x, 0.0), 0.0, 1.0)).r;
  float right = texture(u_tile, clamp(v_tileUv + vec2(stepSize.x, 0.0), 0.0, 1.0)).r;
  float low = texture(u_tile, clamp(v_tileUv - vec2(0.0, stepSize.y), 0.0, 1.0)).r;
  float high = texture(u_tile, clamp(v_tileUv + vec2(0.0, stepSize.y), 0.0, 1.0)).r;
  vec3 normal = normalize(vec3((left - right) * 1.0, (low - high) * 1.0, 1.2));
  vec3 localLight = normalize(u_lightDirection);
  float light = clamp(dot(normal, localLight), 0.0, 1.0);
  vec3 baseColor = texture(u_colormap, vec2(clamp(v_height, 0.0, 1.0), 0.5)).rgb;
  vec3 color = baseColor * (u_ambientLight + light * u_diffuseLight);
  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`,p=class extends q{vertexCount;options;constructor(t,i={}){super(t,ae,oe,"terrain",!1),this.options=i;let A=i.meshResolution??64,r=Array.isArray(A)?A[0]:A,n=Array.isArray(A)?A[1]:A,a=new Float32Array((r-1)*(n-1)*6*4),s=0;for(let g=0;g<n-1;g++){let o=g/(n-1),l=(g+1)/(n-1);for(let h=0;h<r-1;h++){let c=h/(r-1),u=(h+1)/(r-1);a.set([c,o,c,o,u,o,u,o,c,l,c,l],s),a.set([u,o,u,o,u,l,u,l,c,l,c,l],s+12),s+=24}}this.vertexCount=a.length/4,t.bindBuffer(t.ARRAY_BUFFER,this.vertexBuffer),t.bufferData(t.ARRAY_BUFFER,a,t.STATIC_DRAW)}setOptions(t){this.options={...this.options,...t}}getOptions(){return{...this.options}}paint(t,i,A){this.beginPaint([0,0,0,1],this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT,!0),this.bindCommonUniforms(t,i,A),this.shader.uniform2f("u_terrainTimeRange",t.viewport.startTime,t.viewport.endTime);let r=i.deviceWidth/Math.max(1,i.deviceHeight),n=this.options.fov??45,a=this.options.heightScale??.55,s=this.options.heightGamma??1,g=this.options.smoothing??.6,o=this.options.ambientLight??.75,l=this.options.diffuseLight??.25,h=this.options.lightDirection??[.15,-.35,.85],{eye:c,target:u,up:I}=b(this.options);this.shader.uniform1f("u_aspect",r),this.shader.uniformMat4("u_viewProjection",re(r,n,c,u,I)),this.shader.uniform3f("u_cameraPosition",c[0],c[1],c[2]),this.shader.uniform1f("u_terrainHeight",a),this.shader.uniform1f("u_heightGamma",s),this.shader.uniform1f("u_smoothing",g),this.shader.uniform1f("u_ambientLight",o),this.shader.uniform1f("u_diffuseLight",l),this.shader.uniform3f("u_lightDirection",h[0],h[1],h[2]);let C=t.viewport.startTime,d=t.viewport.endTime;for(let m of t.tiles){let{startTime:f,endTime:E}=U(m);E<C||f>d||this.drawTile(m,t.valueScale,A)}this.endPaint(!0)}drawTile(t,i,A){if(t.frameCount<2||t.binCount<2)return;let r=A.textureForTile(t,i);this.gl.activeTexture(this.gl.TEXTURE0),this.gl.bindTexture(this.gl.TEXTURE_2D,r.texture),this.shader.uniform1i("u_tile",0);let{startTime:n,endTime:a}=U(t);this.shader.uniform2f("u_tileTimeRange",n,a),this.shader.uniform2f("u_tileFrequencyRange",t.frequencies[0]??0,t.frequencies[t.frequencies.length-1]??Math.max(1,t.sampleRate/2)),this.shader.uniform2f("u_tileSize",r.width,r.height),this.gl.drawArrays(this.gl.TRIANGLES,0,this.vertexCount)}};return V(se);})();
