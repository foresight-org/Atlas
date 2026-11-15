/**
 * The path from a salon to memory. Nothing in this strip runs in the prototype.
 * It is here so the room can see the consent boundary before any microphone exists.
 */

const STEPS = [
  { name: "Capture", hint: "Only when the whole room agrees" },
  { name: "Diarize", hint: "Split the audio by speaker" },
  { name: "Sterilize", hint: "Names and anything held back come out" },
  { name: "Analyze", hint: "Topics and links, on the Node’s compute" },
  { name: "Graph", hint: "Fold them into this memory" },
] as const;

export function PipelineStrip() {
  return (
    <section className="atlas-pipeline" aria-labelledby="node-pipeline-title">
      <div className="atlas-pipeline__head">
        <h3 id="node-pipeline-title">How a conversation becomes memory</h3>
        <p>Not running in this prototype.</p>
      </div>
      <ol>
        {STEPS.map((step, index) => (
          <li key={step.name}>
            <span className="atlas-pipeline__index" aria-hidden>
              {index + 1}
            </span>
            <span className="atlas-pipeline__name">{step.name}</span>
            <span className="atlas-pipeline__hint">{step.hint}</span>
          </li>
        ))}
      </ol>
      <p className="atlas-pipeline__consent">
        A conversation enters only when everyone in the room has consented. One refusal keeps all of it out.
        Raw audio never leaves the Node. This memory stores topics and links, not transcripts and not names.
        Anyone can ask for their contribution to be removed, and the memory updates. Cross-node matching stays opt-in.
      </p>
    </section>
  );
}
