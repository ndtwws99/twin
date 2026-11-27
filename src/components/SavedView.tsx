import { useMemo } from 'react';
import { Bookmark, Clapperboard } from 'lucide-react';
import { PostCard } from './PostCard';
import { isGuestUser } from '../lib/firebase';
import type { TwinPost, TwinStory, TwinUser } from '../types';

interface SavedViewProps {
  currentUser: TwinUser | null;
  userMap: Record<string, TwinUser>;
  posts: TwinPost[];
  reels: TwinStory[];
  onOpenProfile: (uid: string) => void;
  onOpenLightbox: (images: string[], index: number) => void;
  onOpenReel: (reelId: string) => void;
  onOpenAuth: () => void;
  onToast: (msg: string) => void;
}

export function SavedView({
  currentUser,
  userMap,
  posts,
  reels,
  onOpenProfile,
  onOpenLightbox,
  onOpenReel,
  onOpenAuth,
  onToast,
}: SavedViewProps) {
  const guest = isGuestUser(currentUser);

  const savedPosts = useMemo(() => {
    if (!currentUser || guest) return [];
    return posts.filter((p) => Array.isArray(p.savedBy) && p.savedBy.includes(currentUser.uid));
  }, [posts, currentUser, guest]);

  const savedReels = useMemo(() => {
    if (!currentUser || guest) return [];
    return reels.filter((r) => Array.isArray(r.savedBy) && r.savedBy.includes(currentUser.uid));
  }, [reels, currentUser, guest]);

  if (guest) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-8">
          <Bookmark className="w-10 h-10 text-[#0084FF] mx-auto" />
          <h2 className="mt-3 text-lg font-bold text-[#0F1419] dark:text-white">Mục đã lưu</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Đăng nhập tài khoản để xem lại bài viết và Reels bạn đã lưu.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-5 h-10 px-6 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-sm font-semibold"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[660px] mx-auto px-3 sm:px-5 pt-4 pb-20 md:pb-10 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F1419] dark:text-white">Đã lưu</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
          {savedPosts.length} bài viết · {savedReels.length} Reels
        </p>
      </div>

      {savedReels.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-bold text-[#0F1419] dark:text-white">Reels đã lưu</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {savedReels.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpenReel(r.id)}
                className="relative aspect-[9/14] rounded-2xl overflow-hidden bg-slate-900 text-left group"
              >
                {r.videoPoster ? (
                  <img
                    src={r.videoPoster}
                    alt={r.caption || r.authorName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Clapperboard className="w-8 h-8 text-white/50" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-xs font-bold text-white truncate">{r.authorName}</p>
                  {r.caption && <p className="text-[11px] text-white/80 truncate">{r.caption}</p>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        {savedPosts.length === 0 && savedReels.length === 0 ? (
          <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-12 text-center">
            <Bookmark className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Bạn chưa lưu bài viết hoặc Reels nào.
            </p>
          </div>
        ) : (
          savedPosts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              currentUser={currentUser}
              authorUser={userMap[p.authorUid]}
              onOpenProfile={onOpenProfile}
              onOpenLightbox={onOpenLightbox}
              onOpenAuth={onOpenAuth}
              onToast={onToast}
            />
          ))
        )}
      </section>
    </div>
  );
}
