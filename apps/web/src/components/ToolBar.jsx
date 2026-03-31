const COLORS = [
  '#FFFFFF', '#C0C0C0', '#808080', '#000000',
  '#FF0000', '#FF6B6B', '#FF8C00', '#FFD700',
  '#00FF00', '#4ADE80', '#00CED1', '#06B6D4',
  '#0000FF', '#3B82F6', '#8B5CF6', '#7C3AED',
  '#FF1493', '#EC4899', '#8B4513', '#CD853F',
];

const BRUSH_SIZES = [2, 4, 8, 14, 24];

export default function ToolBar({ tool, setTool, color, setColor, brushSize, setBrushSize, canUndo, onUndo, onClear }) {
  return (
    <div className="bg-white rounded-2xl p-5 flex flex-col gap-5 border-4 border-slate-200 shadow-[0_4px_0_#cbd5e1]">
      {/* Tools */}
      <div className="flex gap-2.5">
        <ToolButton
          active={tool === 'pencil'}
          onClick={() => setTool('pencil')}
          title="Pencil"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </ToolButton>
        <ToolButton
          active={tool === 'eraser'}
          onClick={() => setTool('eraser')}
          title="Eraser"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 20H7l-4-4 10-10 7 7-3 3M14 4l3 3" />
          </svg>
        </ToolButton>
        <ToolButton
          active={tool === 'fill'}
          onClick={() => setTool('fill')}
          title="Fill"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </ToolButton>

        <div className="w-px bg-slate-200 mx-2" />

        <ToolButton
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 6l-4 4 4 4" />
          </svg>
        </ToolButton>
        <ToolButton
          onClick={onClear}
          title="Clear"
          className="text-accent-red hover:bg-accent-red/10"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </ToolButton>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-10 gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => { setColor(c); setTool('pencil'); }}
            className={`
              w-7 h-7 rounded-md transition-all
              ${color === c && tool !== 'eraser'
                ? 'ring-2 ring-accent-purple ring-offset-1 ring-offset-white scale-110'
                : 'hover:scale-110'
              }
              ${c === '#FFFFFF' ? 'border border-slate-300' : ''}
            `}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>

      {/* Brush Size */}
      <div className="flex items-center gap-3">
        {BRUSH_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => setBrushSize(size)}
            className={`
              flex items-center justify-center rounded-lg transition-all p-1.5
              ${brushSize === size
                ? 'bg-accent-purple/20 ring-1 ring-accent-purple'
                : 'hover:bg-slate-100'
              }
            `}
            title={`${size}px`}
          >
            <div
              className="rounded-full bg-slate-800"
              style={{ width: Math.min(size + 2, 20), height: Math.min(size + 2, 20) }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function ToolButton({ children, active, disabled, onClick, title, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        p-3 rounded-lg transition-all
        ${active
          ? 'bg-accent-purple text-white shadow-md shadow-accent-purple/30'
          : disabled
            ? 'text-slate-300 cursor-not-allowed'
            : `text-slate-600 hover:text-slate-900 hover:bg-slate-100 ${className}`
        }
      `}
    >
      {children}
    </button>
  );
}
