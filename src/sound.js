// Optional ambient sound, off by default and generated in the browser (no
// audio files): a low, slowly filtered drone and a soft tick on link hover.
export function initSound() {
  const button = document.querySelector(".sound");
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!button || !Ctx) return { tick() {} };
  button.hidden = false;
  const label = button.querySelector(".sound-label");

  let ctx = null;
  let master = null;
  let on = false;

  function build() {
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 6;
    filter.connect(master);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    for (const [freq, type, gain] of [
      [55, "sine", 0.5],
      [55.4, "sawtooth", 0.08],
      [82.4, "triangle", 0.18],
      [164.8, "sine", 0.05],
    ]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g).connect(filter);
      osc.start();
    }
  }

  function set(value) {
    on = value;
    if (on && !ctx) build();
    if (!ctx) return;
    if (on) ctx.resume();
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(on ? 0.11 : 0, now, on ? 0.8 : 0.25);
    button.setAttribute("aria-pressed", String(on));
    label.textContent = on ? "sound on" : "sound off";
  }

  button.addEventListener("click", () => set(!on));
  document.addEventListener("visibilitychange", () => {
    if (!ctx || !on) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  return {
    tick() {
      if (!on || !ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1800 + Math.random() * 600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);
      g.gain.setValueAtTime(0.025, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    },
  };
}
