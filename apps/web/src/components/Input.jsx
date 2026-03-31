import { useState } from 'react';

export default function Input({
  label,
  type = 'text',
  error,
  icon,
  className = '',
  id,
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-bold text-slate-700 pl-1"
        >
          {label}
        </label>
      )}
      <div
        className={`
          relative flex items-center rounded-2xl overflow-hidden
          transition-all duration-200 bg-white border-4
          ${error
            ? 'border-accent-red shadow-[0_4px_0_#b91c1c]'
            : focused
              ? 'border-accent-purple shadow-[0_4px_0_#8b5cf6] translate-y-[-2px]'
              : 'border-slate-200 shadow-[0_4px_0_#cbd5e1]'
          }
        `}
      >
        {icon && (
          <span className="pl-4 text-slate-400 flex-shrink-0">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={inputType}
          className={`
            w-full bg-transparent px-4 py-3 text-base font-bold text-slate-800
            placeholder:text-slate-400 outline-none
            ${icon ? 'pl-3' : ''}
            ${isPassword ? 'pr-12' : ''}
          `}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-accent-red flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
