import { useState } from 'react';
import { DEFAULT_AVATAR } from '../lib/config';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-24 h-24 text-2xl',
};

const DOT_MAP: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-2 h-2 right-0 bottom-0',
  sm: 'w-2.5 h-2.5 right-0 bottom-0',
  md: 'w-2.5 h-2.5 right-0 bottom-0',
  lg: 'w-3 h-3 right-0.5 bottom-0.5',
  xl: 'w-4 h-4 right-1 bottom-1',
};

export function Avatar({ src, name = 'Twin', size = 'md', online = false, className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = (name || 'T').trim().charAt(0).toUpperCase();
  const validSrc = src && src !== DEFAULT_AVATAR && !failed ? src : '';

  return (
    <span className={`relative inline-flex shrink-0 ${SIZE_MAP[size]} ${className}`}>
      {validSrc ? (
        <img
          src={validSrc}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full rounded-full object-cover bg-slate-200 dark:bg-slate-800 border border-black/5 dark:border-white/10"
        />
      ) : (
        <span
          aria-label={name}
          className="w-full h-full rounded-full bg-[#E8EEF5] dark:bg-[#1E293B] text-[#1E3A5F] dark:text-[#CBD5E1] font-bold flex items-center justify-center border border-black/5 dark:border-white/10"
        >
          {initial}
        </span>
      )}
      {online && (
        <span
          aria-label="Đang hoạt động"
          className={`absolute rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#131822] ${DOT_MAP[size]}`}
        />
      )}
    </span>
  );
}
