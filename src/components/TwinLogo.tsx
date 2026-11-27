interface TwinLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function TwinLogo({ size = 34, showWordmark = true, className = '' }: TwinLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="32" cy="32" r="30" fill="#0084FF" />
        <path
          d="M18.5 20.5H45.5V27.2H35.6V46.5H28.4V27.2H18.5V20.5Z"
          fill="#FFFFFF"
        />
      </svg>
      {showWordmark && (
        <span className="text-[19px] font-extrabold tracking-tight text-[#0F1419] dark:text-white leading-none">
          Twin
        </span>
      )}
    </span>
  );
}
