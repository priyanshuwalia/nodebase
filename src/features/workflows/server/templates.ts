import type { NodeType } from "@/generated/prisma";

export type TemplateNodeSpec = {
  name: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "Start here" | "AI" | "Integrations" | "Job Automation";
  nodes: TemplateNodeSpec[];
  connections: Array<{
    from: number;
    to: number;
    fromOutput?: string;
    toInput?: string;
  }>;
};

const GEMINI_COLUMN = 340;
const RESULT_COLUMN = 600;
const SECOND_COLUMN = 860;
const Y = 120;

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "classify-support",
    name: "Classify support message",
    description:
      "Run a support message through Gemini and read back the detected intent.",
    icon: "Tag",
    category: "AI",
    nodes: [
      {
        name: "Manual trigger",
        type: "MANUAL_TRIGGER",
        position: { x: 80, y: Y },
        data: {},
      },
      {
        name: "Classify intent",
        type: "GEMINI",
        position: { x: GEMINI_COLUMN, y: Y },
        data: {
          model: "gemini-2.5-flash",
          prompt:
            "Classify the following support context into exactly one category: Billing, Technical, Feature request, or Other. Reply with only the category name.\n\nContext: {{$trigger}}",
          system: "You are a support triage assistant.",
        },
      },
      {
        name: "Read intent",
        type: "EXTRACT_FIELD",
        position: { x: RESULT_COLUMN, y: Y },
        data: { paths: ["$prev.text"] },
      },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
  },
  {
    id: "summarize-webhook-alert",
    name: "Summarize webhook payload and send Slack alert",
    description:
      "Turn an incoming webhook into a concise alert posted to a Slack channel.",
    icon: "Megaphone",
    category: "Integrations",
    nodes: [
      {
        name: "Webhook trigger",
        type: "WEBHOOK_TRIGGER",
        position: { x: 80, y: Y },
        data: {},
      },
      {
        name: "Summarize",
        type: "GEMINI",
        position: { x: GEMINI_COLUMN, y: Y },
        data: {
          model: "gemini-2.5-flash",
          prompt:
            "Summarize this payload into a short operational alert message for a team channel.\n\nPayload: {{$trigger}}",
          system: "You write concise operational alerts.",
        },
      },
      {
        name: "Post alert",
        type: "SLACK",
        position: { x: RESULT_COLUMN, y: Y },
        data: {
          message: "Nodebase alert:\n{{$prev.text}}",
          channel: "",
        },
      },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
  },
  {
    id: "api-brief",
    name: "Transform an API response into an AI brief",
    description:
      "Fetch JSON, reshape it, then generate a short written brief with Gemini.",
    icon: "Globe",
    category: "Integrations",
    nodes: [
      {
        name: "Manual trigger",
        type: "MANUAL_TRIGGER",
        position: { x: 80, y: Y },
        data: {},
      },
      {
        name: "Fetch data",
        type: "HTTP_REQUEST",
        position: { x: GEMINI_COLUMN, y: Y },
        data: {
          method: "GET",
          url: "https://api.example.com/v1/data",
          headers: [],
          query: [],
          bodyType: "none",
          bodyContent: "",
          timeoutMs: 10000,
        },
      },
      {
        name: "Shape payload",
        type: "TRANSFORM_JSON",
        position: { x: RESULT_COLUMN, y: Y },
        data: {
          template: {
            title: "{{$prev.data.title}}",
            count: "{{$prev.data.count}}",
          },
        },
      },
      {
        name: "Generate brief",
        type: "GEMINI",
        position: { x: SECOND_COLUMN, y: Y },
        data: {
          model: "gemini-2.5-flash",
          prompt:
            "Write a 3–4 sentence brief about this data. Mention the headline and any notable numbers.\n\nData: {{$prev}}",
          system: "You write clear, data-driven briefs.",
        },
      },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ],
  },
  {
    id: "stripe-payment-alert",
    name: "Stripe payment alert",
    description:
      "React to Stripe charge events and format a high-value payment notification.",
    icon: "CreditCard",
    category: "Integrations",
    nodes: [
      {
        name: "Webhook trigger",
        type: "WEBHOOK_TRIGGER",
        position: { x: 80, y: Y },
        data: {},
      },
      {
        name: "High value check",
        type: "CONDITION",
        position: { x: GEMINI_COLUMN, y: Y },
        data: {
          path: "$trigger.data.object.amount",
          operator: "gte",
          value: 5000,
          negate: false,
        },
      },
      {
        name: "Payment note",
        type: "TRANSFORM_JSON",
        position: { x: RESULT_COLUMN, y: Y },
        data: {
          template: {
            event: "{{$trigger.type}}",
            amount_cents: "{{$trigger.data.object.amount}}",
            currency: "{{$trigger.data.object.currency}}",
            card_last4:
              "{{$trigger.data.object.payment_method_details.card.last4}}",
          },
        },
      },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2, fromOutput: "true" },
    ],
  },
  {
    id: "daily-digest",
    name: "Daily scheduled AI digest",
    description:
      "Generate a short daily digest every morning on a cron schedule.",
    icon: "CalendarClock",
    category: "Integrations",
    nodes: [
      {
        name: "Schedule trigger",
        type: "SCHEDULE_TRIGGER",
        position: { x: 80, y: Y },
        data: { cron: "0 8 * * *", timezone: "" },
      },
      {
        name: "Write digest",
        type: "GEMINI",
        position: { x: GEMINI_COLUMN, y: Y },
        data: {
          model: "gemini-2.5-flash",
          prompt:
            "Write a short daily digest with a heading and three bullet points on the most important thing your team should know today.",
          system: "You write concise daily briefings.",
        },
      },
      {
        name: "Store digest",
        type: "TRANSFORM_JSON",
        position: { x: RESULT_COLUMN, y: Y },
        data: {
          template: {
            digest: "{{$prev.text}}",
            generated_at: "{{$trigger.firedAt}}",
          },
        },
      },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
  },
  {
    id: "extract-fields",
    name: "Extract fields from a payload",
    description:
      "Restructure an example payload and pull out the values you need. A safe, zero-dependency starting point.",
    icon: "Scan",
    category: "Start here",
    nodes: [
      {
        name: "Manual trigger",
        type: "MANUAL_TRIGGER",
        position: { x: 80, y: Y },
        data: {},
      },
      {
        name: "Example payload",
        type: "TRANSFORM_JSON",
        position: { x: GEMINI_COLUMN, y: Y },
        data: {
          template: {
            order: {
              id: "ORDER-1001",
              items: ["USB-C dock", "Laptop stand"],
            },
            customer: {
              email: "ops@example.com",
            },
          },
        },
      },
      {
        name: "Extract values",
        type: "EXTRACT_FIELD",
        position: { x: RESULT_COLUMN, y: Y },
        data: {
          paths: ["order.id", "order.items.0", "customer.email"],
        },
      },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
  },
  {
    id: "job-application-tracker",
    name: "Apply to jobs from Google Sheets and track status",
    description:
      "Read pending job listings from Google Sheets, apply via LinkedIn or Indeed with a personalized cover letter, update the sheet, and notify on Slack.",
    icon: "Briefcase",
    category: "Job Automation",
    nodes: [
      {
        name: "Daily at 9 AM",
        type: "SCHEDULE_TRIGGER",
        position: { x: 80, y: Y },
        data: { cron: "0 9 * * 1-5", timezone: "" },
      },
      {
        name: "Configuration",
        type: "TRANSFORM_JSON",
        position: { x: GEMINI_COLUMN, y: Y },
        data: {
          template: {
            spreadsheetId: "REPLACE_WITH_YOUR_GOOGLE_SHEET_ID",
            resumeUrl: "https://drive.google.com/file/d/YOUR_RESUME_ID/view",
            coverLetterTemplate:
              "Dear Hiring Manager,\n\nI am excited to apply for the {{position}} role at {{company}}. With my experience in software development, I believe I would be a valuable addition to your team.\n\nBest regards,\nYour Name",
          },
        },
      },
      {
        name: "Read jobs from Google Sheets",
        type: "HTTP_REQUEST",
        position: { x: RESULT_COLUMN, y: Y },
        data: {
          method: "GET",
          url: "https://sheets.googleapis.com/v4/spreadsheets/{{$node.Configuration.spreadsheetId}}/values/Jobs!A:J",
          headers: [
            {
              name: "Authorization",
              value: "Bearer {{YOUR_GOOGLE_SHEETS_TOKEN}}",
            },
          ],
          query: [{ name: "key", value: "{{YOUR_GOOGLE_API_KEY}}" }],
          bodyType: "none",
          bodyContent: "",
          timeoutMs: 15000,
        },
      },
      {
        name: "Filter pending and prepare",
        type: "TRANSFORM_JSON",
        position: { x: SECOND_COLUMN, y: Y },
        data: {
          template: {
            pendingJobs:
              "{{$prev.data.values.filter(function(row){ return row[3]==='Not Applied' && row[8]; }).map(function(row){ return { jobId: row[0], company: row[1], position: row[2], status: row[3], jobUrl: row[8], priority: row[9] }; })}}",
            totalCount:
              "{{$prev.data.values.filter(function(row){ return row[3]==='Not Applied' && row[8]; }).length}}",
          },
        },
      },
      {
        name: "Is LinkedIn?",
        type: "CONDITION",
        position: { x: 1120, y: Y },
        data: {
          path: "$prev.pendingJobs.0.jobUrl",
          operator: "contains",
          value: "linkedin.com",
          negate: false,
        },
      },
      {
        name: "Apply via LinkedIn",
        type: "HTTP_REQUEST",
        position: { x: 1380, y: Y - 60 },
        data: {
          method: "POST",
          url: "https://api.linkedin.com/v2/jobs/applications",
          headers: [
            { name: "Content-Type", value: "application/json" },
            {
              name: "Authorization",
              value: "Bearer {{YOUR_LINKEDIN_TOKEN}}",
            },
          ],
          query: [],
          bodyType: "json",
          bodyContent:
            '{"jobId":"{{$prev.pendingJobs.0.jobId}}","coverLetter":"{{$node.Configuration.coverLetterTemplate}}","resumeUrl":"{{$node.Configuration.resumeUrl}}"}',
          timeoutMs: 30000,
        },
      },
      {
        name: "Apply via Indeed",
        type: "HTTP_REQUEST",
        position: { x: 1380, y: Y + 60 },
        data: {
          method: "POST",
          url: "https://api.indeed.com/v2/jobs/apply",
          headers: [
            { name: "Content-Type", value: "application/json" },
            {
              name: "Authorization",
              value: "Bearer {{YOUR_INDEED_API_KEY}}",
            },
          ],
          query: [],
          bodyType: "json",
          bodyContent:
            '{"jobKey":"{{$prev.pendingJobs.0.jobId}}","message":"{{$node.Configuration.coverLetterTemplate}}","resumeUrl":"{{$node.Configuration.resumeUrl}}"}',
          timeoutMs: 30000,
        },
      },
      {
        name: "Process result",
        type: "TRANSFORM_JSON",
        position: { x: 1640, y: Y },
        data: {
          template: {
            job: "{{$prev.pendingJobs ? $prev.pendingJobs[0] : ($prev.body || $prev)}}",
            platform:
              "{{$prev.pendingJobs ? ($prev.pendingJobs[0].jobUrl.indexOf('linkedin')>=0 ? 'linkedin' : 'indeed') : 'unknown'}}",
            appliedAt: "{{$now}}",
            status:
              "{{$prev.statusCode >= 200 && $prev.statusCode < 300 ? 'Applied' : 'Failed'}}",
            notes:
              "{{$prev.statusCode >= 200 && $prev.statusCode < 300 ? 'Application submitted successfully' : 'Application failed with status ' + $prev.statusCode}}",
          },
        },
      },
      {
        name: "Update sheet status",
        type: "HTTP_REQUEST",
        position: { x: 1900, y: Y },
        data: {
          method: "PUT",
          url: "https://sheets.googleapis.com/v4/spreadsheets/{{$node.Configuration.spreadsheetId}}/values/Jobs!D2:H2",
          headers: [
            { name: "Content-Type", value: "application/json" },
            {
              name: "Authorization",
              value: "Bearer {{YOUR_GOOGLE_SHEETS_TOKEN}}",
            },
          ],
          query: [
            { name: "key", value: "{{YOUR_GOOGLE_API_KEY}}" },
            { name: "valueInputOption", value: "RAW" },
          ],
          bodyType: "json",
          bodyContent:
            '{"values":[["Applied","{{$prev.appliedAt}}","{{$prev.appliedAt}}","AUTO_APP_ID","{{$prev.notes}}"]]}',
          timeoutMs: 10000,
        },
      },
      {
        name: "Notify on Slack",
        type: "SLACK",
        position: { x: 2160, y: Y },
        data: {
          message:
            "Job application update: {{$prev.status}} - {{$prev.job.company}} / {{$prev.job.position}} via {{$prev.platform}} at {{$prev.appliedAt}}",
          channel: "",
        },
      },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5, fromOutput: "true" },
      { from: 4, to: 6, fromOutput: "false" },
      { from: 5, to: 7 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
    ],
  },
];

export function getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((template) => template.id === id);
}
