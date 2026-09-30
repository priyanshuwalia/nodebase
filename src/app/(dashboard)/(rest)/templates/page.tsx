import {
  BriefcaseIcon,
  CalendarClockIcon,
  CreditCardIcon,
  GlobeIcon,
  MegaphoneIcon,
  ScanIcon,
  SparklesIcon,
  TagIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createWorkflowFromTemplate } from "@/features/workflows/server/template-actions";
import {
  WORKFLOW_TEMPLATES,
  type WorkflowTemplate,
} from "@/features/workflows/server/templates";
import { getNodeTypeMeta } from "@/integrations/nodes/registry";
import { requireAuth } from "@/lib/auth-utils";

const iconMap = {
  Tag: TagIcon,
  Megaphone: MegaphoneIcon,
  Globe: GlobeIcon,
  CreditCard: CreditCardIcon,
  CalendarClock: CalendarClockIcon,
  Scan: ScanIcon,
  Briefcase: BriefcaseIcon,
} as const;

const Page = async () => {
  await requireAuth();

  const categories = [
    "Start here",
    "AI",
    "Integrations",
    "Job Automation",
  ] as const;

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Start from a real automation and connect your own steps.
        </p>
      </div>

      {categories.map((category) => (
        <section className="mt-8" key={category}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW_TEMPLATES.filter(
              (template) => template.category === category,
            ).map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

function TemplateCard({ template }: { template: WorkflowTemplate }) {
  const Icon = iconMap[template.icon as keyof typeof iconMap] ?? SparklesIcon;
  const nodeTypes = template.nodes
    .map((spec) => spec.type)
    .filter((type, position, self) => self.indexOf(type) === position);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-5" />
          </span>
          <div className="flex flex-wrap justify-end gap-1">
            {nodeTypes.slice(0, 3).map((type) => (
              <Badge key={type} variant="outline">
                {getNodeTypeMeta(type)?.label ?? type}
              </Badge>
            ))}
          </div>
        </div>
        <CardTitle className="text-base">{template.name}</CardTitle>
        <CardDescription className="text-sm">
          {template.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <form action={createWorkflowFromTemplate}>
          <input name="templateId" type="hidden" value={template.id} />
          <Button className="w-full" size="sm" type="submit">
            Use template
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default Page;
