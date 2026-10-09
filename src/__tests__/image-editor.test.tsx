import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { createCanvas } from "@/lib/image/raster";

// jsdom can't decode images, so stub only the decoder. Validation, state, Konva and canvas work are all real.
vi.mock("@/lib/image/load", async (orig) => {
  const real = await orig<typeof import("@/lib/image/load")>();
  return {
    ...real,
    loadImageFile: vi.fn(async (file: File) => {
      const { validateImageFile } = await import("@/lib/image/raster");
      const problem = validateImageFile(file);
      if (problem) throw new Error(problem);
      const c = createCanvas(40, 20);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#336699";
      ctx.fillRect(0, 0, 40, 20);
      return { canvas: c, downscaled: false, originalWidth: 40, originalHeight: 20 };
    }),
  };
});

import ImageEditor from "@/tools/image-editor/ImageEditor";

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 800 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 500 });
});

async function openImage(name = "photo.png", type = "image/png") {
  const user = userEvent.setup({ applyAccept: false });
  const view = render(<ImageEditor />);
  const input = screen.getByLabelText("Choose an image file") as HTMLInputElement;
  await user.upload(input, new File([new Uint8Array([1, 2, 3])], name, { type }));
  return { user, view };
}

describe("ImageEditor (integration)", () => {
  it("shows the drop zone first and explains privacy", () => {
    render(<ImageEditor />);
    expect(screen.getByText("Drop an image here")).toBeTruthy();
    expect(screen.getByText(/Nothing is uploaded/)).toBeTruthy();
  });

  it("rejects unsupported files with a clear message", async () => {
    await openImage("evil.svg", "image/svg+xml");
    expect(await screen.findByText(/isn't supported/)).toBeTruthy();
    expect(screen.queryByText("Undo")).toBeNull();
  });

  it("opens an image and shows the editor with its size", async () => {
    await openImage();
    expect(await screen.findByText("40×20")).toBeTruthy();
    expect((screen.getByText("Undo") as HTMLButtonElement).disabled).toBe(true);
    for (const t of ["Select", "Pan", "Crop", "Text", "Brush", "Eraser", "Line", "Arrow", "Rectangle", "Ellipse", "Blur", "Pixelate", "Redact"]) {
      expect(screen.getByRole("button", { name: t })).toBeTruthy();
    }
  });

  it("rotates, undoes, redoes and resets", async () => {
    const { user } = await openImage();
    await screen.findByText("40×20");
    await user.click(screen.getByText("Rotate right"));
    expect(await screen.findByText("20×40")).toBeTruthy();
    expect((screen.getByText("Undo") as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByText("Undo"));
    expect(await screen.findByText("40×20")).toBeTruthy();
    await user.click(screen.getByText("Redo"));
    expect(await screen.findByText("20×40")).toBeTruthy();
    await user.click(screen.getByText("Reset"));
    expect(await screen.findByText("40×20")).toBeTruthy();
    await user.click(screen.getByText("Undo")); // reset is undoable
    expect(await screen.findByText("20×40")).toBeTruthy();
  });

  it("keeps proportions when resizing and applies the new size", async () => {
    const { user } = await openImage();
    await screen.findByText("40×20");
    const width = screen.getByLabelText("Width") as HTMLInputElement;
    const height = screen.getByLabelText("Height") as HTMLInputElement;
    fireEvent.change(width, { target: { value: "80" } });
    expect(height.value).toBe("40");
    await user.click(screen.getByText("Apply size"));
    expect(await screen.findByText("80×40")).toBeTruthy();
  });

  it("switching tools shows the right options", async () => {
    const { user } = await openImage();
    await screen.findByText("40×20");
    await user.click(screen.getByRole("button", { name: "Blur" }));
    expect(screen.getByText("Blur radius")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Redact" }));
    expect(screen.getByText(/painted over permanently/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Crop" }));
    expect(screen.getByText(/Drag on the image to choose an area/)).toBeTruthy();
    expect((screen.getByText("Apply crop") as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Rectangle" }));
    expect(screen.getByText("Filled shape")).toBeTruthy();
  });

  it("commits grayscale as one undoable step", async () => {
    const { user } = await openImage();
    await screen.findByText("40×20");
    await user.click(screen.getByLabelText("Grayscale"));
    await waitFor(() => expect((screen.getByText("Undo") as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByText("Undo"));
    expect((screen.getByLabelText("Grayscale") as HTMLInputElement).checked).toBe(false);
  });

  it("exports with the chosen format and reports the result", async () => {
    const created: Blob[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => { created.push(b as Blob); return "blob:test"; });
    URL.revokeObjectURL = vi.fn();
    const { user } = await openImage();
    await screen.findByText("40×20");
    await user.selectOptions(screen.getByLabelText("Format"), "jpeg");
    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(await screen.findByText(/Saved 40×20 JPEG/)).toBeTruthy();
    expect(created[0].type).toBe("image/jpeg");
    click.mockRestore();
  });

  it("returns to the drop zone for a new image", async () => {
    const { user } = await openImage();
    await screen.findByText("40×20");
    await user.click(screen.getByText("New image"));
    expect(await screen.findByText("Drop an image here")).toBeTruthy();
  });
});
