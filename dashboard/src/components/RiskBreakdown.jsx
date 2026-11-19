import { capitalize, riskTone } from "../format.js";
import { Panel } from "./Panel.jsx";

const MAX_FACTOR_POINTS = 40;

export function RiskBreakdown({ risk }) {
  const factors = risk.factors || [];

  return (
    <Panel
      title="Risk breakdown"
      subtitle="Each rule that added points to the score"
      action={<span className={`pill tone-${riskTone(risk.level)}`}>{capitalize(risk.level)}</span>}
    >
      {factors.length > 0 ? (
        <ul className="factor-list">
          {factors.map((factor) => (
            <li key={factor.label}>
              <div className="factor-meta">
                <span>{factor.label}</span>
                <strong>+{factor.points}</strong>
              </div>
              <div className="bar-track">
                <div
                  className={`bar-fill fill-${riskTone(risk.level)}`}
                  style={{ width: `${Math.min(100, (factor.points / MAX_FACTOR_POINTS) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="reason-list">
          {risk.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}
      <div className="factor-total">
        <span>Total score</span>
        <strong>{risk.score} / 100</strong>
      </div>
    </Panel>
  );
}
