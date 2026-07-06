// @shina/design-system — biblioteca oficial de componentes (docs 10/19).
// Nenhuma tela implementa componentes próprios: tudo consome daqui.

export { cn, type ClassValue } from "./utils/cn";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./components/button";
export { IconButton, type IconButtonProps } from "./components/icon-button";

export { Input, type InputProps } from "./components/input";
export { Textarea, type TextareaProps } from "./components/textarea";
export { Select, type SelectProps } from "./components/select";

export { Dialog, type DialogProps } from "./components/dialog";
export { Drawer, type DrawerProps } from "./components/drawer";
export { Tooltip, type TooltipProps } from "./components/tooltip";
export { ToastProvider, useToast, type ToastItem, type ToastVariant } from "./components/toast";
export { Popover, type PopoverProps } from "./components/popover";

export { FloatingSidebar, type FloatingSidebarProps, type SidebarItem } from "./components/sidebar";
export { FloatingNavbar, type FloatingNavbarProps } from "./components/navbar";
export { Tabs, type TabsProps, type TabItem } from "./components/tabs";
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbItem } from "./components/breadcrumb";
export { Switcher, type SwitcherProps, type SwitcherItem } from "./components/switcher";

export { GlassCard, type GlassCardProps, type GlassCardRing } from "./components/glass-card";
export { Badge, type BadgeProps, type BadgeVariant } from "./components/badge";
export { Avatar, type AvatarProps } from "./components/avatar";
export { MetricCard, type MetricCardProps } from "./components/metric-card";
export { Table, type TableProps, type TableColumn } from "./components/table";
export { Progress, type ProgressProps } from "./components/progress";
export { EmptyState, type EmptyStateProps } from "./components/empty-state";
export { ErrorState, type ErrorStateProps, type ErrorCode } from "./components/error-state";
export { SuccessState, type SuccessStateProps } from "./components/success-state";

export { InsightCard, type InsightCardProps, type InsightState } from "./components/insight-card";
export { MarketplaceCard, type MarketplaceCardProps } from "./components/marketplace-card";
export { CampaignCard, type CampaignCardProps } from "./components/campaign-card";
export { PromptCard, type PromptCardProps } from "./components/prompt-card";

export {
  CommandPalette,
  type CommandPaletteProps,
  type CommandGroup,
  type CommandItem,
} from "./components/command-palette";
