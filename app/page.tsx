"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Scale,
  UploadCloud,
  FileText,
  Trash2,
  Sparkles,
} from "lucide-react";

type EvidenceFile = { name: string; size: number };

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function IntakePage() {
  const router = useRouter();
  const [caseContext, setCaseContext] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = caseContext.trim().length >= 20;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).map((f) => ({ name: f.name, size: f.size }));
    setEvidenceFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}`));
      return [...prev, ...incoming.filter((f) => !seen.has(`${f.name}-${f.size}`))];
    });
  }

  function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  }

  function removeFile(idx: number) {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    window.sessionStorage.setItem(
      "tribunalNavigator.intake",
      JSON.stringify({
        caseContext: caseContext.trim(),
        evidenceFiles,
        createdAt: new Date().toISOString(),
      })
    );
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen w-full bg-background">
      <div className="mx-auto w-full max-w-2xl px-6 py-8 lg:py-12">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
              <Scale className="size-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Tribunal Navigator</span>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
              Find out what your case is really worth.
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              We simulate how a panel of real UK Employment Tribunal judges would assess your
              dispute, then give you a straight answer on your odds — and whether it&apos;s actually
              worth pursuing. Answer a few questions to begin.
            </p>
          </div>
        </header>

        <form onSubmit={onSubmit} className="mt-12 flex flex-col gap-8">
          {/* Q1 — what happened */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">
                <span className="text-muted-foreground">1.</span> Tell us about your case.
              </h2>
              <p className="text-sm text-muted-foreground">
                Describe what happened in your own words — dates, what your employer said, and what
                you want. The more detail, the sharper the simulation.
              </p>
            </div>

            <Textarea
              value={caseContext}
              onChange={(e) => setCaseContext(e.target.value)}
              placeholder="On 12 March 2025, after four years of service, I was told my role was redundant…"
              rows={12}
              className="resize-none text-sm leading-relaxed min-h-40"
            />
          </section>

          {/* Q3 — evidence */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">
                <span className="text-muted-foreground">2.</span> Add any evidence.{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                Upload documents that support your account.
              </p>
            </div>

            <label
              htmlFor="evidence"
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
                dragActive
                  ? "border-foreground bg-muted/50"
                  : "border-border hover:border-foreground/40 hover:bg-muted/30"
              )}
            >
              <input
                ref={fileInputRef}
                id="evidence"
                type="file"
                multiple
                onChange={onFileInput}
                accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg,.heic"
                className="sr-only"
              />
              <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <UploadCloud className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  Drag files here, or <span className="underline underline-offset-2">browse</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Dismissal letters, contracts, emails, payslips, ACAS records — PDF, DOCX, TXT, images
                </span>
              </div>
            </label>

            {evidenceFiles.length > 0 && (
              <Card className="w-full overflow-y-auto border bg-card !shadow-none">
                <CardContent className="space-y-4">
                  {evidenceFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-x-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                          <FileText className="size-4" />
                        </span>
                        <div className="flex min-w-0 flex-col items-start">
                          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(idx)}
                        className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${file.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>

          {/* Submit */}
          <div className="flex flex-col gap-3 border-t pt-8">
            <Button type="submit" size="lg" disabled={!canSubmit} className="w-full sm:w-auto sm:self-start">
              Run simulation <Sparkles className="size-4" />
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Tribunal Navigator is not legal advice. Always verify outputs before relying on them.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
