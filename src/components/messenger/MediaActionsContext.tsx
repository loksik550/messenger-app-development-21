import { createContext, useContext } from "react";

export interface MediaMessageActions {
  canDelete: (msgId: number) => boolean;
  canPin: boolean;
  isPinned: (msgId: number) => boolean;
  showInChat: (msgId: number) => void;
  reply: (msgId: number) => void;
  togglePin: (msgId: number) => void;
  deleteNow: (msgId: number) => Promise<void> | void;
  react: (msgId: number, emoji: string) => Promise<void> | void;
  select: (msgId: number) => void;
}

export const MediaActionsContext = createContext<MediaMessageActions | null>(null);

export function useMediaActions() {
  return useContext(MediaActionsContext);
}
