import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Heart,
  MessageCircle,
  Music2,
  Play,
  Plus,
  Send,
  Share2,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { DEFAULT_AVATAR } from '../lib/config';
import { PRIVACY_OPTIONS } from '../lib/constants';
import {
  db,
  formatTime,
  friendlyError,
  getChatId,
  isGuestUser,
  isUserAdmin,
  pushNotification,
  toMillis,
  uploadVideoToCloudinary,
} from '../lib/firebase';
import type { PrivacyLevel, TwinPost, TwinStory, TwinStoryReply, TwinUser } from '../types';

interface ReelsViewProps {
  stories: TwinStory[];
  posts: TwinPost[];
  currentUser: TwinUser | null;
  userMap: Record<string, TwinUser>;
  initialReelId?: string | null;
  openUploadSignal?: number;
  onOpenProfile: (uid: string) => void;
  onOpenAuth: () => void;
  onToast: (msg: string) => void;
}

type ReelsTab = 'foryou' | 'following';

interface ReelFeedItem {
  id: string;
  source: 'story' | 'post';
  authorUid: string;
  authorName: string;
  authorAvatar?: string;
  videoUrl: string;
  videoPoster?: string;
  caption: string;
  createdAt?: unknown;
  likes: string[];
  savedBy: string[];
  sharesCount: number;
  replies: TwinStoryReply[];
}

interface TikTokCardProps {
  item: ReelFeedItem;
  isActive: boolean;
  muted: boolean;
  currentUser: TwinUser | null;
  authorUser?: TwinUser;
  onToggleMute: () => void;
  onLike: (item: ReelFeedItem, forceLike?: boolean) => void;
  onSave: (item: ReelFeedItem) => void;
  onShare: (item: ReelFeedItem) => void;
  onDelete: (item: ReelFeedItem) => void;
  onOpenComments: (item: ReelFeedItem) => void;
  onFollowCreator: (authorUid: string, authorName: string) => void;
  onOpenProfile: (uid: string) => void;
}

