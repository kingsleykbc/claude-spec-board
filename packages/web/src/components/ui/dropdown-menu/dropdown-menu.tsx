import type { ComponentProps, ReactNode } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { LuCheck, LuChevronRight, LuCircle } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* shadcn/ui dropdown-menu, restyled with the board's tokens (card surface, panel highlight, line borders). */

const content =
  'z-50 min-w-[8rem] max-h-(--radix-dropdown-menu-content-available-height) origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-xl border border-line bg-card p-1.5 font-sans text-fg shadow-lg';
const item =
  "relative flex cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-2 text-[13px] outline-none select-none data-[highlighted]:bg-panel data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

function DropdownMenu(props: ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal(props: ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger(props: ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({ className, sideOffset = 4, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} className={cn(content, className)} {...props} />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup(props: ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean; variant?: 'default' | 'destructive' }) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(item, 'data-[variant=destructive]:text-block-ink data-[variant=destructive]:data-[highlighted]:bg-block-soft', className)}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({ className, children, checked, ...props }: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem data-slot="dropdown-menu-checkbox-item" className={cn(item, 'pl-8', className)} checked={checked} {...props}>
      <span className="pointer-events-none absolute left-2.5 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <LuCheck className="size-4" aria-hidden="true" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup(props: ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

/** `indicator` replaces the dot that marks the checked item (e.g. a tick). */
function DropdownMenuRadioItem({ className, children, indicator, ...props }: ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & { indicator?: ReactNode }) {
  return (
    <DropdownMenuPrimitive.RadioItem data-slot="dropdown-menu-radio-item" className={cn(item, 'pl-8', className)} {...props}>
      <span className="pointer-events-none absolute left-2.5 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          {indicator ?? <LuCircle className="size-2 fill-current" aria-hidden="true" />}
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({ className, inset, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn('px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-fg3 uppercase data-[inset]:pl-8', className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator data-slot="dropdown-menu-separator" className={cn('mx-1.5 my-1 h-px bg-line', className)} {...props} />;
}

function DropdownMenuShortcut({ className, ...props }: ComponentProps<'span'>) {
  return <span data-slot="dropdown-menu-shortcut" className={cn('ml-auto font-mono text-[11px] text-fg3', className)} {...props} />;
}

function DropdownMenuSub(props: ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({ className, inset, children, ...props }: ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(item, 'data-[state=open]:bg-panel', className)}
      {...props}
    >
      {children}
      <LuChevronRight className="ml-auto size-4 text-fg3" aria-hidden="true" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        data-slot="dropdown-menu-sub-content"
        className={cn(
          'z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-xl border border-line bg-card p-1.5 font-sans text-fg shadow-lg',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
