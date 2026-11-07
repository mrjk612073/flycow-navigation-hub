import { useState } from 'react';
import {
  GripVertical,
  Trash2,
  Maximize2,
} from 'lucide-react';
import type { Widget } from '@shared/api.interface';
import WidgetContent from './WidgetContent';
import SizePicker from './SizePicker';
import { mapSizeToWidgetSize } from './utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { Button } from '@client/src/components/ui/button';
import { cn } from '@/lib/utils';

export interface WidgetItemProps {
  widget: Widget;
  isEditMode?: boolean;
  onResize: (sizeW: number, sizeH: number) => void;
  onDelete?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  isMobile?: boolean;
}

const WidgetItem = ({
  widget,
  isEditMode = false,
  onResize,
  onDelete,
  onPointerDown,
  isMobile = false,
}: WidgetItemProps) => {
  const [sizePickerOpen, setSizePickerOpen] = useState(false);

  const handleSizeApply = (w: number, h: number) => {
    onResize(w, h);
    setSizePickerOpen(false);
  };

  const isGroupTitle = widget.widgetType === 'group_title';

  const stopDrag = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={cn(
        'relative w-full h-full glass-card overflow-hidden group',
        isEditMode && !isGroupTitle && 'cursor-grab active:cursor-grabbing',
      )}
      onPointerDown={
        isEditMode && !isGroupTitle
          ? onPointerDown
          : undefined
      }
    >
      <div
        className={cn(
          'w-full h-full p-4',
          isEditMode && !isGroupTitle && '[&_*]:pointer-events-none',
        )}
      >
        <WidgetContent widget={widget} size={mapSizeToWidgetSize(widget.sizeW, widget.sizeH)} />
      </div>

      {isEditMode && !isGroupTitle && (
        <>
          <div
            className="absolute top-2 left-2 text-white/40 pointer-events-none transition-colors z-10"
            aria-hidden="true"
          >
            <GripVertical size={isMobile ? 16 : 14} strokeWidth={1.5} />
          </div>

          <div className="absolute top-2 right-2 flex gap-1 z-10">
            <Popover open={sizePickerOpen} onOpenChange={setSizePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white/50 hover:text-white hover:bg-white/10 rounded-md"
                  aria-label="调整尺寸"
                  onPointerDown={stopDrag}
                >
                  <Maximize2 size={14} strokeWidth={1.5} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="end" onPointerDown={stopDrag}>
                <SizePicker
                  initialW={widget.sizeW}
                  initialH={widget.sizeH}
                  onApply={handleSizeApply}
                  maxCols={6}
                  maxRows={6}
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/50 hover:text-red-400 hover:bg-white/10 rounded-md"
              aria-label="删除组件"
              onPointerDown={stopDrag}
              onClick={onDelete}
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </Button>
          </div>
        </>
      )}

      {isEditMode && isGroupTitle && (
        <div className="absolute top-2 right-2 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/50 hover:text-red-400 hover:bg-white/10 rounded-md"
            aria-label="删除分组"
            onPointerDown={stopDrag}
            onClick={onDelete}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default WidgetItem;
