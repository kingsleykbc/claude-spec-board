import type { ReactNode } from 'react';
import logoUrl from '@/assets/spec-board-logo.svg';
import type { IconType } from '@/lib/icons';
import { BoardIcon, CaretIcon, DocsIcon, OverviewIcon, RefreshIcon, SettingsIcon, SimpleIcon, TourIcon, WarnIcon } from '@/lib/icons';
import type { ThemeChoice } from '@/lib/theme';
import {
  ResponsiveMenu,
  ResponsiveMenuItem,
  ResponsiveMenuRadioGroup,
  ResponsiveMenuRadioItem,
  ResponsiveMenuSeparator,
  ResponsiveMenuSub,
} from '@/components/ui/responsive-menu/responsive-menu';

/** The board for a project, or the first one. */
export const boardHref = (project?: string | null): string => (project ? `/?project=${encodeURIComponent(project)}` : '/');

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export interface LogoMenuProps {
  /** 'docs': Board and Documentation (this page) only. */
  page: 'board' | 'docs';
  /** The project the links keep. */
  project: string | null;
  docsHref: string;
  themeChoice: ThemeChoice;
  onThemeChoice: (choice: ThemeChoice) => void;
  onTour?: () => void;
  onSync?: () => void;
  syncWaiting?: boolean;
  onSyncWaiting?: () => void;
  onSettings?: () => void;
  /** References and Overview, when they are not in the header (Simple mode or a small screen). */
  onOpenRefs?: () => void;
  onOpenOverview?: () => void;
  /** The Simple mode toggle, when its switch is not in the header (a small screen). */
  simple?: boolean;
  onSimple?: (on: boolean) => void;
}

/** An item's icon and label, side by side. */
const Label = ({ icon: Icon, children }: { icon: IconType; children: ReactNode }) => (
  <>
    <Icon aria-hidden />
    {children}
  </>
);

/** The logo and "Spec Board", and the menu under them: a dropdown, or a bottom drawer on small screens. */
export function LogoMenu({
  page,
  project,
  docsHref,
  themeChoice,
  onThemeChoice,
  onTour,
  onSync,
  syncWaiting = false,
  onSyncWaiting,
  onSettings,
  onOpenRefs,
  onOpenOverview,
  simple,
  onSimple,
}: LogoMenuProps) {
  const docs = page === 'docs';
  return (
    <ResponsiveMenu
      title="Spec Board"
      trigger={
        <button
          type="button"
          data-tour="brand"
          className="flex h-8 flex-none cursor-pointer items-center gap-[9px] rounded-lg border-0 bg-transparent py-0 pr-2 pl-1 text-inherit hover:bg-panel"
        >
          <img src={logoUrl} alt="" width={20} height={20} className="block size-5" />
          <span className="text-[13.5px] font-bold whitespace-nowrap">Spec Board</span>
          <CaretIcon aria-hidden className="text-[13px] text-fg3" />
        </button>
      }
    >
      {docs ? (
        <>
          <ResponsiveMenuItem href={boardHref(project)}>
            <Label icon={BoardIcon}>Board</Label>
          </ResponsiveMenuItem>
          <ResponsiveMenuItem href={docsHref} current>
            <Label icon={DocsIcon}>Documentation</Label>
          </ResponsiveMenuItem>
        </>
      ) : (
        <>
          {/* A new tab, so unsaved work on the board is safe. */}
          <ResponsiveMenuItem href={docsHref} newTab>
            <Label icon={DocsIcon}>Documentation</Label>
          </ResponsiveMenuItem>
          {onTour && (
            <ResponsiveMenuItem onSelect={onTour}>
              <Label icon={TourIcon}>Take the tour</Label>
            </ResponsiveMenuItem>
          )}
          {onSync && (
            <ResponsiveMenuItem onSelect={onSync}>
              <Label icon={RefreshIcon}>Sync with code</Label>
            </ResponsiveMenuItem>
          )}
          {syncWaiting && onSyncWaiting && (
            <ResponsiveMenuItem onSelect={onSyncWaiting}>
              <Label icon={WarnIcon}>Sync proposal waiting</Label>
              <span className="ml-auto size-[7px] flex-none rounded-full bg-accent" aria-hidden />
            </ResponsiveMenuItem>
          )}
          {onSettings && (
            <ResponsiveMenuItem onSelect={onSettings}>
              <Label icon={SettingsIcon}>Settings</Label>
            </ResponsiveMenuItem>
          )}
        </>
      )}
      <ResponsiveMenuSeparator />
      {onOpenRefs && (
        <ResponsiveMenuItem onSelect={onOpenRefs}>
          <Label icon={DocsIcon}>References</Label>
        </ResponsiveMenuItem>
      )}
      {onOpenOverview && (
        <ResponsiveMenuItem onSelect={onOpenOverview}>
          <Label icon={OverviewIcon}>Overview</Label>
        </ResponsiveMenuItem>
      )}
      {onSimple && (
        <ResponsiveMenuItem checked={!!simple} onSelect={() => onSimple(!simple)}>
          <Label icon={SimpleIcon}>Simple mode</Label>
        </ResponsiveMenuItem>
      )}
      <ResponsiveMenuSub label="Theme">
        <ResponsiveMenuRadioGroup value={themeChoice} onValueChange={(v) => onThemeChoice(v as ThemeChoice)}>
          {THEMES.map((t) => (
            <ResponsiveMenuRadioItem key={t.value} value={t.value}>
              {t.label}
            </ResponsiveMenuRadioItem>
          ))}
        </ResponsiveMenuRadioGroup>
      </ResponsiveMenuSub>
    </ResponsiveMenu>
  );
}
