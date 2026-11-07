import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import type { Widget } from '@shared/api.interface';
import WidgetItem from './WidgetItem';
import WidgetContent from './WidgetContent';
import { mapSizeToWidgetSize } from './utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export interface WidgetGridProps {
  widgets: Widget[];
  isEditMode?: boolean;
  onLayoutChange: (widgets: Widget[]) => void;
  cols?: number;
  gap?: number;
}

function resolveCollisions(
  widgets: Widget[],
  totalCols: number,
  prioritizeId?: string | null,
): Widget[] {
  const sorted = [...widgets].sort((a, b) => {
    if (prioritizeId) {
      if (a.id === prioritizeId) return -1;
      if (b.id === prioritizeId) return 1;
    }
    if (a.gridRow !== b.gridRow) return a.gridRow - b.gridRow;
    if (a.gridCol !== b.gridCol) return a.gridCol - b.gridCol;
    return a.sortOrder - b.sortOrder;
  });

  const placed: Widget[] = [];

  const getBottom = (w: Widget): number => w.gridRow + w.sizeH;
  const getRight = (w: Widget): number => w.gridCol + w.sizeW;

  const overlaps = (a: Widget, b: Widget): boolean => {
    return (
      a.gridCol < getRight(b) &&
      getRight(a) > b.gridCol &&
      a.gridRow < getBottom(b) &&
      getBottom(a) > b.gridRow
    );
  };

  for (const widget of sorted) {
    const w = Math.min(widget.sizeW, totalCols);
    const h = Math.max(1, widget.sizeH);
    const col = Math.min(Math.max(0, widget.gridCol), totalCols - w);
    let row = Math.max(0, widget.gridRow);

    const candidate = { ...widget, gridCol: col, gridRow: row, sizeW: w, sizeH: h };

    let maxAttempts = 100;
    while (maxAttempts > 0) {
      const collision = placed.find((p) => overlaps(candidate, p));
      if (!collision) break;
      row = getBottom(collision);
      candidate.gridRow = row;
      maxAttempts -= 1;
    }

    placed.push(candidate);
  }

  return placed.sort((a, b) => a.sortOrder - b.sortOrder);
}

const LONG_PRESS_DELAY = 200;
const LAYOUT_TRANSITION_MS = 160;

