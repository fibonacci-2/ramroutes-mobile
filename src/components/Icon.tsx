import { ReactElement } from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

// Lucide-style icon set, stroke-width 2.75 per design/ds/readme.md's icon
// guidance. Paths for map/cal/chat/bookmark/search/clock/pin/brief/trophy/
// users/music/heart/book/spark/send/back/nav/locate are copied verbatim from
// design/Quad Campus Events.html's IC table. academic/food/cultural/spiritual/
// tech/fitness have no equivalent in the mockup (it only defined 6 categories,
// not our 11-tag taxonomy) - those five are original approximations.
const PATHS: Record<string, ReactElement> = {
  map: (
    <>
      <Path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
      <Path d="M15 5.764v15" />
      <Path d="M9 3.236v15" />
    </>
  ),
  cal: (
    <>
      <Rect x="3" y="4" width="18" height="18" rx="4" />
      <Path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  chat: <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  bookmark: <Path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />,
  search: (
    <>
      <Circle cx="11" cy="11" r="8" />
      <Path d="m21 21-4.3-4.3" />
    </>
  ),
  clock: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </>
  ),
  pin: (
    <>
      <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <Circle cx="12" cy="10" r="3" />
    </>
  ),
  brief: (
    <>
      <Rect x="2" y="7" width="20" height="14" rx="4" />
      <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  trophy: (
    <>
      <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <Path d="M4 22h16" />
      <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>
  ),
  users: (
    <>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  music: (
    <>
      <Path d="M9 18V5l12-2v13" />
      <Circle cx="6" cy="18" r="3" />
      <Circle cx="18" cy="16" r="3" />
    </>
  ),
  heart: <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  book: (
    <>
      <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  spark: <Path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />,
  send: (
    <>
      <Path d="m22 2-11 13" />
      <Path d="M22 2 15 22l-4-9-9-4z" />
    </>
  ),
  back: <Path d="m15 18-6-6 6-6" />,
  close: (
    <>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  nav: <Path d="M3 11l19-9-9 19-2-8-8-2z" />,
  locate: (
    <>
      <Line x1="2" y1="12" x2="5" y2="12" />
      <Line x1="19" y1="12" x2="22" y2="12" />
      <Line x1="12" y1="2" x2="12" y2="5" />
      <Line x1="12" y1="19" x2="12" y2="22" />
      <Circle cx="12" cy="12" r="7" />
    </>
  ),
  // Not in the mockup's 6-category set - approximations for the rest of our tag taxonomy.
  food: (
    <>
      <Path d="M3 2v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V2" />
      <Path d="M7 2v20" />
      <Path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7" />
    </>
  ),
  cultural: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M2 12h20" />
      <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  spiritual: <Path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c0-2-1-3-1-5 2 1 3 4 3 6a5 5 0 0 1-10 0c0-5 3-6 5-9z" />,
  tech: (
    <>
      <Rect x="6" y="6" width="12" height="12" rx="2" />
      <Path d="M9 2v3M12 2v3M15 2v3M9 19v3M12 19v3M15 19v3M2 9h3M2 12h3M2 15h3M19 9h3M19 12h3M19 15h3" />
    </>
  ),
  fitness: (
    <>
      <Path d="M4 9v6M20 9v6" />
      <Path d="M8 7v10M16 7v10" />
      <Path d="M8 12h8" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

type Props = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
};

// react-native-svg has no CSS cascade, so unlike the web mockup's
// stroke="currentColor" every caller must pass an explicit color.
export default function Icon({ name, size = 20, strokeWidth = 2.75, color = '#201e1d' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </Svg>
  );
}
