// Filtros próprios que dependem da posição do pixel (TASK-17): Vinheta, Borda suave e Desfoque de foco (radial ou
// linear). Cada um tem os DOIS caminhos do Fabric 7.4: o shader GLSL (backend WebGL, o do aparelho) e o `applyTo2d`
// (backend Canvas 2D: fallback e vitest), com a mesma conta, para os dois darem o mesmo pixel.
//
// Convenções (conferidas no fonte do Fabric, ver o doc da task):
// - `vTexCoord` (0..1) com y = 0 no TOPO da imagem, como o `y` do ImageData; o centro do pixel x é (x + 0.5) / W.
// - Textura NEAREST + CLAMP_TO_EDGE: o espelho 2D amostra o pixel floor(x + 0.5 + deslocamento), preso à borda.
// - Cor reta (sem alfa pré-multiplicado) nos dois caminhos.
// - Tudo é relativo à REGIÃO visível `x0,y0,x1,y1` (0..1 da imagem natural): o Fabric filtra a imagem inteira e o
//   recorte só entra no desenho [[task-17-vinheta-borda-suave-e-desfoque-de-foco]].
// - Contas no shader normalizadas por `unit` antes de elevar ao quadrado: o Fabric troca `highp` por `mediump` quando o
//   aparelho pede, e px² de uma foto de 4096 px estouraria o mediump.
import { classRegistry, filters, isWebGLPipelineState } from 'fabric';
import type { T2DPipelineState, TWebGLPipelineState, TWebGLUniformLocationMap } from 'fabric';
import { FULL_REGION, type ImageRegion } from './imageGeometry';

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Menor lado da região em px (a unidade do raio do foco e da largura da borda). */
const regionUnit = (r: ImageRegion, w: number, h: number): number => Math.max(1e-6, Math.min((r.x1 - r.x0) * w, (r.y1 - r.y0) * h));

// ---------- Vinheta ----------

type VignetteProps = { vignette: number } & ImageRegion;
const vignetteDefaults: VignetteProps = { vignette: 0, ...FULL_REGION };

const vignetteFragment = `
    precision highp float;
    uniform sampler2D uTexture;
    uniform vec4 uRegion;
    uniform float uVignette;
    varying vec2 vTexCoord;
    void main() {
      vec4 color = texture2D(uTexture, vTexCoord);
      vec2 c = (uRegion.xy + uRegion.zw) * 0.5;
      vec2 r = max((uRegion.zw - uRegion.xy) * 0.5, vec2(0.0001));
      vec2 q = (vTexCoord - c) / r;
      float k = abs(uVignette) * smoothstep(0.3, 2.0, dot(q, q));
      color.rgb = mix(color.rgb, vec3(uVignette > 0.0 ? 0.0 : 1.0), k);
      gl_FragColor = color;
    }`;

/**
 * Escurece (`vignette` > 0) ou clareia (< 0) as bordas da região: d² = ((u−cx)/rx)² + ((v−cy)/ry)², peso
 * |s|·smoothstep(0.3, 2.0, d²). Pixels com d² < 0.3 (o miolo) ficam idênticos; alfa intacto.
 */
export class Vignette extends filters.BaseFilter<'Vignette', VignetteProps> {
  declare vignette: number;
  declare x0: number; declare y0: number; declare x1: number; declare y1: number;
  static type = 'Vignette';
  static defaults: Record<string, unknown> = vignetteDefaults;
  static uniformLocations = ['uRegion', 'uVignette'];

  getFragmentSource(): string { return vignetteFragment; }

  sendUniformData(gl: WebGLRenderingContext, loc: TWebGLUniformLocationMap): void {
    gl.uniform4f(loc.uRegion, this.x0, this.y0, this.x1, this.y1);
    gl.uniform1f(loc.uVignette, this.vignette);
  }

  isNeutralState(): boolean { return !this.vignette; }

