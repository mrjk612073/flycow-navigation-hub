import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { UserPlus, Trash2, Shield, ShieldOff, Power, PowerOff, KeyRound } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  getUsers,
  updateUser,
  deleteUser,
  createUser,
  type NavUserExt,
} from '@client/src/api/auth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { showConfirm } from '@lark-apaas/client-toolkit';

interface AddUserForm {
  username: string;
  displayName: string;
  password: string;
}

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddUserForm>({
    username: '',
    displayName: '',
    password: '',
  });
  const [addError, setAddError] = useState('');

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['authUsers'],
    queryFn: getUsers,
  });

  const users: NavUserExt[] = usersData?.users ?? [];

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { displayName?: string; role?: string; isActive?: boolean; password?: string };
    }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authUsers'] });
    },
    onError: (err) => {
      logger.error('更新用户失败', err);
    },
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authUsers'] });
    },
    onError: (err) => {
      logger.error('删除用户失败', err);
    },
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: { username: string; password: string; displayName: string }) =>
      createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authUsers'] });
      setShowAdd(false);
      setAddError('');
      setAddForm({ username: '', displayName: '', password: '' });
      logger.info('创建用户成功', addForm.username);
    },
    onError: (err) => {
      logger.error('创建用户失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? '创建失败，请稍后重试';
      setAddError(msg);
    },
    retry: false,
  });

  const handleToggleRole = async (user: NavUserExt) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const confirmed = await showConfirm(`确定将用户「${user.displayName || user.username}」的角色改为「${newRole === 'admin' ? '管理员' : '普通用户'}」吗？`);
    if (!confirmed) return;
    updateMutation.mutate({ id: user.id, data: { role: newRole } });
  };

  const handleToggleActive = async (user: NavUserExt) => {
    const isActive = user.isActive !== false;
    const action = isActive ? '禁用' : '启用';
    const confirmed = await showConfirm(`确定${action}用户「${user.displayName || user.username}」吗？`);
    if (!confirmed) return;
    updateMutation.mutate({ id: user.id, data: { isActive: !isActive } });
  };

  const handleResetPassword = (user: NavUserExt) => {
    const newPwd = window.prompt(
      `请输入用户「${user.displayName || user.username}」的新密码：`,
      '',
    );
    if (!newPwd) return;
    if (newPwd.length < 6) {
      toast('密码至少 6 位');
      return;
    }
    updateMutation.mutate({ id: user.id, data: { password: newPwd } });
  };

  const handleDelete = async (user: NavUserExt) => {
    const confirmed = await showConfirm(`确定删除用户「${user.displayName || user.username}」吗？此操作不可恢复。`);
    if (!confirmed) return;
    deleteMutation.mutate(user.id);
  };

  const handleAddSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddError('');

    if (!addForm.username.trim()) {
      setAddError('请输入用户名');
      return;
    }
    if (!addForm.displayName.trim()) {
      setAddError('请输入显示名');
      return;
    }
    if (!addForm.password || addForm.password.length < 6) {
      setAddError('密码至少 6 位');
      return;
    }

    createMutation.mutate({
      username: addForm.username.trim(),
      password: addForm.password,
      displayName: addForm.displayName.trim(),
    });
  };

  return (
    <div className="space-y-4">
      {/* 添加用户 */}
      <div>
        {!showAdd ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdd(true)}
            className="w-full"
          >
            <UserPlus className="w-4 h-4" />
            添加新用户
          </Button>
        ) : (
          <form
            onSubmit={handleAddSubmit}
            className="glass-card p-4 space-y-3 rounded-lg"
          >
            <h4 className="text-sm font-medium text-foreground">添加新用户</h4>
            <Input
              type="text"
              placeholder="用户名"
              value={addForm.username}
              onChange={(e) =>
                setAddForm({ ...addForm, username: e.target.value })
              }
              className="bg-input/50 border-border text-sm"
            />
            <Input
              type="text"
              placeholder="显示名"
              value={addForm.displayName}
              onChange={(e) =>
                setAddForm({ ...addForm, displayName: e.target.value })
              }
              className="bg-input/50 border-border text-sm"
            />
            <Input
              type="password"
              placeholder="初始密码（至少 6 位）"
              value={addForm.password}
              onChange={(e) =>
                setAddForm({ ...addForm, password: e.target.value })
              }
              className="bg-input/50 border-border text-sm"
            />
            {addError && (
              <p className="text-destructive text-xs">{addError}</p>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                className="flex-1"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? '创建中...' : '创建'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAdd(false);
                  setAddError('');
                  setAddForm({ username: '', displayName: '', password: '' });
                }}
                disabled={createMutation.isPending}
              >
                取消
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* 用户列表 */}
      <div className="space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            加载中...
          </p>
        )}
        {!isLoading && users.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            暂无用户
          </p>
        )}
        {users.map((user) => {
          const isActive = user.isActive !== false;
          const isAdmin = user.role === 'admin';
          return (
            <div
              key={user.id}
              className={cn(
                'glass-card rounded-lg p-3 flex items-center gap-3',
                !isActive && 'opacity-60',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {user.displayName || user.username}
                  </span>
                  {isAdmin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                      管理员
                    </span>
                  )}
                  {!isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-medium">
                      已禁用
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  @{user.username}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="w-7 h-7"
                  onClick={() => handleResetPassword(user)}
                  title="重置密码"
                  aria-label={`重置 ${user.username} 的密码`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    'w-7 h-7',
                    isAdmin
                      ? 'text-primary border-primary/30'
                      : 'text-muted-foreground',
                  )}
                  onClick={() => handleToggleRole(user)}
                  title={isAdmin ? '取消管理员' : '设为管理员'}
                  aria-label={`切换 ${user.username} 的管理员角色`}
                >
                  {isAdmin ? (
                    <ShieldOff className="w-3.5 h-3.5" />
                  ) : (
                    <Shield className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    'w-7 h-7',
                    !isActive && 'text-destructive border-destructive/30',
                  )}
                  onClick={() => handleToggleActive(user)}
                  title={isActive ? '禁用用户' : '启用用户'}
                  aria-label={`切换 ${user.username} 的启用状态`}
                >
                  {isActive ? (
                    <Power className="w-3.5 h-3.5" />
                  ) : (
                    <PowerOff className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-7 h-7 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => handleDelete(user)}
                  title="删除用户"
                  aria-label={`删除用户 ${user.username}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
