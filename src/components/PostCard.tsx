import { useState } from 'react';
import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  deleteField,
  doc,
  increment,
  updateDoc,
} from 'firebase/firestore';
import {
  Bookmark,
  Globe,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Send,
  Share2,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  Users,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { DEFAULT_AVATAR } from '../lib/config';
import { FEELINGS, getPrivacyLabel, getReactionMeta, PRIVACY_OPTIONS, REACTIONS } from '../lib/constants';
import {
  db,
  formatTime,
  friendlyError,
  getPostImages,
  isGuestUser,
  isUserAdmin,
  pushNotification,
} from '../lib/firebase';
import type { PrivacyLevel, ReactionKey, TwinComment, TwinPost, TwinUser } from '../types';

interface PostCardProps {
  post: TwinPost;
  currentUser: TwinUser | null;
  authorUser?: TwinUser;
  highlighted?: boolean;
  onOpenProfile: (uid: string) => void;
  onOpenLightbox: (images: string[], index: number) => void;
  onOpenAuth: () => void;
  onToast: (msg: string) => void;
}

export function PostCard({
  post,
  currentUser,
  authorUser,
  highlighted = false,
  onOpenProfile,
  onOpenLightbox,
  onOpenAuth,
  onToast,
}: PostCardProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingCmt, setSubmittingCmt] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editPrivacy, setEditPrivacy] = useState<PrivacyLevel>(post.privacy || 'public');
  const [savingEdit, setSavingEdit] = useState(false);

  const guest = isGuestUser(currentUser);
  const isOwner = Boolean(currentUser && !guest && post.authorUid === currentUser.uid);
  const canManage = isOwner || isUserAdmin(currentUser);

  const reactions = post.reactions || {};
  const reactionEntries = Object.entries(reactions);
  const totalReactions = reactionEntries.length;
  const myReactionKey = currentUser && !guest ? reactions[currentUser.uid] : undefined;
  const myReaction = getReactionMeta(myReactionKey);

  const topReactionEmojis = Array.from(
    new Set(reactionEntries.map(([, k]) => getReactionMeta(k)?.emoji).filter(Boolean))
  ).slice(0, 3);

  const comments: TwinComment[] = Array.isArray(post.comments) ? post.comments : [];
  const savedBy = Array.isArray(post.savedBy) ? post.savedBy : [];
  const isSaved = Boolean(currentUser && !guest && savedBy.includes(currentUser.uid));
  const images = getPostImages(post);

  const feelingObj = post.feeling ? FEELINGS.find((f) => f.value === post.feeling) : null;
  const displayName = authorUser?.name || post.authorName || 'Thành viên Twin';
  const displayAvatar = authorUser?.avatar || post.authorAvatar;
  const authorIsAdmin = isUserAdmin(authorUser);

  const handleReact = async (key: ReactionKey) => {
    setShowPicker(false);
    if (!currentUser || guest) {
      onToast('Đăng nhập tài khoản để thả cảm xúc.');
      onOpenAuth();
      return;
    }
    const ref = doc(db, 'posts', post.id);
    try {
      if (myReactionKey === key) {
        await updateDoc(ref, { [`reactions.${currentUser.uid}`]: deleteField() });
      } else {
        await updateDoc(ref, { [`reactions.${currentUser.uid}`]: key });
        const meta = getReactionMeta(key);
        pushNotification(post.authorUid, {
          fromUid: currentUser.uid,
          fromName: currentUser.name,
          fromAvatar: currentUser.avatar,
          type: 'reaction',
          postId: post.id,
          text: `đã bày tỏ cảm xúc ${meta?.emoji || ''} về bài viết của bạn.`,
        }).catch(() => {});
      }
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || guest) {
      onToast('Đăng nhập tài khoản để bình luận.');
      onOpenAuth();
      return;
    }
    const clean = commentText.trim();
    if (!clean) return;
    setSubmittingCmt(true);
    try {
      const newCmt: TwinComment = {
        id: Date.now().toString(),
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || DEFAULT_AVATAR,
        text: clean,
        createdAt: Date.now(),
      };
      await updateDoc(doc(db, 'posts', post.id), {
        comments: arrayUnion(newCmt),
      });
      setCommentText('');
      setShowComments(true);
      pushNotification(post.authorUid, {
        fromUid: currentUser.uid,
        fromName: currentUser.name,
        fromAvatar: currentUser.avatar,
        type: 'comment',
        postId: post.id,
        text: `đã bình luận bài viết của bạn: "${clean.slice(0, 45)}"`,
      }).catch(() => {});
    } catch (err) {
      onToast(friendlyError(err));
    } finally {
      setSubmittingCmt(false);
    }
  };

  const handleToggleSave = async () => {
    if (!currentUser || guest) {
      onToast('Đăng nhập tài khoản để lưu bài viết.');
      onOpenAuth();
      return;
    }
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        savedBy: isSaved ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      });
      onToast(isSaved ? 'Đã bỏ lưu bài viết.' : 'Đã lưu bài viết.');
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      onToast('Đã sao chép liên kết bài viết.');
      if (currentUser && !guest) {
        updateDoc(doc(db, 'posts', post.id), { sharesCount: increment(1) }).catch(() => {});
      }
    } catch {
      onToast('Không thể sao chép liên kết.');
    }
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        content: editContent.trim(),
        privacy: editPrivacy,
      });
      setEditing(false);
      onToast('Đã cập nhật bài viết.');
    } catch (err) {
      onToast(friendlyError(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      onToast('Đã xóa bài viết.');
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  const PrivacyIcon =
    post.privacy === 'friends' ? Users : post.privacy === 'private' ? Lock : Globe;

  return (
    <article
      id={`post-${post.id}`}
      className={`bg-white dark:bg-[#131822] rounded-2xl border transition-colors ${
        highlighted
          ? 'border-[#0084FF] ring-2 ring-[#0084FF]/25'
          : 'border-[#E5E7EB] dark:border-[#232B3A]'
      }`}
    >
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button type="button" onClick={() => onOpenProfile(post.authorUid)} className="shrink-0">
            <Avatar src={displayAvatar} name={displayName} size="md" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap leading-snug">
              <button
                type="button"
                onClick={() => onOpenProfile(post.authorUid)}
                className="text-[15px] font-bold text-[#0F1419] dark:text-white hover:underline truncate"
              >
                {displayName}
              </button>
              {authorIsAdmin && (
                <ShieldCheck className="w-4 h-4 text-[#0084FF] shrink-0" aria-label="Quản trị viên" />
              )}
              {feelingObj && (
                <span className="text-[13px] text-slate-500 dark:text-slate-400">
                  đang cảm thấy {feelingObj.emoji} <strong className="font-semibold text-[#0F1419] dark:text-white">{feelingObj.label.toLowerCase()}</strong>
                </span>
              )}
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <span>{formatTime(post.createdAt)}</span>
              <span aria-hidden="true">·</span>
              <PrivacyIcon className="w-3 h-3 shrink-0" aria-label={getPrivacyLabel(post.privacy)} />
            </p>
          </div>
        </div>

        {/* Overflow Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Tùy chọn bài viết"
            className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-[#1D2432] flex items-center justify-center text-slate-500 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-48 bg-white dark:bg-[#19202D] border border-[#E5E7EB] dark:border-[#232B3A] rounded-xl shadow-xl p-1.5 z-20">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleToggleSave();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[#0F1419] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#232B3A]"
              >
                <Bookmark className="w-4 h-4" />
                <span>{isSaved ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}</span>
              </button>

              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setEditContent(post.content || '');
                      setEditPrivacy(post.privacy || 'public');
                      setEditing(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[#0F1419] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#232B3A]"
                  >
                    <Pencil className="w-4 h-4" />
                    <span>Chỉnh sửa bài viết</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa bài viết</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Text Content or Inline Editor */}
      {editing ? (
        <div className="px-4 pb-3 space-y-2.5">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full p-3 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm focus:outline-none focus:border-[#0084FF]"
          />
          <div className="flex items-center justify-between gap-2">
            <select
              value={editPrivacy}
              onChange={(e) => setEditPrivacy(e.target.value as PrivacyLevel)}
              className="h-9 px-2.5 rounded-lg bg-[#F2F4F7] dark:bg-[#1D2432] text-xs font-semibold focus:outline-none"
            >
              {PRIVACY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-9 px-3.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1D2432]"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEdit}
                className="h-9 px-4 rounded-lg bg-[#0084FF] text-white text-xs font-semibold hover:bg-[#0073E6]"
              >
                {savingEdit ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        post.content && (
          <div className="px-4 pb-3 text-[15px] leading-[1.5] text-[#0F1419] dark:text-slate-100 whitespace-pre-wrap break-words">
            {post.content}
          </div>
        )
      )}

      {/* Facebook-Style Image Grid */}
      {images.length > 0 && (
        <div
          className={`grid gap-0.5 overflow-hidden border-y border-[#EEF0F4] dark:border-[#232B3A] ${
            images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {images.slice(0, 4).map((img, idx) => (
            <button
              key={`${img}-${idx}`}
              type="button"
              onClick={() => onOpenLightbox(images, idx)}
              className={`relative overflow-hidden bg-slate-100 dark:bg-slate-900 ${
                images.length === 1 ? 'max-h-[560px]' : 'aspect-square'
              } ${images.length === 3 && idx === 0 ? 'col-span-2 aspect-[16/10]' : ''}`}
            >
              <img
                src={img}
                alt={`Hình ảnh bài viết ${idx + 1}`}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="w-full h-full object-cover hover:brightness-95 transition-all"
              />
              {idx === 3 && images.length > 4 && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white tabular-nums">+{images.length - 4}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Reaction & Comment Counters Row */}
      {(totalReactions > 0 || comments.length > 0 || (post.sharesCount || 0) > 0) && (
        <div className="px-4 py-2.5 flex items-center justify-between text-[13px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            {topReactionEmojis.length > 0 && (
              <span className="inline-flex items-center -space-x-1 text-[15px]">
                {topReactionEmojis.map((em, i) => (
                  <span
                    key={i}
                    className="w-5 h-5 rounded-full bg-white dark:bg-[#131822] flex items-center justify-center ring-1 ring-white dark:ring-[#131822]"
                  >
                    {em}
                  </span>
                ))}
              </span>
            )}
            {totalReactions > 0 && <span className="tabular-nums">{totalReactions}</span>}
          </div>

          <div className="flex items-center gap-3 tabular-nums">
            {comments.length > 0 && (
              <button
                type="button"
                onClick={() => setShowComments((prev) => !prev)}
                className="hover:underline"
              >
                {comments.length} bình luận
              </button>
            )}
            {(post.sharesCount || 0) > 0 && <span>{post.sharesCount} lượt chia sẻ</span>}
          </div>
        </div>
      )}

      {/* 3-Column Facebook Action Bar */}
      <div className="mx-3 py-1 border-t border-[#EEF0F4] dark:border-[#232B3A] grid grid-cols-3 gap-1">
        <div
          className="relative"
          onMouseEnter={() => setShowPicker(true)}
          onMouseLeave={() => setShowPicker(false)}
        >
          {showPicker && (
            <div className="absolute bottom-full left-0 pb-2 z-20">
              <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white dark:bg-[#19202D] border border-[#E5E7EB] dark:border-[#232B3A] shadow-xl">
                {REACTIONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => handleReact(r.key)}
                    title={r.label}
                    className="w-9 h-9 rounded-full hover:scale-125 hover:-translate-y-1 transition-transform flex items-center justify-center text-[22px]"
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleReact(myReactionKey || 'like')}
            className="w-full h-9 rounded-xl hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432] flex items-center justify-center gap-2 text-[14px] font-semibold transition-colors"
            style={myReaction ? { color: myReaction.color } : undefined}
          >
            {myReaction ? (
              <span className="text-[17px] leading-none">{myReaction.emoji}</span>
            ) : (
              <ThumbsUp className="w-[18px] h-[18px] text-slate-500 dark:text-slate-400" />
            )}
            <span className={myReaction ? '' : 'text-slate-600 dark:text-slate-300'}>
              {myReaction ? myReaction.label : 'Thích'}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowComments((prev) => !prev)}
          className="h-9 rounded-xl hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432] flex items-center justify-center gap-2 text-[14px] font-semibold text-slate-600 dark:text-slate-300 transition-colors"
        >
          <MessageCircle className="w-[18px] h-[18px] text-slate-500 dark:text-slate-400" />
          <span>Bình luận</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="h-9 rounded-xl hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432] flex items-center justify-center gap-2 text-[14px] font-semibold text-slate-600 dark:text-slate-300 transition-colors"
        >
          <Share2 className="w-[18px] h-[18px] text-slate-500 dark:text-slate-400" />
          <span>Chia sẻ</span>
        </button>
      </div>

      {/* Comment Bubbles */}
      {showComments && (
        <div className="px-4 pt-2.5 pb-3.5 border-t border-[#EEF0F4] dark:border-[#232B3A] space-y-2.5">
          {comments.length > 0 && (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <button type="button" onClick={() => onOpenProfile(c.authorUid)} className="shrink-0 mt-0.5">
                    <Avatar src={c.authorAvatar} name={c.authorName} size="xs" />
                  </button>
                  <div className="min-w-0 max-w-[88%]">
                    <div className="inline-block bg-[#F2F4F7] dark:bg-[#1D2432] rounded-2xl px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onOpenProfile(c.authorUid)}
                        className="text-[13px] font-bold text-[#0F1419] dark:text-white hover:underline block"
                      >
                        {c.authorName}
                      </button>
                      <p className="text-[14px] text-[#0F1419] dark:text-slate-200 leading-snug break-words whitespace-pre-wrap">
                        {c.text}
                      </p>
                    </div>
                    <p className="mt-0.5 ml-3 text-[11px] text-slate-400">
                      {formatTime(c.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleComment} className="flex items-center gap-2 pt-0.5">
            <Avatar src={currentUser?.avatar} name={currentUser?.name || 'Khách'} size="xs" />
            <div className="flex-1 flex items-center h-9 px-3 rounded-full bg-[#F2F4F7] dark:bg-[#1D2432]">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={guest ? 'Đăng nhập để bình luận...' : 'Viết bình luận công khai...'}
                className="flex-1 bg-transparent text-[14px] text-[#0F1419] dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submittingCmt || !commentText.trim()}
                aria-label="Gửi bình luận"
                className="text-[#0084FF] disabled:opacity-35 hover:scale-105 transition-transform ml-1.5"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </article>
  );
}
