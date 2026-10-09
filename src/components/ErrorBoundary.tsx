import { Component, ReactNode } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const e = error as { message?: string; stack?: string };
    return { hasError: true, message: (e?.stack || e?.message || String(error)).slice(0, 600) };
  }

  handleReload = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background text-foreground">
        <Icon name="TriangleAlert" size={44} className="text-primary" />
        <h1 className="text-lg font-semibold">Что-то пошло не так</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Произошёл сбой при загрузке экрана. Попробуйте вернуться на главную.
        </p>
        {this.state.message && (
          <pre className="max-w-sm max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-left text-[11px] text-muted-foreground">
            {this.state.message}
          </pre>
        )}
        <button
          onClick={this.handleReload}
          className="mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Вернуться в приложение
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;