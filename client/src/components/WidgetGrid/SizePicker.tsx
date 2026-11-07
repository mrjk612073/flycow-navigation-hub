import { useState, useRef, useCallback } from 'react';
import { Button } from '@client/src/components/ui/button';
import { SIZE_PRESETS } from './utils';
import { cn } from '@/lib/utils';

export interface SizePickerProps {
  initialW: number;
  initialH: number;
  onApply: (w: number, h: number) => void;
  maxCols?: number;
  maxRows?: number;
}

const SizePicker = ({
  initialW,
  initialH,
  onApply,
  maxCols = 6,
  maxRows = 6,
}: SizePickerProps) => {
  const [selectedW, setSelectedW] = useState(initialW);
  const [selectedH, setSelectedH] = useState(initialH);
  const isDraggingRef = useRef(false);
  const startCellRef = useRef({ w: initialW, h: initialH });

  const handleCellDown = useCallback((w: number, h: number) => {
    isDraggingRef.current = true;
    startCellRef.current = { w, h };
    setSelectedW(w);
    setSelectedH(h);
  }, []);

  const handleCellEnter = useCallback((w: number, h: number) => {
    if (!isDraggingRef.current) return;
    const start = startCellRef.current;
    const newW = Math.max(1, Math.abs(w - start.w) + 1);
    const newH = Math.max(1, Math.abs(h - start.h) + 1);
    setSelectedW(Math.min(newW, maxCols));
    setSelectedH(Math.min(newH, maxRows));
  }, [maxCols, maxRows]);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  return (
    <div
      className="flex flex-col gap-3 select-none"
      onPointerLeave={handlePointerUp}
      onPointerUp={handlePointerUp}
    >
      <div className="text-xs text-white/50 font-medium">调整尺寸（拖选或点击）</div>
      <div
        className="grid gap-1 p-2 bg-white/5 rounded-lg"
        style={{ gridTemplateColumns: `repeat(${maxCols}, 24px)` }}
      >
        {Array.from({ length: maxRows }).map((_, row) =>
          Array.from({ length: maxCols }).map((_, col) => {
            const w = col + 1;
            const h = row + 1;
            const isSelected = w <= selectedW && h <= selectedH;
            return (
              <div
                key={`${col}-${row}`}
                className={cn(
                  'w-6 h-6 rounded-sm border border-white/10 cursor-pointer transition-all',
                  isSelected
                    ? 'bg-primary/60 border-primary'
                    : 'bg-white/5 hover:bg-white/15',
                )}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleCellDown(w, h);
                }}
                onPointerEnter={() => handleCellEnter(w, h)}
                role="button"
                aria-label={`${w}×${h}`}
              />
            );
          }),
        )}
      </div>

      <div className="text-xs text-white/70 text-center">
        当前：<span className="font-mono text-primary">{selectedW} × {selectedH}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {SIZE_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 text-xs',
              selectedW === preset.w && selectedH === preset.h
                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                : 'text-white/60 hover:text-white hover:bg-white/10',
            )}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setSelectedW(preset.w);
              setSelectedH(preset.h);
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <Button
        size="sm"
        className="w-full"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onApply(selectedW, selectedH);
        }}
      >
        应用
      </Button>
    </div>
  );
};

export default SizePicker;
