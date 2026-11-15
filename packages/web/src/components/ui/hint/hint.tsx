import { cloneElement, type ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip/tooltip';

export interface HintProps {
  /** What the control does, shown in the tooltip; also its accessible name when it has none. */
  label: string;
  /** One icon-only control (a button or link) that can hold a ref and take focus. */
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/** A tooltip for an icon-only control: it shows on hover and keyboard focus, and names the control. */
export function Hint({ label, children, side }: HintProps) {
  const props = children.props as { 'aria-label'?: string };
  const trigger = props['aria-label'] ? children : cloneElement(children as ReactElement<{ 'aria-label'?: string }>, { 'aria-label': label });
  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
