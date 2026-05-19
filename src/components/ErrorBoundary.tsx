import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <iconify-icon icon="solar:danger-triangle-bold-duotone" class="text-4xl text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-bricolage mb-2">Algo deu errado</h1>
              <p className="text-neutral-400 text-sm">
                Ocorreu um erro inesperado. Tente recarregar a página.
              </p>
              {import.meta.env.DEV && (
                <pre className="mt-4 p-4 bg-black/50 border border-red-500/20 rounded-xl text-left text-xs text-red-400 overflow-auto max-h-40">
                  {this.state.error.message}
                </pre>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors text-sm"
              >
                Recarregar Página
              </button>
              <button
                onClick={() => { this.setState({ error: null }); window.history.back(); }}
                className="px-6 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
