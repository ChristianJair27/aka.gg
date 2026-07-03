// Error boundary + WebGL guard for any Three.js <Canvas>. If WebGL is unavailable
// or the 3D subtree throws (e.g. "Error creating WebGL context"), render `fallback`
// (default: nothing) instead of crashing the page.
import { Component, ReactNode } from 'react';
import { webglSupported } from '@/lib/webgl';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { failed: boolean; }

export class Safe3D extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch() { /* swallow — 3D is decorative, never fatal */ }

  render() {
    if (this.state.failed || !webglSupported()) {
      return <>{this.props.fallback ?? null}</>;
    }
    return <>{this.props.children}</>;
  }
}

export default Safe3D;
