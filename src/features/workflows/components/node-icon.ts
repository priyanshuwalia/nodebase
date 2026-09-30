import {
  BracesIcon,
  CalendarClockIcon,
  GitBranchIcon,
  GlobeIcon,
  type LucideIcon,
  MessageSquareIcon,
  ScanSearchIcon,
  SparklesIcon,
  TimerIcon,
  WebhookIcon,
  ZapIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Zap: ZapIcon,
  Webhook: WebhookIcon,
  CalendarClock: CalendarClockIcon,
  Sparkles: SparklesIcon,
  Globe: GlobeIcon,
  GitBranch: GitBranchIcon,
  Timer: TimerIcon,
  Braces: BracesIcon,
  ScanSearch: ScanSearchIcon,
  MessageSquare: MessageSquareIcon,
};

export function nodeIcon(name: string): LucideIcon {
  return ICONS[name] ?? SparklesIcon;
}
