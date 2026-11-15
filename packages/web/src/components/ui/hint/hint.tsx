import { cloneElement, type ComponentProps, type ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip/tooltip';

export interface HintProps extends Omit<ComponentProps<typeof TooltipTrigger>, 'children' | 'asChild'> {
  /** What the control does, shown in the tooltip; also its accessible name when it has none. */
  label: string;
  /** One icon-only control (a button or link) that can hold a ref and take focus. */
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * A tooltip for an icon-only control: it shows on hover and keyboard focus, and names the control.
 * Other props and the ref go on to the control, so a Hint can itself be the `asChild` trigger of a
 * menu or popover (e.g. ResponsiveMenu's `trigger={<Hint label="…"><button /></Hint>}`).
 */
export function Hint({ label, children, side, ...rest }: HintProps) {
  const props = children.props as { 'aria-label'?: string };
  const trigger = props['aria-label'] ? children : cloneElement(children as ReactElement<{ 'aria-label'?: string }>, { 'aria-label': label });
  return (
    <Tooltip>
      <TooltipTrigger asChild {...rest}>
        {trigger}
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
