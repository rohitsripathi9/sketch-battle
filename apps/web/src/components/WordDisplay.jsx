export default function WordDisplay({ isDrawer, word, hint, roundNumber, totalRounds }) {
  return (
    <div className="flex items-center justify-center">
      <div className="text-center">
        {isDrawer && word ? (
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white border-4 border-green-200 shadow-[0_3px_0_#86efac]">
            <span className="text-xs font-black text-green-600 uppercase">Your word:</span>
            <span className="text-lg font-black text-slate-800 tracking-wide">{word}</span>
          </div>
        ) : hint ? (
          <div className="inline-flex items-center px-6 py-3 rounded-2xl bg-white border-4 border-slate-200 shadow-[0_3px_0_#cbd5e1]">
            <span className="text-xl font-mono font-black text-slate-800 tracking-[0.35em]">
              {hint}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
