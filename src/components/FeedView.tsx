import { useMemo, useState } from 'react';
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import {
  Bookmark,
  Clapperboard,
  Image as ImageIcon,
  MessageCircle,
  Moon,
  Search,
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { StoriesBar } from './StoriesBar';
import { PostComposer } from './PostComposer';
import { PostCard } from './PostCard';
import {
  db,
  friendlyError,
  getPostImages,
  getUserPresence,
  isGuestUser,
  pushNotification,
} from '../lib/firebase';
import type { NavTab, TwinPost, TwinStory, TwinUser } from '../types';

interface FeedViewProps {
  currentUser: TwinUser | null;
  users: TwinUser[];
  userMap: Record<string, TwinUser>;
  posts: TwinPost[];
  stories: TwinStory[];
  loading: boolean;
  highlightedPostId: string | null;
  darkMode: boolean;
  onToggleTheme: () => void;
  onSelectTab: (tab: NavTab) => void;
  onOpenProfile: (uid: string) => void;
  onStartChat: (peer: TwinUser) => void;
  onOpenLightbox: (images: string[], index: number) => void;
  onOpenAuth: () => void;
  onToast: (msg: string) => void;
}

type FeedFilter = 'all' | 'friends' | 'photos';

export function FeedView({
  currentUser,
  users,
  userMap,
  posts,
  stories,
  loading,
  highlightedPostId,
  darkMode,
  onToggleTheme,
  onSelectTab,
  onOpenProfile,
  onStartChat,
  onOpenLightbox,
  onOpenAuth,
  onToast,
}: FeedViewProps) {
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [contactSearch, setContactSearch] = useState('');
  const [showContactSearch, setShowContactSearch] = useState(false);

  const guest = isGuestUser(currentUser);
  const myFriends = useMemo(
    () => (Array.isArray(currentUser?.friends) ? currentUser.friends : []),
    [currentUser]
  );
  const myRequests = useMemo(
    () => (Array.isArray(currentUser?.friendRequests) ? currentUser.friendRequests : []),
    [currentUser]
  );

  // Post side displays text + photo posts only (videos live in Reels)
  const textAndPhotoPosts = useMemo(
    () => posts.filter((p) => !p.videoUrl),
    [posts]
  );

  const filteredPosts = useMemo(() => {
    if (feedFilter === 'friends') {
      if (!currentUser || guest) return textAndPhotoPosts;
      return textAndPhotoPosts.filter(
        (p) => p.authorUid === currentUser.uid || myFriends.includes(p.authorUid)
      );
    }
    if (feedFilter === 'photos') {
      return textAndPhotoPosts.filter((p) => getPostImages(p).length > 0);
    }
    return textAndPhotoPosts;
  }, [textAndPhotoPosts, feedFilter, currentUser, guest, myFriends]);

  const incomingRequestUsers = useMemo(
    () => myRequests.map((uid) => userMap[uid]).filter(Boolean).slice(0, 2),
    [myRequests, userMap]
  );

  const contacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    return users
      .filter((u) => u.uid !== currentUser?.uid)
      .filter((u) => !q || (u.name || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const aFriend = myFriends.includes(a.uid) ? 1 : 0;
        const bFriend = myFriends.includes(b.uid) ? 1 : 0;
        if (aFriend !== bFriend) return bFriend - aFriend;
        const aOnline = getUserPresence(a).online ? 1 : 0;
        const bOnline = getUserPresence(b).online ? 1 : 0;
        return bOnline - aOnline;
      })
      .slice(0, 14);
  }, [users, currentUser?.uid, myFriends, contactSearch]);

  const suggestedUsers = useMemo(() => {
    if (!currentUser) return [];
    return users
      .filter(
        (u) =>
          u.uid !== currentUser.uid &&
          !myFriends.includes(u.uid) &&
          !myRequests.includes(u.uid)
      )
      .slice(0, 3);
  }, [users, currentUser, myFriends, myRequests]);

  const handleAcceptFriend = async (target: TwinUser) => {
    if (!currentUser || guest) {
      onOpenAuth();
      return;
    }
    try {
      await Promise.all([
        updateDoc(doc(db, 'users', currentUser.uid), {
          friendRequests: arrayRemove(target.uid),
          friends: arrayUnion(target.uid),
        }),
        updateDoc(doc(db, 'users', target.uid), {
          friends: arrayUnion(currentUser.uid),
          friendRequests: arrayRemove(currentUser.uid),
        }),
      ]);
      pushNotification(target.uid, {
        fromUid: currentUser.uid,
        fromName: currentUser.name,
        fromAvatar: currentUser.avatar,
        type: 'friend',
        text: 'đã chấp nhận lời mời kết bạn của bạn.',
      }).catch(() => {});
      onToast(`Đã trở thành bạn bè với ${target.name}.`);
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const handleDeclineFriend = async (target: TwinUser) => {
    if (!currentUser || guest) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        friendRequests: arrayRemove(target.uid),
      });
      onToast('Đã xóa lời mời kết bạn.');
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const handleSendFriendRequest = async (target: TwinUser) => {
    if (!currentUser || guest) {
      onToast('Đăng nhập tài khoản để gửi lời mời kết bạn.');
      onOpenAuth();
      return;
    }
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        friendRequests: arrayUnion(currentUser.uid),
      });
      pushNotification(target.uid, {
        fromUid: currentUser.uid,
        fromName: currentUser.name,
        fromAvatar: currentUser.avatar,
        type: 'friend',
        text: 'đã gửi cho bạn lời mời kết bạn.',
      }).catch(() => {});
      onToast(`Đã gửi lời mời kết bạn tới ${target.name}.`);
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  return (
    <div className="max-w-[1380px] mx-auto px-3 sm:px-5 pt-4 pb-24 md:pb-10 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[268px_minmax(0,600px)_284px] justify-between gap-6 items-start">
      {/* LEFT SIDEBAR (Facebook-style shortcuts in Unified Twin Theme) */}
      <aside className="hidden lg:block sticky top-[72px] space-y-1">
        <button
          type="button"
          onClick={() => {
            if (currentUser && !guest) onOpenProfile(currentUser.uid);
            else onOpenAuth();
          }}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white dark:hover:bg-[#131822] transition-colors text-left"
        >
          <Avatar src={currentUser?.avatar} name={currentUser?.name || 'Khách'} size="sm" />
          <span className="text-sm font-bold text-[#0F1419] dark:text-white truncate">
            {currentUser?.name || 'Khách'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('friends')}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white dark:hover:bg-[#131822] transition-colors text-left"
        >
          <span className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-[#0084FF]/12 text-[#0084FF] flex items-center justify-center shrink-0">
              <Users className="w-[18px] h-[18px]" />
            </span>
            <span className="text-sm font-semibold text-[#0F1419] dark:text-slate-200">Bạn bè</span>
          </span>
          {myRequests.length > 0 && (
            <span className="text-xs font-bold text-[#0084FF] tabular-nums">{myRequests.length}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('reels')}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white dark:hover:bg-[#131822] transition-colors text-left"
        >
          <span className="w-9 h-9 rounded-full bg-rose-500/12 text-rose-500 flex items-center justify-center shrink-0">
            <Clapperboard className="w-[18px] h-[18px]" />
          </span>
          <span className="text-sm font-semibold text-[#0F1419] dark:text-slate-200">Reels</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('messages')}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white dark:hover:bg-[#131822] transition-colors text-left"
        >
          <span className="w-9 h-9 rounded-full bg-sky-500/12 text-sky-500 flex items-center justify-center shrink-0">
            <MessageCircle className="w-[18px] h-[18px]" />
          </span>
          <span className="text-sm font-semibold text-[#0F1419] dark:text-slate-200">Messenger</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('saved')}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white dark:hover:bg-[#131822] transition-colors text-left"
        >
          <span className="w-9 h-9 rounded-full bg-violet-500/12 text-violet-500 flex items-center justify-center shrink-0">
            <Bookmark className="w-[18px] h-[18px]" />
          </span>
          <span className="text-sm font-semibold text-[#0F1419] dark:text-slate-200">Đã lưu</span>
        </button>

        <button
          type="button"
          onClick={() => setFeedFilter(feedFilter === 'photos' ? 'all' : 'photos')}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white dark:hover:bg-[#131822] transition-colors text-left"
        >
          <span className="w-9 h-9 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ImageIcon className="w-[18px] h-[18px]" />
          </span>
          <span className="text-sm font-semibold text-[#0F1419] dark:text-slate-200">Ảnh</span>
        </button>

        <div className="my-2.5 mx-2 h-px bg-[#E5E7EB] dark:bg-[#232B3A]" />

        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white dark:hover:bg-[#131822] transition-colors text-left"
        >
          <span className="w-9 h-9 rounded-full bg-[#E8ECF2] dark:bg-[#1D2432] text-[#0F1419] dark:text-slate-200 flex items-center justify-center shrink-0">
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </span>
          <span className="text-sm font-medium text-[#0F1419] dark:text-slate-200">
            {darkMode ? 'Chế độ sáng' : 'Chế độ tối'}
          </span>
        </button>
      </aside>

      {/* CENTER FEED: Composer -> Stories -> Filter -> Text & Photo Posts */}
      <main className="w-full max-w-[600px] mx-auto space-y-3.5">
        {guest && (
          <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Bạn đang xem với tư cách Khách. Đăng nhập để đăng bài, thả cảm xúc và nhắn tin.
            </p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="h-9 px-4 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              Đăng nhập
            </button>
          </div>
        )}

        <div className="hidden md:block">
          <PostComposer
            currentUser={currentUser}
            onOpenAuth={onOpenAuth}
            onOpenProfile={onOpenProfile}
            onToast={onToast}
          />
        </div>

        <StoriesBar
          stories={stories}
          currentUser={currentUser}
          onOpenAuth={onOpenAuth}
          onOpenProfile={onOpenProfile}
          onToast={onToast}
        />

        <div className="flex items-center gap-1.5 px-0.5">
          {(
            [
              { id: 'all', label: 'Bảng tin' },
              { id: 'friends', label: 'Bạn bè' },
              { id: 'photos', label: 'Có ảnh' },
            ] as { id: FeedFilter; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFeedFilter(item.id)}
              className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                feedFilter === item.id
                  ? 'bg-[#0084FF]/12 text-[#0084FF]'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-[#131822]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-4 animate-pulse space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3.5 w-36 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-2.5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
                <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-10 text-center">
            <p className="text-base font-semibold text-[#0F1419] dark:text-white">
              Không có bài viết nào
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {feedFilter !== 'all'
                ? 'Thử chuyển lại sang Bảng tin để xem tất cả bài viết.'
                : 'Hãy là người đầu tiên chia sẻ bài viết lên Twin.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={currentUser}
                authorUser={userMap[post.authorUid]}
                highlighted={highlightedPostId === post.id}
                onOpenProfile={onOpenProfile}
                onOpenLightbox={onOpenLightbox}
                onOpenAuth={onOpenAuth}
                onToast={onToast}
              />
            ))}
          </div>
        )}
      </main>

      {/* RIGHT SIDEBAR: Friend Requests + People Suggestions + Contacts */}
      <aside className="hidden xl:block sticky top-[72px] space-y-4">
        {incomingRequestUsers.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Lời mời kết bạn
              </h2>
              <button
                type="button"
                onClick={() => onSelectTab('friends')}
                className="text-xs font-semibold text-[#0084FF] hover:underline"
              >
                Xem tất cả
              </button>
            </div>
            <div className="space-y-2">
              {incomingRequestUsers.map((u) => (
                <div
                  key={u.uid}
                  className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-3 flex items-start gap-3"
                >
                  <button type="button" onClick={() => onOpenProfile(u.uid)} className="shrink-0">
                    <Avatar src={u.avatar} name={u.name} size="md" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(u.uid)}
                      className="text-sm font-bold text-[#0F1419] dark:text-white truncate block hover:underline"
                    >
                      {u.name}
                    </button>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAcceptFriend(u)}
                        className="h-8 rounded-lg bg-[#0084FF] hover:bg-[#0073E6] text-white text-xs font-semibold transition-colors"
                      >
                        Xác nhận
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeclineFriend(u)}
                        className="h-8 rounded-lg bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-slate-200 dark:hover:bg-[#263043] text-[#0F1419] dark:text-slate-200 text-xs font-semibold transition-colors"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-px bg-[#E5E7EB] dark:bg-[#232B3A]" />
          </section>
        )}

        {suggestedUsers.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Gợi ý kết bạn
              </h2>
              <button
                type="button"
                onClick={() => onSelectTab('friends')}
                className="text-xs font-semibold text-[#0084FF] hover:underline"
              >
                Tất cả
              </button>
            </div>
            <div className="space-y-1">
              {suggestedUsers.map((u) => {
                const sent = Boolean(
                  currentUser && Array.isArray(u.friendRequests) && u.friendRequests.includes(currentUser.uid)
                );
                return (
                  <div
                    key={u.uid}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl hover:bg-white dark:hover:bg-[#131822] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProfile(u.uid)}
                      className="flex items-center gap-2.5 min-w-0 text-left"
                    >
                      <Avatar src={u.avatar} name={u.name} size="sm" />
                      <span className="text-sm font-semibold text-[#0F1419] dark:text-white truncate">
                        {u.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={sent}
                      onClick={() => handleSendFriendRequest(u)}
                      className="h-8 px-2.5 rounded-lg bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-[#0084FF] hover:text-white disabled:opacity-50 text-xs font-semibold text-[#0F1419] dark:text-slate-200 inline-flex items-center gap-1 transition-colors shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{sent ? 'Đã gửi' : 'Thêm'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="h-px bg-[#E5E7EB] dark:bg-[#232B3A]" />
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Người liên hệ
            </h2>
            <button
              type="button"
              onClick={() => setShowContactSearch((s) => !s)}
              aria-label="Tìm người liên hệ"
              className="w-8 h-8 rounded-full hover:bg-white dark:hover:bg-[#131822] flex items-center justify-center text-slate-500"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {showContactSearch && (
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Tìm tên bạn bè..."
              className="w-full h-9 px-3 rounded-full bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] text-xs focus:outline-none focus:border-[#0084FF]"
            />
          )}

          <div className="space-y-0.5">
            {contacts.map((u) => {
              const presence = getUserPresence(u);
              return (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => onStartChat(u)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white dark:hover:bg-[#131822] text-left transition-colors"
                >
                  <Avatar src={u.avatar} name={u.name} size="sm" online={presence.online} />
                  <span className="text-sm font-medium text-[#0F1419] dark:text-slate-100 truncate">
                    {u.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
}
