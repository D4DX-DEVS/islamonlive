import { iconProps } from "./ui";

const dot = (cx: number, cy: number) => <circle cx={cx} cy={cy} r="1.3" fill="currentColor" stroke="none" />;

const shapes = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></>,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  user: <><circle cx="12" cy="8.5" r="3.6" /><path d="M4.5 20c.6-3.6 3.6-5.5 7.5-5.5s6.9 1.9 7.5 5.5" /></>,
  folder: <path d="M3.5 7.5A1.5 1.5 0 015 6h4l2 2.5h8A1.5 1.5 0 0120.5 10v8a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 18z" />,
  doc: <><rect x="4.5" y="3.5" width="15" height="17" rx="2.5" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.3 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.3-3.8-8.5S9.5 5.9 12 3.5z" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 16l-5-5-8 8" /></>,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4.5 15v3a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5v-3" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  send: <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />,
  tag: <><path d="M3.5 12.4V4.5a1 1 0 011-1h7.9l8.1 8.1a1.5 1.5 0 010 2.1l-6.3 6.3a1.5 1.5 0 01-2.1 0z" /><circle cx="8.3" cy="8.3" r="1.2" /></>,
  listUl: <><path d="M9 6h11M9 12h11M9 18h11" />{dot(4.5, 6)}{dot(4.5, 12)}{dot(4.5, 18)}</>,
  listOl: <><path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v4M4 14.5c0-1 2.5-1 2.5.3 0 .8-2.5 1.700-2.500 2.700h2.500" /></>,
  quote: <path d="M7.500 17c-2 0-3.200-1.300-3.200-3.400 0-2.900 1.600-5 4.200-5.900M16.500 17c-2 0-3.200-1.300-3.200-3.400 0-2.900 1.600-5 4.200-5.900" />,
  alignCenter: <path d="M4 6h16M7 12h10M5 18h14" />,
  alignRight: <path d="M4 6h16M10 12h10M7 18h13" />,
  link: <path d="M10 14a4 4 0 005.700 0l3-3a4 4 0 00-5.700-5.700l-1 1M14 10a4 4 0 00-5.700 0l-3 3a4 4 0 005.700 5.700l1-1" />,
  hr: <path d="M3 12h18M8 6.500h8M8 17.500h8" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  redo: <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" />,
  clearFormat: <path d="M5 5h11M10.500 5L8 19M14 14l6 6M20 14l-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  pencil: <><path d="M4 20l1.200-4.200L16.800 4.200a2.200 2.200 0 013.100 3.100L8.200 18.800z" /><path d="M14.500 6.500l3 3" /></>,
  copy: <><rect x="8.500" y="8.500" width="11" height="11" rx="2" /><path d="M15.500 8.500V6A1.500 1.500 0 0014 4.500H6A1.500 1.500 0 004.500 6v8A1.500 1.500 0 006 15.500h2.500" /></>,
  more: <>{dot(12, 5.500)}{dot(12, 12)}{dot(12, 18.500)}</>,
  trash: <path d="M4.500 7h15M10 7V4.500h4V7M6.500 7l.8 12a1.500 1.500 0 001.500 1.400h6.400a1.500 1.500 0 001.500-1.400l.8-12M10 11v6M14 11v6" />,
  clock: <><circle cx="12" cy="12" r="8.500" /><path d="M12 7.500V12l3 2" /></>,
  external: <path d="M14 4.500h5.500V10M19.500 4.500L11 13M17 14v4.500a1.500 1.500 0 01-1.500 1.500h-9A1.500 1.500 0 015 18.500v-9A1.500 1.500 0 016.500 8H11" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  reset: <path d="M4 12a8 8 0 112.600 5.900M4 19.500V15h4.500" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  video: <><rect x="3.500" y="4.500" width="17" height="15" rx="2.500" /><path d="M10 9l5 3-5 3z" /></>,
  table: <><rect x="3.500" y="4.500" width="17" height="15" rx="2.500" /><path d="M3.500 10h17M3.500 14.500h17M9.500 4.500v15M15 4.500v15" /></>,
  mail: <><rect x="3.500" y="5.500" width="17" height="13" rx="2.500" /><path d="M4 7.500l8 5.500 8-5.500" /></>,
  lock: <><rect x="5" y="10.500" width="14" height="9.500" rx="2.500" /><path d="M8 10.500V8a4 4 0 018 0v2.500" /></>,
  eyeOff: <path d="M3 3l18 18M10.600 10.600a2 2 0 002.800 2.800M9.900 4.200A10.700 10.700 0 0112 4c6.500 0 10 8 10 8a15 15 0 01-3 4.100M6.200 6.200C3.700 7.900 2 12 2 12s3.500 7 10 7c1.200 0 2.300-.2 3.300-.6" />,
  info: <><circle cx="12" cy="12" r="8.500" /><path d="M12 11v5M12 8h.01" /></>,
  users: <><circle cx="9" cy="8.500" r="3.300" /><path d="M2.800 19.500c.5-3.300 3-5 6.200-5s5.700 1.700 6.200 5M16 5.400a3.300 3.300 0 010 6.200M18 14.800c1.700.6 2.900 2.200 3.200 4.700" /></>,
  sparkles: <><path d="M10 4l1.600 4.400L16 10l-4.400 1.600L10 16l-1.600-4.400L4 10l4.400-1.600z" /><path d="M18 14l.8 2.200L21 17l-2.200.8L18 20l-.8-2.200L15 17l2.200-.8z" /></>,
  download: <path d="M12 4v12M7 11l5 5 5-5M4.500 19.500h15" />,
} as const;

export type IconName = keyof typeof shapes;

export function Icon({ name, className = "h-5 w-5", strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return <svg {...iconProps} strokeWidth={strokeWidth} className={className}>{shapes[name]}</svg>;
}
