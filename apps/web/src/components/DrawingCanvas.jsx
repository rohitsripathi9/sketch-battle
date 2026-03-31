import { useEffect, useRef } from 'react';

export default function DrawingCanvas({ canvasHook, isDrawer }) {
  const containerRef = useRef(null);
  const {
    canvasRef, tool, startDrawing, draw, stopDrawing, handleFill, initCanvas,
  } = canvasHook;

  useEffect(() => {
    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container) return;
      const { width } = container.getBoundingClientRect();
      const height = Math.floor(width * 0.75);
      initCanvas(800, 600);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [initCanvas]);

  function onPointerDown(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) canvas.setPointerCapture(e.pointerId);

    if (tool === 'fill') {
      handleFill(e);
    } else {
      startDrawing(e);
    }
  }

  function onPointerMove(e) {
    e.preventDefault();
    draw(e);
  }

  function onPointerUp(e) {
    e.preventDefault();
    stopDrawing();
  }

  return (
    <div ref={containerRef} className="relative w-full panel-3d p-4 bg-white">
      <canvas
        ref={canvasRef}
        className={`
          w-full rounded-2xl bg-white
          ${isDrawer
            ? 'border-8 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)] shadow-yellow-500/50'
            : 'border-4 border-slate-300'
          }
        `}
        style={{
          touchAction: 'none',
          aspectRatio: '4/3',
          cursor: isDrawer ? "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z\"></path><path d=\"m15 5 4 4\"></path></svg>') 0 24, auto" : 'default'
        }}
        onPointerDown={isDrawer ? onPointerDown : undefined}
        onPointerMove={isDrawer ? onPointerMove : undefined}
        onPointerUp={isDrawer ? onPointerUp : undefined}
        onPointerLeave={isDrawer ? onPointerUp : undefined}
        onPointerCancel={isDrawer ? onPointerUp : undefined}
      />
      {!isDrawer && (
        <div className="absolute inset-0 rounded-xl" />
      )}
    </div>
  );
}
