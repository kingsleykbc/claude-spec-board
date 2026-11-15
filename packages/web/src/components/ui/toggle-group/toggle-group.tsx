import { createContext, useContext, type ComponentProps } from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/*
 * shadcn/ui toggle-group, restyled with the board's tokens: a panel track with a raised card for the
 * selected item (the Board | Table switch). shadcn keeps the item styles in `toggle`; they live here
 * because nothing else uses them.
 */

const toggleVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md text-[13px] font-medium whitespace-nowrap text-fg2 transition-colors outline-none hover:text-fg disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-card data-[state=on]:text-fg data-[state=on]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border border-line bg-transparent',
      },
      size: {
        default: 'h-7 min-w-7 px-2.5',
        sm: 'h-6 min-w-6 px-2',
        lg: 'h-8 min-w-8 px-3',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ToggleVariants = VariantProps<typeof toggleVariants>;

const ToggleGroupContext = createContext<ToggleVariants>({ size: 'default', variant: 'default' });

function ToggleGroup({ className, variant, size, children, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root> & ToggleVariants) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn('inline-flex w-fit items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5', className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({ className, children, variant, size, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item> & ToggleVariants) {
  const ctx = useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={ctx.variant ?? variant}
      data-size={ctx.size ?? size}
      className={cn(toggleVariants({ variant: ctx.variant ?? variant, size: ctx.size ?? size }), className)}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
