import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { createCanvas } from "@/lib/image/raster";

// jsdom can't decode images, so stub only the decoder. Validation, processing, encoding and the UI are all real.
vi.mock("@/lib/image/load", async (orig) => {
  const real = await orig<typeof import("@/lib/image/load")>();
  return {
    ...real,
    loadImageFile: vi.fn(async (file: File) => {
      const { validateImageFile } = await import("@/lib/image/raster");
      const problem = validateImageFile(file);
      if (problem) throw new Error(problem);
      if (file.name.startsWith("broken")) throw new Error("That image couldn't be read. It may be corrupted.");
      const c = createCanvas(40, 20);
      const ctx = c.getContext("2d")!;
      for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++) { ctx.fillStyle = `rgb(${x * 6},${y * 12},${(x * y) % 255})`; ctx.fillRect(x, y, 1, 1); }
      return { canvas: c, downscaled: false, originalWidth: 40, originalHeight: 20 };
    }),
  };
});

import { ImageCompressor, ImageConverter, ImageResizer } from "@/tools/image-utils/BatchTool";

let created: Blob[] = [];
let clicks: string[] = [];
beforeEach(() => {
  created = []; clicks = [];
  URL.createObjectURL = vi.fn((b: Blob | MediaSource) => { created.push(b as Blob); return `blob:${created.length}`; });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.download); });
});
afterEach(() => vi.restoreAllMocks());

const file = (name: string, type = "image/png", bytes = 5000) => new File([new Uint8Array(bytes)], name, { type });
const setup = () => userEvent.setup({ applyAccept: false });
const upload = (user: ReturnType<typeof setup>, ...files: File[]) => user.upload(screen.getByLabelText("Choose image files"), files);

