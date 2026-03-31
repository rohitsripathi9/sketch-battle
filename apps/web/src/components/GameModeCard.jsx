import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useSFX } from '../context/SFXContext';

export default function GameModeCard({ mode, title, image, lottie, playerInfo, selected, onClick }) {
  const { playSFX } = useSFX();
  
  return (
    <button
      onClick={(e) => { playSFX('click'); if (onClick) onClick(e); }}
      className={`
        w-full max-w-[220px] text-center p-6 rounded-2xl border-4 transition-all duration-150 cursor-pointer
        flex flex-col items-center gap-4
        ${selected
          ? 'border-accent-purple bg-purple-50 shadow-[0_6px_0_#7c3aed] -translate-y-1'
          : 'border-slate-200 bg-white shadow-[0_6px_0_#cbd5e1] hover:border-slate-300 hover:-translate-y-0.5'
        }
      `}
    >
      {lottie ? (
        <div className="w-full h-28 flex items-center justify-center">
          <DotLottieReact
            src={lottie}
            loop
            autoplay
            className="w-full h-full object-contain scale-[1.15]"
          />
        </div>
      ) : (
        <img
          src={image}
          alt={title}
          className="w-24 h-24 object-contain"
          draggable={false}
        />
      )}
      <h3 className={`text-base font-extrabold transition-colors ${selected ? 'text-accent-purple' : 'text-slate-800'}`}>
        {title}
      </h3>
      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
        selected ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'
      }`}>
        {playerInfo}
      </span>
    </button>
  );
}
