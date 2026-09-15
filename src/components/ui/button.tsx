import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/70 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-on-primary hover:bg-on-primary-container dark:hover:opacity-90",
        accent:
          "bg-primary-container text-on-primary-container hover:brightness-95",
        secondary:
          "bg-secondary-container text-on-secondary-container hover:brightness-95",
        outline:
          "border border-border bg-transparent text-on-surface hover:bg-surface-container-low",
        ghost: "text-on-surface hover:bg-surface-container-low",
        destructive: "bg-error text-on-error hover:brightness-95",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export type IconButtonProps = Omit<ButtonProps, "size"> & {
  size?: "icon" | "icon-sm";
  "aria-label": string;
};

/** Square icon-only control; requires an accessible name. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = "icon", variant = "ghost", className, ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn("shrink-0", className)}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";

export { buttonVariants };
