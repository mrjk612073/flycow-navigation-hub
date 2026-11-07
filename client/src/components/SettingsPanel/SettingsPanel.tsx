import { useState, useEffect, type FormEvent } from 'react';
import { X, Lock, LogOut, User, UserCog } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Sheet, SheetContent, SheetTitle, SheetClose } from '@client/src/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@client/src/components/ui/tabs';
import { ScrollArea } from '@client/src/components/ui/scroll-area';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import CardManager from './CardManager';
import WallpaperManager from './WallpaperManager';
import GeneralSettings from './GeneralSettings';
import WeatherSettings from './WeatherSettings';
import AuthPanel from './AuthPanel';
import UserManagement from './UserManagement';
import { verifyPassword, setEditToken } from '@client/src/api/settings';
import {
  getCachedUser,
  setCachedUser,
  getAuthToken,
  getMe,
  logout as authLogout,
  type NavUserExt,
} from '@client/src/api/auth';
import { cn } from '@/lib/utils';
import { showConfirm } from '@lark-apaas/client-toolkit';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditMode?: boolean;
  onEditSuccess?: () => void;
  initialTab?: string;
}

type EntryMode = 'auth' | 'password';

export default function SettingsPanel({
  open,
  onOpenChange,
  isEditMode = false,
  onEditSuccess,
  initialTab = 'cards',
}: SettingsPanelProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<string>('cards');
  const [password, setPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [localEditMode, setLocalEditMode] = useState(isEditMode);
  const [entryMode, setEntryMode] = useState<EntryMode>('auth');
  const [cachedUser, setLocalCachedUser] = useState<NavUserExt | null>(
    getCachedUser(),
  );

  // 打开面板时同步初始 tab
  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const hasValidToken = !!getAuthToken();

  const { data: meData, error: meError } = useQuery({
    queryKey: ['authMe'],
    queryFn: getMe,
    enabled: !!cachedUser && hasValidToken,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (meData && meData.user === null && cachedUser) {
      authLogout();
      setLocalCachedUser(null);
    }
    if (meError && (meError as any)?.response?.status === 401) {
      authLogout();
      setLocalCachedUser(null);
    }
  }, [meData, meError, cachedUser]);

  const currentUser: NavUserExt | null =
    meData?.user ?? cachedUser ?? null;

  const isLoggedIn = currentUser !== null;
  const isAdmin = currentUser?.role === 'admin';
  const hasEditAccess = isLoggedIn || localEditMode;

  // 构建动态 Tab 列表
  const getTabItems = () => {
    const items = [
      { value: 'cards', label: '卡片管理' },
      { value: 'wallpaper', label: '壁纸管理' },
      { value: 'weather', label: '天气' },
      { value: 'general', label: '通用设置' },
    ];
    if (isLoggedIn) {
      items.push({ value: 'account', label: '账号' });
    }
    if (isAdmin) {
      items.push({ value: 'users', label: '用户管理' });
    }
    return items;
  };

  const tabItems = getTabItems();

  useEffect(() => {
    setLocalEditMode(isEditMode);
  }, [isEditMode]);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setPwdError('');
    }
  }, [open]);

  // 登录成功回调
  const handleAuthSuccess = (user: NavUserExt) => {
    setLocalCachedUser(user);
    setCachedUser(user);
    setActiveTab('cards');
    onEditSuccess?.();
    logger.info('用户登录成功', user.username);
  };

  // 退出登录
  const handleLogout = async () => {
    const confirmed = await showConfirm('确定要退出登录吗？');
    if (!confirmed) return;
    authLogout();
    setLocalCachedUser(null);
    queryClient.removeQueries({ queryKey: ['authMe'] });
    queryClient.removeQueries({ queryKey: ['authUsers'] });
    logger.info('用户已退出登录');
  };

  const verifyMutation = useMutation({
    mutationFn: (pwd: string) => verifyPassword(pwd),
    onSuccess: (res) => {
      if (res.success && res.token) {
        setEditToken(res.token);
        setLocalEditMode(true);
        setPwdError('');
        setPassword('');
        onEditSuccess?.();
        logger.info('编辑模式已开启');
      } else {
        setPwdError('密码错误，请重试');
      }
    },
    onError: (err) => {
      logger.error('验证密码失败', err);
      setPwdError('验证失败，请稍后重试');
    },
    retry: false,
  });

  const handlePwdSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!password.trim()) {
      setPwdError('请输入密码');
      return;
    }
    setPwdError('');
    verifyMutation.mutate(password);
  };

  const switchEntryMode = () => {
    setEntryMode(entryMode === 'auth' ? 'password' : 'auth');
    setPwdError('');
    setPassword('');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 !max-w-none gap-0',
          isMobile
            ? 'w-full h-[85vh] rounded-t-2xl border-t'
            : 'w-full sm:w-[480px] border-l',
          'bg-[hsl(220_25%_12%_/_0.85)] backdrop-blur-2xl',
          'border-white/10',
          '[&>button[data-slot=sheet-close]]:hidden',
        )}
      >
        <SheetTitle className="sr-only">设置</SheetTitle>
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-lg font-semibold text-foreground font-display">
            设置
          </h2>
          <SheetClose asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors rounded-md p-1 hover:bg-white/5"
              aria-label="关闭设置"
            >
              <X className="w-5 h-5" />
            </button>
          </SheetClose>
        </div>

        {!hasEditAccess ? (
          <div className="flex-1 min-h-0 overflow-auto">
            {entryMode === 'auth' ? (
              <>
                <AuthPanel onSuccess={handleAuthSuccess} />
                <div className="text-center pb-8">
                  <button
                    type="button"
                    onClick={switchEntryMode}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    使用编辑密码进入（公共数据）
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center justify-center h-[calc(100%-65px)] px-8">
                  <div className="w-16 h-16 rounded-full glass-card flex items-center justify-center mb-6">
                    <Lock className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2 font-display">
                    进入编辑模式
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-6">
                    请输入编辑密码以修改公共导航卡片、壁纸和设置
                  </p>
                  <form
                    onSubmit={handlePwdSubmit}
                    className="w-full space-y-3"
                  >
                    <Input
                      type="password"
                      placeholder="请输入编辑密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                      autoFocus
                    />
                    {pwdError && (
                      <p className="text-destructive text-sm">{pwdError}</p>
                    )}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={verifyMutation.isPending}
                    >
                      {verifyMutation.isPending ? '验证中...' : '确认'}
                    </Button>
                  </form>
                  <p className="text-xs text-muted-foreground mt-6">
                    默认密码：admin123
                  </p>
                </div>
                <div className="text-center pb-8">
                  <button
                    type="button"
                    onClick={switchEntryMode}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    使用账号登录
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v)}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="px-6 pt-4 border-b border-white/10">
              <TabsList className="bg-transparent p-0 h-auto gap-6 w-full">
                {tabItems.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      'relative bg-transparent border-0 rounded-none px-0 py-3',
                      'text-sm text-muted-foreground hover:text-foreground',
                      'data-[state=active]:text-primary data-[state=active]:font-medium',
                      'data-[state=active]:shadow-none data-[state=active]:bg-transparent',
                      'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5',
                      'after:bg-primary after:scale-x-0 after:origin-center after:transition-transform',
                      'data-[state=active]:after:scale-x-100',
                    )}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className={cn('px-6 py-5', isMobile && 'pb-10')}>
                <TabsContent value="cards" className="mt-0">
                  <CardManager />
                </TabsContent>
                <TabsContent value="wallpaper" className="mt-0">
                  <WallpaperManager />
                </TabsContent>
                <TabsContent value="weather" className="mt-0">
                  <WeatherSettings />
                </TabsContent>
                <TabsContent value="general" className="mt-0">
                  <GeneralSettings />
                </TabsContent>
                {isLoggedIn && (
                  <TabsContent value="account" className="mt-0">
                    <div className="space-y-4">
                      <div className="glass-card rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <div className="text-foreground font-medium">
                              {currentUser?.displayName ||
                                currentUser?.username}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              @{currentUser?.username}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <UserCog className="w-3.5 h-3.5" />
                          <span>
                            角色：
                            {currentUser?.role === 'admin'
                              ? '管理员'
                              : '普通用户'}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4" />
                        退出登录
                      </Button>

                      {localEditMode && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          当前同时处于公共数据编辑模式
                        </p>
                      )}
                    </div>
                  </TabsContent>
                )}
                {isAdmin && (
                  <TabsContent value="users" className="mt-0">
                    <UserManagement />
                  </TabsContent>
                )}
              </div>
            </ScrollArea>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
