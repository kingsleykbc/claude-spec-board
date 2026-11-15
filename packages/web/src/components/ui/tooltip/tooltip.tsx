import type { ComponentProps } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

/*
 * shadcn/ui tooltip, restyled with the board's tokens (inverted: fg surface, bg text).
 * A TooltipProvider wraps the board (App), the docs page (main.tsx) and every story (Storybook preview), so a Tooltip
 * does not bring its own provider; shared delay means moving between buttons shows labels at once.
 */

function TooltipProvider({ delayDuration = 300, ...props }: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />;
}

function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({ className, sideOffset = 4, children, ...props }: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          // Long explanations (the Run buttons) wrap instead of running across the screen.
          'z-[80] w-fit max-w-[min(320px,calc(100vw-32px))] origin-(--radix-tooltip-content-transform-origin) rounded-md bg-fg px-2 py-1 font-sans text-xs text-balance text-bg',
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-[80] block size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] fill-fg bg-fg" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
