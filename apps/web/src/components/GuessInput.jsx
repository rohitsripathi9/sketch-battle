import { useState, useRef, useEffect } from 'react';

export default function GuessInput({ onSubmit, disabled, isDrawer, hasGuessedCorrectly }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!disabled && !isDrawer && !hasGuessedCorrectly) {
      inputRef.current?.focus();
    }
  }, [disabled, isDrawer, hasGuessedCorrectly]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSubmit(text.trim());
    setText('');
  }

  const placeholder = isDrawer
    ? "You're drawing!"
    : hasGuessedCorrectly
      ? 'You guessed correctly!'
      : 'Type your guess...';

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 pt-2">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || isDrawer || hasGuessedCorrectly}
        maxLength={100}
        className={`
          flex-1 bg-slate-100 border-2 rounded-xl px-5 py-3 text-sm text-slate-800 font-bold
          placeholder:text-slate-400 outline-none transition-colors
          ${hasGuessedCorrectly
            ? 'border-green-300 bg-green-50'
            : 'border-slate-200 focus:border-accent-purple'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim() || isDrawer || hasGuessedCorrectly}
        className="
          px-5 py-3 rounded-xl bg-accent-purple text-white text-sm font-black
          border-2 border-purple-600 shadow-[0_3px_0_#7c3aed]
          hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0
        "
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </form>
  );
}