  applyTo2d({ imageData: { data, width, height } }: T2DPipelineState): void {
    const s = this.vignette, amount = Math.abs(s), target = s > 0 ? 0 : 255;
    const cx = (this.x0 + this.x1) / 2, cy = (this.y0 + this.y1) / 2;
    const rx = Math.max(1e-4, (this.x1 - this.x0) / 2), ry = Math.max(1e-4, (this.y1 - this.y0) / 2);
    for (let y = 0; y < height; y++) {
      const qy = ((y + 0.5) / height - cy) / ry;
      for (let x = 0; x < width; x++) {
        const qx = ((x + 0.5) / width - cx) / rx;
        const k = amount * smoothstep(0.3, 2.0, qx * qx + qy * qy);
        if (k <= 0) continue;
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) data[i + c] = data[i + c] + (target - data[i + c]) * k;
      }
    }
  }
}

// ---------- Borda suave ----------

type SoftEdgeProps = { softEdge: number } & ImageRegion;
const softEdgeDefaults: SoftEdgeProps = { softEdge: 0, ...FULL_REGION };

const softEdgeFragment = `
    precision highp float;
    uniform sampler2D uTexture;
    uniform float uStepW;
    uniform float uStepH;
    uniform vec4 uRegion;
    uniform float uSoftEdge;
    varying vec2 vTexCoord;
    void main() {
      vec4 color = texture2D(uTexture, vTexCoord);
      vec2 px = vec2(1.0 / uStepW, 1.0 / uStepH);
      float unit = max(min((uRegion.z - uRegion.x) * px.x, (uRegion.w - uRegion.y) * px.y), 0.0001);
      vec2 lo = (vTexCoord - uRegion.xy) * px;
      vec2 hi = (uRegion.zw - vTexCoord) * px;
      float e = min(min(lo.x, hi.x), min(lo.y, hi.y)) / (unit * 0.5);
      color.a *= smoothstep(0.0, uSoftEdge, e);
      gl_FragColor = color;
    }`;

/**
 * Esfuma o alfa perto da borda da região: e = distância em px até a borda mais próxima ÷ (meio lado menor);
 * alfa ×= smoothstep(0, softEdge, e). Fora da região, alfa 0; rgb intacto.
 */
export class SoftEdge extends filters.BaseFilter<'SoftEdge', SoftEdgeProps> {
  declare softEdge: number;
  declare x0: number; declare y0: number; declare x1: number; declare y1: number;
  static type = 'SoftEdge';
  static defaults: Record<string, unknown> = softEdgeDefaults;
  static uniformLocations = ['uRegion', 'uSoftEdge'];

  getFragmentSource(): string { return softEdgeFragment; }

  sendUniformData(gl: WebGLRenderingContext, loc: TWebGLUniformLocationMap): void {
    gl.uniform4f(loc.uRegion, this.x0, this.y0, this.x1, this.y1);
    gl.uniform1f(loc.uSoftEdge, this.softEdge);
  }

  isNeutralState(): boolean { return !(this.softEdge > 0); }

  applyTo2d({ imageData: { data, width, height } }: T2DPipelineState): void {
    const half = regionUnit(this, width, height) / 2, s = this.softEdge;
    for (let y = 0; y < height; y++) {
      const v = (y + 0.5) / height;
      const ey = Math.min(v - this.y0, this.y1 - v) * height;
      for (let x = 0; x < width; x++) {
        const u = (x + 0.5) / width;
        const e = Math.min(Math.min(u - this.x0, this.x1 - u) * width, ey) / half;
        const f = smoothstep(0, s, e);
        if (f >= 1) continue;
        const i = (y * width + x) * 4 + 3;
        data[i] = data[i] * f;
      }
    }
  }
}

// ---------- Desfoque de foco ----------

export type FocusMode = 'radial' | 'linear';
/** Desfoque fora da zona de foco. Centro relativo à região (0..1), raio e transição em múltiplos do lado menor. */
export type FocusSpec = {
  mode: FocusMode;
  /** Intensidade 0..1 (desloca até `blur · 0.12 · lado menor` px nas bordas, como o Blur do Fabric). */
  blur: number;
  focusX: number;
  focusY: number;
  radius: number;
  feather: number;
  /** Só no linear: inclinação da faixa em graus (0 = faixa horizontal). */
  angle: number;
};
/** O que o foco liga ao ser ativado na folha Filtros. */
export const FOCUS_DEFAULTS: Omit<FocusSpec, 'mode'> = { blur: 0.5, focusX: 0.5, focusY: 0.5, radius: 0.25, feather: 0.2, angle: 0 };
const MIN_FEATHER = 0.001;
/** Amostras por lado em cada passada (31 no total, como o shader do Blur do Fabric). */
const SAMPLES = 15;

