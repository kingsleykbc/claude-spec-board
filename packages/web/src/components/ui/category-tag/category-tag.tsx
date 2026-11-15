import { catColor } from '@/lib/vm';

/** Category pill with a dot whose colour comes from the name. */
export function CategoryTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-[5px] rounded-full border border-line py-px pr-[7px] pl-1.5 text-[11.5px] text-fg2">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: catColor(name) }} />
      {name}
    </span>
  );
}
