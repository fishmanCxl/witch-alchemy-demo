const DESIGN_WIDTH = 393;
const DESIGN_HEIGHT = 852;
const ENGINE_PROGRESS_END = 0.6;
const BACKGROUND_VERTICAL_OVERSCAN = 8;

const VERTEX_SHADER = `
attribute vec2 a_Position;
attribute vec2 a_TexCoord;
varying vec2 v_TexCoord;
void main() {
  gl_Position = vec4(a_Position, 0.0, 1.0);
  v_TexCoord = a_TexCoord;
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_Texture;
varying vec2 v_TexCoord;
void main() {
  gl_FragColor = texture2D(u_Texture, v_TexCoord);
}`;

let gl = null;
let program = null;
let texture = null;
let vertexBuffer = null;
let offscreen = null;
let context = null;
let background = null;
let witch = null;
let logo = null;
let screenHeight = DESIGN_HEIGHT;
let progress = 0;
let dirty = true;
let rafHandle = null;
let afterTick = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'first-screen shader compilation failed');
  }
  return shader;
}

function createProgram() {
  const next = gl.createProgram();
  gl.attachShader(next, createShader(gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(next, createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(next);
  if (!gl.getProgramParameter(next, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(next) || 'first-screen program linking failed');
  }
  return next;
}

function createOffscreenCanvas() {
  let next = null;
  if (typeof wx !== 'undefined' && typeof wx.createOffscreenCanvas === 'function') {
    next = wx.createOffscreenCanvas({ type: '2d', width: DESIGN_WIDTH, height: screenHeight });
  } else if (typeof wx !== 'undefined' && typeof wx.createCanvas === 'function') {
    next = wx.createCanvas();
    next.width = DESIGN_WIDTH;
    next.height = screenHeight;
  }
  if (!next) throw new Error('2D offscreen canvas is unavailable');
  return next;
}

function loadImage(path) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = path;
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCover(ctx, image) {
  const scale = Math.max(DESIGN_WIDTH / image.width, (screenHeight + BACKGROUND_VERTICAL_OVERSCAN) / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, (DESIGN_WIDTH - width) / 2, (screenHeight - height) / 2, width, height);
}

function drawText(text, size, x, y, color, strokeWidth) {
  context.save();
  context.font = `${size}px serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  if (strokeWidth > 0) {
    context.lineWidth = strokeWidth;
    context.strokeStyle = 'rgba(45, 18, 63, 0.86)';
    context.strokeText(text, x, y);
  }
  context.fillStyle = color;
  context.fillText(text, x, y);
  context.restore();
}

function drawLaunchScreen() {
  const yOffset = (screenHeight - DESIGN_HEIGHT) / 2;
  context.clearRect(0, 0, DESIGN_WIDTH, screenHeight);
  context.fillStyle = '#13091F';
  context.fillRect(0, 0, DESIGN_WIDTH, screenHeight);
  if (background) drawCover(context, background);
  context.fillStyle = 'rgba(18, 8, 31, 0.37)';
  context.fillRect(0, 0, DESIGN_WIDTH, screenHeight);

  if (logo) {
    const width = 306;
    const height = width * logo.height / logo.width;
    context.drawImage(logo, (DESIGN_WIDTH - width) / 2, 191 + yOffset - height / 2, width, height);
  }
  if (witch) context.drawImage(witch, 66.5, 274 + yOffset, 260, 260);

  const trackX = 46.5;
  const trackY = 647 + yOffset;
  roundedRect(context, trackX, trackY, 300, 18, 9);
  context.fillStyle = 'rgba(30, 13, 45, 0.91)';
  context.fill();
  context.strokeStyle = 'rgba(201, 156, 233, 0.71)';
  context.lineWidth = 1;
  context.stroke();

  const fillWidth = 296 * progress;
  if (fillWidth > 0) {
    roundedRect(context, trackX + 2, trackY + 2, fillWidth, 14, 7);
    context.fillStyle = '#DCA6FF';
    context.fill();
  }

  drawText(`${Math.floor(progress * 100)}%`, 13, DESIGN_WIDTH / 2, 691 + yOffset, '#F7E6FF', 0);
  drawText('正在准备炼金室…', 11, DESIGN_WIDTH / 2, 716 + yOffset, '#DCC7E8', 0);
  drawText('抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。', 8,
    DESIGN_WIDTH / 2, 800 + yOffset, '#BDAFC4', 0);
  drawText('适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。', 8,
    DESIGN_WIDTH / 2, 820 + yOffset, '#BDAFC4', 0);
}

function uploadFrame() {
  if (dirty) {
    drawLaunchScreen();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen);
    dirty = false;
  }
  gl.viewport(0, 0, window.canvas.width, window.canvas.height);
  gl.clearColor(19 / 255, 9 / 255, 31 / 255, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  const position = gl.getAttribLocation(program, 'a_Position');
  const texCoord = gl.getAttribLocation(program, 'a_TexCoord');
  gl.enableVertexAttribArray(position);
  gl.enableVertexAttribArray(texCoord);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(texCoord, 2, gl.FLOAT, false, 16, 8);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function tick() {
  rafHandle = requestAnimationFrame(() => {
    uploadFrame();
    if (afterTick) {
      const resolve = afterTick;
      afterTick = null;
      resolve();
    }
    tick();
  });
}

function setProgress(value) {
  progress = Math.max(progress, clamp(value, 0, ENGINE_PROGRESS_END));
  dirty = true;
  return new Promise((resolve) => { afterTick = resolve; });
}

function start(alpha, antialias, useWebgl2) {
  const options = {
    alpha: alpha === 'true',
    antialias: antialias !== 'false',
    depth: true,
    stencil: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  };
  if (useWebgl2 === 'true') gl = window.canvas.getContext('webgl2', options);
  if (!gl) gl = window.canvas.getContext('webgl', options);

  screenHeight = Math.round(DESIGN_WIDTH * window.canvas.height / window.canvas.width);
  offscreen = createOffscreenCanvas();
  context = offscreen.getContext('2d');
  program = createProgram();
  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    1, -1, 1, 1,
    1, 1, 1, 0,
    -1, -1, 0, 1,
    -1, 1, 0, 0,
  ]), gl.STATIC_DRAW);
  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  tick();

  return Promise.all([
    loadImage('launch-background.png'),
    loadImage('launch-witch.png'),
    loadImage('launch-logo.png'),
  ]).then((images) => {
    background = images[0];
    witch = images[1];
    logo = images[2];
    dirty = true;
    return setProgress(0);
  });
}

function end() {
  return setProgress(ENGINE_PROGRESS_END).then(() => {
    cancelAnimationFrame(rafHandle);
    gl.deleteTexture(texture);
    gl.deleteBuffer(vertexBuffer);
    gl.deleteProgram(program);
    gl = null;
    program = null;
    texture = null;
    vertexBuffer = null;
    offscreen = null;
    context = null;
    logo = null;
  });
}

module.exports = { start, end, setProgress };
