// Shared WebGL availability check. Some environments (enterprise policy, hardened
// browsers, Overwolf CEF, headless) disable WebGL — creating a Three.js renderer
// there throws and crashes the whole React tree. Guard every <Canvas> with this.
let _cached: boolean | null = null;

export function webglSupported(): boolean {
  if (_cached !== null) return _cached;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (window as any).WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    _cached = !!gl;
  } catch {
    _cached = false;
  }
  return _cached;
}
