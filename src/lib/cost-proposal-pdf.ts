import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import defaultTemplate from "@/assets/cost-proposal-template.pdf.asset.json";

export type CostProposalKind = "project" | "work" | "subscription";

export type CostProposalItem = {
  item_no: string | null;
  description: string;
  quantity: number;
  final_cost: number;
};

export type CostProposalSection = {
  heading: string;
  items: CostProposalItem[];
  /** Subscription sub-section only */
  renewalDate?: string | null;
};

export type CostProposalInput = {
  kind: CostProposalKind;
  clientName: string | null | undefined;
  /** Project/work title or subscription plan name */
  title: string;
  description: string | null | undefined;
  /** Subscriptions only — applies to the primary section */
  renewalDate?: string | null;
  items: CostProposalItem[];
  /** Optional second section appended after the main one (e.g. linked subscription) */
  extraSection?: CostProposalSection;
};

type Settings = {
  template_path: string | null;
  conditions_project: string[];
  conditions_work: string[];
  conditions_subscription: string[];
};

const DEFAULT_CONDITIONS = [
  "This proposal is valid for 30 days.",
  "Invoices must be paid within 30 days.",
  "IO-Gen Ltd will keep all information from the client confidential",
];

function formatGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDateLong(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

async function fetchTemplateBytes(templatePath: string | null): Promise<ArrayBuffer> {
  if (templatePath) {
    const { data, error } = await supabase.storage.from("project-files").download(templatePath);
    if (!error && data) return await data.arrayBuffer();
  }
  const res = await fetch(defaultTemplate.url);
  return await res.arrayBuffer();
}

async function fetchSettings(): Promise<Settings> {
  const { data } = await supabase
    .from("cost_proposal_settings")
    .select("template_path,conditions_project,conditions_work,conditions_subscription")
    .maybeSingle();
  return {
    template_path: data?.template_path ?? null,
    conditions_project: data?.conditions_project ?? DEFAULT_CONDITIONS,
    conditions_work: data?.conditions_work ?? DEFAULT_CONDITIONS,
    conditions_subscription: data?.conditions_subscription ?? DEFAULT_CONDITIONS,
  };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function generateCostProposalPdf(input: CostProposalInput): Promise<void> {
  const settings = await fetchSettings();
  const templateBytes = await fetchTemplateBytes(settings.template_path);

  const conditions =
    input.kind === "project"
      ? settings.conditions_project
      : input.kind === "work"
        ? settings.conditions_work
        : settings.conditions_subscription;

  const pdf = await PDFDocument.load(templateBytes);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.getPages()[0];
  const { width, height } = page.getSize();

  const marginX = 60;
  const contentWidth = width - marginX * 2;
  let y = height - 230; // Start below the "Cost Proposal" title block in the template

  const ink = rgb(0.05, 0.1, 0.12);
  const muted = rgb(0.2, 0.25, 0.28);

  const ensureSpace = async (needed: number) => {
    if (y - needed >= 80) return;
    // Append a new page using the template's first page as background
    const [copied] = await pdf.copyPages(pdf, [0]);
    pdf.addPage(copied);
    page = pdf.getPages()[pdf.getPageCount() - 1];
    y = height - 80;
  };

  const drawText = (text: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number }) => {
    const font = opts.font ?? helv;
    const size = opts.size ?? 11;
    page.drawText(text, { x: opts.x ?? marginX, y, size, font, color: opts.color ?? ink });
  };

  // Date
  await ensureSpace(20);
  drawText(formatDateLong(new Date()), { size: 11 });
  y -= 22;

  // Header line: client - title
  await ensureSpace(22);
  const headerLine = `${input.clientName?.trim() || "—"} - ${input.title}`;
  drawText(headerLine, { font: helvBold, size: 13 });
  y -= 30;

  // Description
  if (input.description?.trim()) {
    const lines = wrapText(input.description.trim(), helv, 11, contentWidth);
    for (const line of lines) {
      await ensureSpace(16);
      drawText(line, { size: 11 });
      y -= 15;
    }
    y -= 8;
  }

  // Cost table
  const cols = [
    { header: "Item No.", width: 70, align: "center" as const },
    { header: "Description", width: contentWidth - 70 - 80 - 110, align: "left" as const },
    { header: "Quantity", width: 80, align: "center" as const },
    { header: "Cost (ex. VAT)", width: 110, align: "right" as const },
  ];

  const drawRow = (cells: string[], opts: { bold?: boolean; rowHeight: number }) => {
    const font = opts.bold ? helvBold : helv;
    const size = 10.5;
    const rowTop = y;
    const rowBottom = y - opts.rowHeight;
    let x = marginX;
    page.drawRectangle({
      x: marginX, y: rowBottom, width: contentWidth, height: opts.rowHeight,
      borderColor: muted, borderWidth: 0.7,
    });
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const cellLines = wrapText(cells[i], font, size, col.width - 10);
      let ty = rowTop - 16;
      for (const ln of cellLines) {
        const w = font.widthOfTextAtSize(ln, size);
        let tx = x + 5;
        if (col.align === "center") tx = x + (col.width - w) / 2;
        if (col.align === "right") tx = x + col.width - w - 5;
        page.drawText(ln, { x: tx, y: ty, size, font, color: ink });
        ty -= 13;
      }
      if (i < cols.length - 1) {
        page.drawLine({
          start: { x: x + col.width, y: rowTop },
          end: { x: x + col.width, y: rowBottom },
          thickness: 0.7, color: muted,
        });
      }
      x += col.width;
    }
    y = rowBottom;
  };

  const drawSection = async (opts: {
    heading?: string;
    items: CostProposalItem[];
    renewalDate?: string | null;
    isSubtotal: boolean;
  }) => {
    if (opts.heading) {
      await ensureSpace(22);
      page.drawText(opts.heading, { x: marginX, y, size: 12, font: helvBold, color: ink });
      y -= 18;
    }
    await ensureSpace(40);
    drawRow(cols.map((c) => c.header), { bold: true, rowHeight: 28 });
    for (const item of opts.items) {
      const descLines = wrapText(item.description || "", helv, 10.5, cols[1].width - 10);
      const rowHeight = Math.max(26, 14 + descLines.length * 13);
      await ensureSpace(rowHeight + 4);
      drawRow(
        [item.item_no ?? "", item.description ?? "", String(item.quantity ?? 0), formatGBP(Number(item.final_cost ?? 0))],
        { rowHeight },
      );
    }
    const totalQty = opts.items.reduce((s, i) => s + Number(i.quantity ?? 0), 0);
    const totalCost = opts.items.reduce((s, i) => s + Number(i.final_cost ?? 0), 0);
    await ensureSpace(30);
    drawRow([
      "",
      opts.isSubtotal ? "Subtotal" : "Total",
      String(totalQty),
      formatGBP(totalCost),
    ], { bold: true, rowHeight: 26 });
    y -= 10;
    if (opts.renewalDate) {
      await ensureSpace(20);
      page.drawText(`Renewal due: ${formatDateLong(opts.renewalDate)}`, {
        x: marginX, y, size: 11, font: helvBold, color: ink,
      });
      y -= 22;
    }
    return totalCost;
  };

  const hasExtra = !!input.extraSection;

  // Primary section
  const primaryTotal = await drawSection({
    heading: hasExtra ? (input.kind === "subscription" ? `Subscription — ${input.title}` : "Project & Works") : undefined,
    items: input.items,
    renewalDate: input.kind === "subscription" ? input.renewalDate ?? null : null,
    isSubtotal: hasExtra,
  });

  // Optional extra section (combined cost proposal)
  let grandTotal = primaryTotal;
  if (hasExtra && input.extraSection) {
    y -= 6;
    const extraTotal = await drawSection({
      heading: input.extraSection.heading,
      items: input.extraSection.items,
      renewalDate: input.extraSection.renewalDate ?? null,
      isSubtotal: true,
    });
    grandTotal += extraTotal;
    await ensureSpace(30);
    drawRow(["", "Grand Total", "", formatGBP(grandTotal)], { bold: true, rowHeight: 26 });
    y -= 10;
  }

  // Renewal (single-section subscriptions handled inside drawSection)
  y -= 6;


  // Conditions
  if (conditions.length) {
    await ensureSpace(24);
    page.drawText("Conditions", { x: marginX, y, size: 12, font: helvBold, color: ink });
    y -= 18;
    for (const c of conditions) {
      const lines = wrapText(c, helv, 11, contentWidth - 14);
      for (let i = 0; i < lines.length; i++) {
        await ensureSpace(16);
        const prefix = i === 0 ? "•  " : "    ";
        page.drawText(prefix + lines[i], { x: marginX, y, size: 11, font: helv, color: ink });
        y -= 15;
      }
    }
  }

  const bytes = await pdf.save();
  // Copy into a plain ArrayBuffer to satisfy the Blob TS type
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();
  a.href = url;
  a.download = `Cost Proposal - ${safe(input.clientName || "Client")} - ${safe(input.title)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function fetchCostItems(parentType: "project" | "subscription", parentId: string) {
  const { data: versions } = await supabase
    .from("cost_versions")
    .select("id,is_current,version")
    .eq("parent_type", parentType)
    .eq("parent_id", parentId)
    .order("version", { ascending: false });
  const current = (versions ?? []).find((v) => v.is_current) ?? versions?.[0];
  if (!current) return [];
  const { data: items } = await supabase
    .from("cost_items")
    .select("item_no,description,quantity,final_cost,position")
    .eq("version_id", current.id)
    .order("position");
  return (items ?? []).map((i) => ({
    item_no: i.item_no,
    description: i.description,
    quantity: Number(i.quantity),
    final_cost: Number(i.final_cost),
  }));
}
