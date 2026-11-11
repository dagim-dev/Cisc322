// A full-screen dissolve used between chapters: the picture breaks into
// terminal-sized cells that switch off in a noisy wave, with a bright edge.
import { Uniform, Color } from "three";
import { Effect } from "postprocessing";

const fragment = /* glsl */ `
  uniform float amount;
  uniform vec3 color;
  uniform float cell;

  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (amount <= 0.001) {
      outputColor = inputColor;
      return;
    }
    vec2 c = floor(uv * resolution / cell);
    float n = 0.55 * vnoise(c * 0.045 + time * 0.05) + 0.45 * hash2(c + floor(time * 8.0));
    float off = step(n, amount);
    float edge = off - step(n, amount - 0.035);
    vec3 rgb = mix(inputColor.rgb, inputColor.rgb * 0.15, off * 0.85);
    rgb += color * edge * 0.9;
    outputColor = vec4(rgb, inputColor.a);
  }
`;

export class TransitionEffect extends Effect {
  constructor() {
    super("TransitionEffect", fragment, {
      uniforms: new Map([
        ["amount", new Uniform(0)],
        ["color", new Uniform(new Color("#ffb35c"))],
        ["cell", new Uniform(7)],
      ]),
    });
  }

  set amount(value) {
    this.uniforms.get("amount").value = value;
  }

  get color() {
    return this.uniforms.get("color").value;
  }

  set cell(value) {
    this.uniforms.get("cell").value = value;
  }
}
