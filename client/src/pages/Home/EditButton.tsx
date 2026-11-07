import { useState, type FormEvent } from 'react';
import { Settings } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import { verifyPassword, setEditToken, clearEditToken } from '@client/src/api/settings';

interface EditButtonProps {
  isEditMode: boolean;
  onEditModeChange: (value: boolean) => void;
}

const EditButton = ({ isEditMode, onEditModeChange }: EditButtonProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const verifyMutation = useMutation({
    mutationFn: (pwd: string) => verifyPassword(pwd),
    onSuccess: (res) => {
      if (res.success && res.token) {
        setEditToken(res.token);
        onEditModeChange(true);
        setDialogOpen(false);
        setPassword('');
        setError('');
        logger.info('编辑模式已开启');
      } else {
        setError('密码错误，请重试');
      }
    },
    onError: (err) => {
      logger.error('验证密码失败', err);
      setError('验证失败，请稍后重试');
    },
    retry: false,
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }
    setError('');
    verifyMutation.mutate(password);
  };

  const handleExitEdit = () => {
    clearEditToken();
    onEditModeChange(false);
    logger.info('已退出编辑模式');
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setPassword('');
      setError('');
    }
  };

  return (
    <>
      {isEditMode ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleExitEdit}
          className="glass-card !h-9 !px-4 text-white/80 hover:text-white border-primary/40"
        >
          退出编辑
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDialogOpen(true)}
          className="glass-card !w-10 !h-10 text-white/70 hover:text-white"
          aria-label="设置"
        >
          <Settings className="w-5 h-5" />
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md !bg-background/80 backdrop-blur-md border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">进入编辑模式</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="请输入编辑密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
              {error && (
                <p className="text-destructive text-sm">{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? '验证中...' : '确认'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditButton;
