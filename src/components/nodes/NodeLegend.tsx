/**
 * The three marks on the map, plus the prototype line.
 * The line is repeated in the panel so sample data is never unmarked.
 */

import foresightIcon from "../../assets/Foresight_RGB_Icon_Black.png?url";

export function NodeLegend() {
  return (
    <div className="atlas-node-legend">
      <p>Prototype. Sample data only.</p>
      <ul>
        <li data-kind="node">
          <span className="atlas-node-legend__mark atlas-node-legend__mark--wheel" aria-hidden>
            <img src={foresightIcon} alt="" />
          </span>
          Foresight node
        </li>
        <li data-kind="affiliate">
          <span className="atlas-node-legend__mark atlas-node-legend__mark--affiliate" aria-hidden />
          Affiliate
        </li>
        <li data-kind="conversation">
          <span className="atlas-node-legend__mark atlas-node-legend__mark--conversation" aria-hidden />
          In conversation
        </li>
      </ul>
    </div>
  );
}
