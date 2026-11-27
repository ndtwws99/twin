import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { Navbar } from './components/Navbar';
import { FeedView } from './components/FeedView';
import { ReelsView } from './components/ReelsView';
import { MessengerView } from './components/MessengerView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import { FriendsView } from './components/FriendsView';
import { SavedView } from './components/SavedView';
import { AuthModal } from './components/AuthModal';
import { LightboxModal } from './components/LightboxModal';
import { PostComposer } from './components/PostComposer';
import {
  auth,
  canViewPost,
  canViewStory,
  createGuestProfile,
  db,
  ensureUserDoc,
  isGuestUser,
  signInAsGuest,
  signOutUser,
  toMillis,
} from './lib/firebase';
import type { NavTab, TwinNotification, TwinPost, TwinStory, TwinUser } from './types';

const THEME_KEY = 'twin_theme_mode';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<NavTab>('post');
  const [currentUser, setCurrentUser] = useState<TwinUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [users, setUsers] = useState<TwinUser[]>([]);
  const [rawPosts, setRawPosts] = useState<TwinPost[]>([]);
  const [rawStories, setRawStories] = useState<TwinStory[]>([]);
  const [notifications, setNotifications] = useState<TwinNotification[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [chatPeerUid, setChatPeerUid] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [initialReelId, setInitialReelId] = useState<string | null>(null);

  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mobilePostModalOpen, setMobilePostModalOpen] = useState(false);
  const [reelUploadSignal, setReelUploadSignal] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Sync Tailwind .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  // Auth listener with automatic anonymous guest fallback so live content loads immediately
  useEffect(() => {
    let userDocUnsub: (() => void) | null = null;
    let triedGuest = false;

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }

      if (!fbUser) {
        if (!triedGuest) {
          triedGuest = true;
          const guestProfile = await signInAsGuest();
          setCurrentUser(guestProfile);
          setAuthReady(true);
        } else {
          setCurrentUser(createGuestProfile('guest_local'));
          setAuthReady(true);
        }
        return;
      }

      if (fbUser.isAnonymous) {
        setCurrentUser(createGuestProfile(fbUser.uid));
        setAuthReady(true);
        return;
      }

      try {
        const ensured = await ensureUserDoc(fbUser);
        setCurrentUser(ensured);
        setAuthReady(true);
        userDocUnsub = onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
          if (snap.exists()) {
            setCurrentUser({ uid: fbUser.uid, ...(snap.data() as Omit<TwinUser, 'uid'>) });
          }
        });
      } catch {
        setCurrentUser(createGuestProfile(fbUser.uid));
        setAuthReady(true);
      }
    });

    return () => {
      unsub();
      if (userDocUnsub) userDocUnsub();
    };
  }, []);

  // Online presence heartbeat for logged-in members
  useEffect(() => {
    if (!currentUser || isGuestUser(currentUser)) return;
    const uid = currentUser.uid;
    const ping = () => {
      updateDoc(doc(db, 'users', uid), {
        isOnline: true,
        lastActiveAt: Date.now(),
      }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 45000);
    const onUnload = () => {
      updateDoc(doc(db, 'users', uid), {
        isOnline: false,
        lastActiveAt: Date.now(),
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [currentUser?.uid, currentUser?.isGuest]);

  // Real-time Users, Posts, Stories subscriptions
  useEffect(() => {
    if (!authReady) return;
    const hasFirebaseSession = Boolean(auth.currentUser);
    if (!hasFirebaseSession) {
      setFeedLoading(false);
      return;
    }

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), limit(120)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          uid: d.id,
          ...(d.data() as Omit<TwinUser, 'uid'>),
        }));
        setUsers(list);
      },
      (err) => console.warn('Users snapshot error:', err)
    );

    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(120)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TwinPost, 'id'>),
        }));
        setRawPosts(list);
        setFeedLoading(false);
      },
      (err) => {
        console.warn('Posts snapshot error:', err);
        setFeedLoading(false);
      }
    );

    const unsubStories = onSnapshot(
      query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(80)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TwinStory, 'id'>),
        }));
        setRawStories(list);
      },
      (err) => console.warn('Stories snapshot error:', err)
    );

    return () => {
      unsubUsers();
      unsubPosts();
      unsubStories();
    };
  }, [authReady, currentUser?.uid]);

  // Real-time Notifications listener for signed-in member
  useEffect(() => {
    if (!currentUser || isGuestUser(currentUser)) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('toUid', '==', currentUser.uid),
      limit(80)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<TwinNotification, 'id'>),
          }))
          .sort((a, b) => {
            const ta = toMillis(a.createdAtMs || a.createdAt);
            const tb = toMillis(b.createdAtMs || b.createdAt);
            return tb - ta;
          });
        setNotifications(list);
      },
      (err) => console.warn('Notifications snapshot error:', err)
    );
    return () => unsub();
  }, [currentUser?.uid, currentUser?.isGuest]);

  const userMap = useMemo(() => {
    const map: Record<string, TwinUser> = {};
    users.forEach((u) => {
      map[u.uid] = u;
    });
    if (currentUser && !isGuestUser(currentUser)) {
      map[currentUser.uid] = currentUser;
    }
    return map;
  }, [users, currentUser]);

  const visiblePosts = useMemo(
    () => rawPosts.filter((p) => !p.groupId && canViewPost(p, currentUser)),
    [rawPosts, currentUser]
  );

  const visibleStories = useMemo(
    () => rawStories.filter((s) => canViewStory(s, currentUser)),
    [rawStories, currentUser]
  );

  const visibleReels = useMemo(
    () => visibleStories.filter((s) => s.type === 'video' && Boolean(s.videoUrl)),
    [visibleStories]
  );

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => n.type !== 'message' && !n.read).length,
    [notifications]
  );

  const unreadByPeer = useMemo(() => {
    const counts: Record<string, number> = {};
    notifications.forEach((n) => {
      if (n.type === 'message' && !n.read && n.fromUid) {
        counts[n.fromUid] = (counts[n.fromUid] || 0) + 1;
      }
    });
    return counts;
  }, [notifications]);

  const unreadMessageCount = useMemo(
    () => Object.values(unreadByPeer).reduce((acc, v) => acc + v, 0),
    [unreadByPeer]
  );

  const handleMarkPeerRead = useCallback(
    async (peerUid: string) => {
      const unreadFromPeer = notifications.filter(
        (n) => n.type === 'message' && !n.read && n.fromUid === peerUid
      );
      if (!unreadFromPeer.length) return;
      try {
        const batch = writeBatch(db);
        unreadFromPeer.forEach((n) => {
          batch.update(doc(db, 'notifications', n.id), { read: true });
        });
        await batch.commit();
      } catch {
        // ignore batch errors
      }
    },
    [notifications]
  );

  const handleMarkAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => n.type !== 'message' && !n.read);
    if (!unread.length) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
      showToast('Đã đánh dấu tất cả thông báo là đã đọc.');
    } catch {
      showToast('Không thể cập nhật thông báo.');
    }
  }, [notifications, showToast]);

  const handleOpenProfile = useCallback((uid: string) => {
    setProfileUid(uid);
    setActiveTab('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleStartChat = useCallback((peer: TwinUser) => {
    setChatPeerUid(peer.uid);
    setActiveTab('messages');
  }, []);

  const handleOpenNotification = useCallback(
    (n: TwinNotification) => {
      if (!n.read) {
        updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {});
      }
      if (n.type === 'message' && n.fromUid) {
        setChatPeerUid(n.fromUid);
        setActiveTab('messages');
        return;
      }
      if (n.postId) {
        setActiveTab('post');
        setHighlightedPostId(n.postId);
        setTimeout(() => {
          document.getElementById(`post-${n.postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
        setTimeout(() => setHighlightedPostId(null), 4000);
        return;
      }
      if (n.storyId) {
        setInitialReelId(n.storyId);
        setActiveTab('reels');
        return;
      }
      if (n.type === 'friend' && n.fromUid) {
        handleOpenProfile(n.fromUid);
        return;
      }
      setActiveTab('post');
    },
    [handleOpenProfile]
  );

  const handleSelectSearchPost = useCallback((postId: string) => {
    setActiveTab('post');
    setHighlightedPostId(postId);
    setTimeout(() => {
      document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    setTimeout(() => setHighlightedPostId(null), 4000);
  }, []);

  const handleSelectSearchReel = useCallback((reelId: string) => {
    setInitialReelId(reelId);
    setActiveTab('reels');
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutUser(currentUser?.uid);
    showToast('Đã đăng xuất khỏi Twin.');
    setActiveTab('post');
  }, [currentUser?.uid, showToast]);

  const handleMobileCreateAction = useCallback(() => {
    if (!currentUser || isGuestUser(currentUser)) {
      showToast(
        activeTab === 'reels'
          ? 'Đăng nhập tài khoản để đăng video lên Reels.'
          : 'Đăng nhập tài khoản để đăng bài viết mới.'
      );
      setAuthModalOpen(true);
      return;
    }
    if (activeTab === 'reels') {
      setReelUploadSignal((n) => n + 1);
    } else {
      setMobilePostModalOpen(true);
    }
  }, [activeTab, currentUser, showToast]);

  return (
    <div className="min-h-screen bg-[#F5F6F8] dark:bg-[#0A0D12] text-[#0F1419] dark:text-[#F3F5F8] transition-colors">
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'profile' && currentUser && !isGuestUser(currentUser)) {
            setProfileUid(currentUser.uid);
          }
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        currentUser={currentUser}
        users={users}
        posts={visiblePosts}
        reels={visibleReels}
        notifications={notifications}
        unreadNotifCount={unreadNotifCount}
        unreadMessageCount={unreadMessageCount}
        pendingFriendCount={Array.isArray(currentUser?.friendRequests) ? currentUser.friendRequests.length : 0}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((prev) => !prev)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onSignOut={handleSignOut}
        onOpenProfile={handleOpenProfile}
        onStartChat={handleStartChat}
        onCreateAction={handleMobileCreateAction}
        onOpenNotification={handleOpenNotification}
        onMarkAllRead={handleMarkAllRead}
        onSelectSearchPost={handleSelectSearchPost}
        onSelectSearchReel={handleSelectSearchReel}
      />

      {activeTab === 'post' && (
        <FeedView
          currentUser={currentUser}
          users={users}
          userMap={userMap}
          posts={visiblePosts}
          stories={visibleStories}
          loading={feedLoading}
          highlightedPostId={highlightedPostId}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((prev) => !prev)}
          onSelectTab={setActiveTab}
          onOpenProfile={handleOpenProfile}
          onStartChat={handleStartChat}
          onOpenLightbox={(images, index) => setLightbox({ images, index })}
          onOpenAuth={() => setAuthModalOpen(true)}
          onToast={showToast}
        />
      )}

      {activeTab === 'reels' && (
        <ReelsView
          stories={visibleStories}
          posts={visiblePosts}
          currentUser={currentUser}
          userMap={userMap}
          initialReelId={initialReelId}
          openUploadSignal={reelUploadSignal}
          onOpenProfile={handleOpenProfile}
          onOpenAuth={() => setAuthModalOpen(true)}
          onToast={showToast}
        />
      )}

      {activeTab === 'messages' && (
        <MessengerView
          currentUser={currentUser}
          users={users}
          initialPeerUid={chatPeerUid}
          unreadByPeer={unreadByPeer}
          onMarkPeerRead={handleMarkPeerRead}
          onOpenProfile={handleOpenProfile}
          onOpenLightbox={(images, index) => setLightbox({ images, index })}
          onOpenAuth={() => setAuthModalOpen(true)}
          onToast={showToast}
        />
      )}

      {activeTab === 'notifications' && (
        <NotificationsView
          currentUser={currentUser}
          notifications={notifications}
          onOpenNotification={handleOpenNotification}
          onMarkAllRead={handleMarkAllRead}
          onOpenAuth={() => setAuthModalOpen(true)}
        />
      )}

      {activeTab === 'profile' && (
        <ProfileView
          profileUid={profileUid}
          currentUser={currentUser}
          users={users}
          userMap={userMap}
          posts={visiblePosts}
          onOpenProfile={handleOpenProfile}
          onStartChat={handleStartChat}
          onOpenLightbox={(images, index) => setLightbox({ images, index })}
          onOpenAuth={() => setAuthModalOpen(true)}
          onToast={showToast}
        />
      )}

      {activeTab === 'friends' && (
        <FriendsView
          currentUser={currentUser}
          users={users}
          userMap={userMap}
          onOpenProfile={handleOpenProfile}
          onStartChat={handleStartChat}
          onOpenAuth={() => setAuthModalOpen(true)}
          onToast={showToast}
        />
      )}

      {activeTab === 'saved' && (
        <SavedView
          currentUser={currentUser}
          userMap={userMap}
          posts={visiblePosts}
          reels={visibleReels}
          onOpenProfile={handleOpenProfile}
          onOpenLightbox={(images, index) => setLightbox({ images, index })}
          onOpenReel={handleSelectSearchReel}
          onOpenAuth={() => setAuthModalOpen(true)}
          onToast={showToast}
        />
      )}

      {/* Mobile Quick Create Post Modal (Text + Photos) */}
      {mobilePostModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setMobilePostModalOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-white dark:bg-[#131822] rounded-t-3xl sm:rounded-2xl p-3 sm:p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <PostComposer
              currentUser={currentUser}
              initialExpanded
              onPublished={() => {
                setMobilePostModalOpen(false);
                if (activeTab !== 'post') setActiveTab('post');
              }}
              onCancel={() => setMobilePostModalOpen(false)}
              onOpenAuth={() => {
                setMobilePostModalOpen(false);
                setAuthModalOpen(true);
              }}
              onOpenProfile={(uid) => {
                setMobilePostModalOpen(false);
                handleOpenProfile(uid);
              }}
              onToast={showToast}
            />
          </div>
        </div>
      )}

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onToast={showToast}
      />

      {lightbox && (
        <LightboxModal
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onChangeIndex={(next) => setLightbox((prev) => (prev ? { ...prev, index: next } : null))}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2.5 rounded-xl bg-[#0F1419] dark:bg-white text-white dark:text-[#0F1419] text-xs sm:text-sm font-medium shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
