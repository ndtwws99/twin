import { useMemo, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Avatar } from './Avatar';
import { formatTime, isGuestUser } from '../lib/firebase';
import type { TwinNotification, TwinUser } from '../types';

interface NotificationsViewProps {
  currentUser: TwinUser | null;
  notifications: TwinNotification[];
  onOpenNotification: (n: TwinNotification) => void;
  onMarkAllRead: () => void;
  onOpenAuth: () => void;
}

export function NotificationsView({
  currentUser,
  notifications,
  onOpenNotification,
  onMarkAllRead,
  onOpenAuth,
}: NotificationsViewProps) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const guest = isGuestUser(currentUser);

  const visibleNotifs = useMemo(() => {
    const base = notifications.filter((n) => n.type !== 'message');
    return filter === 'unread' ? base.filter((n) => !n.read) : base;
  }, [notifications, filter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.type !== 'message' && !n.read).length,
    [notifications]
  );

  if (guest) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-8">
          <Bell className="w-10 h-10 text-[#0084FF] mx-auto" />
          <h2 className="mt-3 text-lg font-bold text-[#0F1419] dark:text-white">Thông báo</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Đăng nhập tài khoản để nhận thông báo lượt thích, bình luận và lời mời kết bạn theo thời gian thực.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-5 h-10 px-6 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-sm font-semibold transition-colors"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[680px] mx-auto px-3 sm:px-5 pt-4 pb-20 md:pb-10">
      <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#EEF0F4] dark:border-[#232B3A] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#0F1419] dark:text-white">Thông báo</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 rounded-xl bg-[#F2F4F7] dark:bg-[#1D2432]">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  filter === 'all'
                    ? 'bg-white dark:bg-[#131822] text-[#0F1419] dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  filter === 'unread'
                    ? 'bg-white dark:bg-[#131822] text-[#0F1419] dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Chưa đọc
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="h-9 px-3 rounded-xl hover:bg-[#0084FF]/10 text-xs font-semibold text-[#0084FF] inline-flex items-center gap-1.5 transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Đánh dấu đã đọc</span>
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-[#F2F4F7] dark:divide-[#1D2432]">
          {visibleNotifs.length === 0 ? (
            <div className="py-16 text-center px-6">
              <Bell className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                {filter === 'unread' ? 'Không có thông báo chưa đọc.' : 'Chưa có thông báo nào.'}
              </p>
            </div>
          ) : (
            visibleNotifs.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onOpenNotification(n)}
                className={`w-full px-4 py-3.5 flex items-start gap-3 text-left hover:bg-[#F8F9FB] dark:hover:bg-[#1A2130] transition-colors ${
                  !n.read ? 'bg-[#0084FF]/[0.05] dark:bg-[#0084FF]/[0.08]' : ''
                }`}
              >
                <Avatar src={n.fromAvatar} name={n.fromName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-[#0F1419] dark:text-slate-100">
                    <span className="font-bold">{n.fromName || 'Thành viên Twin'}</span> {n.text}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatTime(n.createdAtMs || n.createdAt)}
                    {!n.read && ' · Chưa đọc'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
