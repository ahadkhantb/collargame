import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    (this as any).setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let details = "";

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) {
            errorMessage = `Firestore Error: ${parsed.operationType} on ${parsed.path}`;
            details = parsed.error;
          }
        }
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
          <div className="glass max-w-md w-full p-8 rounded-3xl text-center">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-serif italic mb-2">Something went wrong</h2>
            <p className="text-white/60 mb-6">{errorMessage}</p>
            {details && (
              <div className="bg-black/40 p-4 rounded-xl mb-6 text-left">
                <p className="text-[10px] uppercase font-bold text-white/40 mb-1">Details</p>
                <p className="text-xs font-mono break-all text-rose-400/80">{details}</p>
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-2"
            >
              <RefreshCw size={20} />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
