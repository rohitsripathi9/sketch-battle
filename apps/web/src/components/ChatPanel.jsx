import { useRef, useEffect } from 'react';

export default function ChatPanel({ messages }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex flex-col gap-2 overflow-y-auto flex-1 h-full min-h-0 pr-2 scrollbar-thin">
      {messages.length === 0 && (
        <p className="text-[10px] text-slate-400 text-center py-4 font-bold">No messages yet</p>
      )}
      {messages.map((msg) => (
        <div key={msg.id} className="text-xs">
          {msg.isCorrect ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-green-50 border border-green-200 text-accent-green">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-bold text-green-700">{msg.username}</span>
              <span className="text-[10px] font-bold text-green-600">guessed it! (+{msg.score})</span>
            </div>
          ) : (
            <div className={`px-2 py-1 rounded ${msg.isClose ? 'bg-orange-50 border border-orange-200' : ''}`}>
              <span className="font-bold text-slate-700">{msg.username}: </span>
              <span className={msg.isClose ? 'text-orange-600 font-bold' : 'text-slate-600 break-words'}>
                {msg.text}
              </span>
              {msg.isClose && (
                <span className="text-[8px] ml-1.5 font-black text-orange-500 uppercase">close!</span>
              )}
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
