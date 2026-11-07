import { useState, useRef, useCallback, useEffect } from 'react';
import NavCard from './NavCard';
import type { NavGroupWithCards, NavCard as NavCardType } from '@shared/api.interface';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface CardGridProps {
  groups: NavGroupWithCards[];
  ungrouped: NavCardType[];
  isEditMode?: boolean;
}

const CardGrid = ({ groups, ungrouped, isEditMode = false }: CardGridProps) => {
  const isMobile = useIsMobile();

  const allGroups = [...groups];
  if (ungrouped.length > 0) {
    allGroups.push({
      id: '__ungrouped__',
      name: '未分组',
      sortOrder: 9999,
      cards: ungrouped,
    });
  }

  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchDeltaX = useRef<number>(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  const isTouchDevice =
    typeof window !== 'undefined' && 'ontouchstart' in window;

  const handleLongPressStart = useCallback((cardId: string, cardIndex: number) => {
    if (!isEditMode || !isTouchDevice) return;

    longPressTimer.current = setTimeout(() => {
      setDragIndex(cardIndex);
      setDraggedCardId(cardId);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  }, [isEditMode, isTouchDevice]);

  const handleLongPressCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && index !== dragIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      setDraggedCardId(null);
      return;
    }
    setDragIndex(null);
    setDragOverIndex(null);
    setDraggedCardId(null);
  };

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaX.current = 0;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      setIsSwiping(true);
      touchDeltaX.current = deltaX;
    }
  };

  const handleTouchEnd = () => {
    if (isSwiping && Math.abs(touchDeltaX.current) > 50) {
      if (touchDeltaX.current > 0 && activeGroupIndex > 0) {
        setActiveGroupIndex((prev) => prev - 1);
      } else if (
        touchDeltaX.current < 0 &&
        activeGroupIndex < allGroups.length - 1
      ) {
        setActiveGroupIndex((prev) => prev + 1);
      }
    }
    setIsSwiping(false);
    touchDeltaX.current = 0;
  };

  if (allGroups.length === 0) {
    return (
      <div className="text-center text-white/40 py-16 rise" style={{ animationDelay: '0.4s' }}>
        暂无导航卡片
      </div>
    );
  }

  if (!isMobile) {
    return (
      <div className="space-y-8 rise" style={{ animationDelay: '0.4s' }}>
        {allGroups.map((group, groupIndex) => (
          <div key={group.id}>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-1 h-4 rounded-full bg-primary"
                aria-hidden="true"
              />
              <h2 className="text-white font-semibold text-sm tracking-wide">
                {group.name}
              </h2>
            </div>
            <div className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {group.cards.map((card, cardIndex) => (
                <NavCard
                  key={card.id}
                  card={card}
                  delay={groupIndex * 80 + cardIndex * 40 + 400}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const currentGroup = allGroups[activeGroupIndex];

  return (
    <div className="rise" style={{ animationDelay: '0.4s' }}>
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 -mx-2 px-2">
        {allGroups.map((group, index) => (
          <button
            key={group.id}
            onClick={() => setActiveGroupIndex(index)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              activeGroupIndex === index
                ? 'bg-primary text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20',
            )}
          >
            {group.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-1 h-5 rounded-full bg-primary"
          aria-hidden="true"
        />
        <h2 className="text-white font-semibold text-base tracking-wide">
          {currentGroup?.name}
        </h2>
      </div>

      <div
        className="relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="grid grid-cols-2 gap-4 transition-transform duration-300 ease-out"
          style={{
            transform: isSwiping
              ? `translateX(${touchDeltaX.current * 0.3}px)`
              : 'translateX(0)',
          }}
        >
          {currentGroup?.cards.map((card, cardIndex) => (
            <div
              key={card.id}
              onDragOver={(e) => handleDragOver(e, cardIndex)}
              onDrop={(e) => handleDrop(e, cardIndex)}
              onTouchStart={() => handleLongPressStart(card.id, cardIndex)}
              onTouchEnd={handleLongPressCancel}
              onTouchMove={handleLongPressCancel}
              className={cn(
                'transition-all duration-200',
                draggedCardId === card.id &&
                  'scale-110 opacity-50 z-10 shadow-2xl',
                dragOverIndex === cardIndex &&
                  dragIndex !== null &&
                  'ring-2 ring-primary',
              )}
            >
              <NavCard
                card={card}
                delay={cardIndex * 40 + 400}
              />
            </div>
          ))}
        </div>

        {allGroups.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-6">
            {allGroups.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  activeGroupIndex === index
                    ? 'w-6 bg-primary'
                    : 'w-1.5 bg-white/30',
                )}
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CardGrid;
