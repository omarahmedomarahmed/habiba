"use client";

import { useState, useTransition } from "react";

import { savePage } from "@/app/(admin)/admin/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { ICON_NAMES } from "@/components/public/icons";
import { CONTENT_DEMOS } from "@/lib/db/schema";

/** The artwork that ships with the app. Any https:// URL also works. */
const BACKGROUNDS = [
  { label: "None (gradient only)", value: "" },
  { label: "Mesh", value: "/backgrounds/mesh.svg" },
  { label: "Waves", value: "/backgrounds/waves.svg" },
  { label: "Contours", value: "/backgrounds/contours.svg" },
  { label: "Grid", value: "/backgrounds/grid.svg" },
];

const SELECT_CLASS =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none";
import type { ContentBlock } from "@/lib/db/schema";

/**
 * Block editor.
 *
 * Structured fields, not a rich-text box. That is a deliberate constraint: the
 * public site and the clinician portal share an origin and a cookie scope, so
 * admin-authored HTML would be a stored-XSS path straight to a session cookie.
 * Everything typed here is stored as text and rendered as text.
 */
export function PageEditor({
  pageId,
  slug,
  initial,
}: {
  pageId: string;
  slug: string;
  initial: {
    title: string;
    description: string;
    status: "draft" | "published";
    blocks: ContentBlock[];
  };
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [status, setStatus] = useState(initial.status);
  const [blocks, setBlocks] = useState<ContentBlock[]>(initial.blocks);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patchBlock = (index: number, patch: Record<string, unknown>) => {
    setBlocks((current) =>
      current.map((block, i) => (i === index ? ({ ...block, ...patch } as ContentBlock) : block)),
    );
  };

  const patchItem = (blockIndex: number, itemIndex: number, patch: Record<string, string>) => {
    setBlocks((current) =>
      current.map((block, i) => {
        if (i !== blockIndex || !("items" in block)) return block;
        const items = (block.items as Record<string, string>[]).map((item, j) =>
          j === itemIndex ? { ...item, ...patch } : item,
        );
        return { ...block, items } as ContentBlock;
      }),
    );
  };

  const handleSave = (nextStatus?: "draft" | "published") =>
    startTransition(async () => {
      setError(null);
      setFeedback(null);
      const effective = nextStatus ?? status;
      const result = await savePage(pageId, {
        title,
        description,
        status: effective,
        blocks,
      });
      if (result.error) setError(result.error);
      else {
        setStatus(effective);
        setFeedback(effective === "published" ? "Published — live now" : "Saved as draft");
      }
    });

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">
            /{slug === "home" ? "" : slug}
          </p>
          <span className="text-xs text-slate-500">{status}</span>
        </div>

        {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <Field label="Page title" htmlFor="title" hint="Used in the browser tab and search results.">
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <Field label="Meta description" htmlFor="description">
          <Textarea
            id="description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </Card>

      {blocks.map((block, index) => (
        <Card key={index} className="space-y-3 p-4">
          <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            {block.type}
          </p>

          {"eyebrow" in block ? (
            <Field label="Eyebrow" htmlFor={`eyebrow-${index}`}>
              <Input
                id={`eyebrow-${index}`}
                value={block.eyebrow ?? ""}
                onChange={(e) => patchBlock(index, { eyebrow: e.target.value })}
              />
            </Field>
          ) : null}

          {"heading" in block ? (
            <Field label="Heading" htmlFor={`heading-${index}`}>
              <Input
                id={`heading-${index}`}
                value={block.heading ?? ""}
                onChange={(e) => patchBlock(index, { heading: e.target.value })}
              />
            </Field>
          ) : null}

          {"body" in block ? (
            <Field label="Body" htmlFor={`body-${index}`}>
              <Textarea
                id={`body-${index}`}
                rows={3}
                value={block.body ?? ""}
                onChange={(e) => patchBlock(index, { body: e.target.value })}
              />
            </Field>
          ) : null}

          {"backgroundImage" in block || block.type === "hero" || block.type === "cta" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Background image"
                htmlFor={`bg-${index}`}
                hint="Pick built-in artwork, or paste any https:// image URL below."
              >
                <select
                  id={`bg-${index}`}
                  className={SELECT_CLASS}
                  value={
                    BACKGROUNDS.some((b) => b.value === (block.backgroundImage ?? ""))
                      ? (block.backgroundImage ?? "")
                      : "custom"
                  }
                  onChange={(e) =>
                    e.target.value !== "custom" &&
                    patchBlock(index, { backgroundImage: e.target.value })
                  }
                >
                  {BACKGROUNDS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                  <option value="custom">Custom URL…</option>
                </select>
              </Field>
              <Field label="Custom image URL" htmlFor={`bgurl-${index}`}>
                <Input
                  id={`bgurl-${index}`}
                  value={block.backgroundImage ?? ""}
                  placeholder="https://…"
                  onChange={(e) => patchBlock(index, { backgroundImage: e.target.value })}
                />
              </Field>
            </div>
          ) : null}

          {block.type !== "faq" && block.type !== "cta" ? (
            <Field label="Icon" htmlFor={`icon-${index}`}>
              <select
                id={`icon-${index}`}
                className={SELECT_CLASS}
                value={("icon" in block ? block.icon : "") ?? ""}
                onChange={(e) => patchBlock(index, { icon: e.target.value })}
              >
                <option value="">None</option>
                {ICON_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {"ctaLabel" in block ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Button label" htmlFor={`cta-${index}`}>
                <Input
                  id={`cta-${index}`}
                  value={block.ctaLabel ?? ""}
                  onChange={(e) => patchBlock(index, { ctaLabel: e.target.value })}
                />
              </Field>
              <Field label="Button link" htmlFor={`href-${index}`}>
                <Input
                  id={`href-${index}`}
                  value={block.ctaHref ?? ""}
                  onChange={(e) => patchBlock(index, { ctaHref: e.target.value })}
                />
              </Field>
            </div>
          ) : null}

          {"items" in block
            ? (block.items as Record<string, string>[]).map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  {"title" in item ? (
                    <Input
                      aria-label={`Item ${itemIndex + 1} title`}
                      value={item.title ?? ""}
                      onChange={(e) => patchItem(index, itemIndex, { title: e.target.value })}
                    />
                  ) : null}
                  {"q" in item ? (
                    <Input
                      aria-label={`Question ${itemIndex + 1}`}
                      value={item.q ?? ""}
                      onChange={(e) => patchItem(index, itemIndex, { q: e.target.value })}
                    />
                  ) : null}
                  <Textarea
                    aria-label={`Item ${itemIndex + 1} body`}
                    rows={2}
                    value={item.body ?? item.a ?? ""}
                    onChange={(e) =>
                      patchItem(
                        index,
                        itemIndex,
                        "a" in item ? { a: e.target.value } : { body: e.target.value },
                      )
                    }
                  />
                  {!("q" in item) ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        aria-label={`Item ${itemIndex + 1} icon`}
                        className={SELECT_CLASS}
                        value={item.icon ?? ""}
                        onChange={(e) => patchItem(index, itemIndex, { icon: e.target.value })}
                      >
                        <option value="">No icon</option>
                        {ICON_NAMES.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      {block.type === "showcase" ? (
                        <select
                          aria-label={`Item ${itemIndex + 1} component`}
                          className={SELECT_CLASS}
                          value={item.demo ?? "none"}
                          onChange={(e) => patchItem(index, itemIndex, { demo: e.target.value })}
                        >
                          {CONTENT_DEMOS.map((demo) => (
                            <option key={demo} value={demo}>
                              {demo === "none" ? "No component" : `Show ${demo}`}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
            : null}
        </Card>
      ))}

      <div className="sticky bottom-4 flex gap-2.5">
        <Button variant="secondary" full disabled={pending} onClick={() => handleSave("draft")}>
          Save draft
        </Button>
        <Button full disabled={pending} onClick={() => handleSave("published")}>
          {pending ? "Saving…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}
