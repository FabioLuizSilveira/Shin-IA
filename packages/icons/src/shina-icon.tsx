// Base dos ícones próprios Shinã — mesma gramática do Lucide (doc 07):
// grade 24×24, stroke 2, round caps/joins, currentColor.

import { forwardRef, type SVGProps } from "react";

export interface ShinaIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

export function createShinaIcon(name: string, children: React.ReactNode) {
  const Icon = forwardRef<SVGSVGElement, ShinaIconProps>(({ size = 24, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={props["aria-label"] ? undefined : true}
      {...props}
    >
      {children}
    </svg>
  ));
  Icon.displayName = name;
  return Icon;
}
