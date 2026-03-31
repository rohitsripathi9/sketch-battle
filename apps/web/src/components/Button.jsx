import { useSFX } from '../context/SFXContext';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  const { playSFX } = useSFX();
  const baseClasses = `
    relative inline-flex items-center justify-center font-bold
    rounded-2xl transition-all duration-100 cursor-pointer
    disabled:opacity-60 disabled:cursor-not-allowed
    btn-3d overflow-hidden
  `;

  const variants = {
    primary: `
      bg-accent-yellow text-white border-2 border-[#d97706]
      shadow-[0_4px_0_#d97706] hover:brightness-110 active:shadow-none
    `,
    secondary: `
      bg-accent-cyan text-white border-2 border-[#0891b2]
      shadow-[0_4px_0_#0891b2] hover:brightness-110 active:shadow-none
    `,
    ghost: `
      bg-transparent text-slate-600 border-2 border-transparent
      hover:bg-slate-100 hover:text-slate-800 active:shadow-none
    `,
    danger: `
      bg-accent-red text-white border-2 border-[#b91c1c]
      shadow-[0_4px_0_#b91c1c] hover:brightness-110 active:shadow-none
    `,
    success: `
      bg-accent-green text-white border-2 border-[#047857]
      shadow-[0_4px_0_#047857] hover:brightness-110 active:shadow-none
    `,
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm gap-1.5',
    md: 'px-6 py-3 text-base gap-2',
    lg: 'px-8 py-3.5 text-lg gap-2.5',
    xl: 'px-10 py-4 text-xl gap-3',
  };

  return (
    <button
      className={`
        ${baseClasses}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      onMouseDown={(e) => {
        if (!disabled && !loading) playSFX('click');
        if (props.onMouseDown) props.onMouseDown(e);
      }}
      {...props}
    >
      {variant !== 'ghost' && <div className="glossy-overlay" />}
      <span className="relative z-10 flex items-center justify-center gap-inherit">
        {loading && (
          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </span>
    </button>
  );
}
