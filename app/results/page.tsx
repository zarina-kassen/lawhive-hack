"use client";

export default function ResultsPage() {
  return (
    <main className="results-shell">
      <section className="results-placeholder" aria-labelledby="results-title">
        <p className="eyebrow">Simulation running</p>
        <h1 id="results-title">Preparing your tribunal assessment.</h1>
        <p>
          This is the temporary results handoff. Next we will shape this page into the full Strategic
          Recommendation, Case Forecast, Practical Impact, and Action Plan experience.
        </p>
        <ul className="progress-list" aria-label="Simulation stages">
          <li>Building your case profile</li>
          <li>Selecting relevant tribunal judges</li>
          <li>Running judge debates</li>
          <li>Preparing your recommendation</li>
        </ul>
      </section>
    </main>
  );
}