type FocusBlurProps = FocusSpec & ImageRegion;
const focusBlurDefaults: FocusBlurProps = { mode: 'radial', ...FOCUS_DEFAULTS, blur: 0, ...FULL_REGION };

const focusBlurFragment = `
    precision highp float;
    uniform sampler2D uTexture;
    uniform float uStepW;
    uniform float uStepH;
    uniform vec4 uRegion;
    uniform vec2 uFocus;
    uniform vec4 uShape;
    uniform vec2 uNormal;
    uniform vec2 uAxis;
    varying vec2 vTexCoord;
    const float nSamples = ${SAMPLES}.0;
    void main() {
      vec2 px = vec2(1.0 / uStepW, 1.0 / uStepH);
      float unit = max(min((uRegion.z - uRegion.x) * px.x, (uRegion.w - uRegion.y) * px.y), 0.0001);
      vec2 p = (vTexCoord - uFocus) * px / unit;
      float dist = uShape.w < 0.5 ? length(p) : abs(dot(p, uNormal));
      float reach = smoothstep(uShape.x, uShape.x + uShape.y, dist) * uShape.z * 0.12 * unit;
      if (reach < 0.5) {
        gl_FragColor = texture2D(uTexture, vTexCoord);
      } else {
        vec2 delta = uAxis * reach * vec2(uStepW, uStepH);
        vec3 rgb = vec3(0.0);
        float alpha = 0.0;
        float totalW = 0.0;
        for (float t = -nSamples; t <= nSamples; t++) {
          float percent = t / nSamples;
          vec4 s = texture2D(uTexture, vTexCoord + delta * percent);
          float w = 1.0 - abs(percent);
          rgb += s.rgb * (w * s.a);
          alpha += w * s.a;
          totalW += w;
        }
        gl_FragColor = vec4(alpha > 0.0 ? rgb / alpha : vec3(0.0), alpha / totalW);
      }
    }`;

/**
 * Mantém nítida a zona de foco e desfoca de forma gradual fora dela. Máscara m = smoothstep(radius, radius + feather,
 * dist), dist = |P| (radial) ou |P·n| (linear, n = (−sen a, cos a)), P = (pixel − foco) em px ÷ lado menor da região.
 * Desfoque separável em duas passadas (horizontal, vertical), 31 amostras de peso triangular ponderadas pelo alfa, com
 * alcance m·blur·0.12·lado menor px: m = 0 (dentro do foco) devolve o pixel original exato.
 */
export class FocusBlur extends filters.BaseFilter<'FocusBlur', FocusBlurProps> {
  declare mode: FocusMode;
  declare blur: number;
  declare focusX: number; declare focusY: number;
  declare radius: number; declare feather: number; declare angle: number;
  declare x0: number; declare y0: number; declare x1: number; declare y1: number;
  /** Passada atual no GL (não serializa: fora dos `defaults`). */
  declare horizontal: boolean;
  static type = 'FocusBlur';
  static defaults: Record<string, unknown> = focusBlurDefaults;
  static uniformLocations = ['uRegion', 'uFocus', 'uShape', 'uNormal', 'uAxis'];

  getFragmentSource(): string { return focusBlurFragment; }

  /** O que a folha Filtros relê. */
  spec(): FocusSpec {
    const { blur, focusX, focusY, radius, feather, angle } = this;
    return { mode: this.mode === 'linear' ? 'linear' : 'radial', blur, focusX, focusY, radius, feather, angle };
  }

  isNeutralState(): boolean { return !(this.blur > 0); }

  /** Centro do foco em coordenada de textura (0..1 da imagem inteira). */
  private focusPoint(): [number, number] {
    return [this.x0 + this.focusX * (this.x1 - this.x0), this.y0 + this.focusY * (this.y1 - this.y0)];
  }

  private normal(): [number, number] {
    const a = ((this.angle || 0) * Math.PI) / 180;
    return [-Math.sin(a), Math.cos(a)];
  }

