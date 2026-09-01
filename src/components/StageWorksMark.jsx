import { PRODUCT } from '../constants/brand';

/**
 * Stage Work Studio mark — Apple squircle, Dropbox isometric planes,
 * HDFC gold + slight slant, Adobe-solid masses. One symbol, no ornament.
 */
export default function StageWorksMark({ size = 80, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className.trim()}
      role="img"
      aria-label={PRODUCT}
    >
      <rect width="64" height="64" rx="14.4" fill="#161412" />
      <g transform="rotate(-6 32 33)">
        <path fill="#E8D4A8" d="M20 27.5 32 20.5 44 27.5 32 34.5Z" />
        <path fill="#C9A36A" d="M20 27.5 20 42.5 32 49.5 32 34.5Z" />
        <path fill="#8D7042" d="M44 27.5 44 42.5 32 49.5 32 34.5Z" />
      </g>
    </svg>
  );
}
