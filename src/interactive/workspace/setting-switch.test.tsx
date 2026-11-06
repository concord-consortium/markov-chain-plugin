import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingSwitch } from "./setting-switch";

describe("SettingSwitch", () => {
  it("flips when the student clicks its name or its Yes or No, as well as the track", () => {
    const onChange = jest.fn();
    render(<SettingSwitch label="Case sensitive" value={false} onChange={onChange} />);
    fireEvent.click(screen.getByText("Case sensitive"));
    fireEvent.click(screen.getByText("No"));
    fireEvent.click(screen.getByRole("switch", { name: "Case sensitive" }));
    expect(onChange.mock.calls).toEqual([[true], [true], [true]]);
  });

  it("doesn't flip from its name while disabled", () => {
    const onChange = jest.fn();
    render(<SettingSwitch label="Case sensitive" value={false} onChange={onChange} disabled />);
    fireEvent.click(screen.getByText("Case sensitive"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
