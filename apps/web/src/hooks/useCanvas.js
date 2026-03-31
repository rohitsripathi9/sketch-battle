import { useRef, useState, useCallback, useEffect } from 'react';

const DEFAULT_COLOR = '#000000';
const DEFAULT_BRUSH_SIZE = 4;

export function useCanvas({ isDrawer, onStroke, onUndo, onClear }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const isDrawing = useRef(false);
  const currentPath = useRef([]);
  const strokeHistory = useRef([]);
  const localSeqRef = useRef(0);

  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [canUndo, setCanUndo] = useState(false);

  const initCanvas = useCallback((width = 800, height = 600) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    contextRef.current = ctx;
    strokeHistory.current = [];
    localSeqRef.current = 0;
    setCanUndo(false);
  }, []);

  const getPointerPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e) => {
    if (!isDrawer) return;
    const pos = getPointerPos(e);
    isDrawing.current = true;
    currentPath.current = [pos];

    const ctx = contextRef.current;
    if (!ctx) return;

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize;

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [isDrawer, tool, color, brushSize, getPointerPos]);

  const draw = useCallback((e) => {
    if (!isDrawing.current || !isDrawer) return;
    const pos = getPointerPos(e);
    currentPath.current.push(pos);

    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawer, getPointerPos]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing.current || !isDrawer) return;
    isDrawing.current = false;

    const ctx = contextRef.current;
    if (ctx) ctx.globalCompositeOperation = 'source-over';

    if (currentPath.current.length > 0) {
      const seq = ++localSeqRef.current;
      const opType = tool === 'eraser' ? 'erase' : 'draw';
      const payload = {
        points: currentPath.current,
        color: tool === 'eraser' ? null : color,
        brushSize: tool === 'eraser' ? brushSize * 3 : brushSize,
      };

      strokeHistory.current.push({ seq, opType, payload });
      setCanUndo(true);
      onStroke?.({ opType, payload, clientSeq: seq });
    }
    currentPath.current = [];
  }, [isDrawer, tool, color, brushSize, onStroke]);

  const handleFill = useCallback((e) => {
    if (!isDrawer || tool !== 'fill') return;
    const pos = getPointerPos(e);
    const seq = ++localSeqRef.current;
    const payload = { x: Math.round(pos.x), y: Math.round(pos.y), color };

    fillArea(contextRef.current, canvasRef.current, payload.x, payload.y, color);

    strokeHistory.current.push({ seq, opType: 'fill', payload });
    setCanUndo(true);
    onStroke?.({ opType: 'fill', payload, clientSeq: seq });
  }, [isDrawer, tool, color, onStroke, getPointerPos]);

  const undo = useCallback(() => {
    if (!isDrawer || strokeHistory.current.length === 0) return;
    const last = strokeHistory.current.pop();
    setCanUndo(strokeHistory.current.length > 0);
    onUndo?.(last.seq);
  }, [isDrawer, onUndo]);

  const clearCanvas = useCallback(() => {
    if (!isDrawer) return;
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokeHistory.current = [];
    localSeqRef.current = 0;
    setCanUndo(false);
    onClear?.();
  }, [isDrawer, onClear]);

  const applyRemoteStroke = useCallback(({ opType, payload, serverSeq }) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    if (opType === 'draw' || opType === 'erase') {
      const { points, color: strokeColor, brushSize: size } = payload;
      if (!points || points.length === 0) return;

      ctx.save();
      if (opType === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
      }
      ctx.strokeStyle = strokeColor || '#000000';
      ctx.lineWidth = size || 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    } else if (opType === 'fill') {
      const { x, y, color: fillColor } = payload;
      fillArea(ctx, canvasRef.current, x, y, fillColor || '#000000');
    }
  }, []);

  const replayStrokes = useCallback((strokes) => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
      applyRemoteStroke(stroke);
    }
  }, [applyRemoteStroke]);

  const clearCanvasRemote = useCallback(() => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokeHistory.current = [];
  }, []);

  return {
    canvasRef,
    tool, setTool,
    color, setColor,
    brushSize, setBrushSize,
    canUndo,
    initCanvas,
    startDrawing,
    draw,
    stopDrawing,
    handleFill,
    undo,
    clearCanvas,
    applyRemoteStroke,
    replayStrokes,
    clearCanvasRemote,
  };
}

function fillArea(ctx, canvas, startX, startY, fillColor) {
  if (!ctx || !canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const [fr, fg, fb] = hexToRgb(fillColor);
  const idx = (startY * w + startX) * 4;
  const tr = data[idx], tg = data[idx + 1], tb = data[idx + 2];

  if (tr === fr && tg === fg && tb === fb) return;

  const stack = [[startX, startY]];
  const visited = new Set();

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= w || y < 0 || y >= h) continue;

    const key = y * w + x;
    if (visited.has(key)) continue;

    const i = key * 4;
    if (Math.abs(data[i] - tr) > 30 || Math.abs(data[i + 1] - tg) > 30 || Math.abs(data[i + 2] - tb) > 30) continue;

    visited.add(key);
    data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = 255;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
