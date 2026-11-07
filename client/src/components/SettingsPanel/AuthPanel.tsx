import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { LogIn, UserPlus } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { login, register, type NavUserExt } from '@client/src/api/auth';
import { cn } from '@/lib/utils';

interface AuthPanelProps {
  onSuccess: (user: NavUserExt) => void;
}

type AuthMode = 'login' | 'register';

export default function AuthPanel({ onSuccess }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: ({ u, p }: { u: string; p: string }) => login(u, p),
    onSuccess: (res) => {
      if (res.user && res.token) {
        onSuccess(res.user);
        logger.info('登录成功', res.user.username);
      }
    },
    onError: (err) => {
      logger.error('登录失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? '登录失败，请稍后重试';
      setError(msg);
    },
    retry: false,
  });

  const registerMutation = useMutation({
    mutationFn: ({
      u,
      p,
      d,
    }: {
      u: string;
      p: string;
      d: string;
    }) => register(u, p, d),
    onSuccess: (res) => {
      if (res.user && res.token) {
        onSuccess(res.user);
        logger.info('注册成功', res.user.username);
      }
    },
    onError: (err) => {
      logger.error('注册失败', err);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? '注册失败，请稍后重试';
      setError(msg);
    },
    retry: false,
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }

    if (mode === 'register') {
      if (!displayName.trim()) {
        setError('请输入显示名');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
      registerMutation.mutate({
        u: username.trim(),
        p: password,
        d: displayName.trim(),
      });
    } else {
      loginMutation.mutate({ u: username.trim(), p: password });
    }
  };

  const switchMode = () => {
    setError('');
    setConfirmPassword('');
    setDisplayName('');
    setMode(mode === 'login' ? 'register' : 'login');
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;
  const isLogin = mode === 'login';

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <div className="w-16 h-16 rounded-full glass-card flex items-center justify-center mb-6">
        {isLogin ? (
          <LogIn className="w-7 h-7 text-primary" />
        ) : (
          <UserPlus className="w-7 h-7 text-primary" />
        )}
      </div>

      <h3 className="text-xl font-semibold text-foreground mb-2 font-display">
        {isLogin ? '登录账号' : '创建账号'}
      </h3>
      <p className="text-sm text-muted-foreground text-center mb-6">
        {isLogin
          ? '登录后可同步和管理你的导航数据'
          : '注册账号，拥有属于你的专属导航页'}
      </p>

      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <Input
          type="text"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={cn(
            'bg-input border-border text-foreground placeholder:text-muted-foreground',
          )}
          autoFocus
          disabled={isPending}
        />

        {!isLogin && (
          <Input
            type="text"
            placeholder="显示名"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            disabled={isPending}
          />
        )}

        <Input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-input border-border text-foreground placeholder:text-muted-foreground"
          disabled={isPending}
        />

        {!isLogin && (
          <Input
            type="password"
            placeholder="确认密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            disabled={isPending}
          />
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending
            ? isLogin
              ? '登录中...'
              : '注册中...'
            : isLogin
              ? '登录'
              : '注册'}
        </Button>
      </form>

      <div className="mt-6 text-sm text-muted-foreground">
        {isLogin ? '还没有账号？' : '已有账号？'}
        <button
          type="button"
          onClick={switchMode}
          className="text-primary hover:text-primary/80 ml-1 font-medium transition-colors"
          disabled={isPending}
        >
          {isLogin ? '去注册' : '去登录'}
        </button>
      </div>
    </div>
  );
}
