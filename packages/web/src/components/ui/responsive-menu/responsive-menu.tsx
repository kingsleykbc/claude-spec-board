import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { LuCheck } from 'react-icons/lu';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/dropdown-menu';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer/drawer';
import { useNarrow } from '@/lib/useNarrow';
import { cn } from '@/lib/utils';

/** Which shape the menu took, and how a drawer item closes the drawer. */
const Mode = createContext<{ narrow: boolean; close: () => void }>({ narrow: false, close: () => undefined });

export interface ResponsiveMenuProps {
  /** One button that opens the menu (it can hold a ref and take focus). */
  trigger: ReactElement;
  /** The drawer's title on narrow screens. */
  title: string;
  children: ReactNode;
  /** Dropdown alignment against the trigger on wide screens. */
  align?: 'start' | 'center' | 'end';
}

/**
 * A menu that fits the screen: a dropdown on wide screens, a bottom drawer titled `title` on narrow
 * ones (`useNarrow()`, 720px and under). Build it from ResponsiveMenuItem, ResponsiveMenuSeparator,
 * ResponsiveMenuLabel and ResponsiveMenuSub; picking an item closes the menu or the drawer.
 */
export function ResponsiveMenu({ trigger, title, children, align = 'start' }: ResponsiveMenuProps) {
  const narrow = useNarrow();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  if (!narrow) {
    return (
      <Mode.Provider value={{ narrow: false, close }}>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align={align} collisionPadding={8}>
            {children}
          </DropdownMenuContent>
        </DropdownMenu>
      </Mode.Provider>
    );
  }
  return (
    <Mode.Provider value={{ narrow: true, close }}>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent aria-describedby={undefined}>
          <DrawerHeader className="pb-1">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div role="menu" aria-label={title} className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-[max(12px,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    </Mode.Provider>
  );
}

export interface ResponsiveMenuItemProps {
  onSelect: () => void;
  children: ReactNode;
  /** Makes it a checkable item, ticked when true. */
  checked?: boolean;
  disabled?: boolean;
}

// Drawer rows: the dropdown item's look, a little taller for fingers.
const row =
  'relative flex w-full cursor-pointer items-center gap-2 rounded-[7px] border-0 bg-transparent px-2.5 py-2.5 text-left font-[inherit] text-[14px] text-fg hover:bg-panel disabled:pointer-events-none disabled:opacity-50';

/** One choice. `checked` makes it a checkable item (a tick when true). */
export function ResponsiveMenuItem({ onSelect, children, checked, disabled }: ResponsiveMenuItemProps) {
  const { narrow, close } = useContext(Mode);
  const checkable = checked !== undefined;
  if (!narrow) {
    return checkable ? (
      <DropdownMenuCheckboxItem checked={checked} disabled={disabled} onSelect={() => onSelect()}>
        {children}
      </DropdownMenuCheckboxItem>
    ) : (
      <DropdownMenuItem disabled={disabled} onSelect={() => onSelect()}>
        {children}
      </DropdownMenuItem>
    );
  }
  return (
    <button
      type="button"
      role={checkable ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={checkable ? checked : undefined}
      disabled={disabled}
      className={cn(row, checkable && 'pl-8')}
      onClick={() => {
        onSelect();
        close();
      }}
    >
      {checkable && checked ? (
        <span className="pointer-events-none absolute left-2.5 flex size-3.5 items-center justify-center">
          <LuCheck className="block size-4" aria-hidden="true" />
        </span>
      ) : null}
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
