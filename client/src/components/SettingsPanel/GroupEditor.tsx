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
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import {
  createGroup,
  updateGroup,
} from '@client/src/api/nav';
import type { NavGroup } from '@shared/api.interface';

const groupSchema = z.object({
  name: z.string().min(1, '请输入分组名称'),
});

type GroupFormValues = z.infer<typeof groupSchema>;

interface GroupEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: NavGroup | null;
}

export default function GroupEditor({
  open,
  onOpenChange,
  group,
}: GroupEditorProps) {
  const queryClient = useQueryClient();
  const isEditing = !!group;

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: group?.name ?? '',
    },
    values: group ? { name: group.name } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (values: GroupFormValues) =>
      createGroup({ name: values.name }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navData'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('分组已添加');
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      logger.error('添加分组失败', error);
      toast.error('添加失败，请重试');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: GroupFormValues) => {
      if (!group) throw new Error('No group to update');
      return updateGroup(group.id, { name: values.name });
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navData'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('分组已更新');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      logger.error('更新分组失败', error);
      toast.error('更新失败，请重试');
    },
  });

  const onSubmit = (values: GroupFormValues) => {
    if (isEditing) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[hsl(220_25%_12%_/_0.95)] backdrop-blur-2xl border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEditing ? '编辑分组' : '添加分组'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>分组名称</FormLabel>
                  <FormControl>
                    <Input placeholder="输入分组名称" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
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
