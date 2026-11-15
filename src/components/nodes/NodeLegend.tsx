/**
 * The three marks on the globe, plus the prototype line.
 * The line is repeated in the panel so sample data is never unmarked.
 */

export function NodeLegend() {
  return (
    <div className="atlas-node-legend">
      <p>Prototype. Sample data only.</p>
      <ul>
        <li data-kind="node">Foresight node</li>
        <li data-kind="affiliate">Affiliate</li>
        <li data-kind="conversation">In conversation</li>
      </ul>
    </div>
  );
}
