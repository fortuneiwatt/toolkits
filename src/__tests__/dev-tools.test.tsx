import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Base64Tool from "@/tools/dev/Base64Tool";
import UrlTool from "@/tools/dev/UrlTool";
import RegexTool from "@/tools/dev/RegexTool";

const out = (label: string | RegExp) => (screen.getByLabelText(label) as HTMLTextAreaElement).value;

describe("Base64 tool", () => {
  it("encodes live and flips with Use as input", async () => {
    const user = userEvent.setup();
    render(<Base64Tool />);
    await user.click(screen.getByLabelText("Text to encode"));
    await user.paste("héllo 😀");
    expect(out("Base64 result")).toBe("aMOpbGxvIPCfmIA=");
    await user.click(screen.getByRole("button", { name: "Use as input" }));
    expect(out("Decoded text")).toBe("héllo 😀");
  });
  it("shows an error for invalid Base64 and none when empty", async () => {
    const user = userEvent.setup();
    render(<Base64Tool />);
    await user.click(screen.getByLabelText("Decode Base64 to text"));
    expect(screen.getByRole("status").textContent).toBe("");
    await user.click(screen.getByLabelText("Base64 to decode"));
    await user.paste("not base64!!");
    expect(screen.getByRole("status").textContent).toMatch(/aren't valid Base64/);
  });
  it("URL-safe option changes the output", async () => {
    const user = userEvent.setup();
    render(<Base64Tool />);
    await user.click(screen.getByLabelText("Text to encode"));
    await user.paste("subjects?_d=>>>???");
    expect(out("Base64 result")).toMatch(/[+/=]/);
    await user.click(screen.getByLabelText(/URL-safe/));
    expect(out("Base64 result")).not.toMatch(/[+/=]/);
  });
});

describe("URL tool", () => {
  it("encodes by type", async () => {
    const user = userEvent.setup();
    render(<UrlTool />);
    await user.click(screen.getByLabelText("Text or URL to encode"));
    await user.paste("a b&c");
    expect(out("Encoded result")).toBe("a%20b%26c");
    await user.selectOptions(screen.getByLabelText("Type"), "form");
    expect(out("Encoded result")).toBe("a+b%26c");
  });
  it("decodes and reports malformed input", async () => {
    const user = userEvent.setup();
    render(<UrlTool />);
    await user.click(screen.getByLabelText("Decode"));
    await user.click(screen.getByLabelText("Encoded text to decode"));
    await user.paste("100%");
    expect(screen.getByRole("status").textContent).toMatch(/malformed/);
  });
});

describe("Regex tool", () => {
  it("highlights matches and lists groups (inline fallback, no Worker in jsdom)", async () => {
    const user = userEvent.setup();
    const { container } = render(<RegexTool />);
    expect(screen.getByText("Enter a pattern to start.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Regular expression"), { target: { value: "(\\d)(\\d)" } });
    await user.click(screen.getByLabelText("Test text"));
    await user.paste("a12 b34");
    await waitFor(() => expect(screen.getByText("2 matches")).toBeTruthy(), { timeout: 3000 });
    expect(Array.from(container.querySelectorAll("mark")).map((m) => m.textContent)).toEqual(["12", "34"]);
    expect(screen.getAllByText(/Group 1:/)).toHaveLength(2);
  });
  it("shows an error for an invalid pattern", async () => {
    render(<RegexTool />);
    fireEvent.change(screen.getByLabelText("Regular expression"), { target: { value: "(" } });
    await waitFor(() => expect(screen.getByRole("status").textContent).not.toMatch(/Running|Enter a pattern/), { timeout: 3000 });
    expect(screen.getByRole("status").textContent!.length).toBeGreaterThan(5);
  });
  it("previews a replacement", async () => {
    const user = userEvent.setup();
    render(<RegexTool />);
    fireEvent.change(screen.getByLabelText("Regular expression"), { target: { value: "(\\w+)@(\\w+)" } });
    await user.click(screen.getByLabelText("Test text"));
    await user.paste("me@home");
    await user.click(screen.getByLabelText("Preview a replacement"));
    fireEvent.change(screen.getByLabelText("Replace with"), { target: { value: "$2:$1" } });
    await waitFor(() => expect(out("Result")).toBe("home:me"), { timeout: 3000 });
  });
  it("loads an example", async () => {
    const user = userEvent.setup();
    render(<RegexTool />);
    await user.click(screen.getByRole("button", { name: "Email" }));
    await waitFor(() => expect(screen.getByText("2 matches")).toBeTruthy(), { timeout: 3000 });
  });
  it("toggling a flag updates the displayed flags", async () => {
    const user = userEvent.setup();
    render(<RegexTool />);
    await user.click(screen.getByLabelText(/Ignore case/));
    expect(screen.getByText("/gi")).toBeTruthy();
  });
});
