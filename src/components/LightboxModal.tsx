import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface LightboxModalProps {
  images: string[];
  index: number;
  onClose: () => void;
  onChangeIndex: (next: number) => void;
}

export function LightboxModal({ images, index, onClose, onChangeIndex }: LightboxModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && images.length > 1) {
        onChangeIndex((index + 1) % images.length);
      }
      if (e.key === 'ArrowLeft' && images.length > 1) {
        onChangeIndex((index - 1 + images.length) % images.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, index, onClose, onChangeIndex]);

  if (!images.length) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChangeIndex((index - 1 + images.length) % images.length);
            }}
            aria-label="Ảnh trước"
            className="absolute left-3 sm:left-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChangeIndex((index + 1) % images.length);
            }}
            aria-label="Ảnh tiếp theo"
            className="absolute right-3 sm:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <div className="max-w-5xl max-h-[88vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img
          src={images[index]}
          alt={`Ảnh ${index + 1}`}
          referrerPolicy="no-referrer"
          className="max-w-full max-h-[82vh] object-contain rounded-lg"
        />
        {images.length > 1 && (
          <p className="text-xs text-white/75 tabular-nums">
            {index + 1} / {images.length}
          </p>
        )}
      </div>
    </div>
  );
}
