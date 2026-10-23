import { Component, type ReactNode } from "react";
import Icon from "@/components/ui/icon";
import { track } from "@/lib/track";

interface Props { children: ReactNode; resetKey: string | number; onBack: () => void }
interface State { error: boolean; tries: number }

/** Если окно чата упало — тихо перезапускаем его, а не роняем всё приложение. */
export default class ChatErrorGuard extends Component<Props, State> {
  state: State = { error: false, tries: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { error: true };
  }

  componentDidCatch(error: unknown) {
    const e = error as { message?: string };
    console.error("[chat crash]", e?.message || String(error));
    const msg = String(e?.message || error);
    const code = /185|Maximum update depth/.test(msg) ? "loop" : (msg.match(/[A-Za-z]+Error/)?.[0] || "other");
    track(`chat_crash_${code}`.slice(0, 40));
    if (this.state.tries < 2) {
      setTimeout(() => this.setState((s) => ({ error: false, tries: s.tries + 1 })), 400);
    }
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && (this.state.error || this.state.tries)) {
      this.setState({ error: false, tries: 0 });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.state.tries < 2) {
      return <div className="h-full flex items-center justify-center"><Icon name="Loader2" size={22} className="animate-spin text-muted-foreground" /></div>;
    }
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Icon name="RefreshCw" size={30} className="text-violet-400" />
        <p className="text-sm text-muted-foreground">Не удалось открыть чат</p>
        <div className="flex gap-2">
          <button onClick={() => this.setState({ error: false, tries: 0 })} className="px-4 py-2 rounded-xl grad-primary text-white text-sm font-semibold">Повторить</button>
          <button onClick={this.props.onBack} className="px-4 py-2 rounded-xl bg-white/8 text-sm">Назад</button>
        </div>
      </div>
    );
  }
}
