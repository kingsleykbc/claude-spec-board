import { catColor } from '../lib/vm';
import s from './CategoryTag.module.css';

/** Category pill with a dot whose colour comes from the name. */
export function CategoryTag({ name }: { name: string }) {
  return (
    <span className={s.root}>
      <span className={s.dot} style={{ background: catColor(name) }} />
      {name}
    </span>
  );
}
