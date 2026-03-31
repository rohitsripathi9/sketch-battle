import { useRef, useState, useEffect, useCallback } from 'react';
import Button from './Button';

export default function ReplayCanvas({ strokes, guesses }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [currentStroke, setCurrentStroke] = useState(0);
  const animRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 800, 600);
    ctxRef.current = ctx;
  }, []);

  const drawStroke = useCallback((stroke) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (stroke.opType === 'clear') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 800, 600);
      return;
    }

    const { points, color, brushSize } = stroke.payload || {};
    if (!points || points.length === 0) return;

    ctx.save();
    if (stroke.opType === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
    }
    ctx.strokeStyle = color || '#000000';
    ctx.lineWidth = brushSize || 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }, []);

  const renderUpTo = useCallback((index) => {
    const ctx = ctxRef.current;
    if (!ctx || !strokes) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 800, 600);
    for (let i = 0; i <= Math.min(index, strokes.length - 1); i++) {
      drawStroke(strokes[i]);
    }
  }, [strokes, drawStroke]);

  useEffect(() => {
    if (!playing || !strokes || strokes.length === 0) return;

    startTimeRef.current = Date.now() - (currentStroke / strokes.length) * (strokes.length * 100 / speed);

    function animate() {
      const elapsed = (Date.now() - startTimeRef.current) * speed;
      const targetStroke = Math.min(Math.floor(elapsed / 100), strokes.length - 1);

      if (targetStroke > currentStroke) {
        for (let i = currentStroke + 1; i <= targetStroke; i++) {
          drawStroke(strokes[i]);
        }
        setCurrentStroke(targetStroke);
      }

      setProgress(targetStroke / (strokes.length - 1));

      if (targetStroke >= strokes.length - 1) {
        setPlaying(false);
        return;
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, speed, strokes, drawStroke]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      cancelAnimationFrame(animRef.current);
    } else {
      if (currentStroke >= (strokes?.length || 1) - 1) {
        reset();
      }
      setPlaying(true);
    }
  }

  function reset() {
    setPlaying(false);
    cancelAnimationFrame(animRef.current);
    setCurrentStroke(0);
    setProgress(0);
    const ctx = ctxRef.current;
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 800, 600);
    }
  }

  function scrub(e) {
    const fraction = parseFloat(e.target.value);
    const index = Math.floor(fraction * ((strokes?.length || 1) - 1));
    setCurrentStroke(index);
    setProgress(fraction);
    renderUpTo(index);
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl border-2 border-dark-500"
        style={{ aspectRatio: '4/3' }}
      />

      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={togglePlay}>
          {playing ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </Button>

        <Button variant="ghost" size="sm" onClick={reset}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Button>

        <input
          type="range" min="0" max="1" step="0.001"
          value={progress}
          onChange={scrub}
          className="flex-1 accent-accent-purple"
        />

        <select
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          className="bg-slate-100 border-2 border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>

      <p className="text-xs text-slate-500 text-center">
        Stroke {currentStroke + 1} / {strokes?.length || 0}
      </p>
    </div>
  );
}
