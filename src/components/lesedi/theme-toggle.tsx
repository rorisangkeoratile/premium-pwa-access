import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

/** Switches between the light and dark colour tokens already defined in styles.css. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, toggle] = useTheme();
  const dark = theme === "dark";
  return (
    <Button variant="ghost" size="icon" className={`min-h-11 min-w-11 ${className}`} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark} onClick={toggle}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
