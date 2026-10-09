import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JsonFormatter, JsonValidator, JsonMinifier } from "@/tools/json/JsonTool";
import UuidTool from "@/tools/uuid/UuidTool";
import WordCounter from "@/tools/text/WordCounter";

describe("tool components", () => {
  it("formats JSON", async () => {
    render(<JsonFormatter />);
    await userEvent.click(screen.getByLabelText("JSON input"));
    await userEvent.paste('{"b":1,"a":2}');
    expect(screen.getByText("Valid JSON")).toBeTruthy();
    expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe('{\n  "b": 1,\n  "a": 2\n}');
  });
  it("shows errors with position", async () => {
    render(<JsonValidator />);
    await userEvent.click(screen.getByLabelText("JSON input"));
    await userEvent.paste('{"a":}');
    expect(screen.getByRole("status").textContent).toMatch(/Invalid JSON/);
  });
  it("minifies JSON", async () => {
    render(<JsonMinifier />);
    await userEvent.click(screen.getByLabelText("JSON input"));
    await userEvent.paste('{ "a" : [ 1, 2 ] }');
    expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe('{"a":[1,2]}');
  });
  it("treats markup as plain text, never HTML", async () => {
    const { container } = render(<JsonFormatter />);
    await userEvent.click(screen.getByLabelText("JSON input"));
    await userEvent.paste('{"x":"<img src=x onerror=alert(1)>"}');
    expect(container.querySelector("img")).toBeNull();
  });
  it("generates UUIDs", async () => {
    render(<UuidTool />);
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect((screen.getByLabelText("UUIDs") as HTMLTextAreaElement).value.split("\n")).toHaveLength(5);
  });
  it("counts words", async () => {
    render(<WordCounter />);
    await userEvent.click(screen.getByLabelText("Your text"));
    await userEvent.paste("one two three");
    expect(screen.getByText("Words").nextSibling?.textContent).toBe("3");
  });
});
