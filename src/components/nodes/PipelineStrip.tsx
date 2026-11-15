/**
 * Capture through graph, drawn as a flow.
 * The last step is the memory on this page. Nothing in the chain is running yet.
 */

const STEPS = ["Capture", "Diarize", "Sterilize", "Analyze", "Graph"] as const;

export function PipelineStrip() {
  return (
    <section className="atlas-flow" aria-label="How a conversation becomes memory">
      <ol>
        {STEPS.map((step, index) => (
          <li key={step}>
            <span>{step}</span>
            {index < STEPS.length - 1 ? <span className="atlas-flow__arrow" aria-hidden /> : null}
          </li>
        ))}
      </ol>
      <p>Consented conversations only.</p>
    </section>
  );
}
