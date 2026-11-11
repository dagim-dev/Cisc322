// Post-processing per quality tier: bloom, the chapter dissolve, vignette,
// film grain, and a light chromatic fringe at the edges.
import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  ChromaticAberrationEffect,
  VignetteEffect,
  NoiseEffect,
  BlendFunction,
} from "postprocessing";
import { TransitionEffect } from "./transitions.js";

export function createPost(renderer, scene, camera, tier) {
  if (!tier.post) return null;
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    intensity: 1.35,
    luminanceThreshold: 0.22,
    luminanceSmoothing: 0.35,
    mipmapBlur: true,
    radius: 0.78,
  });
  const transition = new TransitionEffect();
  const vignette = new VignetteEffect({ darkness: 0.68, offset: 0.25 });
  const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
  grain.blendMode.opacity.value = 0.14;

  const main = new EffectPass(camera, bloom, transition, vignette, grain);
  composer.addPass(main);
  if (tier.aberration) {
    // Only the last pass may convert to sRGB, or colours get encoded twice.
    main.fullscreenMaterial.encodeOutput = false;
    const aberration = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.0009, 0.0009),
      radialModulation: true,
      modulationOffset: 0.3,
    });
    composer.addPass(new EffectPass(camera, aberration));
  }

  return {
    composer,
    transition,
    setSize(width, height, dpr) {
      composer.setSize(width, height);
      transition.cell = 6 * dpr;
    },
    render(dt) {
      composer.render(dt);
    },
  };
}
