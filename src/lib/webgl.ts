// Shared WebGL availability check. Some environments (enterprise policy, hardened
// browsers, Overwolf's CEF) disable WebGL — creating a Three.js renderer there
// throws and crashes the whole React tree. Guard every <Canvas> with this AND wrap
// it in the <Safe3D> error boundary (belt-and-suspenders).
//
// The naive `getContext('webgl')` check is NOT enough: some CEF builds return a
// non-null stub for webgl1 while THREE requests webgl2 (which fails), so the guard
// passes but THREE still throws. We therefore probe webgl2 first (what THREE/R3F
// asks for), then webgl1, and verify the context is actually usable.
let _cached: boolean | null = null;

export function webglSupported(): boolean {
  if (_cached !== null) return _cached;
  try {
    if (typeof document === 'undefined') { _cached = false; return _cached; }
    const canvas = document.createElement('canvas');
    const opts = { failIfMajorPerformanceCaveat: false } as WebGLContextAttributes;
    const gl: any =
      canvas.getContext('webgl2', opts) ||
      canvas.getContext('webgl', opts) ||
      canvas.getContext('experimental-webgl', opts);
    // Must be a real, usable context — a policy-disabled stub has no working
    // getParameter (returns null / throws), which is how we detect the fake.
    _cached = !!(gl && typeof gl.getParameter === 'function' && gl.getParameter(gl.VERSION));
    // Release the probe context so we don't burn one of the browser's ~16 slots.
    try { gl?.getExtension?.('WEBGL_lose_context')?.loseContext?.(); } catch { /* noop */ }
  } catch {
    _cached = false;
  }
  return _cached;
}
