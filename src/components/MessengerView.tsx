import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ArrowLeft,
  FileText,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar } from './Avatar';
import {
  db,
  formatFileSize,
  formatTime,
  friendlyError,
  getChatId,
  getUserPresence,
  isGuestUser,
  pushNotification,
  uploadChatAttachmentToCloudinary,
} from '../lib/firebase';
import type { TwinMessage, TwinUser } from '../types';

interface MessengerViewProps {
  currentUser: TwinUser | null;
  users: TwinUser[];
  initialPeerUid?: string | null;
  unreadByPeer: Record<string, number>;
  onMarkPeerRead: (peerUid: string) => void;
  onOpenProfile: (uid: string) => void;
  onOpenLightbox: (images: string[], index: number) => void;
  onOpenAuth: () => void;
  onToast: (msg: string) => void;
}

export function MessengerView({
  currentUser,
  users,
  initialPeerUid,
  unreadByPeer,
  onMarkPeerRead,
  onOpenProfile,
  onOpenLightbox,
  onOpenAuth,
  onToast,
}: MessengerViewProps) {
  const [search, setSearch] = useState('');
  const [activePeerUid, setActivePeerUid] = useState<string | null>(initialPeerUid || null);
  const [messages, setMessages] = useState<TwinMessage[]>([]);
  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const guest = isGuestUser(currentUser);

  useEffect(() => {
    if (initialPeerUid) {
      setActivePeerUid(initialPeerUid);
    }
  }, [initialPeerUid]);

  const peerList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const myFriends = Array.isArray(currentUser?.friends) ? currentUser.friends : [];
    return users
      .filter((u) => u.uid !== currentUser?.uid)
      .filter((u) => !q || (u.name || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const aUnread = unreadByPeer[a.uid] || 0;
        const bUnread = unreadByPeer[b.uid] || 0;
        if (aUnread !== bUnread) return bUnread - aUnread;
        const aFriend = myFriends.includes(a.uid) ? 1 : 0;
        const bFriend = myFriends.includes(b.uid) ? 1 : 0;
        if (aFriend !== bFriend) return bFriend - aFriend;
        const aOn = getUserPresence(a).online ? 1 : 0;
        const bOn = getUserPresence(b).online ? 1 : 0;
        return bOn - aOn;
      });
  }, [users, currentUser, search, unreadByPeer]);

  const activePeer = useMemo(
    () => users.find((u) => u.uid === activePeerUid) || null,
    [users, activePeerUid]
  );

  // Subscribe to real-time messages for activePeer
  useEffect(() => {
    if (!currentUser || guest || !activePeerUid) {
      setMessages([]);
      return;
    }
    onMarkPeerRead(activePeerUid);
    const chatId = getChatId(currentUser.uid, activePeerUid);
    const q = query(collection(db, 'messages', chatId, 'items'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TwinMessage, 'id'>) }));
        setMessages(list);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
      },
      (err) => {
        console.warn('Messages listener error:', err);
      }
    );
    return () => unsub();
  }, [currentUser, guest, activePeerUid, onMarkPeerRead]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || guest) {
      onOpenAuth();
      return;
    }
    if (!activePeer) return;
    const clean = text.trim();
    if (!clean && !pendingFile) return;

    setSending(true);
    setUploadPct(null);
    const chatId = getChatId(currentUser.uid, activePeer.uid);
    try {
      const payload: Record<string, unknown> = {
        senderUid: currentUser.uid,
        senderName: currentUser.name,
        text: clean,
        createdAt: serverTimestamp(),
      };
      let notifText = clean ? `đã nhắn: "${clean.slice(0, 45)}"` : 'đã gửi một tin nhắn';

      if (pendingFile) {
        const uploaded = await uploadChatAttachmentToCloudinary(pendingFile, (pct) => setUploadPct(pct));
        if (uploaded.kind === 'image') {
          payload.imageUrl = uploaded.url;
          payload.fileName = uploaded.name;
          notifText = clean ? `đã gửi ảnh: "${clean.slice(0, 40)}"` : 'đã gửi một hình ảnh';
        } else if (uploaded.kind === 'video') {
          payload.videoUrl = uploaded.url;
          payload.videoPoster = uploaded.poster || '';
          payload.fileName = uploaded.name;
          notifText = 'đã gửi một video';
        } else {
          payload.fileUrl = uploaded.url;
          payload.fileName = uploaded.name;
          payload.fileSize = uploaded.size;
          payload.fileMime = uploaded.mime;
          notifText = `đã gửi tệp: ${uploaded.name}`;
        }
      }

      await addDoc(collection(db, 'messages', chatId, 'items'), payload);
      setText('');
      setPendingFile(null);

      pushNotification(activePeer.uid, {
        fromUid: currentUser.uid,
        fromName: currentUser.name,
        fromAvatar: currentUser.avatar,
        type: 'message',
        text: notifText,
      }).catch(() => {});
    } catch (err) {
      onToast(friendlyError(err));
    } finally {
      setSending(false);
      setUploadPct(null);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!currentUser || !activePeer) return;
    const chatId = getChatId(currentUser.uid, activePeer.uid);
    try {
      await deleteDoc(doc(db, 'messages', chatId, 'items', msgId));
    } catch (err) {
      onToast(friendlyError(err));
    }
  };

  if (guest) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-8">
          <MessageCircle className="w-10 h-10 text-[#0084FF] mx-auto" />
          <h2 className="mt-3 text-lg font-bold text-[#0F1419] dark:text-white">Twin Messenger</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Đăng nhập tài khoản Twin để trò chuyện trực tiếp và gửi ảnh, video cho bạn bè.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-5 h-10 px-6 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-sm font-semibold transition-colors"
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-0 sm:px-5 pt-0 sm:pt-4 pb-0 md:pb-6">
      <div className="h-[calc(100dvh-116px)] md:h-[calc(100dvh-88px)] bg-white dark:bg-[#131822] sm:border border-[#E5E7EB] dark:border-[#232B3A] sm:rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
        {/* Conversation List */}
        <aside
          className={`border-r border-[#E5E7EB] dark:border-[#232B3A] flex flex-col min-h-0 ${
            activePeer ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-[#EEF0F4] dark:border-[#232B3A] space-y-3">
            <h1 className="text-lg font-bold text-[#0F1419] dark:text-white">Tin nhắn</h1>
            <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-[#F2F4F7] dark:bg-[#1D2432]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm người liên hệ..."
                className="w-full bg-transparent text-sm text-[#0F1419] dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {peerList.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                Không tìm thấy thành viên nào.
              </p>
            ) : (
              peerList.map((u) => {
                const presence = getUserPresence(u);
                const unread = unreadByPeer[u.uid] || 0;
                const selected = u.uid === activePeerUid;
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => setActivePeerUid(u.uid)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${
                      selected
                        ? 'bg-[#0084FF]/10 dark:bg-[#0084FF]/15'
                        : 'hover:bg-[#F5F6F8] dark:hover:bg-[#1A2130]'
                    }`}
                  >
                    <Avatar src={u.avatar} name={u.name} size="md" online={presence.online} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#0F1419] dark:text-white truncate">
                          {u.name}
                        </p>
                        {unread > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#0084FF] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                            {unread}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {presence.label || 'Nhấn để nhắn tin'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Active Chat Thread */}
        <section
          className={`flex flex-col min-h-0 ${activePeer ? 'flex' : 'hidden md:flex'}`}
        >
          {!activePeer ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <MessageCircle className="w-11 h-11 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-base font-semibold text-[#0F1419] dark:text-white">
                Chọn một cuộc trò chuyện
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Bắt đầu nhắn tin thời gian thực với bạn bè trên Twin.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="h-16 px-4 border-b border-[#EEF0F4] dark:border-[#232B3A] flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActivePeerUid(null)}
                    aria-label="Quay lại danh sách"
                    className="md:hidden w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-[#1D2432] flex items-center justify-center text-slate-600 dark:text-slate-300"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProfile(activePeer.uid)}
                    className="flex items-center gap-3 min-w-0 text-left"
                  >
                    <Avatar
                      src={activePeer.avatar}
                      name={activePeer.name}
                      size="sm"
                      online={getUserPresence(activePeer).online}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F1419] dark:text-white truncate">
                        {activePeer.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {getUserPresence(activePeer).label || 'Thành viên Twin'}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8F9FB] dark:bg-[#0D1118]">
                {messages.length === 0 ? (
                  <div className="py-12 text-center">
                    <Avatar src={activePeer.avatar} name={activePeer.name} size="lg" className="mx-auto" />
                    <p className="mt-3 text-sm font-bold text-[#0F1419] dark:text-white">{activePeer.name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Hãy gửi lời chào đầu tiên!
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = m.senderUid === currentUser?.uid;
                    return (
                      <div
                        key={m.id}
                        className={`flex items-end gap-2 group ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isMine && <Avatar src={activePeer.avatar} name={activePeer.name} size="xs" />}
                        <div className={`max-w-[78%] sm:max-w-[68%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                          {m.storyReply && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 px-1">
                              Phản hồi tin: &ldquo;{m.storyReply.previewText}&rdquo;
                            </p>
                          )}

                          <div
                            className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                              isMine
                                ? 'bg-[#0084FF] text-white rounded-br-sm'
                                : 'bg-white dark:bg-[#19202D] text-[#0F1419] dark:text-slate-100 border border-[#E5E7EB] dark:border-[#232B3A] rounded-bl-sm'
                            }`}
                          >
                            {m.imageUrl && (
                              <button
                                type="button"
                                onClick={() => onOpenLightbox([m.imageUrl!], 0)}
                                className="block mb-1.5 rounded-xl overflow-hidden"
                              >
                                <img
                                  src={m.imageUrl}
                                  alt="Hình ảnh đính kèm"
                                  referrerPolicy="no-referrer"
                                  className="max-w-full max-h-64 object-cover"
                                />
                              </button>
                            )}

                            {m.videoUrl && (
                              <video
                                src={m.videoUrl}
                                poster={m.videoPoster || undefined}
                                controls
                                className="max-w-full max-h-64 rounded-xl mb-1.5"
                              />
                            )}

                            {m.fileUrl && (
                              <a
                                href={m.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center gap-2 p-2 rounded-xl mb-1 ${
                                  isMine ? 'bg-white/15 text-white' : 'bg-slate-100 dark:bg-[#232B3A]'
                                }`}
                              >
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="text-xs font-medium truncate">
                                  {m.fileName || 'Tệp đính kèm'}
                                  {m.fileSize ? ` (${formatFileSize(m.fileSize)})` : ''}
                                </span>
                              </a>
                            )}

                            {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                          </div>

                          <div className="mt-1 px-1 flex items-center gap-2 text-[10px] text-slate-400">
                            <span>{formatTime(m.createdAt)}</span>
                            {isMine && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                aria-label="Xóa tin nhắn"
                                className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input Bar */}
              <div className="p-3 border-t border-[#EEF0F4] dark:border-[#232B3A] bg-white dark:bg-[#131822]">
                {pendingFile && (
                  <div className="mb-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#F2F4F7] dark:bg-[#1D2432] text-xs">
                    <span className="truncate font-medium text-[#0F1419] dark:text-slate-200">
                      Đính kèm: {pendingFile.name} {uploadPct !== null ? `(${uploadPct}%)` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPendingFile(null)}
                      aria-label="Bỏ đính kèm"
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <label
                    title="Đính kèm ảnh, video hoặc tệp"
                    className="w-10 h-10 rounded-full hover:bg-[#F2F4F7] dark:hover:bg-[#1D2432] flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer shrink-0 transition-colors"
                  >
                    <Paperclip className="w-5 h-5" />
                    <input
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setPendingFile(f);
                        e.target.value = '';
                      }}
                      hidden
                    />
                  </label>

                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 h-10 px-4 rounded-full bg-[#F2F4F7] dark:bg-[#1D2432] text-sm text-[#0F1419] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF]/40"
                  />

                  <button
                    type="submit"
                    disabled={sending || (!text.trim() && !pendingFile)}
                    aria-label="Gửi tin nhắn"
                    className="w-10 h-10 rounded-full bg-[#0084FF] hover:bg-[#0073E6] disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