function TikTokCard({
  item,
  isActive,
  muted,
  currentUser,
  authorUser,
  onToggleMute,
  onLike,
  onSave,
  onShare,
  onDelete,
  onOpenComments,
  onFollowCreator,
  onOpenProfile,
}: TikTokCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTapRef = useRef<number>(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [heartPop, setHeartPop] = useState<{ x: number; y: number; key: number } | null>(null);

  const guest = isGuestUser(currentUser);
  const myFriends = Array.isArray(currentUser?.friends) ? currentUser.friends : [];
  const isOwnVideo = Boolean(currentUser && !guest && item.authorUid === currentUser.uid);
  const isFollowing = Boolean(currentUser && !guest && myFriends.includes(item.authorUid));
  const hasSentRequest = Boolean(
    currentUser &&
      !guest &&
      Array.isArray(authorUser?.friendRequests) &&
      authorUser.friendRequests.includes(currentUser.uid)
  );
  const canDelete = isOwnVideo || isUserAdmin(currentUser);

  const liked = Boolean(currentUser && !guest && item.likes.includes(currentUser.uid));
  const saved = Boolean(currentUser && !guest && item.savedBy.includes(currentUser.uid));

  const displayName = authorUser?.name || item.authorName || 'Thành viên Twin';
  const displayAvatar = authorUser?.avatar || item.authorAvatar;
  const handleName = displayName.toLowerCase().replace(/\s+/g, '');

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      setPaused(false);
      v.play().catch(() => {
        setPaused(true);
      });
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive]);

  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (now - lastTapRef.current < 280) {
      setHeartPop({ x, y, key: now });
      if (!liked) onLike(item, true);
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;
    setTimeout(() => {
      if (lastTapRef.current === now) {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) {
          v.play().catch(() => {});
          setPaused(false);
        } else {
          v.pause();
          setPaused(true);
        }
      }
    }, 220);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
    setProgress(ratio * 100);
  };

  return (
    <div className="snap-start snap-always w-full h-full shrink-0 flex items-center justify-center py-0 sm:py-3 px-0 sm:px-4">
      <div className="relative w-full h-full sm:w-auto sm:h-full sm:aspect-[9/16] sm:max-w-[430px] sm:rounded-2xl overflow-hidden bg-black shadow-xl sm:border sm:border-[#E5E7EB] sm:dark:border-[#232B3A] select-none">
        {/* Video Layer */}
        <div className="relative w-full h-full" onClick={handleVideoTap}>
          <video
            ref={videoRef}
            src={item.videoUrl}
            poster={item.videoPoster || undefined}
            loop
            muted={muted}
            playsInline
            preload={isActive ? 'auto' : 'metadata'}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) {
                setProgress((v.currentTime / v.duration) * 100);
              }
            }}
            className="w-full h-full object-cover cursor-pointer"
          />

          {/* Double-tap Heart Pop */}
          {heartPop && (
            <div
              key={heartPop.key}
              style={{ left: heartPop.x, top: heartPop.y }}
              className="pointer-events-none absolute z-30 animate-heart-pop"
            >
              <Heart className="w-24 h-24 text-[#FF3040] drop-shadow-[0_6px_18px_rgba(255,48,64,0.55)]" fill="#FF3040" />
            </div>
          )}

          {/* Center Paused Indicator */}
          {paused && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
              <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-xs flex items-center justify-center text-white">
                <Play className="w-8 h-8 ml-1" fill="currentColor" />
              </div>
            </div>
          )}
        </div>

        {/* Top-Right Mute Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          className="absolute top-3.5 right-3 z-20 w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-xs text-white flex items-center justify-center transition-colors"
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* Bottom Scrim */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {/* Bottom-Left Creator, Text Caption & Audio Overlay */}
        <div className="absolute left-3.5 right-20 bottom-5 z-20 space-y-2 text-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenProfile(item.authorUid);
              }}
              className="text-[15px] font-bold hover:underline drop-shadow-xs truncate"
            >
              @{handleName}
            </button>
            <span className="text-xs text-white/75 shrink-0">· {formatTime(item.createdAt)}</span>
          </div>

          {item.caption && (
            <div className="text-[13.5px] leading-snug text-white/95 drop-shadow-xs">
              <p className={expandedCaption ? '' : 'line-clamp-2'}>{item.caption}</p>
              {item.caption.length > 85 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedCaption((prev) => !prev);
                  }}
                  className="text-xs font-semibold text-white/80 hover:text-white mt-0.5"
                >
                  {expandedCaption ? 'Thu gọn' : 'xem thêm'}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-white/90 pt-0.5">
            <Music2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate font-medium">Âm thanh gốc - {displayName}</span>
          </div>
        </div>

        {/* TikTok Right Vertical Action Stack */}
        <div className="absolute right-2.5 bottom-5 z-20 flex flex-col items-center gap-4">
          <div className="relative mb-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenProfile(item.authorUid);
              }}
              className="block rounded-full ring-2 ring-white"
            >
              <Avatar src={displayAvatar} name={displayName} size="lg" />
            </button>
            {!isOwnVideo && (
              <button
                type="button"
                disabled={isFollowing || hasSentRequest}
                onClick={(e) => {
                  e.stopPropagation();
                  onFollowCreator(item.authorUid, displayName);
                }}
                aria-label={isFollowing ? 'Đã kết bạn' : 'Kết bạn'}
                className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-md transition-transform active:scale-90 ${
                  isFollowing || hasSentRequest ? 'bg-emerald-500' : 'bg-[#0084FF] hover:scale-110'
                }`}
              >
                {isFollowing || hasSentRequest ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                ) : (
                  <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                )}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLike(item);
            }}
            aria-label="Thả tim"
            className="flex flex-col items-center gap-1 text-white group"
          >
            <span className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-xs flex items-center justify-center group-active:scale-90 transition-transform">
              <Heart
                className={`w-7 h-7 transition-colors ${liked ? 'text-[#FF3040]' : 'text-white'}`}
                fill={liked ? '#FF3040' : 'none'}
              />
            </span>
            <span className="text-[12px] font-bold drop-shadow-xs tabular-nums">{item.likes.length}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments(item);
            }}
            aria-label="Bình luận"
            className="flex flex-col items-center gap-1 text-white group"
          >
            <span className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-xs flex items-center justify-center group-active:scale-90 transition-transform">
              <MessageCircle className="w-7 h-7" fill="currentColor" />
            </span>
            <span className="text-[12px] font-bold drop-shadow-xs tabular-nums">{item.replies.length}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSave(item);
            }}
            aria-label="Lưu video"
            className="flex flex-col items-center gap-1 text-white group"
          >
            <span className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-xs flex items-center justify-center group-active:scale-90 transition-transform">
              <Bookmark
                className={`w-7 h-7 transition-colors ${saved ? 'text-[#0084FF]' : 'text-white'}`}
                fill={saved ? '#0084FF' : 'none'}
              />
            </span>
            <span className="text-[12px] font-bold drop-shadow-xs tabular-nums">{item.savedBy.length}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShare(item);
            }}
            aria-label="Chia sẻ"
            className="flex flex-col items-center gap-1 text-white group"
          >
            <span className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-xs flex items-center justify-center group-active:scale-90 transition-transform">
              <Share2 className="w-6 h-6" />
            </span>
            <span className="text-[12px] font-bold drop-shadow-xs tabular-nums">{item.sharesCount}</span>
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              aria-label="Xóa video"
              className="w-10 h-10 rounded-full bg-black/45 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Spinning Vinyl Audio Disc */}
          <div
            className={`w-10 h-10 rounded-full p-1.5 bg-gradient-to-tr from-zinc-900 via-zinc-700 to-zinc-900 ring-2 ring-zinc-800 shadow-lg flex items-center justify-center ${
              isActive && !paused ? 'animate-vinyl-spin' : ''
            }`}
            aria-hidden="true"
          >
            <Avatar src={displayAvatar} name={displayName} size="xs" className="!w-6 !h-6" />
          </div>
        </div>

        {/* Bottom Interactive Scrubber Bar */}
        <div
          onClick={handleSeek}
          role="slider"
          aria-label="Tiến độ video"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="absolute inset-x-0 bottom-0 z-30 h-3 flex items-end cursor-pointer group/bar"
        >
          <div className="w-full h-[3px] group-hover/bar:h-[6px] bg-white/25 transition-all">
            <div
              className="h-full bg-[#0084FF] transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReelsView({
  stories,
  posts,
  currentUser,
  userMap,
  initialReelId,
  openUploadSignal = 0,
  onOpenProfile,
  onOpenAuth,
  onToast,
}: ReelsViewProps) {
  const [tab, setTab] = useState<ReelsTab>('foryou');
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  const [commentsItemId, setCommentsItemId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('public');
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const guest = isGuestUser(currentUser);
  const myFriends = useMemo(
    () => (Array.isArray(currentUser?.friends) ? currentUser.friends : []),
    [currentUser]
  );

  // Combine all video Reels (video stories + legacy video posts) sorted newest first
  const allVideoItems = useMemo<ReelFeedItem[]>(() => {
    const fromStories: ReelFeedItem[] = stories
      .filter((s) => s.type === 'video' && Boolean(s.videoUrl))
      .map((s) => ({
        id: s.id,
        source: 'story',
        authorUid: s.authorUid,
        authorName: s.authorName,
        authorAvatar: s.authorAvatar,
        videoUrl: s.videoUrl!,
        videoPoster: s.videoPoster,
        caption: s.caption || '',
        createdAt: s.createdAt,
        likes: Array.isArray(s.likes) ? s.likes : [],
        savedBy: Array.isArray(s.savedBy) ? s.savedBy : [],
        sharesCount: Number(s.sharesCount) || 0,
        replies: Array.isArray(s.replies) ? s.replies : [],
      }));

    const fromPosts: ReelFeedItem[] = posts
      .filter((p) => Boolean(p.videoUrl))
      .map((p) => ({
        id: p.id,
        source: 'post',
        authorUid: p.authorUid,
        authorName: p.authorName,
        authorAvatar: p.authorAvatar,
        videoUrl: p.videoUrl!,
        videoPoster: p.videoPoster,
        caption: p.content || '',
        createdAt: p.createdAt,
        likes: Object.keys(p.reactions || {}),
        savedBy: Array.isArray(p.savedBy) ? p.savedBy : [],
        sharesCount: Number(p.sharesCount) || 0,
        replies: Array.isArray(p.comments) ? p.comments : [],
      }));

    return [...fromStories, ...fromPosts].sort(
      (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
    );
  }, [stories, posts]);

  const feedItems = useMemo(() => {
    if (tab === 'following') {
      return allVideoItems.filter(
        (i) => i.authorUid === currentUser?.uid || myFriends.includes(i.authorUid)
      );
    }
    return allVideoItems;
  }, [tab, allVideoItems, currentUser?.uid, myFriends]);

  const activeCommentsItem = useMemo(
    () => feedItems.find((i) => i.id === commentsItemId) || null,
    [feedItems, commentsItemId]
  );

  useEffect(() => {
    if (!initialReelId) return;
    const idx = allVideoItems.findIndex((r) => r.id === initialReelId);
    if (idx >= 0) {
      setTab('foryou');
      setActiveIndex(idx);
      setTimeout(() => {
        const el = scrollContainerRef.current;
        if (el) el.scrollTo({ top: idx * el.clientHeight, behavior: 'auto' });
      }, 60);
    }
  }, [initialReelId, allVideoItems]);

  const lastUploadSignalRef = useRef(openUploadSignal);
  useEffect(() => {
    if (openUploadSignal === lastUploadSignalRef.current) return;
    lastUploadSignalRef.current = openUploadSignal;
    if (guest) {
      onToast('Đăng nhập tài khoản để đăng video lên Reels.');
      onOpenAuth();
      return;
    }
    setUploadOpen(true);
  }, [openUploadSignal, guest, onOpenAuth, onToast]);

  const scrollToIndex = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(feedItems.length - 1, nextIndex));
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTo({ top: clamped * el.clientHeight, behavior: 'smooth' });
      }
      setActiveIndex(clamped);
    },
    [feedItems.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || uploadOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToIndex(activeIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToIndex(activeIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, scrollToIndex, uploadOpen]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el || !el.clientHeight) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    if (idx !== activeIndex && idx >= 0 && idx < feedItems.length) {
      setActiveIndex(idx);
    }
  };

  const handleLike = async (item: ReelFeedItem, forceLike = false) => {
    if (!currentUser || guest) {
      onToast('Đăng nhập tài khoản để thả tim.');
      onOpenAuth();
      return;
    }
    const alreadyLiked = item.likes.includes(currentUser.uid);
    if (forceLike && alreadyLiked) return;
    try {
      if (item.source === 'story') {
        await updateDoc(doc(db, 'stories', item.id), {
          likes: alreadyLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
        });
      } else {
        await updateDoc(doc(db, 'posts', item.id), {
          [`reactions.${currentUser.uid}`]: alreadyLiked ? deleteField() : 'love',
        });
      }
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const handleSave = async (item: ReelFeedItem) => {
    if (!currentUser || guest) {
      onToast('Đăng nhập để lưu video.');
      onOpenAuth();
      return;
    }
    const saved = item.savedBy.includes(currentUser.uid);
    const col = item.source === 'story' ? 'stories' : 'posts';
    try {
      await updateDoc(doc(db, col, item.id), {
        savedBy: saved ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      });
      onToast(saved ? 'Đã bỏ lưu video.' : 'Đã lưu vào mục Yêu thích.');
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const handleShare = async (item: ReelFeedItem) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#reel-${item.id}`);
      onToast('Đã sao chép liên kết video!');
      if (currentUser && !guest) {
        const col = item.source === 'story' ? 'stories' : 'posts';
        updateDoc(doc(db, col, item.id), { sharesCount: increment(1) }).catch(() => {});
      }
    } catch {
      onToast('Không thể sao chép liên kết.');
    }
  };

  const handleDelete = async (item: ReelFeedItem) => {
    const col = item.source === 'story' ? 'stories' : 'posts';
    try {
      await deleteDoc(doc(db, col, item.id));
      if (commentsItemId === item.id) setCommentsItemId(null);
      onToast('Đã xóa video.');
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const handleFollowCreator = async (authorUid: string, authorName: string) => {
    if (!currentUser || guest) {
      onToast('Đăng nhập tài khoản để kết bạn với nhà sáng tạo.');
      onOpenAuth();
      return;
    }
    try {
      await updateDoc(doc(db, 'users', authorUid), {
        friendRequests: arrayUnion(currentUser.uid),
      });
      pushNotification(authorUid, {
        fromUid: currentUser.uid,
        fromName: currentUser.name,
        fromAvatar: currentUser.avatar,
        type: 'friend',
        text: 'đã gửi lời mời kết bạn từ Twin Reels.',
      }).catch(() => {});
      onToast(`Đã gửi lời mời kết bạn tới ${authorName}.`);
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommentsItem) return;
    if (!currentUser || guest) {
      onToast('Đăng nhập tài khoản để bình luận.');
      onOpenAuth();
      return;
    }
    const clean = replyText.trim();
    if (!clean) return;
    setSendingReply(true);
    try {
      const commentObj: TwinStoryReply = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || DEFAULT_AVATAR,
        text: clean,
        createdAt: Date.now(),
      };
      if (activeCommentsItem.source === 'story') {
        await updateDoc(doc(db, 'stories', activeCommentsItem.id), {
          replies: arrayUnion(commentObj),
        });
        if (activeCommentsItem.authorUid !== currentUser.uid) {
          const chatId = getChatId(currentUser.uid, activeCommentsItem.authorUid);
          await addDoc(collection(db, 'messages', chatId, 'items'), {
            senderUid: currentUser.uid,
            senderName: currentUser.name,
            text: clean,
            storyReply: {
              storyId: activeCommentsItem.id,
              type: 'video',
              previewText: (activeCommentsItem.caption || 'Video Reels').slice(0, 80),
            },
            createdAt: serverTimestamp(),
          });
          pushNotification(activeCommentsItem.authorUid, {
            fromUid: currentUser.uid,
            fromName: currentUser.name,
            fromAvatar: currentUser.avatar,
            type: 'message',
            storyId: activeCommentsItem.id,
            text: `đã bình luận Reels của bạn: "${clean.slice(0, 45)}"`,
          }).catch(() => {});
        }
      } else {
        await updateDoc(doc(db, 'posts', activeCommentsItem.id), {
          comments: arrayUnion(commentObj),
        });
        pushNotification(activeCommentsItem.authorUid, {
          fromUid: currentUser.uid,
          fromName: currentUser.name,
          fromAvatar: currentUser.avatar,
          type: 'comment',
          postId: activeCommentsItem.id,
          text: `đã bình luận video của bạn: "${clean.slice(0, 45)}"`,
        }).catch(() => {});
      }
      setReplyText('');
    } catch (err) {
      onToast(friendlyError(err));
    } finally {
      setSendingReply(false);
    }
  };

  // Reels strictly uploads Text (caption) + Video
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || guest) {
      onOpenAuth();
      return;
    }
    if (!videoFile) {
      onToast('Vui lòng chọn tệp video để đăng lên Reels.');
      return;
    }
    setUploading(true);
    setUploadPct(0);
    try {
      const uploaded = await uploadVideoToCloudinary(videoFile, (pct) => setUploadPct(pct));
      const allowedFriendUids =
        privacy === 'friends' && Array.isArray(currentUser.friends) ? currentUser.friends : [];

      await addDoc(collection(db, 'stories'), {
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || DEFAULT_AVATAR,
        type: 'video',
        videoUrl: uploaded.url,
        videoPoster: uploaded.poster,
        duration: uploaded.duration,
        imageUrl: '',
        caption: caption.trim(),
        text: '',
        bgId: '',
        privacy,
        allowedFriendUids,
        likes: [],
        savedBy: [],
        sharesCount: 0,
        replies: [],
        createdAt: serverTimestamp(),
      });

      setVideoFile(null);
      setVideoPreview('');
      setCaption('');
      setUploadOpen(false);
      setTab('foryou');
      setActiveIndex(0);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      onToast('Đã đăng video lên Twin Reels!');
    } catch (err) {
      onToast(friendlyError(err));
    } finally {
      setUploading(false);
      setUploadPct(null);
    }
  };

  return (
    <div className="w-full h-[calc(100dvh-116px)] md:h-[calc(100dvh-56px)] flex flex-col bg-[#F5F6F8] dark:bg-[#0A0D12] overflow-hidden">
      {/* Unified Twin Sub-Toolbar for Reels (Dành cho bạn | Bạn bè + Desktop Đăng Video) */}
      <div className="shrink-0 h-12 px-3 sm:px-6 bg-white dark:bg-[#131822] border-b border-[#E5E7EB] dark:border-[#232B3A] flex items-center justify-center md:justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F2F4F7] dark:bg-[#1D2432]">
          {(
            [
              { id: 'foryou', label: 'Dành cho bạn' },
              { id: 'following', label: 'Bạn bè' },
            ] as { id: ReelsTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setActiveIndex(0);
                setCommentsItemId(null);
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
              }}
              className={`h-8 px-3.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-white dark:bg-[#131822] text-[#0084FF] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F1419] dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (guest) {
              onToast('Đăng nhập tài khoản để đăng video lên Reels.');
              onOpenAuth();
              return;
            }
            setUploadOpen(true);
          }}
          className="hidden md:inline-flex h-9 px-3.5 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-xs sm:text-sm font-semibold items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span>Đăng video</span>
        </button>
      </div>

      {/* Main TikTok Vertical Snap-Scroll Stage + Comments Drawer */}
      <div className="relative flex-1 min-h-0 flex">
        <div className="relative flex-1 h-full flex items-center justify-center">
          {feedItems.length === 0 ? (
            <div className="max-w-sm mx-auto px-6 py-10 bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl text-center">
              <Clapperboard className="w-11 h-11 text-slate-400 mx-auto" />
              <h2 className="mt-3 text-base font-bold text-[#0F1419] dark:text-white">
                {tab === 'following' ? 'Bạn bè chưa đăng video nào' : 'Chưa có video Reels nào'}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Đăng video kèm mô tả đầu tiên để bắt đầu lướt Reels trên Twin.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (guest) onOpenAuth();
                  else setUploadOpen(true);
                }}
                className="mt-5 h-10 px-5 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Đăng video ngay
              </button>
            </div>
          ) : (
            <>
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
              >
                {feedItems.map((item, idx) => (
                  <TikTokCard
                    key={`${item.source}-${item.id}`}
                    item={item}
                    isActive={idx === activeIndex}
                    muted={muted}
                    currentUser={currentUser}
                    authorUser={userMap[item.authorUid]}
                    onToggleMute={() => setMuted((m) => !m)}
                    onLike={handleLike}
                    onSave={handleSave}
                    onShare={handleShare}
                    onDelete={handleDelete}
                    onOpenComments={(it) => setCommentsItemId((prev) => (prev === it.id ? null : it.id))}
                    onFollowCreator={handleFollowCreator}
                    onOpenProfile={onOpenProfile}
                  />
                ))}
              </div>

              {/* Desktop Floating Up/Down Controls in Unified Twin Surface */}
              <div className="hidden md:flex flex-col items-center gap-2.5 absolute right-6 top-1/2 -translate-y-1/2 z-20">
                <button
                  type="button"
                  disabled={activeIndex <= 0}
                  onClick={() => scrollToIndex(activeIndex - 1)}
                  aria-label="Video trước"
                  className="w-11 h-11 rounded-full bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] hover:border-[#0084FF] disabled:opacity-30 text-[#0F1419] dark:text-white flex items-center justify-center shadow-sm transition-colors"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {activeIndex + 1}/{feedItems.length}
                </span>
                <button
                  type="button"
                  disabled={activeIndex >= feedItems.length - 1}
                  onClick={() => scrollToIndex(activeIndex + 1)}
                  aria-label="Video tiếp theo"
                  className="w-11 h-11 rounded-full bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] hover:border-[#0084FF] disabled:opacity-30 text-[#0F1419] dark:text-white flex items-center justify-center shadow-sm transition-colors"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Comments Drawer (Desktop Right Panel / Mobile Bottom Sheet) */}
        {activeCommentsItem && (
          <div
            className="fixed md:static inset-0 z-40 md:z-20 bg-black/50 md:bg-transparent flex items-end md:items-stretch"
            onClick={() => setCommentsItemId(null)}
          >
            <aside
              onClick={(e) => e.stopPropagation()}
              className="w-full md:w-[360px] h-[68dvh] md:h-full bg-white dark:bg-[#131822] text-[#0F1419] dark:text-white rounded-t-3xl md:rounded-none md:border-l border-[#E5E7EB] dark:border-[#232B3A] flex flex-col overflow-hidden"
            >
              <div className="md:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5" />

              <div className="px-4 py-3 border-b border-[#EEF0F4] dark:border-[#232B3A] flex items-center justify-between">
                <h3 className="text-sm font-bold tabular-nums">
                  {activeCommentsItem.replies.length} bình luận
                </h3>
                <button
                  type="button"
                  onClick={() => setCommentsItemId(null)}
                  aria-label="Đóng bình luận"
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-[#1D2432] flex items-center justify-center text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {activeCommentsItem.replies.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                    Chưa có bình luận nào. Hãy là người đầu tiên bình luận!
                  </p>
                ) : (
                  activeCommentsItem.replies.map((r) => (
                    <div key={r.id} className="flex items-start gap-2.5">
                      <button type="button" onClick={() => onOpenProfile(r.authorUid)} className="shrink-0">
                        <Avatar src={r.authorAvatar} name={r.authorName} size="sm" />
                      </button>
                      <div className="min-w-0 flex-1 bg-[#F2F4F7] dark:bg-[#1D2432] rounded-2xl px-3.5 py-2">
                        <button
                          type="button"
                          onClick={() => onOpenProfile(r.authorUid)}
                          className="text-xs font-bold text-[#0F1419] dark:text-white hover:underline"
                        >
                          {r.authorName}
                        </button>
                        <p className="text-[13.5px] text-[#0F1419] dark:text-slate-200 leading-snug mt-0.5 break-words">
                          {r.text}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">{formatTime(r.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={handleSendComment}
                className="p-3 border-t border-[#EEF0F4] dark:border-[#232B3A] flex items-center gap-2 pb-safe"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={guest ? 'Đăng nhập để bình luận...' : 'Thêm bình luận...'}
                  className="flex-1 h-10 px-4 rounded-full bg-[#F2F4F7] dark:bg-[#1D2432] text-sm text-[#0F1419] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF]/40"
                />
                <button
                  type="submit"
                  disabled={sendingReply || !replyText.trim()}
                  aria-label="Gửi bình luận"
                  className="w-10 h-10 rounded-full bg-[#0084FF] hover:bg-[#0073E6] disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </aside>
          </div>
        )}
      </div>

      {/* Upload Video + Text Modal (Reels Only) */}
      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setUploadOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#131822] text-[#0F1419] dark:text-white border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EEF0F4] dark:border-[#232B3A]">
              <h3 className="text-base font-bold">Đăng video lên Reels</h3>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                aria-label="Đóng"
                className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-[#1D2432] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
              {videoPreview ? (
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video src={videoPreview} controls className="w-full max-h-64 object-contain" />
                  <button
                    type="button"
                    onClick={() => {
                      setVideoFile(null);
                      setVideoPreview('');
                    }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="h-44 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#0084FF] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                  <Upload className="w-7 h-7 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Chọn tệp video (MP4, MOV, WebM)
                  </span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setVideoFile(f);
                      setVideoPreview(URL.createObjectURL(f));
                    }}
                    hidden
                  />
                </label>
              )}

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                placeholder="Viết nội dung, mô tả cho video..."
                className="w-full p-3 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm resize-none focus:outline-none focus:border-[#0084FF]"
              />

              {uploadPct !== null && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-[#0084FF] transition-all" style={{ width: `${uploadPct}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Đang tải video... {uploadPct}%
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value as PrivacyLevel)}
                  className="h-10 px-3 rounded-xl bg-[#F2F4F7] dark:bg-[#1D2432] text-xs font-semibold focus:outline-none"
                >
                  {PRIVACY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#131822]">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={uploading || !videoFile}
                  className="h-10 px-5 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] disabled:opacity-45 text-white text-sm font-semibold transition-colors"
                >
                  {uploading ? 'Đang đăng...' : 'Đăng Reels'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