  applyTo(options: TWebGLPipelineState | T2DPipelineState): void {
    if (isWebGLPipelineState(options)) {
      // duas passadas, como o Blur do Fabric: a 1ª vai para o framebuffer, a 2ª segue a cadeia
      options.passes++;
      this._setupFrameBuffer(options);
      this.horizontal = true;
      this.applyToWebGL(options);
      this._swapTextures(options);
      this._setupFrameBuffer(options);
      this.horizontal = false;
      this.applyToWebGL(options);
      this._swapTextures(options);
    } else {
      this.applyTo2d(options);
    }
  }

  sendUniformData(gl: WebGLRenderingContext, loc: TWebGLUniformLocationMap): void {
    const [fx, fy] = this.focusPoint();
    const [nx, ny] = this.normal();
    gl.uniform4f(loc.uRegion, this.x0, this.y0, this.x1, this.y1);
    gl.uniform2f(loc.uFocus, fx, fy);
    gl.uniform4f(loc.uShape, this.radius, Math.max(MIN_FEATHER, this.feather), this.blur, this.mode === 'linear' ? 1 : 0);
    gl.uniform2f(loc.uNormal, nx, ny);
    gl.uniform2f(loc.uAxis, this.horizontal ? 1 : 0, this.horizontal ? 0 : 1);
  }

  /** Alcance do desfoque (px) de cada pixel: 0 dentro da zona de foco. */
  reachMap(width: number, height: number): Float32Array {
    const unit = regionUnit(this, width, height);
    const [fx, fy] = this.focusPoint();
    const [nx, ny] = this.normal();
    const linear = this.mode === 'linear';
    const r0 = this.radius, r1 = this.radius + Math.max(MIN_FEATHER, this.feather);
    const full = this.blur * 0.12 * unit;
    const reach = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      const py = (((y + 0.5) / height - fy) * height) / unit;
      for (let x = 0; x < width; x++) {
        const qx = (((x + 0.5) / width - fx) * width) / unit;
        const dist = linear ? Math.abs(qx * nx + py * ny) : Math.hypot(qx, py);
        reach[y * width + x] = smoothstep(r0, r1, dist) * full;
      }
    }
    return reach;
  }

  applyTo2d({ imageData: { data, width, height } }: T2DPipelineState): void {
    const reach = this.reachMap(width, height);
    const tmp = new Uint8ClampedArray(data.length);
    blurPass(data, tmp, width, height, reach, true);
    blurPass(tmp, data, width, height, reach, false);
  }
}

/** Uma passada do desfoque de alcance variável (espelho do laço do shader). */
function blurPass(src: Uint8ClampedArray, dst: Uint8ClampedArray, width: number, height: number, reach: Float32Array,
  horizontal: boolean): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = y * width + x, i = k * 4, d = reach[k];
      if (d < 0.5) {
        dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2]; dst[i + 3] = src[i + 3];
        continue;
      }
      let r = 0, g = 0, b = 0, a = 0, tw = 0;
      for (let t = -SAMPLES; t <= SAMPLES; t++) {
        const percent = t / SAMPLES, w = 1 - Math.abs(percent), off = d * percent;
        const sx = horizontal ? Math.min(width - 1, Math.max(0, Math.floor(x + 0.5 + off))) : x;
        const sy = horizontal ? y : Math.min(height - 1, Math.max(0, Math.floor(y + 0.5 + off)));
        const j = (sy * width + sx) * 4, la = src[j + 3] * w;
        r += src[j] * la; g += src[j + 1] * la; b += src[j + 2] * la;
        a += la; tw += w;
      }
      dst[i] = a > 0 ? r / a : 0;
      dst[i + 1] = a > 0 ? g / a : 0;
      dst[i + 2] = a > 0 ? b / a : 0;
      dst[i + 3] = a / tw;
    }
  }
}

export type RegionFilter = Vignette | SoftEdge | FocusBlur;
export function isRegionFilter(f: unknown): f is RegionFilter {
  return f instanceof Vignette || f instanceof SoftEdge || f instanceof FocusBlur;
}

// Registro para o revive (`loadFromJSON` do rascunho, undo, troca de página, clone, miniatura): sem ele o Fabric lança
// "No class registered for Vignette" e a imagem inteira não abre.
classRegistry.setClass(Vignette);
classRegistry.setClass(SoftEdge);
classRegistry.setClass(FocusBlur);
