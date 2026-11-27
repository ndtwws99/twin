import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Bookmark,
  CheckCheck,
  ChevronRight,
  Clapperboard,
  Home,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Newspaper,
  Plus,
  Search,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react';
import { TwinLogo } from './TwinLogo';
import { Avatar } from './Avatar';
import { formatTime, getUserPresence, isGuestUser } from '../lib/firebase';
import type { NavTab, TwinNotification, TwinPost, TwinStory, TwinUser } from '../types';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentUser: TwinUser | null;
  users: TwinUser[];
  posts: TwinPost[];
  reels: TwinStory[];
  notifications: TwinNotification[];
  unreadNotifCount: number;
  unreadMessageCount: number;
  pendingFriendCount: number;
  darkMode: boolean;
  onToggleTheme: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenProfile: (uid: string) => void;
  onStartChat: (peer: TwinUser) => void;
  onCreateAction: () => void;
  onOpenNotification: (n: TwinNotification) => void;
  onMarkAllRead: () => void;
  onSelectSearchPost: (postId: string) => void;
  onSelectSearchReel: (reelId: string) => void;
}

export function Navbar({
  activeTab,
  onSelectTab,
  currentUser,
  users,
  posts,
  reels,
  notifications,
  unreadNotifCount,
  unreadMessageCount,
  pendingFriendCount,
  darkMode,
  onToggleTheme,
  onOpenAuth,
  onSignOut,
  onOpenProfile,
  onStartChat,
  onCreateAction,
  onOpenNotification,
  onMarkAllRead,
  onSelectSearchPost,
  onSelectSearchReel,
}: NavbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);

  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  const guest = isGuestUser(currentUser);
  const myFriends = useMemo(
    () => (Array.isArray(currentUser?.friends) ? currentUser.friends : []),
    [currentUser]
  );

  // Online-first contacts list for mobile Left Menu Drawer
  const drawerContacts = useMemo(() => {
    return users
      .filter((u) => u.uid !== currentUser?.uid)
      .sort((a, b) => {
        const aFriend = myFriends.includes(a.uid) ? 1 : 0;
        const bFriend = myFriends.includes(b.uid) ? 1 : 0;
        if (aFriend !== bFriend) return bFriend - aFriend;
        const aOnline = getUserPresence(a).online ? 1 : 0;
        const bOnline = getUserPresence(b).online ? 1 : 0;
        return bOnline - aOnline;
      })
      .slice(0, 10);
  }, [users, currentUser?.uid, myFriends]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inDesktopSearch = desktopSearchRef.current?.contains(target);
      const inMobileSearch = mobileSearchRef.current?.contains(target);
      if (!inDesktopSearch && !inMobileSearch) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifPopoverOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => desktopSearchInputRef.current?.focus(), 40);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (leftDrawerOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [leftDrawerOpen]);

  const searchResults = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return { matchedUsers: [], matchedPosts: [], matchedReels: [] };

    const matchedUsers = users
      .filter((u) => (u.name || '').toLowerCase().includes(q) || (u.bio || '').toLowerCase().includes(q))
      .slice(0, 5);

    const matchedPosts = posts
      .filter(
        (p) =>
          !p.videoUrl &&
          ((p.content || '').toLowerCase().includes(q) || (p.authorName || '').toLowerCase().includes(q))
      )
      .slice(0, 4);

    const matchedReels = reels
      .filter((r) => (r.caption || '').toLowerCase().includes(q) || (r.authorName || '').toLowerCase().includes(q))
      .slice(0, 3);

    return { matchedUsers, matchedPosts, matchedReels };
  }, [queryText, users, posts, reels]);

  const hasSearchResults =
    searchResults.matchedUsers.length > 0 ||
    searchResults.matchedPosts.length > 0 ||
    searchResults.matchedReels.length > 0;

  const generalNotifs = useMemo(
    () => notifications.filter((n) => n.type !== 'message').slice(0, 12),
    [notifications]
  );

  const handleOpenMyProfile = () => {
    if (currentUser && !guest) {
      onOpenProfile(currentUser.uid);
    } else {
      onOpenAuth();
    }
  };

  const renderSearchResults = () => (
    <>
      {!hasSearchResults ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Không tìm thấy kết quả cho &ldquo;{queryText}&rdquo;
        </p>
      ) : (
        <div className="space-y-2">
          {searchResults.matchedUsers.length > 0 && (
            <div>
              <p className="px-2.5 py-1 text-xs font-semibold text-slate-400">Mọi người</p>
              {searchResults.matchedUsers.map((u) => (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => {
                    onOpenProfile(u.uid);
                    setSearchOpen(false);
                    setQueryText('');
                  }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1D2432] text-left transition-colors"
                >
                  <Avatar src={u.avatar} name={u.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0F1419] dark:text-white truncate">{u.name}</p>
                    {u.bio && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.bio}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchResults.matchedPosts.length > 0 && (
            <div className="pt-1 border-t border-[#EEF0F4] dark:border-[#232B3A]">
              <p className="px-2.5 py-1 text-xs font-semibold text-slate-400">Bài viết</p>
              {searchResults.matchedPosts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectSearchPost(p.id);
                    setSearchOpen(false);
                    setQueryText('');
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1D2432] text-left transition-colors"
                >
                  <p className="text-xs font-semibold text-[#0F1419] dark:text-white">{p.authorName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                    {p.content || 'Bài viết có hình ảnh'}
                  </p>
                </button>
              ))}
            </div>
          )}

          {searchResults.matchedReels.length > 0 && (
            <div className="pt-1 border-t border-[#EEF0F4] dark:border-[#232B3A]">
              <p className="px-2.5 py-1 text-xs font-semibold text-slate-400">Reels</p>
              {searchResults.matchedReels.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onSelectSearchReel(r.id);
                    setSearchOpen(false);
                    setQueryText('');
                  }}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1D2432] text-left transition-colors"
                >
                  <p className="text-xs font-semibold text-[#0F1419] dark:text-white">{r.authorName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {r.caption || 'Video Reels'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  const isReelsTab = activeTab === 'reels';

  return (
    <>
      <header className="sticky top-0 z-40 h-14 bg-white/95 dark:bg-[#131822]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#232B3A]">
        {/* ================= MOBILE TOP BAR (Symmetric 4 equal-size icons) ================= */}
        {/* Left: Menu | Center: Post & Reels | Right: Search */}
        <div className="grid md:hidden grid-cols-[48px_1fr_48px] items-center h-full w-full px-2">
          {/* LEFT: Icon menu bên trái */}
          <button
            type="button"
            onClick={() => setLeftDrawerOpen(true)}
            aria-label="Mở menu bên trái"
            title="Menu"
            className="h-full w-full flex items-center justify-center"
          >
            <span
              className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                leftDrawerOpen
                  ? 'bg-[#0084FF]/15 text-[#0084FF]'
                  : 'bg-[#F2F4F7] dark:bg-[#1D2432] text-[#0F1419] dark:text-slate-200 hover:bg-[#E7EBF0] dark:hover:bg-[#263043]'
              }`}
            >
              <Menu className="w-[19px] h-[19px]" />
              {unreadMessageCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#FF3040] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                  {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                </span>
              )}
            </span>
          </button>

          {/* CENTER: Icon Post + Icon Reels */}
          <div className="h-full flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onSelectTab('post')}
              aria-label="Bài viết"
              title="Bài viết"
              className="relative h-full px-3 flex items-center justify-center"
            >
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  activeTab === 'post'
                    ? 'bg-[#0084FF]/15 text-[#0084FF]'
                    : 'bg-[#F2F4F7] dark:bg-[#1D2432] text-[#0F1419] dark:text-slate-200 hover:bg-[#E7EBF0] dark:hover:bg-[#263043]'
                }`}
              >
                <Newspaper className="w-[19px] h-[19px]" strokeWidth={activeTab === 'post' ? 2.3 : 1.9} />
              </span>
              {activeTab === 'post' && (
                <span className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-t-full bg-[#0084FF]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('reels')}
              aria-label="Reels"
              title="Reels"
              className="relative h-full px-3 flex items-center justify-center"
            >
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  activeTab === 'reels'
                    ? 'bg-[#0084FF]/15 text-[#0084FF]'
                    : 'bg-[#F2F4F7] dark:bg-[#1D2432] text-[#0F1419] dark:text-slate-200 hover:bg-[#E7EBF0] dark:hover:bg-[#263043]'
                }`}
              >
                <Clapperboard className="w-[19px] h-[19px]" strokeWidth={activeTab === 'reels' ? 2.3 : 1.9} />
              </span>
              {activeTab === 'reels' && (
                <span className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-t-full bg-[#0084FF]" />
              )}
            </button>
          </div>

          {/* RIGHT: Icon Search */}
          <div className="h-full w-full flex items-center justify-center" ref={mobileSearchRef}>
            <button
              type="button"
              onClick={() => {
                setSearchOpen(true);
                setLeftDrawerOpen(false);
              }}
              aria-label="Tìm kiếm"
              title="Tìm kiếm"
              className="w-9 h-9 rounded-full bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-[#E7EBF0] dark:hover:bg-[#263043] text-[#0F1419] dark:text-slate-200 flex items-center justify-center transition-colors"
            >
              <Search className="w-[19px] h-[19px]" />
            </button>

            {searchOpen && (
              <div className="fixed inset-x-0 top-0 h-14 px-3 bg-white dark:bg-[#131822] border-b border-[#E5E7EB] dark:border-[#232B3A] flex items-center gap-2 z-50">
                <div className="flex-1 flex items-center h-10 rounded-full bg-[#F2F4F7] dark:bg-[#1D2432] border border-[#0084FF]/50 px-3.5 gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    placeholder="Tìm kiếm trên Twin..."
                    className="w-full bg-transparent text-sm text-[#0F1419] dark:text-white placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQueryText('');
                    setSearchOpen(false);
                  }}
                  aria-label="Đóng tìm kiếm"
                  className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-[#1D2432] flex items-center justify-center text-slate-500 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>

                {queryText.trim() && (
                  <div className="fixed left-3 right-3 top-[60px] max-h-[65vh] overflow-y-auto bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl shadow-xl p-2 z-50">
                    {renderSearchResults()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ================= DESKTOP TOP BAR ================= */}
        <div className="hidden md:flex max-w-[1440px] mx-auto h-full px-5 items-center justify-between gap-4">
          {/* LEFT ZONE: Logo + Search */}
          <div className="flex items-center gap-3 min-w-0 shrink-0" ref={desktopSearchRef}>
            <button
              type="button"
              onClick={() => onSelectTab('post')}
              className="flex items-center focus-visible:outline-2 focus-visible:outline-[#0084FF] rounded-full shrink-0"
              aria-label="Trang chủ Twin"
            >
              <TwinLogo size={34} showWordmark />
            </button>

            <div className="relative">
              {!searchOpen ? (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Tìm kiếm"
                  title="Tìm kiếm trên Twin"
                  className="w-10 h-10 rounded-full bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-[#E7EBF0] dark:hover:bg-[#263043] text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
                >
                  <Search className="w-[18px] h-[18px]" />
                </button>
              ) : (
                <div className="flex items-center h-10 w-[260px] rounded-full bg-[#F2F4F7] dark:bg-[#1D2432] border border-[#0084FF]/50 px-3 gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    ref={desktopSearchInputRef}
                    type="text"
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    placeholder="Tìm kiếm trên Twin..."
                    className="w-full bg-transparent text-sm text-[#0F1419] dark:text-white placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setQueryText('');
                      setSearchOpen(false);
                    }}
                    aria-label="Đóng tìm kiếm"
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {searchOpen && queryText.trim() && (
                <div className="absolute left-0 top-12 w-[360px] max-h-[70vh] overflow-y-auto bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl shadow-xl p-2 z-50">
                  {renderSearchResults()}
                </div>
              )}
            </div>
          </div>

          {/* CENTER ZONE: Bài viết | Reels */}
          <nav aria-label="Điều hướng chính" className="flex items-center h-full gap-2">
            <button
              type="button"
              onClick={() => onSelectTab('post')}
              className={`relative h-full px-7 flex items-center gap-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'post'
                  ? 'text-[#0084FF]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F1419] dark:hover:text-white'
              }`}
            >
              <Newspaper className="w-[18px] h-[18px]" strokeWidth={activeTab === 'post' ? 2.4 : 1.9} />
              <span>Bài viết</span>
              {activeTab === 'post' && (
                <span className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-t-full bg-[#0084FF]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('reels')}
              className={`relative h-full px-7 flex items-center gap-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'reels'
                  ? 'text-[#0084FF]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F1419] dark:hover:text-white'
              }`}
            >
              <Clapperboard className="w-[18px] h-[18px]" strokeWidth={activeTab === 'reels' ? 2.4 : 1.9} />
              <span>Reels</span>
              {activeTab === 'reels' && (
                <span className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-t-full bg-[#0084FF]" />
              )}
            </button>
          </nav>

          {/* RIGHT ZONE: Tin nhắn + Thông báo + Avatar */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onSelectTab('messages')}
              aria-label="Tin nhắn"
              title="Tin nhắn"
              className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                activeTab === 'messages'
                  ? 'bg-[#0084FF]/15 text-[#0084FF]'
                  : 'bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-[#E7EBF0] dark:hover:bg-[#263043] text-[#0F1419] dark:text-slate-200'
              }`}
            >
              <MessageCircle className="w-[19px] h-[19px]" />
              {unreadMessageCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3040] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                </span>
              )}
            </button>

            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setNotifPopoverOpen((prev) => !prev);
                  setAvatarMenuOpen(false);
                }}
                aria-label="Thông báo"
                title="Thông báo"
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  notifPopoverOpen || activeTab === 'notifications'
                    ? 'bg-[#0084FF]/15 text-[#0084FF]'
                    : 'bg-[#F2F4F7] dark:bg-[#1D2432] hover:bg-[#E7EBF0] dark:hover:bg-[#263043] text-[#0F1419] dark:text-slate-200'
                }`}
              >
                <Bell className="w-[19px] h-[19px]" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3040] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {notifPopoverOpen && (
                <div className="absolute right-0 top-12 w-[360px] bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[#EEF0F4] dark:border-[#232B3A] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#0F1419] dark:text-white">Thông báo</h3>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        onClick={onMarkAllRead}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0084FF] hover:underline"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Đọc tất cả
                      </button>
                    )}
                  </div>
                  <div className="max-h-[380px] overflow-y-auto divide-y divide-[#F2F4F7] dark:divide-[#1D2432]">
                    {generalNotifs.length === 0 ? (
                      <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                        Chưa có thông báo nào.
                      </p>
                    ) : (
                      generalNotifs.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            onOpenNotification(n);
                            setNotifPopoverOpen(false);
                          }}
                          className={`w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-slate-50 dark:hover:bg-[#1A2130] transition-colors ${
                            !n.read ? 'bg-[#0084FF]/[0.05] dark:bg-[#0084FF]/[0.08]' : ''
                          }`}
                        >
                          <Avatar src={n.fromAvatar} name={n.fromName} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-snug text-[#0F1419] dark:text-slate-100">
                              <span className="font-semibold">{n.fromName || 'Ai đó'}</span> {n.text}
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
                  <button
                    type="button"
                    onClick={() => {
                      setNotifPopoverOpen(false);
                      onSelectTab('notifications');
                    }}
                    className="w-full py-2.5 text-center text-xs font-semibold text-[#0084FF] hover:bg-slate-50 dark:hover:bg-[#1A2130] border-t border-[#EEF0F4] dark:border-[#232B3A]"
                  >
                    Xem tất cả thông báo
                  </button>
                </div>
              )}
            </div>

            <div className="relative" ref={avatarRef}>
              <button
                type="button"
                onClick={() => {
                  setAvatarMenuOpen((prev) => !prev);
                  setNotifPopoverOpen(false);
                }}
                aria-label="Tài khoản"
                className="relative w-10 h-10 rounded-full flex items-center justify-center ring-offset-2 ring-offset-white dark:ring-offset-[#131822] focus-visible:ring-2 focus-visible:ring-[#0084FF]"
              >
                <Avatar src={currentUser?.avatar} name={currentUser?.name || 'Khách'} size="sm" />
              </button>

              {avatarMenuOpen && (
                <div className="absolute right-0 top-12 w-64 bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl shadow-xl p-2 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      handleOpenMyProfile();
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1D2432] text-left transition-colors"
                  >
                    <Avatar src={currentUser?.avatar} name={currentUser?.name || 'Khách'} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F1419] dark:text-white truncate">
                        {currentUser?.name || 'Khách'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {guest ? 'Đăng nhập để trải nghiệm đầy đủ' : 'Xem trang cá nhân'}
                      </p>
                    </div>
                  </button>

                  <div className="my-1.5 h-px bg-[#EEF0F4] dark:bg-[#232B3A]" />

                  <button
                    type="button"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      onSelectTab('friends');
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-[#0F1419] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1D2432] transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-slate-500" />
                      <span>Bạn bè</span>
                    </span>
                    {pendingFriendCount > 0 && (
                      <span className="text-xs font-bold text-[#0084FF] tabular-nums">{pendingFriendCount}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      onSelectTab('saved');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#0F1419] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1D2432] transition-colors"
                  >
                    <Bookmark className="w-4 h-4 text-slate-500" />
                    <span>Đã lưu</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#0F1419] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1D2432] transition-colors"
                  >
                    {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
                    <span>{darkMode ? 'Chế độ sáng' : 'Chế độ tối'}</span>
                  </button>

                  <div className="my-1.5 h-px bg-[#EEF0F4] dark:bg-[#232B3A]" />

                  {guest ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        onOpenAuth();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#0084FF] hover:bg-[#0084FF]/10 transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Đăng nhập / Đăng ký</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ================= MOBILE LEFT SLIDE-OUT MENU DRAWER ================= */}
      {leftDrawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex"
          onClick={() => setLeftDrawerOpen(false)}
        >
          <aside
            aria-label="Menu điều hướng bên trái"
            onClick={(e) => e.stopPropagation()}
            className="w-[292px] max-w-[84vw] h-full bg-white dark:bg-[#131822] border-r border-[#E5E7EB] dark:border-[#232B3A] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="h-14 px-4 border-b border-[#EEF0F4] dark:border-[#232B3A] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onSelectTab('post');
                  setLeftDrawerOpen(false);
                }}
                className="flex items-center"
              >
                <TwinLogo size={32} showWordmark />
              </button>
              <button
                type="button"
                onClick={() => setLeftDrawerOpen(false)}
                aria-label="Đóng menu"
                className="w-9 h-9 rounded-full hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Profile Card */}
              <button
                type="button"
                onClick={() => {
                  setLeftDrawerOpen(false);
                  handleOpenMyProfile();
                }}
                className="w-full flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-[#F5F6F8] dark:bg-[#1A2130] hover:bg-[#EEF0F4] dark:hover:bg-[#222B3D] text-left transition-colors"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Avatar src={currentUser?.avatar} name={currentUser?.name || 'Khách'} size="md" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[#0F1419] dark:text-white truncate">
                      {currentUser?.name || 'Khách'}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {guest ? 'Chạm để đăng nhập' : 'Xem trang cá nhân'}
                    </span>
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {/* Main Navigation Links */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setLeftDrawerOpen(false);
                    onSelectTab('messages');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    activeTab === 'messages'
                      ? 'bg-[#0084FF]/12 text-[#0084FF]'
                      : 'text-[#0F1419] dark:text-slate-200 hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-sky-500/12 text-sky-500 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-[18px] h-[18px]" />
                    </span>
                    <span>Tin nhắn</span>
                  </span>
                  {unreadMessageCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#FF3040] text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                      {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLeftDrawerOpen(false);
                    onSelectTab('post');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    activeTab === 'post'
                      ? 'bg-[#0084FF]/12 text-[#0084FF]'
                      : 'text-[#0F1419] dark:text-slate-200 hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432]'
                  }`}
                >
                  <span className="w-9 h-9 rounded-full bg-[#0084FF]/12 text-[#0084FF] flex items-center justify-center shrink-0">
                    <Newspaper className="w-[18px] h-[18px]" />
                  </span>
                  <span>Bài viết</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLeftDrawerOpen(false);
                    onSelectTab('reels');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    activeTab === 'reels'
                      ? 'bg-[#0084FF]/12 text-[#0084FF]'
                      : 'text-[#0F1419] dark:text-slate-200 hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432]'
                  }`}
                >
                  <span className="w-9 h-9 rounded-full bg-rose-500/12 text-rose-500 flex items-center justify-center shrink-0">
                    <Clapperboard className="w-[18px] h-[18px]" />
                  </span>
                  <span>Reels</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLeftDrawerOpen(false);
                    onSelectTab('saved');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    activeTab === 'saved'
                      ? 'bg-[#0084FF]/12 text-[#0084FF]'
                      : 'text-[#0F1419] dark:text-slate-200 hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432]'
                  }`}
                >
                  <span className="w-9 h-9 rounded-full bg-violet-500/12 text-violet-500 flex items-center justify-center shrink-0">
                    <Bookmark className="w-[18px] h-[18px]" />
                  </span>
                  <span>Đã lưu</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-[#0F1419] dark:text-slate-200 hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432] transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-[#F2F4F7] dark:bg-[#1D2432] flex items-center justify-center shrink-0">
                      {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
                    </span>
                    <span>{darkMode ? 'Chế độ sáng' : 'Chế độ tối'}</span>
                  </span>
                  <span className="text-xs font-semibold text-[#0084FF]">{darkMode ? 'Tối' : 'Sáng'}</span>
                </button>
              </div>

              {/* Contacts List */}
              {drawerContacts.length > 0 && (
                <div className="pt-2 border-t border-[#EEF0F4] dark:border-[#232B3A]">
                  <p className="px-2 mb-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                    Người liên hệ
                  </p>
                  <div className="space-y-0.5">
                    {drawerContacts.map((u) => {
                      const presence = getUserPresence(u);
                      return (
                        <button
                          key={u.uid}
                          type="button"
                          onClick={() => {
                            setLeftDrawerOpen(false);
                            onStartChat(u);
                          }}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432] text-left transition-colors"
                        >
                          <Avatar src={u.avatar} name={u.name} size="sm" online={presence.online} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#0F1419] dark:text-slate-200 truncate">
                              {u.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {presence.online ? 'Đang hoạt động' : presence.label}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Auth Footer */}
            <div className="p-3 border-t border-[#EEF0F4] dark:border-[#232B3A]">
              {guest ? (
                <button
                  type="button"
                  onClick={() => {
                    setLeftDrawerOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full h-10 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập / Đăng ký</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setLeftDrawerOpen(false);
                    onSignOut();
                  }}
                  className="w-full h-10 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ================= MOBILE BOTTOM BAR (5 balanced Vietnamese tabs) ================= */}
      {/* Order: Trang chủ | Bạn bè | Nút đăng (linh động: Đăng bài / Đăng video) | Thông báo | Cá nhân */}
      <nav
        aria-label="Điều hướng di động"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#131822]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[#232B3A] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-[60px] items-stretch">
          {/* 1. Trang chủ */}
          <button
            type="button"
            onClick={() => onSelectTab('post')}
            className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'post'
                ? 'text-[#0084FF]'
                : 'text-slate-500 dark:text-slate-400 hover:text-[#0F1419] dark:hover:text-white'
            }`}
          >
            {activeTab === 'post' && (
              <span className="absolute top-0 left-3 right-3 h-[2.5px] rounded-b-full bg-[#0084FF]" />
            )}
            <span className="h-6 flex items-center justify-center">
              <Home className="w-5 h-5" strokeWidth={activeTab === 'post' ? 2.3 : 1.9} />
            </span>
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">Trang chủ</span>
          </button>

          {/* 2. Bạn bè */}
          <button
            type="button"
            onClick={() => onSelectTab('friends')}
            className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'friends'
                ? 'text-[#0084FF]'
                : 'text-slate-500 dark:text-slate-400 hover:text-[#0F1419] dark:hover:text-white'
            }`}
          >
            {activeTab === 'friends' && (
              <span className="absolute top-0 left-3 right-3 h-[2.5px] rounded-b-full bg-[#0084FF]" />
            )}
            <span className="relative h-6 flex items-center justify-center">
              <Users className="w-5 h-5" strokeWidth={activeTab === 'friends' ? 2.3 : 1.9} />
              {pendingFriendCount > 0 && (
                <span className="absolute -top-0.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#FF3040] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                  {pendingFriendCount > 9 ? '9+' : pendingFriendCount}
                </span>
              )}
            </span>
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">Bạn bè</span>
          </button>

          {/* 3. Nút đăng linh động: Đăng bài (khi ở Post) / Đăng video (khi ở Reels) */}
          <button
            type="button"
            onClick={onCreateAction}
            aria-label={isReelsTab ? 'Đăng video Reels' : 'Đăng bài viết mới'}
            className="flex flex-col items-center justify-center gap-1 text-[#0084FF] active:scale-95 transition-transform"
          >
            <span className="w-10 h-6 rounded-xl bg-[#0084FF] text-white flex items-center justify-center shadow-xs">
              <Plus className="w-4 h-4" strokeWidth={2.8} />
            </span>
            <span className="text-[11px] font-semibold leading-none whitespace-nowrap">
              {isReelsTab ? 'Đăng video' : 'Đăng bài'}
            </span>
          </button>

          {/* 4. Thông báo (Noti) */}
          <button
            type="button"
            onClick={() => onSelectTab('notifications')}
            className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'notifications'
                ? 'text-[#0084FF]'
                : 'text-slate-500 dark:text-slate-400 hover:text-[#0F1419] dark:hover:text-white'
            }`}
          >
            {activeTab === 'notifications' && (
              <span className="absolute top-0 left-3 right-3 h-[2.5px] rounded-b-full bg-[#0084FF]" />
            )}
            <span className="relative h-6 flex items-center justify-center">
              <Bell className="w-5 h-5" strokeWidth={activeTab === 'notifications' ? 2.3 : 1.9} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-0.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#FF3040] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </span>
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">Thông báo</span>
          </button>

          {/* 5. Cá nhân (Profile) */}
          <button
            type="button"
            onClick={handleOpenMyProfile}
            className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'profile'
                ? 'text-[#0084FF]'
                : 'text-slate-500 dark:text-slate-400 hover:text-[#0F1419] dark:hover:text-white'
            }`}
          >
            {activeTab === 'profile' && (
              <span className="absolute top-0 left-3 right-3 h-[2.5px] rounded-b-full bg-[#0084FF]" />
            )}
            <span className="h-6 flex items-center justify-center">
              <User className="w-5 h-5" strokeWidth={activeTab === 'profile' ? 2.3 : 1.9} />
            </span>
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">Cá nhân</span>
          </button>
        </div>
      </nav>
    </>
  );
}
