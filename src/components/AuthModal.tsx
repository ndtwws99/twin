import { useState } from 'react';
import { X } from 'lucide-react';
import { TwinLogo } from './TwinLogo';
import {
  friendlyError,
  registerWithEmail,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
} from '../lib/firebase';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

type Mode = 'login' | 'register' | 'reset';

export function AuthModal({ open, onClose, onToast }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        onToast('Đăng nhập thành công!');
        onClose();
      } else if (mode === 'register') {
        if (!name.trim()) {
          setError('Vui lòng nhập tên hiển thị.');
          setLoading(false);
          return;
        }
        await registerWithEmail(name, email, password);
        onToast('Tạo tài khoản Twin thành công!');
        onClose();
      } else {
        await resetPassword(email);
        onToast('Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.');
        setMode('login');
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      onToast('Đăng nhập Google thành công!');
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Đăng nhập Twin"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#131822] border border-[#E5E7EB] dark:border-[#232B3A] rounded-2xl p-6 sm:p-7 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <TwinLogo size={36} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-[#0F1419] dark:text-white">
          {mode === 'login' && 'Đăng nhập vào Twin'}
          {mode === 'register' && 'Tạo tài khoản Twin'}
          {mode === 'reset' && 'Đặt lại mật khẩu'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {mode === 'login' && 'Kết nối bài viết, Reels và nhắn tin thời gian thực.'}
          {mode === 'register' && 'Bắt đầu chia sẻ khoảnh khắc với bạn bè ngay hôm nay.'}
          {mode === 'reset' && 'Nhập email đã đăng ký để nhận liên kết khôi phục.'}
        </p>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Tên hiển thị
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm focus:outline-none focus:border-[#0084FF]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@example.com"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm focus:outline-none focus:border-[#0084FF]"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0D1118] border border-[#E5E7EB] dark:border-[#232B3A] text-sm focus:outline-none focus:border-[#0084FF]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {loading
              ? 'Đang xử lý...'
              : mode === 'login'
              ? 'Đăng nhập'
              : mode === 'register'
              ? 'Đăng ký'
              : 'Gửi email khôi phục'}
          </button>
        </form>

        {mode !== 'reset' && (
          <>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#E5E7EB] dark:bg-[#232B3A]" />
              <span className="text-xs text-slate-400">hoặc</span>
              <div className="h-px flex-1 bg-[#E5E7EB] dark:bg-[#232B3A]" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full h-11 rounded-xl border border-[#E5E7EB] dark:border-[#232B3A] bg-white dark:bg-[#1A2130] hover:bg-slate-50 dark:hover:bg-[#222B3D] text-sm font-semibold text-[#0F1419] dark:text-white flex items-center justify-center gap-2.5 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.2 0-5.8-2.1-6.8-5H1.2v3.1C3.2 21.3 7.3 24 12 24z" />
                <path fill="#FBBC05" d="M5.2 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V6.7H1.2C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.3l4-3.1z" />
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.7l4 3.1c1-2.9 3.6-5 6.8-5z" />
              </svg>
              Tiếp tục với Google
            </button>
          </>
        )}

        <div className="mt-5 pt-4 border-t border-[#E5E7EB] dark:border-[#232B3A] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          {mode === 'login' ? (
            <>
              <button type="button" onClick={() => { setMode('reset'); setError(''); }} className="hover:text-[#0084FF]">
                Quên mật khẩu?
              </button>
              <button type="button" onClick={() => { setMode('register'); setError(''); }} className="font-semibold text-[#0084FF] hover:underline">
                Tạo tài khoản mới
              </button>
            </>
          ) : (
            <button type="button" onClick={() => { setMode('login'); setError(''); }} className="font-semibold text-[#0084FF] hover:underline">
              Quay lại đăng nhập
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
