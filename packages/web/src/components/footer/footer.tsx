import { GithubIcon, StarIcon } from '@/lib/icons';

/** The project on GitHub. */
export const REPO_URL = 'https://github.com/kingsleykbc/claude-spec-board';

const link = 'inline-flex items-center gap-[5px] text-fg2 no-underline hover:text-fg hover:underline';

/**
 * Credit, the GitHub link and a star button, centred under the board. Plain links: the board never calls
 * GitHub itself. The side padding keeps it clear of the "Add new spec" button at the bottom right.
 */
export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-2.5 border-t border-line px-[200px] pt-[18px] pb-[26px] text-[12.5px] text-fg3 [@media(max-width:640px)]:px-5 [@media(max-width:640px)]:pb-[84px]">
      <span>
        Spec Board, made by{' '}
        <a className={link} href="https://github.com/kingsleykbc" target="_blank" rel="noopener noreferrer">
          Kingsley
        </a>
      </span>
      <span className="text-line2" aria-hidden>
        ·
      </span>
      <a className={link} href={REPO_URL} target="_blank" rel="noopener noreferrer">
        <GithubIcon aria-hidden /> GitHub
      </a>
      <a
        className="group inline-flex h-[26px] items-center gap-1.5 rounded-[7px] border border-line px-2.5 font-medium text-fg2 no-underline hover:bg-panel hover:text-fg"
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Star Spec Board on GitHub"
      >
        <StarIcon aria-hidden className="group-hover:text-review" /> Star on GitHub
      </a>
    </footer>
  );
}
