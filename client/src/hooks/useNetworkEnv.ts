import { useState, useEffect } from 'react';

export type NetworkEnv = 'intranet' | 'extranet';

const STORAGE_KEY = 'compass_network_override';

/**
 * 判断 hostname 是否属于内网环境
 */
function isIntranetHostname(hostname: string, intranetPrefix: string): boolean {
  // localhost / 127.x.x.x
  if (hostname === 'localhost' || /^127\.\d+\.\d+\.\d+$/.test(hostname)) {
    return true;
  }
  // 192.168.x.x
  if (/^192\.168\.\d+\.\d+$/.test(hostname)) {
    return true;
  }
  // 10.x.x.x
  if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) {
    return true;
  }
  // 172.16.x.x ~ 172.31.x.x
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)) {
    return true;
  }
  // 从设置读取的内网前缀
  if (intranetPrefix && hostname.includes(intranetPrefix)) {
    return true;
  }
  return false;
}

export interface UseNetworkEnvResult {
  env: NetworkEnv;
  manualOverride: NetworkEnv | null;
  setManualOverride: (env: NetworkEnv | null) => void;
}

/**
 * 内外网环境检测 Hook
 * - 自动根据 hostname 判断内网/外网
 * - 支持手动强制切换（localStorage 持久化）
 * - 支持内网前缀配置辅助判断
 */
export function useNetworkEnv(
  natEnabled: boolean,
  natIntranetPrefix: string,
): UseNetworkEnvResult {
  const [manualOverride, setManualOverrideState] = useState<NetworkEnv | null>(null);
  const [autoEnv, setAutoEnv] = useState<NetworkEnv>('extranet');

  // 从 localStorage 读取手动覆盖设置
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'intranet' || stored === 'extranet') {
      setManualOverrideState(stored as NetworkEnv);
    }
  }, []);

  // 自动检测
  useEffect(() => {
    if (!natEnabled) {
      setAutoEnv('extranet');
      return;
    }
    const hostname = window.location.hostname;
    const isIntra = isIntranetHostname(hostname, natIntranetPrefix);
    setAutoEnv(isIntra ? 'intranet' : 'extranet');
  }, [natEnabled, natIntranetPrefix]);

  const setManualOverride = (env: NetworkEnv | null) => {
    setManualOverrideState(env);
    if (env) {
      localStorage.setItem(STORAGE_KEY, env);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return {
    env: manualOverride ?? autoEnv,
    manualOverride,
    setManualOverride,
  };
}
