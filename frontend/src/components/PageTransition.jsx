import { motion as Motion } from "framer-motion";

function PageTransition({ children }) {
  return (
    <Motion.div
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.02, y: -12 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen w-full bg-ivory text-navy transition-colors duration-500 dark:bg-navy dark:text-ivory"
    >
      {children}
    </Motion.div>
  );
}

export default PageTransition;
