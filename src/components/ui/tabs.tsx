import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/cn";

const tabsListVariants = cva(
  "inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-container-low p-0.5",
  {
    variants: {
      size: {
        default: "h-auto",
        sm: "h-auto",
      },
    },
    defaultVariants: { size: "default" },
  },
);

const tabsTriggerVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/70 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      active: {
        true: "bg-surface-container-lowest text-on-surface shadow-sm",
        false: "text-on-surface-variant hover:text-on-surface",
      },
    },
    defaultVariants: { active: false },
  },
);

export interface TabsListProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tabsListVariants> {}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, size, onKeyDown, ...props }, ref) => {
    const listRef = React.useRef<HTMLDivElement | null>(null);

    function setRefs(node: HTMLDivElement | null) {
      listRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (
        e.key !== "ArrowRight" &&
        e.key !== "ArrowLeft" &&
        e.key !== "Home" &&
        e.key !== "End"
      ) {
        return;
      }
      const root = listRef.current;
      if (!root) return;
      const tabs = Array.from(
        root.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
      );
      if (tabs.length === 0) return;
      const current = document.activeElement as HTMLElement | null;
      const index = current ? tabs.indexOf(current) : -1;
      let next = index;
      if (e.key === "ArrowRight")
        next = index < 0 ? 0 : (index + 1) % tabs.length;
      if (e.key === "ArrowLeft")
        next =
          index < 0 ? tabs.length - 1 : (index - 1 + tabs.length) % tabs.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = tabs.length - 1;
      if (next === index || next < 0) return;
      e.preventDefault();
      tabs[next]?.focus();
      tabs[next]?.click();
    }

    return (
      <div
        ref={setRefs}
        role="tablist"
        tabIndex={-1}
        className={cn(tabsListVariants({ size }), className)}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  },
);
TabsList.displayName = "TabsList";

export interface TabsTriggerProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tabsTriggerVariants> {
  active?: boolean;
}

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(({ className, active = false, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    role="tab"
    aria-selected={active}
    tabIndex={active ? 0 : -1}
    data-state={active ? "active" : "inactive"}
    className={cn(tabsTriggerVariants({ active }), className)}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export interface TabsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When false, panel is hidden but kept in the tree for a11y id stability when needed. */
  active?: boolean;
}

export const TabsPanel = React.forwardRef<HTMLDivElement, TabsPanelProps>(
  ({ className, active = true, hidden, ...props }, ref) => (
    <div
      ref={ref}
      role="tabpanel"
      hidden={hidden ?? !active}
      className={cn(className)}
      {...props}
    />
  ),
);
TabsPanel.displayName = "TabsPanel";

export { tabsListVariants, tabsTriggerVariants };
