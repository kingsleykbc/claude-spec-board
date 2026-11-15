import { createContext, useContext, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { LuCheck, LuCircle } from 'react-icons/lu';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/dropdown-menu';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer/drawer';
import { useNarrow } from '@/lib/useNarrow';
import { cn } from '@/lib/utils';

interface ModeValue {
  narrow: boolean;
  /** An item was picked: remember it (for focus on close) and, in the drawer, close it at once. */
  pick: () => void;
}

/** Which shape the menu took, and what picking an item does to it. */
const Mode = createContext<ModeValue>({ narrow: false, pick: () => undefined });

export interface ResponsiveMenuProps {
  /** One button that opens the menu (it can hold a ref and take focus). */
  trigger: ReactElement;
  /** The drawer's title on narrow screens. */
  title: string;
  children: ReactNode;
  /** Dropdown alignment against the trigger on wide screens. */
  align?: 'start' | 'center' | 'end';
  /** Extra classes for the dropdown's box on wide screens (e.g. a fixed width). */
  contentClassName?: string;
  /** Told when the menu opens or closes (e.g. to refresh what it lists). */
  onOpenChange?: (open: boolean) => void;
}

/**
 * A menu that fits the screen: a dropdown on wide screens, a bottom drawer titled `title` on narrow
 * ones (`useNarrow()`, 720px and under). Build it from ResponsiveMenuItem, ResponsiveMenuRadioGroup
 * and ResponsiveMenuRadioItem, ResponsiveMenuSeparator, ResponsiveMenuLabel and ResponsiveMenuSub;
 * picking an item closes the menu or the drawer.
 *
 * Focus on close goes back to the trigger, unless the picked item moved it somewhere else (an item
 * that opens a modal): then it stays there.
 */
export function ResponsiveMenu({ trigger, title, children, align = 'start', contentClassName, onOpenChange: tell }: ResponsiveMenuProps) {
  const narrow = useNarrow();
  const [open, setOpen] = useState(false);
  // Closed by picking an item: the drawer goes away at once (no slide-out), so its focus trap and
  // aria-hidden on the rest of the page are gone before whatever the item opened needs them.
  const [picked, setPicked] = useState(false);
  const pickedRef = useRef(false);
  const pick = () => {
    pickedRef.current = true;
    if (narrow) {
      setPicked(true);
      setOpen(false);
      tell?.(false);
    }
  };
  const onOpenChange = (next: boolean) => {
    if (next) {
      pickedRef.current = false;
      setPicked(false);
    }
    setOpen(next);
    tell?.(next);
  };
  const onCloseAutoFocus = (e: Event) => {
    if (!pickedRef.current) return;
    pickedRef.current = false;
    const now = document.activeElement;
    if (now && now !== document.body) e.preventDefault();
  };
  if (!narrow) {
    return (
      <Mode.Provider value={{ narrow: false, pick }}>
        {/* Non-modal: a modal menu traps focus until it has finished unmounting, which pulls focus back out of
            a Modal that an item has just opened. Outside clicks and Esc still close it. */}
        <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align={align} collisionPadding={8} onCloseAutoFocus={onCloseAutoFocus} className={contentClassName}>
            {children}
          </DropdownMenuContent>
        </DropdownMenu>
      </Mode.Provider>
    );
  }
  return (
    <Mode.Provider value={{ narrow: true, pick }}>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        {open || !picked ? (
          <DrawerContent aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
            <DrawerHeader className="pb-1">
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div role="menu" aria-label={title} className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-[max(12px,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </DrawerContent>
        ) : null}
      </Drawer>
    </Mode.Provider>
  );
}

export interface ResponsiveMenuItemProps {
  /** What picking it does; optional for a link item, which follows its href. */
  onSelect?: () => void;
  children: ReactNode;
  /** Makes it a checkable item, ticked when true. */
  checked?: boolean;
  disabled?: boolean;
  /** Makes it a link (an `<a role="menuitem">`) to this address. */
  href?: string;
  /** A link item opens in a new tab (`target=_blank`, `rel=noopener`). */
  newTab?: boolean;
  /** A link item is the page you are on (`aria-current=page`). */
  current?: boolean;
}

// Drawer rows: the dropdown item's look, a little taller for fingers.
const row =
  'relative flex w-full cursor-pointer items-center gap-2 rounded-[7px] border-0 bg-transparent px-2.5 py-2.5 text-left font-[inherit] text-[14px] text-fg hover:bg-panel disabled:pointer-events-none disabled:opacity-50';
const indicatorBox = 'pointer-events-none absolute left-2.5 flex size-3.5 items-center justify-center';

/** One choice. `checked` makes it a checkable item (a tick when true); `href` makes it a link. */
export function ResponsiveMenuItem({ onSelect, children, checked, disabled, href, newTab, current }: ResponsiveMenuItemProps) {
  const { narrow, pick } = useContext(Mode);
  const checkable = checked !== undefined;
  const choose = () => {
    pick();
    onSelect?.();
  };
  // An anchor still follows its href after the menu has removed it (the HTML spec lets an `a` navigate when disconnected).
  const link =
    href !== undefined
      ? { href, ...(newTab ? { target: '_blank', rel: 'noopener' } : {}), ...(current ? { 'aria-current': 'page' as const } : {}) }
      : null;
  if (!narrow) {
    if (link) {
      return (
        <DropdownMenuItem asChild disabled={disabled} onSelect={choose} className="text-fg no-underline hover:text-fg">
          <a {...link}>{children}</a>
        </DropdownMenuItem>
      );
    }
    return checkable ? (
      <DropdownMenuCheckboxItem checked={checked} disabled={disabled} onSelect={choose}>
        {children}
      </DropdownMenuCheckboxItem>
    ) : (
      <DropdownMenuItem disabled={disabled} onSelect={choose}>
        {children}
      </DropdownMenuItem>
    );
  }
  if (link) {
    return (
      <a role="menuitem" {...link} className={cn(row, 'no-underline hover:text-fg')} onClick={choose}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      role={checkable ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={checkable ? checked : undefined}
      disabled={disabled}
      className={cn(row, checkable && 'pl-8')}
      onClick={choose}
    >
      {checkable && checked ? (
        <span className={indicatorBox}>
          <LuCheck className="block size-4" aria-hidden="true" />
        </span>
      ) : null}
      {children}
    </button>
  );
}

/** The value a radio group holds, for its items in the drawer. */
const Radio = createContext<{ value: string; onValueChange: (value: string) => void } | null>(null);

/** One-of-many choices (e.g. Theme: Light, Dark, System); holds the value its ResponsiveMenuRadioItems pick. */
export function ResponsiveMenuRadioGroup({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: ReactNode }) {
  const { narrow } = useContext(Mode);
  if (!narrow) {
    return (
      <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
        {children}
      </DropdownMenuRadioGroup>
    );
  }
  return (
    <Radio.Provider value={{ value, onValueChange }}>
      <div role="group" className="flex flex-col gap-0.5">
        {children}
      </div>
    </Radio.Provider>
  );
}

/** A tick in place of the dot (e.g. the current project). */
const tick = <LuCheck className="block size-4 text-accent-ink" aria-hidden="true" />;

/** One radio choice; a dot (or, with `indicator="check"`, a tick) marks the group's current value. Picking it closes the menu. */
export function ResponsiveMenuRadioItem({ value, children, indicator = 'dot', className }: { value: string; children: ReactNode; indicator?: 'dot' | 'check'; className?: string }) {
  const { narrow, pick } = useContext(Mode);
  const group = useContext(Radio);
  if (!narrow) {
    return (
      <DropdownMenuRadioItem value={value} onSelect={pick} className={className} {...(indicator === 'check' ? { indicator: tick } : {})}>
        {children}
      </DropdownMenuRadioItem>
    );
  }
  const checked = group?.value === value;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      className={cn(row, 'pl-8', className)}
      onClick={() => {
        pick();
        group?.onValueChange(value);
      }}
    >
      {checked ? <span className={indicatorBox}>{indicator === 'check' ? tick : <LuCircle className="block size-2 fill-current" aria-hidden="true" />}</span> : null}
      {children}
    </button>
  );
}

/** A thin line between groups of items. */
export function ResponsiveMenuSeparator() {
  const { narrow } = useContext(Mode);
  if (!narrow) return <DropdownMenuSeparator />;
  return <div role="separator" className="mx-1.5 my-1 h-px bg-line" />;
}

/** A small uppercase heading over the items that follow. */
export function ResponsiveMenuLabel({ children }: { children: ReactNode }) {
  const { narrow } = useContext(Mode);
  if (!narrow) return <DropdownMenuLabel>{children}</DropdownMenuLabel>;
  return <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-fg3 uppercase">{children}</div>;
}

/** A submenu: a flyout on wide screens, a labelled group of items in the drawer. */
export function ResponsiveMenuSub({ label, children }: { label: string; children: ReactNode }) {
  const { narrow } = useContext(Mode);
  if (!narrow) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent collisionPadding={8}>{children}</DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-0.5">
      <div aria-hidden="true" className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-fg3 uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}
