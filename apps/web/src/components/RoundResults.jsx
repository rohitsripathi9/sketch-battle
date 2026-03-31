export default function RoundResults({ results }) {
  if (!results) return null;

  const { word, correctGuesses = [], drawerUsername, drawerScore, scores = [], roundNumber, totalRounds } = results;

  return (
    <div className="panel-3d bg-white p-10 animate-fade-in">
      <div className="text-center mb-8">
        <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">
          Round {roundNumber || '?'} / {totalRounds || '?'} -- The word was
        </p>
        <h2 className="text-4xl font-black text-slate-800 mt-2">{word}</h2>
      </div>

      {/* Drawer score */}
      {drawerUsername && (
        <div className="flex items-center justify-center gap-4 mb-8 px-6 py-4 rounded-2xl bg-purple-50 border-2 border-purple-200 mx-auto w-fit">
          <span className="text-sm font-bold text-slate-500">Drawer:</span>
          <span className="text-sm font-black text-slate-800">{drawerUsername}</span>
          <span className={`text-sm font-mono font-black px-3 py-1 rounded-lg ${drawerScore > 0 ? 'text-accent-purple bg-purple-100' : 'text-slate-400 bg-slate-100'}`}>
            {drawerScore > 0 ? `+${drawerScore}` : '+0'}
          </span>
        </div>
      )}

      {/* Who guessed correctly */}
      {correctGuesses.length > 0 ? (
        <div className="mb-8">
          <p className="text-xs font-bold text-slate-400 text-center mb-4 uppercase tracking-wider">Correct guesses</p>
          <div className="flex flex-wrap justify-center gap-3">
            {correctGuesses.map((g, i) => (
              <div key={g.userId} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-green-50 border-2 border-green-200">
                <span className="text-xs font-black text-slate-400">#{i + 1}</span>
                <span className="text-sm font-bold text-slate-800">{g.username}</span>
                <span className="text-sm font-mono font-black text-accent-green bg-green-100 px-2 py-0.5 rounded-lg">+{g.score}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-sm font-bold text-slate-400 mb-8">Nobody guessed correctly</p>
      )}

      {/* Standings */}
      {scores.length > 0 && (
        <div className="border-t-4 border-slate-100 pt-6">
          <p className="text-xs font-bold text-slate-400 text-center mb-4 uppercase tracking-wider">Standings</p>
          <div className="flex flex-wrap justify-center gap-3">
            {scores
              .sort((a, b) => b.score - a.score)
              .map((s, i) => (
                <div key={s.userId} className="px-4 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-xs flex items-center gap-3">
                  <span className="font-black text-slate-400">#{i + 1}</span>
                  <span className="font-bold text-slate-800">{s.username}</span>
                  <span className="text-accent-purple font-mono font-black">{s.score}</span>
                </div>
              ))
          }
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 mt-8">
        <svg className="animate-spin h-4 w-4 text-accent-purple" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm font-bold text-slate-400">Next round starting...</p>
      </div>
    </div>
  );
}
