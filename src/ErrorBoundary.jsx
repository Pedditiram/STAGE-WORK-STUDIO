import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Stage Production Studio Error Boundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleResetApp = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      window.location.href = window.location.origin;
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-zinc-900 border border-red-500/50 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto text-2xl font-mono font-bold">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-white font-mono">Stage Production Studio</h2>
            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
              A runtime initialization error occurred. Click below to reset local state and restore default production studio configuration.
            </p>
            {this.state.error && (
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-red-300 text-left overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleResetApp}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-amber-600 to-cyan-600 text-white font-bold text-xs font-mono shadow-lg hover:brightness-125 transition-all"
            >
              ⚡ Reset Studio Cache & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
