'use client';

import gameIcons from 'virtual:game-icons';
import {
  Icon,
  type IconifyIcon,
} from '@iconify/react/offline';

export interface GameIconProps {
  name: string;
  className?: string;
  size?: number | string;
  color?: string;
  ariaLabel?: string;
}

const iconCache = new Map<string, IconifyIcon>();

function bundledIcon(name: string): IconifyIcon | undefined {
  const cachedIcon = iconCache.get(name);
  if (cachedIcon) {
    return cachedIcon;
  }

  const sourceIcon = gameIcons.icons[name];
  if (!sourceIcon) {
    return undefined;
  }

  const icon: IconifyIcon = {
    ...sourceIcon,
    width: sourceIcon.width ?? gameIcons.width,
    height: sourceIcon.height ?? gameIcons.height,
  };

  iconCache.set(name, icon);
  return icon;
}

export function GameIcon({
  name,
  className,
  size,
  color,
  ariaLabel,
}: GameIconProps) {
  const icon = bundledIcon(name);
  const combinedClassName = className
    ? `game-icon ${className}`
    : 'game-icon';

  if (!icon) {
    return (
      <span
        className={`${combinedClassName} game-icon--missing`}
        data-icon-name={name}
        role={ariaLabel ? 'img' : undefined}
        aria-label={ariaLabel}
        aria-hidden={ariaLabel ? undefined : true}
        style={{ width: size, height: size, color }}
      />
    );
  }

  return (
    <Icon
      className={combinedClassName}
      icon={icon}
      width={size}
      height={size}
      color={color}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      focusable={false}
    />
  );
}

export default GameIcon;
