import { Bot, LayoutDashboard, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppNav() {
  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-xl flex items-center px-6 gap-6">
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-bold text-foreground tracking-tight">Platform AI</span>
      </div>

      <nav className="flex items-center gap-1 ml-6">
        {[
          { to: "/", label: "Agent", icon: Bot },
          { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`
            }
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
          JD
        </div>
      </div>
    </header>
  );
}
