import React from "react";

import "./speed-toggle.scss";

interface Props {
  fastSimulation: boolean;
  onChange: (newValue: boolean) => void;
}

export const SpeedToggle = ({fastSimulation, onChange}: Props) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };
  const getStyle = (isBold: boolean): React.CSSProperties => ({fontWeight: isBold ? "bold" : "normal"});
  const title = `Simulation Speed: ${fastSimulation ? "Fast" : "Normal"}`;

  return (
    <div className="speedToggle">
      <label htmlFor="simulationSpeed">Simulation Speed:</label>
      <div>
        <div style={getStyle(!fastSimulation)}>Normal</div>
        <input
          id="simulationSpeed"
          className="slider"
          type="checkbox"
          role="switch"
          title={title}
          checked={fastSimulation}
          onChange={handleChange}
        />
        <div style={getStyle(fastSimulation)} className="fast">Fast</div>
      </div>
    </div>
  );
};
