export function Brand() {
  return (
    <>
      <span className="sb-logo" aria-hidden>
        <svg viewBox="0 0 36 36" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bwGoldIcon" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ecd9a6" />
              <stop offset="45%" stopColor="#c9a257" />
              <stop offset="100%" stopColor="#a8822f" />
            </linearGradient>
          </defs>
          <path
            d="M6.5 18.2L18 7.5L29.5 18.2"
            stroke="url(#bwGoldIcon)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 16V27.2C9.5 27.9 10.1 28.5 10.8 28.5H25.2C25.9 28.5 26.5 27.9 26.5 27.2V16"
            stroke="url(#bwGoldIcon)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15.2 28.5V21.5C15.2 21 15.6 20.6 16.1 20.6H19.9C20.4 20.6 20.8 21 20.8 21.5V28.5"
            stroke="url(#bwGoldIcon)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="sb-name">
        <span className="brand-word">
          Betterway<span className="brand-os">OS</span>
        </span>
        <small>BETTERWAY MORTGAGES</small>
      </div>
    </>
  );
}