describe("Image Compressor", () => {
  it("compresses a batch and reports sizes", async () => {
    const user = setup();
    render(<ImageCompressor />);
    await upload(user, file("a.png"), file("b.jpg", "image/jpeg", 200000));
    await user.click(screen.getByRole("button", { name: "Compress 2 images" }));
    const list = await screen.findByRole("list", { name: "Images" });
    await waitFor(() => expect(within(list).getAllByRole("button", { name: "Download" }).every((b) => !(b as HTMLButtonElement).disabled)).toBe(true));
    expect(within(list).getAllByText(/→/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/smaller\)/)).toBeTruthy();
  });

  it("keeps the original file when re-encoding would not make it smaller", async () => {
    const user = setup();
    render(<ImageCompressor />);
    await upload(user, file("tiny.jpg", "image/jpeg", 10));
    await user.click(screen.getByRole("button", { name: "Compress 1 image" }));
    expect(await screen.findByText(/original file was kept/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(clicks).toEqual(["tiny.jpg"]);
  });

  it("downloads everything as one ZIP with unique names", async () => {
    const user = setup();
    render(<ImageCompressor />);
    await upload(user, file("same.jpg", "image/jpeg", 200000), file("same.jpg", "image/jpeg", 200000));
    await user.click(screen.getByRole("button", { name: "Compress 2 images" }));
    const zipBtn = screen.getByRole("button", { name: "Download all (ZIP)" }) as HTMLButtonElement;
    await waitFor(() => expect(zipBtn.disabled).toBe(false));
    await user.click(zipBtn);
    await waitFor(() => expect(clicks.some((c) => c.endsWith(".zip"))).toBe(true));
    const zip = created.find((b) => b.type === "application/zip")!;
    expect(zip).toBeTruthy();
    const bytes = await new Promise<Uint8Array>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
      r.readAsArrayBuffer(zip);
    });
    expect(new TextDecoder("latin1").decode(bytes)).toContain("same-compressed (2).jpg");
  });

  it("rejects unsupported and oversized files with a message, and accepts the valid ones", async () => {
    const user = setup();
    render(<ImageCompressor />);
    await upload(user, file("x.svg", "image/svg+xml"), file("ok.png"));
    expect(await screen.findByText(/isn't supported/)).toBeTruthy();
    expect(screen.getByText("ok.png")).toBeTruthy();
    expect(screen.queryByText("x.svg")).toBeNull();
    await upload(user, file("huge.png", "image/png", 26 * 1024 * 1024));
    expect(await screen.findByText(/larger than 25 MB/)).toBeTruthy();
  });

  it("limits a batch to 20 images", async () => {
    const user = setup();
    render(<ImageCompressor />);
    await upload(user, ...Array.from({ length: 22 }, (_, i) => file(`f${i}.png`)));
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(20);
    expect(screen.getByText(/Only 20 images at a time/)).toBeTruthy();
  });

  it("shows a per-image error without stopping the others", async () => {
    const user = setup();
    render(<ImageCompressor />);
    await upload(user, file("broken.png"), file("good.jpg", "image/jpeg", 200000));
    await user.click(screen.getByRole("button", { name: "Compress 2 images" }));
    expect(await screen.findByText(/may be corrupted/)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Download" }).some((b) => !(b as HTMLButtonElement).disabled)).toBe(true));
  });

  it("removes one image and clears all", async () => {
    const user = setup();
    render(<ImageCompressor />);
    await upload(user, file("a.png"), file("b.png"));
    await user.click(screen.getByRole("button", { name: "Remove a.png" }));
    expect(screen.queryByText("a.png")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.queryByRole("list", { name: "Images" })).toBeNull();
  });
});

describe("Image Resizer", () => {
  it("resizes by width keeping proportions", async () => {
    const user = setup();
    render(<ImageResizer />);
    await upload(user, file("a.png"));
    fireEvent.change(screen.getByLabelText("Width (px)"), { target: { value: "20" } });
    await user.click(screen.getByRole("button", { name: "Resize 1 image" }));
    expect(await screen.findByText(/40×20 → 20×10/)).toBeTruthy();
  });

  it("resizes by percentage", async () => {
    const user = setup();
    render(<ImageResizer />);
    await upload(user, file("a.png"));
    await user.click(screen.getByLabelText("By percentage"));
    fireEvent.change(screen.getByLabelText(/Scale/), { target: { value: "200" } });
    await user.click(screen.getByRole("button", { name: "Resize 1 image" }));
    expect(await screen.findByText(/40×20 → 80×40/)).toBeTruthy();
  });

  it("exact size needs both numbers when proportions are off", async () => {
    const user = setup();
    render(<ImageResizer />);
    await upload(user, file("a.png"));
    await user.click(screen.getByLabelText("Keep proportions"));
    fireEvent.change(screen.getByLabelText("Width (px)"), { target: { value: "10" } });
    await user.click(screen.getByRole("button", { name: "Resize 1 image" }));
    expect(await screen.findByText(/both width and height/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Height (px)"), { target: { value: "30" } });
    await user.click(screen.getByRole("button", { name: "Resize 1 image" }));
    expect(await screen.findByText(/40×20 → 10×30/)).toBeTruthy();
  });

  it("asks for a size when none is given and does not enlarge by default", async () => {
    const user = setup();
    render(<ImageResizer />);
    await upload(user, file("a.png"));
    await user.click(screen.getByRole("button", { name: "Resize 1 image" }));
    expect(await screen.findByText(/Enter a width, a height, or both/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Width (px)"), { target: { value: "400" } });
    await user.click(screen.getByRole("button", { name: "Resize 1 image" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Download" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText(/→ 400×200/)).toBeNull();
    expect(screen.getByText(/40×20 · PNG/)).toBeTruthy();
  });

  it("strips non-digits from the size boxes", async () => {
    const user = setup();
    render(<ImageResizer />);
    await upload(user, file("a.png"));
    const w = screen.getByLabelText("Width (px)") as HTMLInputElement;
    fireEvent.change(w, { target: { value: "1a2-3" } });
    expect(w.value).toBe("123");
  });
});

describe("Image Converter", () => {
  it("converts to JPG, renames the file and warns about transparency", async () => {
    const user = setup();
    render(<ImageConverter />);
    await upload(user, file("logo.png"));
    await user.selectOptions(screen.getByLabelText("Convert to"), "jpeg");
    await user.click(screen.getByRole("button", { name: "Convert 1 image" }));
    expect(await screen.findByText(/Transparent areas became white/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(clicks).toEqual(["logo.jpg"]);
    expect(created.some((b) => b.type === "image/jpeg")).toBe(true);
  });

  it("hides the quality slider for PNG output", async () => {
    const user = setup();
    render(<ImageConverter />);
    await user.selectOptions(screen.getByLabelText("Convert to"), "png");
    expect(screen.queryByLabelText(/Quality/)).toBeNull();
    await user.selectOptions(screen.getByLabelText("Convert to"), "jpeg");
    expect(screen.getByLabelText(/Quality/)).toBeTruthy();
  });

  it("explains privacy", () => {
    render(<ImageConverter />);
    expect(screen.getByText(/Nothing is uploaded/)).toBeTruthy();
  });
});
