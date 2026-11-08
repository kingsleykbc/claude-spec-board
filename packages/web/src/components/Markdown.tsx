import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import s from './Markdown.module.css';

/** Renders Markdown in the board's typography (prototype Markdown.dc.html), with GitHub-flavoured extras. */
export function Markdown({ md, size = 'md' }: { md: string; size?: 'sm' | 'md' }) {
  const empty = md.trim() === '';
  return (
    <div className={s.root} data-size={size}>
      {empty ? (
        <p className={s.empty}>Nothing here yet.</p>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
      )}
    </div>
  );
}
