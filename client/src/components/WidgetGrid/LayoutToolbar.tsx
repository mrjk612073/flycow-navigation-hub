import { RotateCcw, LayoutGrid, LayoutList, Grid3X3 } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface LayoutToolbarProps {
  onReset: () => void;
  onApplyTemplate: (name: 'default' | 'compact' | 'dense') => void;
  className?: string;
}

const templates = [
  { name: 'default' as const, label: '默认布局', icon: LayoutGrid },
  { name: 'compact' as const, label: '紧凑布局', icon: LayoutList },
  { name: 'dense' as const, label: '密集布局', icon: Grid3X3 },
];

const LayoutToolbar = ({ onReset, onApplyTemplate, className }: LayoutToolbarProps) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="glass-card !h-9 !px-3 text-white/80 hover:text-white border-white/20 gap-2"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>布局模板</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-black/80 backdrop-blur-md border-white/10 text-white">
          {templates.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <DropdownMenuItem
                key={tpl.name}
                onClick={() => onApplyTemplate(tpl.name)}
                className="gap-2 cursor-pointer hover:bg-white/10 focus:bg-white/10"
              >
                <Icon className="w-4 h-4" />
                {tpl.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="glass-card !h-9 !px-3 text-white/80 hover:text-white border-white/20 gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        <span>重置布局</span>
      </Button>
    </div>
  );
};

export default LayoutToolbar;
