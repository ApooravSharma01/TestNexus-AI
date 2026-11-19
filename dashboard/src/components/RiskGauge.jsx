import { riskTone } from "../format.js";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function RiskGauge({ score, level }) {
  const offset = CIRCUMFERENCE * (1 - score / 100);

  return (
    <div className={`gauge tone-${riskTone(level)}`}>
      <svg viewBox="0 0 108 108" role="img" aria-label={`Risk score ${score} of 100`}>
        <circle className="gauge-track" cx="54" cy="54" r={RADIUS} />
        <circle
          className="gauge-value"
          cx="54"
          cy="54"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 54 54)"
        />
      </svg>
      <div className="gauge-label">
        <strong>{score}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}
