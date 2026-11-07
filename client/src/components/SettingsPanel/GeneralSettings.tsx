import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { HardDrive, Download, Upload } from 'lucide-react';
import { Separator } from '@client/src/components/ui/separator';
import { Switch } from '@client/src/components/ui/switch';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@client/src/components/ui/form';
import {
  getPublicSettings,
  updateSettings,
  changePassword,
  exportData,
  importData,
  getStorageInfo,
} from '@client/src/api/settings';
import type { AppSettings, StorageInfo } from '@shared/api.interface';

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, '请输入旧密码'),
    newPassword: z.string().min(6, '新密码至少 6 位'),
    confirmPassword: z.string().min(1, '请确认新密码'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '两次输入的新密码不一致',
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function GeneralSettings() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Partial<AppSettings>>({});
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('merge');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
  });

  const { data: storageInfo } = useQuery<StorageInfo>({
    queryKey: ['storageInfo'],
    queryFn: getStorageInfo,
  });

  const settings: AppSettings = {
    ...settingsData?.settings,
    ...localSettings,
  } as AppSettings;

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => updateSettings(patch),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicSettings'] });
      toast.success('设置已保存');
    },
    onError: (error: Error) => {
      logger.error('更新设置失败', error);
      toast.error('保存失败，请重试');
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordFormValues) =>
      changePassword(values.oldPassword, values.newPassword),
    retry: false,
    onSuccess: () => {
      toast.success('密码修改成功');
      passwordForm.reset();
    },
    onError: (error: Error) => {
      logger.error('修改密码失败', error);
      const msg = (error as { response?: { data?: { error?: { message?: string } } } })
        .response?.data?.error?.message || '修改失败，请检查旧密码是否正确';
      toast.error(msg);
    },
  });

  const handleToggle = (key: keyof AppSettings, value: boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    updateMutation.mutate({ [key]: value } as Partial<AppSettings>);
  };

  const handleSearchEngine = (value: string) => {
    setLocalSettings((prev) => ({ ...prev, searchEngine: value }));
    updateMutation.mutate({ searchEngine: value });
  };

  const handlePasswordSubmit = (values: PasswordFormValues) => {
    passwordMutation.mutate(values);
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 数据存储 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <HardDrive className="w-4 h-4" />
          数据存储
        </h3>
        <div className="space-y-3">
          <div className="glass-card rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">存储位置</span>
              <span className="text-xs text-foreground font-mono truncate max-w-[200px]" title={storageInfo?.dbPath}>
                {storageInfo?.dbPath || '加载中...'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">数据库大小</span>
              <span className="text-xs text-foreground">
                {storageInfo ? `${(storageInfo.dbSize / 1024).toFixed(1)} KB` : '-'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t border-white/10">
              数据保存在本地 SQLite 数据库文件中，支持直接备份和迁移该文件。
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await exportData();
                  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `compass-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('配置已导出');
                } catch (error) {
                  logger.error('导出失败', error);
                  toast.error('导出失败');
                }
              }}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              导出备份
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              导入配置
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const parsed = JSON.parse(String(reader.result));
                    importData({ mode: importMode, data: parsed })
                      .then(() => {
                        queryClient.clear();
                        toast.success('配置已导入');
                        window.location.reload();
                      })
                      .catch((err) => {
                        logger.error('导入失败', err);
                        toast.error('导入失败，请检查文件格式');
                      });
                  } catch {
                    toast.error('文件格式不正确');
                  }
                };
                reader.readAsText(file);
              }}
            />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground">导入模式：</span>
            <Select
              value={importMode}
              onValueChange={(v) => setImportMode(v as 'overwrite' | 'merge')}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="merge">合并导入</SelectItem>
                <SelectItem value="overwrite">覆盖导入</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* 搜索设置 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">搜索设置</h3>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">默认搜索引擎</label>
          <Select
            value={settings.searchEngine}
            onValueChange={handleSearchEngine}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择搜索引擎" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baidu">百度</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="bing">Bing</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* 时钟设置 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">时钟设置</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">24 小时制</p>
              <p className="text-xs text-muted-foreground">
                关闭则使用 12 小时制（AM/PM）
              </p>
            </div>
            <Switch
              checked={settings.clock24h}
              onCheckedChange={(checked) => handleToggle('clock24h', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">显示秒数</p>
              <p className="text-xs text-muted-foreground">
                时钟显示秒针
              </p>
            </div>
            <Switch
              checked={settings.showSeconds}
              onCheckedChange={(checked) => handleToggle('showSeconds', checked)}
            />
          </div>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* 内外网设置 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">内外网自动切换</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">启用内外网切换</p>
              <p className="text-xs text-muted-foreground">
                根据访问环境自动选择卡片的内网/外网地址
              </p>
            </div>
            <Switch
              checked={settings.natEnabled}
              onCheckedChange={(checked) => handleToggle('natEnabled', checked)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">内网地址前缀</label>
            <Input
              value={settings.natIntranetPrefix}
              onChange={(e) => {
                setLocalSettings((prev) => ({
                  ...prev,
                  natIntranetPrefix: e.target.value,
                }));
              }}
              onBlur={() => {
                if (localSettings.natIntranetPrefix !== undefined) {
                  updateMutation.mutate({
                    natIntranetPrefix: localSettings.natIntranetPrefix,
                  });
                }
              }}
              disabled={!settings.natEnabled}
              placeholder="intranet. 或 192.168."
            />
            <p className="text-xs text-muted-foreground">
              当 hostname 包含此前缀时判定为内网环境
            </p>
          </div>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* 修改密码 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">修改密码</h3>
        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
            className="space-y-3"
          >
            <FormField
              control={passwordForm.control}
              name="oldPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">旧密码</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="输入旧密码" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">新密码</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="至少 6 位" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">确认新密码</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="再次输入新密码" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="sm"
              disabled={passwordMutation.isPending}
              className="w-full"
            >
              修改密码
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
