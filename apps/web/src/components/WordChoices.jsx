export default function WordChoices({ words, onSelect }) {
  if (!words || words.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-10 max-w-lg w-full animate-fade-in-scale shadow-2xl border-4 border-slate-200">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent-purple flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Choose a word to draw</h2>
          <p className="text-sm text-slate-500 mt-2">Pick one -- you have 30 seconds</p>
        </div>

        <div className="flex flex-col gap-4">
          {words.map((word, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className="
                w-full py-4 px-6 rounded-2xl text-lg font-bold text-slate-800
                bg-slate-50 border-4 border-slate-200 shadow-[0_3px_0_#cbd5e1]
                hover:border-accent-purple hover:bg-purple-50
                hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-purple/20
                transition-all duration-200 cursor-pointer
                active:translate-y-0.5 active:shadow-none
              "
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
