import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@client/src/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import {
  createCard,
  updateCard,
} from '@client/src/api/nav';
import type { NavCard, NavGroup } from '@shared/api.interface';

const cardSchema = z.object({
  name: z.string().min(1, '请输入卡片名称'),
  url: z.string().url('请输入有效的 URL'),
  intranetUrl: z.string().optional(),
  extranetUrl: z.string().optional(),
  iconType: z.enum(['emoji', 'image', 'favicon']),
  icon: z.string().optional(),
  groupId: z.string().nullable(),
}).refine((data) => !data.intranetUrl || /^https?:\/\//.test(data.intranetUrl), {
  message: '内网地址需以 http:// 或 https:// 开头',
  path: ['intranetUrl'],
}).refine((data) => !data.extranetUrl || /^https?:\/\//.test(data.extranetUrl), {
  message: '外网地址需以 http:// 或 https:// 开头',
  path: ['extranetUrl'],
});

type CardFormValues = z.infer<typeof cardSchema>;

interface CardEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NavGroup[];
  card?: NavCard | null;
  defaultGroupId?: string | null;
}

export default function CardEditor({
  open,
  onOpenChange,
  groups,
  card,
  defaultGroupId = null,
}: CardEditorProps) {
  const queryClient = useQueryClient();
  const isEditing = !!card;

  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      name: card?.name ?? '',
      url: card?.url ?? '',
      intranetUrl: card?.intranetUrl ?? '',
      extranetUrl: card?.extranetUrl ?? '',
      iconType: card?.iconType ?? 'emoji',
      icon: card?.icon ?? '',
      groupId: card?.groupId ?? defaultGroupId,
    },
    values: card
      ? {
          name: card.name,
          url: card.url,
          intranetUrl: card.intranetUrl ?? '',
          extranetUrl: card.extranetUrl ?? '',
          iconType: card.iconType,
          icon: card.icon ?? '',
          groupId: card.groupId,
        }
      : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (values: CardFormValues) =>
      createCard({
        name: values.name,
        url: values.url,
        intranetUrl: values.intranetUrl || undefined,
        extranetUrl: values.extranetUrl || undefined,
        iconType: values.iconType,
        icon: values.icon || undefined,
        groupId: values.groupId,
      }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navData'] });
      toast.success('卡片已添加');
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      logger.error('添加卡片失败', error);
      toast.error('添加失败，请重试');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: CardFormValues) => {
      if (!card) throw new Error('No card to update');
      return updateCard(card.id, {
        name: values.name,
        url: values.url,
        intranetUrl: values.intranetUrl || undefined,
        extranetUrl: values.extranetUrl || undefined,
        iconType: values.iconType,
        icon: values.icon || undefined,
        groupId: values.groupId,
      });
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navData'] });
      toast.success('卡片已更新');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      logger.error('更新卡片失败', error);
      toast.error('更新失败，请重试');
    },
  });

  const onSubmit = (values: CardFormValues) => {
    if (isEditing) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const iconType = form.watch('iconType');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[hsl(220_25%_12%_/_0.95)] backdrop-blur-2xl border-white/10">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEditing ? '编辑卡片' : '添加卡片'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名称</FormLabel>
                  <FormControl>
                    <Input placeholder="输入卡片名称" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>默认 URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="intranetUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>内网地址（可选）</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://intranet.example.com"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="extranetUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>外网地址（可选）</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="iconType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>图标类型</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择图标类型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="emoji">Emoji</SelectItem>
                      <SelectItem value="image">图片 URL</SelectItem>
                      <SelectItem value="favicon">网站 Favicon</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {iconType === 'emoji' && (
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emoji 图标</FormLabel>
                    <FormControl>
                      <Input placeholder="🚀" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {iconType === 'image' && (
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>图片 URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/icon.png" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="groupId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>所属分组</FormLabel>
                  <Select
                    value={field.value ?? 'ungrouped'}
                    onValueChange={(v) =>
                      field.onChange(v === 'ungrouped' ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择分组" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ungrouped">未分组</SelectItem>
                      {groups.map((group: NavGroup) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {isEditing ? '保存' : '添加'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
