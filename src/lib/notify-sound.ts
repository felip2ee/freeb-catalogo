// Som de "venda" (estilo caixa registradora / Hotmart) — um ka-ching alegre,
// sintetizado via Web Audio API (sem arquivo de áudio, sem direitos de terceiros).

let ctx: AudioContext | null = null;

function tone(
  audio: AudioContext,
  master: GainNode,
  freq: number,
  start: number,
  dur: number,
  peak: number,
  type: OscillatorType = "triangle",
) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0005, start + dur);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

export function playNewOrderSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    ctx = ctx ?? new AudioCtx();
    if (ctx.state === "suspended") void ctx.resume();

    const audio = ctx;
    const t = audio.currentTime;

    // Compressor + master gain para dar "punch" sem estourar.
    const master = audio.createGain();
    master.gain.value = 0.9;
    const comp = audio.createDynamicsCompressor();
    master.connect(comp).connect(audio.destination);

    // "Ka" — batidinha metálica curta (duas notas rápidas).
    tone(audio, master, 1318.5, t, 0.12, 0.22, "square"); // E6
    tone(audio, master, 1567.98, t + 0.05, 0.12, 0.22, "square"); // G6

    // "Ching!" — arpejo de acorde maior brilhante subindo (sino).
    const arp = [
      { f: 1046.5, d: 0.0 }, // C6
      { f: 1318.5, d: 0.07 }, // E6
      { f: 1567.98, d: 0.14 }, // G6
      { f: 2093.0, d: 0.21 }, // C7
    ];
    arp.forEach(({ f, d }) => {
      tone(audio, master, f, t + 0.12 + d, 0.6, 0.26, "triangle");
      tone(audio, master, f * 2.001, t + 0.12 + d, 0.5, 0.06, "sine"); // brilho/shimmer
    });

    // Brilho final sustentado (a "moeda caindo").
    tone(audio, master, 2637.0, t + 0.34, 0.9, 0.12, "sine"); // E7
    tone(audio, master, 3135.96, t + 0.36, 0.8, 0.08, "sine"); // G7
  } catch {
    // silencioso — som é um extra, não pode quebrar o app
  }
}
