import React from "react";
import { motion } from "framer-motion";

// Line-by-line masked reveal for kinetic headings
export function MaskedLines({ lines, className = "", lineClassName = "", delay = 0 }) {
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden">
          <motion.span
            className={`block ${lineClassName}`}
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: delay + i * 0.12 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

// Generic scroll-triggered reveal
export function Reveal({ children, className = "", y = 40, delay = 0, once = true }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

// Staggered container for lists/grids
export function Stagger({ children, className = "", stagger = 0.1, once = true }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};
