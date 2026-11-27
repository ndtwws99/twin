import { useRef, useState } from 'react';
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Heart, Image as ImageIcon, Plus, Send, Trash2, Type, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { DEFAULT_AVATAR, getStoryBgCss, STORY_BACKGROUNDS } from '../lib/config';
import { PRIVACY_OPTIONS } from '../lib/constants';
import {
  db,
  formatTime,
  friendlyError,
  getChatId,
  isGuestUser,
  isUserAdmin,
  pushNotification,
  uploadImageToCloudinary,
} from '../lib/firebase';
import type { PrivacyLevel, TwinStory, TwinUser } from '../types';

interface StoriesBarProps {
  stories: TwinStory[];
  currentUser: TwinUser | null;
  onOpenAuth: () => void;
  onOpenProfile: (uid: string) => void;
  onToast: (msg: string) => void;
}

export function StoriesBar({
  stories,
  currentUser,
  onOpenAuth,
  onOpenProfile,
  onToast,
}: StoriesBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewingStory, setViewingStory] = useState<TwinStory | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'image' | 'text'>('image');
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyPreview, setStoryPreview] = useState('');
  const [storyText, setStoryText] = useState('');
  const [storyBg, setStoryBg] = useState(STORY_BACKGROUNDS[0].id);
  const [storyPrivacy, setStoryPrivacy] = useState<PrivacyLevel>('public');
  const [publishing, setPublishing] = useState(false);

  const guest = isGuestUser(currentUser);
  const photoAndTextStories = stories.filter((s) => s.type !== 'video').slice(0, 20);

  const scrollStories = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  const handleOpenCreate = () => {
    if (guest) {
      onToast('Đăng nhập tài khoản để tạo tin mới.');
      onOpenAuth();
      return;
    }
    setCreateOpen(true);
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoryFile(file);
    setStoryPreview(URL.createObjectURL(file));
  };

  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || guest) return;
    if (createMode === 'image' && !storyFile) {
      onToast('Vui lòng chọn một hình ảnh cho tin.');
      return;
    }
    if (createMode === 'text' && !storyText.trim()) {
      onToast('Vui lòng nhập nội dung tin.');
      return;
    }
    setPublishing(true);
    try {
      let imageUrl = '';
      if (createMode === 'image' && storyFile) {
        imageUrl = await uploadImageToCloudinary(storyFile);
      }
      const allowedFriendUids =
        storyPrivacy === 'friends' && Array.isArray(currentUser.friends) ? currentUser.friends : [];

      await addDoc(collection(db, 'stories'), {
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || DEFAULT_AVATAR,
        type: createMode,
        imageUrl,
        caption: createMode === 'image' ? storyText.trim() : '',
        text: createMode === 'text' ? storyText.trim() : '',
        bgId: createMode === 'text' ? storyBg : '',
        privacy: storyPrivacy,
        allowedFriendUids,
        likes: [],
        savedBy: [],
        sharesCount: 0,
        replies: [],
        createdAt: serverTimestamp(),
      });

      setStoryFile(null);
      setStoryPreview('');
      setStoryText('');
      setCreateOpen(false);
      onToast('Đã đăng tin lên Twin!');
    } catch (err) {
      onToast(friendlyError(err));
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleLike = async (story: TwinStory) => {
    if (!currentUser || guest) {
      onToast('Đăng nhập để thả tim cho tin.');
      onOpenAuth();
      return;
    }
    const likes = Array.isArray(story.likes) ? story.likes : [];
    const liked = likes.includes(currentUser.uid);
    try {
      await updateDoc(doc(db, 'stories', story.id), {
        likes: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      });
      setViewingStory((prev) =>
        prev && prev.id === story.id
          ? {
              ...prev,
              likes: liked
                ? likes.filter((id) => id !== currentUser.uid)
                : [...likes, currentUser.uid],
            }
          : prev
      );
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingStory || !currentUser || guest) {
      onToast('Đăng nhập để trả lời tin.');
      onOpenAuth();
      return;
    }
    const clean = replyText.trim();
    if (!clean) return;
    setSendingReply(true);
    try {
      const replyItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || DEFAULT_AVATAR,
        text: clean,
        createdAt: Date.now(),
      };
      await updateDoc(doc(db, 'stories', viewingStory.id), {
        replies: arrayUnion(replyItem),
      });
      if (viewingStory.authorUid !== currentUser.uid) {
        const chatId = getChatId(currentUser.uid, viewingStory.authorUid);
        await addDoc(collection(db, 'messages', chatId, 'items'), {
          senderUid: currentUser.uid,
          senderName: currentUser.name,
          text: clean,
          storyReply: {
            storyId: viewingStory.id,
            type: viewingStory.type,
            previewText: (viewingStory.text || viewingStory.caption || 'Tin của bạn').slice(0, 80),
          },
          createdAt: serverTimestamp(),
        });
        pushNotification(viewingStory.authorUid, {
          fromUid: currentUser.uid,
          fromName: currentUser.name,
          fromAvatar: currentUser.avatar,
          type: 'message',
          storyId: viewingStory.id,
          text: `đã trả lời tin của bạn: "${clean.slice(0, 45)}"`,
        }).catch(() => {});
      }
      setReplyText('');
      onToast('Đã gửi phản hồi!');
    } catch (err) {
      onToast(friendlyError(err));
    } finally {
      setSendingReply(false);
    }
  };

  const handleDeleteStory = async (story: TwinStory) => {
    try {
      await deleteDoc(doc(db, 'stories', story.id));
      setViewingStory(null);
      onToast('Đã xóa tin.');
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const myAvatar =
    currentUser?.avatar && currentUser.avatar !== DEFAULT_AVATAR ? currentUser.avatar : '';

  return (
    <>
      <section aria-label="Tin 24 giờ" className="relative group/strip">
        <div
          ref={scrollRef}
          className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5"
        >
          {/* Facebook-style Create Story Card in Unified Twin Theme */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="relative shrink-0 w-[110px] h-[190px] rounded-2xl overflow-hidden bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] flex flex-col text-center group"
          >
            <div className="relative w-full h-[138px] bg-[#E8EEF5] dark:bg-[#1D2432] overflow-hidden">
              {myAvatar ? (
                <img
                  src={myAvatar}
                  alt={currentUser?.name || 'Tạo tin'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#0084FF]/20 via-[#0084FF]/10 to-slate-200 dark:to-[#1D2432] flex items-center justify-center text-3xl font-extrabold text-[#0084FF]">
                  {(currentUser?.name || 'T').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/5 group-hover:bg-black/15 transition-colors" />
            </div>

            <div className="relative flex-1 bg-white dark:bg-[#131822] flex items-end justify-center pb-2.5">
              <span className="absolute -top-4.5 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-[#0084FF] text-white flex items-center justify-center ring-4 ring-white dark:ring-[#131822] group-hover:scale-105 transition-transform">
                <Plus className="w-5 h-5" strokeWidth={2.5} />
              </span>
              <span className="text-[12px] font-semibold text-[#0F1419] dark:text-white">
                Tạo tin
              </span>
            </div>
          </button>

          {/* Story Cards */}
          {photoAndTextStories.map((story) => (
            <button
              key={story.id}
              type="button"
              onClick={() => setViewingStory(story)}
              className="relative shrink-0 w-[110px] h-[190px] rounded-2xl overflow-hidden text-left group border border-black/5 dark:border-white/10"
              style={
                story.type === 'text'
                  ? { background: getStoryBgCss(story.bgId) }
                  : undefined
              }
            >
              {story.type === 'image' && story.imageUrl ? (
                <img
                  src={story.imageUrl}
                  alt={story.authorName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full p-2.5 flex items-center justify-center text-center">
                  <p className="text-xs font-bold text-white line-clamp-5 leading-snug">
                    {story.text || story.caption}
                  </p>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25 pointer-events-none" />

              <div className="absolute top-2.5 left-2.5 ring-[2.5px] ring-[#0084FF] rounded-full">
                <Avatar src={story.authorAvatar} name={story.authorName} size="xs" />
              </div>

              <p className="absolute bottom-2.5 left-2.5 right-2.5 text-[12px] font-semibold text-white leading-tight line-clamp-2 drop-shadow-xs">
                {story.authorName}
              </p>
            </button>
          ))}
        </div>

        {photoAndTextStories.length > 3 && (
          <>
            <button
              type="button"
              onClick={() => scrollStories(-1)}
              aria-label="Cuộn sang trái"
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-[#1D2432] border border-[#E5E7EB] dark:border-[#232B3A] shadow-md text-[#0F1419] dark:text-white items-center justify-center opacity-0 group-hover/strip:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollStories(1)}
              aria-label="Cuộn sang phải"
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-[#1D2432] border border-[#E5E7EB] dark:border-[#232B3A] shadow-md text-[#0F1419] dark:text-white items-center justify-center opacity-0 group-hover/strip:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </section>

      {/* Story Viewer Modal */}
      {viewingStory && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setViewingStory(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-[400px] h-[78vh] max-h-[700px] rounded-2xl overflow-hidden bg-slate-950 flex flex-col justify-between shadow-2xl"
            style={
              viewingStory.type === 'text'
                ? { background: getStoryBgCss(viewingStory.bgId) }
                : undefined
            }
            onClick={(e) => e.stopPropagation()}
          >
            {viewingStory.type === 'image' && viewingStory.imageUrl && (
              <img
                src={viewingStory.imageUrl}
                alt={viewingStory.authorName}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/80 pointer-events-none" />

            <div className="relative z-10 p-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setViewingStory(null);
                  onOpenProfile(viewingStory.authorUid);
                }}
                className="flex items-center gap-2.5 min-w-0 text-left"
              >
                <Avatar src={viewingStory.authorAvatar} name={viewingStory.authorName} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{viewingStory.authorName}</p>
                  <p className="text-xs text-white/75">{formatTime(viewingStory.createdAt)}</p>
                </div>
              </button>

              <div className="flex items-center gap-1.5">
                {currentUser && !guest && (viewingStory.authorUid === currentUser.uid || isUserAdmin(currentUser)) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteStory(viewingStory)}
                    aria-label="Xóa tin"
                    className="w-9 h-9 rounded-full bg-black/35 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingStory(null)}
                  aria-label="Đóng"
                  className="w-9 h-9 rounded-full bg-black/35 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {viewingStory.type === 'text' && (
              <div className="relative z-10 px-6 text-center">
                <p className="text-xl font-bold text-white leading-relaxed whitespace-pre-wrap">
                  {viewingStory.text}
                </p>
              </div>
            )}

            <div className="relative z-10 p-4 space-y-3">
              {viewingStory.type === 'image' && viewingStory.caption && (
                <p className="text-sm text-white/95 leading-snug">{viewingStory.caption}</p>
              )}

              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Trả lời tin..."
                  className="flex-1 h-10 px-4 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-sm text-white placeholder:text-white/70 focus:outline-none focus:border-white"
                />
                <button
                  type="button"
                  onClick={() => handleToggleLike(viewingStory)}
                  aria-label="Thả tim"
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    currentUser && Array.isArray(viewingStory.likes) && viewingStory.likes.includes(currentUser.uid)
                      ? 'bg-[#FF3040] text-white'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  <Heart className="w-4 h-4" fill="currentColor" />
                </button>
                <button
                  type="submit"
                  disabled={sendingReply || !replyText.trim()}
                  aria-label="Gửi"
                  className="w-10 h-10 rounded-full bg-[#0084FF] hover:bg-[#0073E6] disabled:opacity-50 text-white flex items-center justify-center transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Story Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setCreateOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EEF0F4] dark:border-[#232B3A]">
              <h3 className="text-base font-bold text-[#0F1419] dark:text-white">Tạo tin mới</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Đóng"
                className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-[#1D2432] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 p-1 bg-[#F2F4F7] dark:bg-[#1D2432] rounded-xl">
              <button
                type="button"
                onClick={() => setCreateMode('image')}
                className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  createMode === 'image'
                    ? 'bg-white dark:bg-[#131822] text-[#0F1419] dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                Tin ảnh
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('text')}
                className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  createMode === 'text'
                    ? 'bg-white dark:bg-[#131822] text-[#0F1419] dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Type className="w-4 h-4" />
                Tin văn bản
              </button>
            </div>

            <form onSubmit={handlePublishStory} className="mt-4 space-y-4">
              {createMode === 'image' ? (
                <div>
                  {storyPreview ? (
                    <div className="relative rounded-xl overflow-hidden h-64 bg-slate-900">
                      <img src={storyPreview} alt="Xem trước" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => {
                          setStoryFile(null);
                          setStoryPreview('');
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="h-44 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#0084FF] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                      <ImageIcon className="w-7 h-7 text-slate-400" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Chọn ảnh từ thiết bị
                      </span>
                      <input type="file" accept="image/*" onChange={handleSelectFile} hidden />
                    </label>
                  )}
                  <input
                    type="text"
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    placeholder="Thêm chú thích (tùy chọn)..."
                    className="mt-3 w-full h-10 px-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm focus:outline-none focus:border-[#0084FF]"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div
                    className="h-52 rounded-xl p-5 flex items-center justify-center"
                    style={{ background: getStoryBgCss(storyBg) }}
                  >
                    <textarea
                      value={storyText}
                      onChange={(e) => setStoryText(e.target.value)}
                      rows={4}
                      placeholder="Bắt đầu nhập..."
                      className="w-full bg-transparent text-center text-lg font-bold text-white placeholder:text-white/75 resize-none focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {STORY_BACKGROUNDS.map((bg) => (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => setStoryBg(bg.id)}
                        aria-label={bg.label}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          storyBg === bg.id ? 'ring-2 ring-offset-2 ring-[#0084FF] scale-110' : ''
                        }`}
                        style={{ background: bg.css }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <select
                  value={storyPrivacy}
                  onChange={(e) => setStoryPrivacy(e.target.value as PrivacyLevel)}
                  className="h-10 px-3 rounded-xl bg-[#F2F4F7] dark:bg-[#1D2432] text-xs font-semibold text-[#0F1419] dark:text-slate-200 focus:outline-none"
                >
                  {PRIVACY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={publishing}
                  className="h-10 px-5 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {publishing ? 'Đang đăng...' : 'Đăng tin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