const WidgetGrid = ({
  widgets,
  isEditMode = false,
  onLayoutChange,
  cols: colsProp,
  gap = 20,
}: WidgetGridProps) => {
  const isMobile = useIsMobile();
  const gridRef = useRef<HTMLDivElement>(null);
  const gridInnerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const cellSizeRef = useRef(cellSize);
  useEffect(() => {
    cellSizeRef.current = cellSize;
  }, [cellSize]);

  const [viewportCols, setViewportCols] = useState(6);
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      if (w < 480) setViewportCols(2);
      else if (w < 768) setViewportCols(3);
      else if (w < 1024) setViewportCols(4);
      else if (w < 1280) setViewportCols(5);
      else setViewportCols(6);
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const cols = colsProp ?? viewportCols;
  const colsRef = useRef(cols);
  useEffect(() => {
    colsRef.current = cols;
  }, [cols]);

  useEffect(() => {
    const updateCellSize = () => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const cellW = (rect.width - gap * (cols - 1)) / cols;
      setCellSize({ w: cellW, h: cellW });
    };
    updateCellSize();
    window.addEventListener('resize', updateCellSize);
    const ro = new ResizeObserver(updateCellSize);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => {
      window.removeEventListener('resize', updateCellSize);
      ro.disconnect();
    };
  }, [cols, gap]);

  const [localWidgets, setLocalWidgets] = useState<Widget[]>(widgets);
  const localWidgetsRef = useRef(localWidgets);
  useEffect(() => {
    localWidgetsRef.current = localWidgets;
  }, [localWidgets]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const immediateSaveRef = useRef(false);

  useEffect(() => {
    setLocalWidgets(widgets);
  }, [widgets]);

  const scheduleSave = useCallback((updated: Widget[]) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    if (immediateSaveRef.current) {
      onLayoutChange(updated);
      immediateSaveRef.current = false;
      return;
    }
    saveTimerRef.current = setTimeout(() => {
      onLayoutChange(updated);
    }, 300);
  }, [onLayoutChange]);

  const applyLocalChange = useCallback((updater: (prev: Widget[]) => Widget[]) => {
    setLocalWidgets((prev) => {
      const updated = updater(prev);
      scheduleSave(updated);
      return updated;
    });
  }, [scheduleSave]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragStarted, setDragStarted] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dragStateRef = useRef({
    id: null as string | null,
    sizeW: 1,
    sizeH: 1,
    offsetX: 0,
    offsetY: 0,
    clientX: 0,
    clientY: 0,
    overCol: -1,
    overRow: -1,
    lastOverCol: -1,
    lastOverRow: -1,
    origCol: 0,
    origRow: 0,
    rafPending: false,
  });

  const dragPreviewRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const widgetElsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const previewPackedRef = useRef<Widget[]>([]);

  const packedWidgets = useMemo(
    () => resolveCollisions(localWidgets, cols, null),
    [localWidgets, cols],
  );

  const packedWidgetsRef = useRef(packedWidgets);
  useEffect(() => {
    packedWidgetsRef.current = packedWidgets;
  }, [packedWidgets]);

  const totalRows = useMemo(() => {
    let maxR = 0;
    for (const w of packedWidgets) {
      maxR = Math.max(maxR, w.gridRow + w.sizeH);
    }
    return Math.max(1, maxR);
  }, [packedWidgets]);

  const gridHeight = totalRows * cellSize.h + (totalRows - 1) * gap;

  const getCellFromPoint = useCallback(
    (clientX: number, clientY: number): { col: number; row: number } | null => {
      if (!gridRef.current || cellSizeRef.current.w <= 0) return null;
      const cs = cellSizeRef.current;
      const rect = gridRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const col = Math.floor(x / (cs.w + gap));
      const row = Math.floor(y / (cs.h + gap));
      return { col: Math.max(0, Math.min(colsRef.current - 1, col)), row: Math.max(0, row) };
    },
    [gap],
  );

  const recalcPreviewLayout = useCallback(
    (overCol: number, overRow: number) => {
      const ds = dragStateRef.current;
      if (!ds.id) return;

      const base = localWidgetsRef.current;
      const others = base.filter((w) => w.id !== ds.id);
      const sortedOthers = [...others].sort((a, b) => a.sortOrder - b.sortOrder);

      const pw = Math.min(ds.sizeW, colsRef.current);
      const ph = Math.max(1, ds.sizeH);

      const placed: Widget[] = [];

      const overlapsPlace = (col: number, row: number, w: number, h: number): boolean => {
        for (let i = 0; i < placed.length; i++) {
          const p = placed[i];
          if (
            col < p.gridCol + p.sizeW &&
            col + w > p.gridCol &&
            row < p.gridRow + p.sizeH &&
            row + h > p.gridRow
          ) return true;
        }
        if (
          col < overCol + pw &&
          col + w > overCol &&
          row < overRow + ph &&
          row + h > overRow
        ) return true;
        return false;
      };

      const findSlot = (w: number, h: number): { col: number; row: number } => {
        const maxRow = placed.length > 0
          ? Math.max(...placed.map((p) => p.gridRow + p.sizeH)) + overRow + ph + h
          : overRow + ph + h;
        for (let row = 0; row < maxRow; row++) {
          for (let col = 0; col <= colsRef.current - w; col++) {
            if (!overlapsPlace(col, row, w, h)) {
              return { col, row };
            }
          }
        }
        return { col: 0, row: maxRow };
      };

      for (const widget of sortedOthers) {
        const w = Math.min(widget.sizeW, colsRef.current);
        const h = Math.max(1, widget.sizeH);
        const { col, row } = findSlot(w, h);
        placed.push({ ...widget, gridCol: col, gridRow: row, sizeW: w, sizeH: h });
      }

      previewPackedRef.current = placed;
    },
    [],
  );

  const applyPreviewPositions = useCallback(() => {
    const cs = cellSizeRef.current;
    const ds = dragStateRef.current;
    const preview = previewPackedRef.current;
    if (preview.length === 0 || !ds.id) return;

    for (let i = 0; i < preview.length; i++) {
      const w = preview[i];
      if (w.id === ds.id) continue;
      const el = widgetElsRef.current.get(w.id);
      if (!el) continue;
      const newX = w.gridCol * (cs.w + gap);
      const newY = w.gridRow * (cs.h + gap);
      el.style.transition = '';
      el.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
      const newWidth = `${w.sizeW * cs.w + (w.sizeW - 1) * gap}px`;
      const newHeight = `${w.sizeH * cs.h + (w.sizeH - 1) * gap}px`;
      el.style.width = newWidth;
      el.style.height = newHeight;
    }

    if (placeholderRef.current && ds.overCol >= 0 && ds.overRow >= 0) {
      const w = ds.sizeW * cs.w + (ds.sizeW - 1) * gap;
      const h = ds.sizeH * cs.h + (ds.sizeH - 1) * gap;
      placeholderRef.current.style.transition = '';
      placeholderRef.current.style.transform = `translate3d(${ds.overCol * (cs.w + gap)}px, ${ds.overRow * (cs.h + gap)}px, 0)`;
      placeholderRef.current.style.width = `${w}px`;
      placeholderRef.current.style.height = `${h}px`;
      placeholderRef.current.style.display = 'block';
    }
  }, [gap]);

  const applyDragFrame = useCallback(() => {
    const ds = dragStateRef.current;
    const cs = cellSizeRef.current;
    ds.rafPending = false;

    if (dragPreviewRef.current) {
      const w = ds.sizeW * cs.w + (ds.sizeW - 1) * gap;
      const h = ds.sizeH * cs.h + (ds.sizeH - 1) * gap;
      dragPreviewRef.current.style.transform = `translate3d(${ds.clientX - ds.offsetX}px, ${ds.clientY - ds.offsetY}px, 0)`;
      dragPreviewRef.current.style.width = `${w}px`;
      dragPreviewRef.current.style.height = `${h}px`;
      dragPreviewRef.current.style.display = 'block';
    }
  }, [gap]);

  const scheduleDragFrame = useCallback(() => {
    if (dragStateRef.current.rafPending) return;
    dragStateRef.current.rafPending = true;
    requestAnimationFrame(applyDragFrame);
  }, [applyDragFrame]);

  const handlePointerDown = useCallback(
    (id: string, e: React.PointerEvent) => {
      if (!isEditMode) return;
      const widget = localWidgetsRef.current.find((w) => w.id === id);
      if (!widget) return;

      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      const startDrag = () => {
        const ds = dragStateRef.current;
        ds.id = id;
        ds.sizeW = widget.sizeW;
        ds.sizeH = widget.sizeH;
        ds.offsetX = offsetX;
        ds.offsetY = offsetY;
        ds.clientX = e.clientX;
        ds.clientY = e.clientY;
        ds.overCol = -1;
        ds.overRow = -1;
        ds.lastOverCol = -1;
        ds.lastOverRow = -1;

        const packed = packedWidgetsRef.current;
        const dragged = packed.find((w) => w.id === id);
        if (dragged) {
          ds.origCol = dragged.gridCol;
          ds.origRow = dragged.gridRow;
        }

        const cs = cellSizeRef.current;

        if (dragPreviewRef.current) {
          const w = ds.sizeW * cs.w + (ds.sizeW - 1) * gap;
          const h = ds.sizeH * cs.h + (ds.sizeH - 1) * gap;
          dragPreviewRef.current.style.transition = 'none';
          dragPreviewRef.current.style.transform = `translate3d(${e.clientX - offsetX}px, ${e.clientY - offsetY}px, 0)`;
          dragPreviewRef.current.style.width = `${w}px`;
          dragPreviewRef.current.style.height = `${h}px`;
          dragPreviewRef.current.style.display = 'block';
        }

        const draggedEl = widgetElsRef.current.get(id);
        if (draggedEl) {
          draggedEl.style.opacity = '0.2';
        }

        const pos = getCellFromPoint(e.clientX, e.clientY);
        if (pos) {
          ds.overCol = Math.min(pos.col, colsRef.current - widget.sizeW);
          ds.overRow = pos.row;
          ds.lastOverCol = ds.overCol;
          ds.lastOverRow = ds.overRow;
        }

        if (placeholderRef.current && ds.overCol >= 0 && ds.overRow >= 0) {
          const w = ds.sizeW * cs.w + (ds.sizeW - 1) * gap;
          const h = ds.sizeH * cs.h + (ds.sizeH - 1) * gap;
          placeholderRef.current.style.transition = 'none';
          placeholderRef.current.style.transform = `translate3d(${ds.overCol * (cs.w + gap)}px, ${ds.overRow * (cs.h + gap)}px, 0)`;
          placeholderRef.current.style.width = `${w}px`;
          placeholderRef.current.style.height = `${h}px`;
          placeholderRef.current.style.display = 'block';
        }

        if (ds.overCol >= 0 && ds.overRow >= 0) {
          recalcPreviewLayout(ds.overCol, ds.overRow);
          requestAnimationFrame(() => {
            applyPreviewPositions();
          });
        }

        setDraggedId(id);
        setDragStarted(true);

        try {
          target.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }

        scheduleDragFrame();
      };

      if (isMobile || e.pointerType === 'touch') {
        longPressTimerRef.current = setTimeout(startDrag, LONG_PRESS_DELAY);
      } else {
        startDrag();
      }

      e.preventDefault();
    },
    [isEditMode, getCellFromPoint, isMobile, gap, scheduleDragFrame, recalcPreviewLayout, applyPreviewPositions],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds.id) return;
      e.preventDefault();

      ds.clientX = e.clientX;
      ds.clientY = e.clientY;

      const pos = getCellFromPoint(e.clientX, e.clientY);
      if (pos) {
        const newOverCol = Math.min(pos.col, colsRef.current - ds.sizeW);
        const newOverRow = pos.row;

        if (newOverCol !== ds.lastOverCol || newOverRow !== ds.lastOverRow) {
          ds.overCol = newOverCol;
          ds.overRow = newOverRow;
          ds.lastOverCol = newOverCol;
          ds.lastOverRow = newOverRow;

          recalcPreviewLayout(newOverCol, newOverRow);
          applyPreviewPositions();
        }
      }

      scheduleDragFrame();
    },
    [getCellFromPoint, scheduleDragFrame, recalcPreviewLayout, applyPreviewPositions],
  );

  const finishDrag = useCallback(
    (clientX: number, clientY: number, committed: boolean) => {
      const ds = dragStateRef.current;
      if (!ds.id) {
        setDraggedId(null);
        setDragStarted(false);
        return;
      }

      const droppedId = ds.id;
      const dropSizeW = ds.sizeW;
      const dropSizeH = ds.sizeH;
      const cs = cellSizeRef.current;
      const gridRect = gridRef.current?.getBoundingClientRect();

      if (committed && gridRect && ds.overCol >= 0 && ds.overRow >= 0) {
        const dropCol = ds.overCol;
        const dropRow = ds.overRow;
        const targetX = dropCol * (cs.w + gap);
        const targetY = dropRow * (cs.h + gap);

        const droppedEl = widgetElsRef.current.get(droppedId);
        if (droppedEl) {
          droppedEl.style.transition = 'none';
          droppedEl.style.opacity = '1';
          const dropX = clientX - ds.offsetX - gridRect.left;
          const dropY = clientY - ds.offsetY - gridRect.top;
          droppedEl.style.transform = `translate3d(${dropX}px, ${dropY}px, 0)`;
          droppedEl.style.width = `${dropSizeW * cs.w + (dropSizeW - 1) * gap}px`;
          droppedEl.style.height = `${dropSizeH * cs.h + (dropSizeH - 1) * gap}px`;

          requestAnimationFrame(() => {
            if (droppedEl.isConnected) {
              droppedEl.style.transition = '';
              droppedEl.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
            }
          });
        }

        const base = localWidgetsRef.current;
        const draggedWidget = base.find((w) => w.id === droppedId);

        if (!draggedWidget) {
          ds.id = null;
          setDraggedId(null);
          setDragStarted(false);
          return;
        }

        const othersFinal = previewPackedRef.current;
        const allFinal: Widget[] = [
          { ...draggedWidget, gridCol: dropCol, gridRow: dropRow, sizeW: dropSizeW, sizeH: dropSizeH },
          ...othersFinal,
        ];

        const byPosition = [...allFinal].sort((a, b) => {
          if (a.gridRow !== b.gridRow) return a.gridRow - b.gridRow;
          if (a.gridCol !== b.gridCol) return a.gridCol - b.gridCol;
          return a.sortOrder - b.sortOrder;
        });
        const withNewOrder = byPosition.map((w, i) => ({ ...w, sortOrder: i * 10 }));
        const finalMap = new Map(withNewOrder.map((w) => [w.id, w]));

        requestAnimationFrame(() => {
          for (let i = 0; i < withNewOrder.length; i++) {
            const w = withNewOrder[i];
            const el = widgetElsRef.current.get(w.id);
            if (!el) continue;
            const newX = w.gridCol * (cs.w + gap);
            const newY = w.gridRow * (cs.h + gap);
            el.style.transition = '';
            el.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
            const newWidth = `${w.sizeW * cs.w + (w.sizeW - 1) * gap}px`;
            const newHeight = `${w.sizeH * cs.h + (w.sizeH - 1) * gap}px`;
            el.style.width = newWidth;
            el.style.height = newHeight;
            if (w.id === droppedId) {
              el.style.opacity = '1';
            }
          }
        });

        immediateSaveRef.current = true;
        applyLocalChange((prev) => {
          return prev.map((w) => {
            const resolved = finalMap.get(w.id);
            if (!resolved) return w;
            return {
              ...w,
              gridCol: resolved.gridCol,
              gridRow: resolved.gridRow,
              sizeW: resolved.sizeW,
              sizeH: resolved.sizeH,
              sortOrder: resolved.sortOrder,
            };
          });
        });
      } else {
        const basePacked = packedWidgetsRef.current;
        const baseMap = new Map(basePacked.map((w) => [w.id, w]));

        const droppedEl = widgetElsRef.current.get(droppedId);
        if (droppedEl && gridRect) {
          const returnX = clientX - ds.offsetX - gridRect.left;
          const returnY = clientY - ds.offsetY - gridRect.top;
          const orig = baseMap.get(droppedId);
          const origX = orig ? orig.gridCol * (cs.w + gap) : ds.origCol * (cs.w + gap);
          const origY = orig ? orig.gridRow * (cs.h + gap) : ds.origRow * (cs.h + gap);

          droppedEl.style.transition = 'none';
          droppedEl.style.opacity = '1';
          droppedEl.style.transform = `translate3d(${returnX}px, ${returnY}px, 0)`;
          droppedEl.style.width = `${dropSizeW * cs.w + (dropSizeW - 1) * gap}px`;
          droppedEl.style.height = `${dropSizeH * cs.h + (dropSizeH - 1) * gap}px`;

          requestAnimationFrame(() => {
            if (droppedEl.isConnected) {
              droppedEl.style.transition = '';
              droppedEl.style.transform = `translate3d(${origX}px, ${origY}px, 0)`;
            }
          });
        }

        for (let i = 0; i < basePacked.length; i++) {
          const w = basePacked[i];
          if (w.id === droppedId) continue;
          const el = widgetElsRef.current.get(w.id);
          if (!el) continue;
          const newX = w.gridCol * (cs.w + gap);
          const newY = w.gridRow * (cs.h + gap);
          el.style.transition = '';
          el.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
          el.style.width = `${w.sizeW * cs.w + (w.sizeW - 1) * gap}px`;
          el.style.height = `${w.sizeH * cs.h + (w.sizeH - 1) * gap}px`;
        }

        if (placeholderRef.current) {
          placeholderRef.current.style.display = 'none';
        }
      }

      ds.id = null;
      ds.overCol = -1;
      ds.overRow = -1;
      ds.lastOverCol = -1;
      ds.lastOverRow = -1;
      setDraggedId(null);
      setDragStarted(false);

      if (dragPreviewRef.current) {
        dragPreviewRef.current.style.display = 'none';
      }
      if (committed && placeholderRef.current) {
        placeholderRef.current.style.display = 'none';
      }
    },
    [applyLocalChange],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const ds = dragStateRef.current;
      if (!ds.id) {
        setDraggedId(null);
        setDragStarted(false);
        return;
      }

      finishDrag(e.clientX, e.clientY, true);

      try {
        const target = e.target as HTMLElement;
        if (target.releasePointerCapture) {
          target.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    },
    [finishDrag],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const ds = dragStateRef.current;
      if (!ds.id) return;
      finishDrag(ds.clientX, ds.clientY, false);
    },
    [finishDrag],
  );

  useEffect(() => {
    if (!dragStarted) return;

    const onMove = (e: PointerEvent) => handlePointerMove(e);
    const onUp = (e: PointerEvent) => handlePointerUp(e);
    const onCancel = (e: PointerEvent) => handlePointerUp(e);
    const onKey = (e: KeyboardEvent) => handleKeyDown(e);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
    };
  }, [dragStarted, handlePointerMove, handlePointerUp, handleKeyDown]);

  const handleDelete = useCallback(
    (id: string) => {
      immediateSaveRef.current = true;
      applyLocalChange((prev) => prev.filter((w) => w.id !== id));
    },
    [applyLocalChange],
  );

  const handleResize = useCallback(
    (id: string, newSizeW: number, newSizeH: number) => {
      immediateSaveRef.current = true;
      applyLocalChange((prev) =>
        prev.map((w) => {
          if (w.id === id) return { ...w, sizeW: newSizeW, sizeH: newSizeH };
          return w;
        }),
      );
    },
    [applyLocalChange],
  );

  const registerWidgetEl = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      widgetElsRef.current.set(id, el);
    } else {
      widgetElsRef.current.delete(id);
    }
  }, []);

  const setWidgetTransform = useCallback(
    (widget: Widget): React.CSSProperties => {
      const cs = cellSize;
      const w = widget.sizeW * cs.w + (widget.sizeW - 1) * gap;
      const h = widget.sizeH * cs.h + (widget.sizeH - 1) * gap;
      const x = widget.gridCol * (cs.w + gap);
      const y = widget.gridRow * (cs.h + gap);
      return {
        position: 'absolute',
        width: w,
        height: h,
        transform: `translate3d(${x}px, ${y}px, 0)`,
      };
    },
    [cellSize, gap],
  );

  const draggedWidget = draggedId ? localWidgets.find((w) => w.id === draggedId) : null;

  return (
    <div
      ref={gridRef}
      className={cn(
        'relative w-full transition-opacity duration-300',
        isEditMode && 'widget-grid-edit',
        dragStarted && 'select-none',
      )}
    >
      {isEditMode && cellSize.w > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(0 0% 100% / 0.08) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(0 0% 100% / 0.08) 1px, transparent 1px)
            `,
            backgroundSize: `${cellSize.w + gap}px ${cellSize.h + gap}px`,
          }}
        />
      )}

      <div
        ref={gridInnerRef}
        className={cn('relative w-full widget-grid-inner')}
        style={{
          height: gridHeight > 0 ? gridHeight : 'auto',
          minHeight: cellSize.h > 0 ? cellSize.h : 200,
        }}
      >
        {packedWidgets.map((widget) => (
          <div
            key={widget.id}
            ref={(el) => registerWidgetEl(widget.id, el)}
            style={setWidgetTransform(widget)}
            className={cn(
              'widget-grid-item',
              draggedId === widget.id && dragStarted && 'opacity-20 pointer-events-none',
            )}
          >
            <WidgetItem
              widget={widget}
              isEditMode={isEditMode}
              onResize={(w, h) => handleResize(widget.id, w, h)}
              onDelete={() => handleDelete(widget.id)}
              onPointerDown={(e) => handlePointerDown(widget.id, e)}
              isMobile={isMobile}
            />
          </div>
        ))}

        {isEditMode && (
          <div
            ref={placeholderRef}
            className="absolute border-2 border-dashed border-primary rounded-xl pointer-events-none bg-primary/15 widget-grid-item"
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        )}
      </div>

      <div
        ref={dragPreviewRef}
        className="glass-card shadow-2xl ring-2 ring-primary/60 overflow-hidden fixed z-[1000] pointer-events-none"
        style={{ top: 0, left: 0, display: 'none', willChange: 'transform' }}
      >
        {draggedWidget && (
          <div className="w-full h-full p-4">
            <WidgetContent
              widget={draggedWidget}
              size={mapSizeToWidgetSize(
                dragStateRef.current.sizeW || 1,
                dragStateRef.current.sizeH || 1,
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default WidgetGrid;
