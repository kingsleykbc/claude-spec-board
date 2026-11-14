import { GithubIcon, StarIcon } from '../lib/icons';
import s from './Footer.module.css';

/** The project on GitHub. */
export const REPO_URL = 'https://github.com/kingsleykbc/claude-spec-board';

/** Credit, the GitHub link and a star button, under the board. Plain links: the board never calls GitHub itself. */
export function Footer() {
  return (
    <footer className={s.footer}>
      <span>
        Spec Board, made by{' '}
        <a className={s.link} href="https://github.com/kingsleykbc" target="_blank" rel="noopener noreferrer">
          Kingsley
        </a>
      </span>
      <span className={s.dot} aria-hidden>
        ·
      </span>
      <a className={s.link} href={REPO_URL} target="_blank" rel="noopener noreferrer">
        <GithubIcon aria-hidden /> GitHub
      </a>
      <a className={s.star} href={REPO_URL} target="_blank" rel="noopener noreferrer" title="Star Spec Board on GitHub">
        <StarIcon aria-hidden /> Star on GitHub
      </a>
    </footer>
  );
}
