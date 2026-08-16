// Red de seguridad global: un crash de render ya no deja la pantalla en negro.
// Muestra una tarjeta con el error y botones de recuperar/recargar.
import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[AppErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center',
        background: 'radial-gradient(900px 500px at 50% -10%, rgba(225,36,46,0.14), transparent 60%), #08080b',
        padding: 24, fontFamily: "'Saira', system-ui, sans-serif",
      }}>
        <div style={{
          maxWidth: 460, width: '100%', padding: 28, borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(16,16,20,0.75)',
          backdropFilter: 'blur(18px)', textAlign: 'center', color: '#fff',
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚔️</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>Algo salió mal</h1>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55 }}>
            La página tuvo un error inesperado. Tus datos están a salvo — recarga para continuar.
          </p>
          <p style={{
            margin: '0 0 20px', fontSize: 11, color: 'rgba(255,255,255,0.35)',
            fontFamily: 'monospace', wordBreak: 'break-word',
          }}>
            {this.state.error.message}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                padding: '10px 18px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)',
              }}>
              Reintentar
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '10px 18px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: 'linear-gradient(135deg, #e1242e, #a5121b)', color: '#fff', border: 'none',
              }}>
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
