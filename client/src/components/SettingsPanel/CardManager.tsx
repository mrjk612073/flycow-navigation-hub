import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  FolderPlus,
  Link as LinkIcon,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import { getNavData, deleteCard, deleteGroup, reorderCards } from '@client/src/api/nav';
import CardEditor from './CardEditor';
import GroupEditor from './GroupEditor';
import type { NavCard, NavGroup, NavGroupWithCards } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

export default function CardManager() {
  const queryClient = useQueryClient();
  const [cardEditorOpen, setCardEditorOpen] = useState(false);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<NavCard | null>(null);
  const [editingGroup, setEditingGroup] = useState<NavGroup | null>(null);
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const { data: navData, isLoading } = useQuery({
    queryKey: ['navData'],
    queryFn: getNavData,
  });

  const groups = navData?.groups ?? [];
  const ungrouped = navData?.ungrouped ?? [];
  const allGroups: NavGroup[] = groups.map((g: NavGroupWithCards) => ({
    id: g.id,
    name: g.name,
    sortOrder: g.sortOrder,
  }));

  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => deleteCard(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navData'] });
      toast.success('卡片已删除');
      setDeleteCardId(null);
    },
    onError: (error: Error) => {
      logger.error('删除卡片失败', error);
      toast.error('删除失败，请重试');
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navData'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('分组已删除');
      setDeleteGroupId(null);
    },
    onError: (error: Error) => {
      logger.error('删除分组失败', error);
      toast.error('删除失败，请重试');
    },
  });

  const handleAddCard = (groupId: string | null) => {
    setEditingCard(null);
    setDefaultGroupId(groupId);
    setCardEditorOpen(true);
  };

  const handleEditCard = (card: NavCard) => {
    setEditingCard(card);
    setDefaultGroupId(card.groupId);
    setCardEditorOpen(true);
  };

  const handleAddGroup = () => {
    setEditingGroup(null);
    setGroupEditorOpen(true);
  };

  const handleEditGroup = (group: NavGroup) => {
    setEditingGroup(group);
    setGroupEditorOpen(true);
  };

  const moveCard = (
    cardId: string,
    direction: 'up' | 'down',
    cards: NavCard[],
    groupId: string | null,
  ) => {
    const idx = cards.findIndex((c: NavCard) => c.id === cardId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === cards.length - 1) return;

    const newCards = [...cards];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newCards[idx], newCards[swapIdx]] = [newCards[swapIdx], newCards[idx]];

    const items = newCards.map((c: NavCard, i: number) => ({
      id: c.id,
      sortOrder: i,
      groupId,
    }));

    reorderCards({ items })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['navData'] });
      })
      .catch((err: Error) => {
        logger.error('排序失败', err);
        toast.error('排序失败，请重试');
      });
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 操作按钮 */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => handleAddCard(null)}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          添加卡片
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddGroup}
          className="gap-1.5"
        >
          <FolderPlus className="w-4 h-4" />
          添加分组
        </Button>
      </div>

      {/* 分组列表 */}
      <div className="space-y-5">
        {groups.map((group: NavGroupWithCards) => (
          <div
            key={group.id}
            className="glass-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground">{group.name}</h3>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleEditGroup(group)}
                  aria-label="编辑分组"
                  className="h-7 w-7"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleteGroupId(group.id)}
                  aria-label="删除分组"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {group.cards.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-3">
                  暂无卡片
                </p>
              )}
              {group.cards.map((card: NavCard, idx: number) => (
                <CardItem
                  key={card.id}
                  card={card}
                  index={idx}
                  total={group.cards.length}
                  onEdit={() => handleEditCard(card)}
                  onDelete={() => setDeleteCardId(card.id)}
                  onMoveUp={() => moveCard(card.id, 'up', group.cards, group.id)}
                  onMoveDown={() => moveCard(card.id, 'down', group.cards, group.id)}
                />
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddCard(group.id)}
              className="w-full gap-1.5 text-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              添加卡片
            </Button>
          </div>
        ))}

        {/* 未分组 */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">未分组</h3>
            <span className="text-xs text-muted-foreground">
              {ungrouped.length} 个
            </span>
          </div>
          <div className="space-y-2">
            {ungrouped.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-3">
                暂无未分组卡片
              </p>
            )}
            {ungrouped.map((card: NavCard, idx: number) => (
              <CardItem
                key={card.id}
                card={card}
                index={idx}
                total={ungrouped.length}
                onEdit={() => handleEditCard(card)}
                onDelete={() => setDeleteCardId(card.id)}
                onMoveUp={() => moveCard(card.id, 'up', ungrouped, null)}
                onMoveDown={() => moveCard(card.id, 'down', ungrouped, null)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 卡片编辑器 */}
      <CardEditor
        open={cardEditorOpen}
        onOpenChange={setCardEditorOpen}
        groups={allGroups}
        card={editingCard}
        defaultGroupId={defaultGroupId}
      />

      {/* 分组编辑器 */}
      <GroupEditor
        open={groupEditorOpen}
        onOpenChange={setGroupEditorOpen}
        group={editingGroup}
      />

      {/* 删除卡片确认 */}
      <AlertDialog open={!!deleteCardId} onOpenChange={(o) => !o && setDeleteCardId(null)}>
        <AlertDialogContent className="bg-[hsl(220_25%_12%_/_0.95)] backdrop-blur-2xl border-white/10">
          <AlertDialogTitle>确认删除卡片？</AlertDialogTitle>
          <AlertDialogDescription>
            删除后无法恢复，确定要删除这张卡片吗？
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCardId && deleteCardMutation.mutate(deleteCardId)}
              className="bg-destructive text-destructive-foreground"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除分组确认 */}
      <AlertDialog open={!!deleteGroupId} onOpenChange={(o) => !o && setDeleteGroupId(null)}>
        <AlertDialogContent className="bg-[hsl(220_25%_12%_/_0.95)] backdrop-blur-2xl border-white/10">
          <AlertDialogTitle>确认删除分组？</AlertDialogTitle>
          <AlertDialogDescription>
            删除分组后，组内卡片将变为未分组状态。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupId && deleteGroupMutation.mutate(deleteGroupId)}
              className="bg-destructive text-destructive-foreground"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CardItem({
  card,
  index,
  total,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  card: NavCard;
  index: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/5 hover:bg-white/8 transition-colors group">
      <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center text-sm shrink-0 overflow-hidden">
        {card.iconType === 'emoji' && card.icon ? (
          <span>{card.icon}</span>
        ) : card.iconType === 'image' && card.icon ? (
          <Image src={card.icon} alt="" className="w-full h-full object-cover" />
        ) : (
          <LinkIcon className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {card.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">{card.url}</p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="上移"
          className="h-7 w-7"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label="下移"
          className="h-7 w-7"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          aria-label="编辑"
          className="h-7 w-7"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          aria-label="删除"
          className="h-7 w-7 text-destructive hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
