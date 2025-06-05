import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  preventDefault?: boolean;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const matches = (
        event.key.toLowerCase() === shortcut.key.toLowerCase() &&
        !!event.ctrlKey === (shortcut.ctrl || false) &&
        !!event.altKey === (shortcut.alt || false) &&
        !!event.shiftKey === (shortcut.shift || false) &&
        !!event.metaKey === (shortcut.meta || false)
      );

      if (matches) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action();
        break;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

export const getShortcutText = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];
  
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.meta) parts.push('Cmd');
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join(' + ');
};