"use client";

import { useState } from "react";
import { ChevronDown } from "@shina/icons";
import { cn } from "@shina/design-system";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqProps {
  items: FaqItem[];
}

export function Faq({ items }: FaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto divide-y divide-[var(--shina-border-subtle)]">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.question} className="py-4">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : i)}
              className="w-full flex items-center justify-between gap-4 text-left text-sm font-semibold text-white"
            >
              {item.question}
              <ChevronDown
                size={16}
                className={cn("shrink-0 transition-transform duration-fast", open && "rotate-180")}
              />
            </button>
            {open && (
              <p className="mt-3 text-sm text-[var(--shina-text-secondary)]">{item.answer}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
