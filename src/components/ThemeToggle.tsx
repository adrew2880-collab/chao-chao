'use client';

export function ThemeToggle({ mode, onToggle }: { mode: 'light' | 'dark'; onToggle: () => void }) {
  return (
    <button className="icon-toggle" onClick={onToggle} aria-label="다크모드 전환">
      <span className="dot">{mode === 'dark' ? '🌙' : '☀️'}</span>
      {mode === 'dark' ? '다크모드' : '화이트모드'}
    </button>
  );
}
