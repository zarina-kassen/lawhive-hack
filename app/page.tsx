"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type EvidenceFile = {
  name: string;
  size: number;
};

const casePlaceholder =
  "Tell us what happened, in your own words. Include dates, what your employer said, what you did next, and what outcome you want.";

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function IntakePage() {
  const router = useRouter();
  const [caseContext, setCaseContext] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);

  const canRunSimulation = caseContext.trim().length >= 20;
  const evidenceSummary = useMemo(() => {
    if (evidenceFiles.length === 0) return "No files selected";
    if (evidenceFiles.length === 1) return evidenceFiles[0].name;
    return `${evidenceFiles.length} files selected`;
  }, [evidenceFiles]);

  function onEvidenceChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).map((file) => ({
      name: file.name,
      size: file.size,
    }));

    setEvidenceFiles(files);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canRunSimulation) return;

    window.sessionStorage.setItem(
      "tribunalNavigator.intake",
      JSON.stringify({
        caseContext: caseContext.trim(),
        evidenceFiles,
        createdAt: new Date().toISOString(),
      }),
    );

    router.push("/results");
  }

  return (
    <main className="intake-shell">
      <section className="intake-card" aria-labelledby="intake-title">
        <header className="intake-header">
          <p className="eyebrow">Tribunal Navigator</p>
          <h1 id="intake-title">Start with the facts.</h1>
          <p>
            Describe your employment dispute and upload the evidence you have. We will simulate how tribunal
            judges may assess it and suggest next steps.
          </p>
        </header>

        <form className="intake-form" onSubmit={onSubmit}>
          <label className="case-field" htmlFor="case-context">
            <span>Case context</span>
            <textarea
              id="case-context"
              name="caseContext"
              value={caseContext}
              onChange={(event) => setCaseContext(event.target.value)}
              placeholder={casePlaceholder}
              minLength={20}
              required
            />
          </label>

          <label className="evidence-dropzone" htmlFor="evidence">
            <input
              id="evidence"
              name="evidence"
              type="file"
              multiple
              onChange={onEvidenceChange}
              accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg,.heic"
            />
            <span className="dropzone-label">Documents & evidence</span>
            <strong>{evidenceSummary}</strong>
            <small>Upload dismissal letters, contracts, emails, grievance records, payslips, messages, or ACAS correspondence.</small>
          </label>

          {evidenceFiles.length > 0 ? (
            <ul className="evidence-list" aria-label="Selected evidence files">
              {evidenceFiles.map((file) => (
                <li key={`${file.name}-${file.size}`}>
                  <span>{file.name}</span>
                  <small>{formatFileSize(file.size)}</small>
                </li>
              ))}
            </ul>
          ) : null}

          <button className="primary-action" type="submit" disabled={!canRunSimulation}>
            Run judge simulation
          </button>
        </form>
      </section>
    </main>
  );
}
