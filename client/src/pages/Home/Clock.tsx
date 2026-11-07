import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPublicSettings } from '@client/src/api/settings';
import WeatherDisplay from './WeatherDisplay';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const Clock = () => {
  const { data } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });

  const clock24h = data?.settings?.clock24h ?? true;
  const showSeconds = data?.settings?.showSeconds ?? true;

  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date): string => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    if (!clock24h) {
      hours = hours % 12;
      if (hours === 0) hours = 12;
    }

    const hourStr = hours.toString().padStart(2, '0');
    return showSeconds ? `${hourStr}:${minutes}:${seconds}` : `${hourStr}:${minutes}`;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const weekday = WEEKDAYS[date.getDay()];
    return `${year}年${month}月${day}日 ${weekday}`;
  };

  return (
    <div className="text-center select-none">
      <div
        className="font-mono tnum text-white font-semibold tracking-tight rise"
        style={{
          fontSize: 'clamp(2.5rem, 10vw, 4.5rem)',
          textShadow: '0 2px 20px hsl(0 0% 0% / 0.5)',
          animationDelay: '0.1s',
        }}
      >
        {formatTime(now)}
      </div>
      <div
        className="mt-2 text-white/70 text-sm md:text-base rise"
        style={{ animationDelay: '0.2s' }}
      >
        {formatDate(now)}
      </div>
      <WeatherDisplay />
    </div>
  );
};

export default Clock;
