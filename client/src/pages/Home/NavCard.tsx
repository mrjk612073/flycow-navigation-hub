import { useMemo, type MouseEvent } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { NavCard as NavCardType } from '@shared/api.interface';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { Image } from '@client/src/components/ui/image';
import { useNetworkEnv } from '@client/src/hooks/useNetworkEnv';
import { useQuery } from '@tanstack/react-query';
import { getPublicSettings } from '@client/src/api/settings';

interface NavCardProps {
  card: NavCardType;
  delay?: number;
}

const NavCardComponent = ({ card, delay = 0 }: NavCardProps) => {
  const { data: settingsData } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });

  const natEnabled = settingsData?.settings?.natEnabled ?? false;
  const natIntranetPrefix = settingsData?.settings?.natIntranetPrefix ?? '';

  const { env } = useNetworkEnv(natEnabled, natIntranetPrefix);

  // 选择当前环境对应的 URL
  const activeUrl = useMemo(() => {
    if (card.intranetUrl && card.extranetUrl) {
      return env === 'intranet' ? card.intranetUrl : card.extranetUrl;
    }
    return card.url;
  }, [card.url, card.intranetUrl, card.extranetUrl, env]);

  const hasDualUrl = !!(card.intranetUrl && card.extranetUrl);

  const renderIcon = () => {
    if (card.iconType === 'image' && card.icon) {
      return (
        <Image
          src={card.icon}
          alt={card.name}
          className="w-8 h-8 rounded-md object-cover"
        />
      );
    }

    if (card.iconType === 'favicon' && activeUrl) {
      try {
        const url = new URL(activeUrl);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
        return (
          <Image
            src={faviconUrl}
            alt={card.name}
            className="w-8 h-8 rounded-md object-cover"
          />
        );
      } catch (e) {
        logger.warn('解析 favicon URL 失败', e);
      }
    }

    // 默认：emoji
    return (
      <span
        className="text-[32px] leading-none block"
        style={{ fontVariantEmoji: 'emoji' }}
      >
        {card.icon || '🔗'}
      </span>
    );
  };

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!activeUrl) {
      e.preventDefault();
    }
  };

  return (
    <UniversalLink
      to={activeUrl || '#'}
      target={activeUrl ? '_blank' : undefined}
      rel={activeUrl ? 'noopener noreferrer' : undefined}
      onClick={handleClick}
      className="glass-card relative flex flex-col items-center justify-center gap-2 aspect-square cursor-pointer no-underline rise group"
      style={{ animationDelay: `${delay}ms` }}
      aria-label={card.name}
      title={hasDualUrl ? `${env === 'intranet' ? '内网' : '外网'}：${activeUrl}` : undefined}
    >
      {hasDualUrl && (
        <span
          className="absolute top-1.5 right-1.5 text-[9px] px-1 py-0.5 rounded bg-white/10 text-white/50 group-hover:text-white/80 transition-colors"
          title={`${env === 'intranet' ? '内网地址' : '外网地址'}：${activeUrl}`}
        >
          {env === 'intranet' ? '内' : '外'}
        </span>
      )}
      <div className="flex items-center justify-center w-8 h-8">
        {renderIcon()}
      </div>
      <span className="text-white text-xs text-center leading-tight px-1 line-clamp-2">
        {card.name}
      </span>
    </UniversalLink>
  );
};

export default NavCardComponent;
