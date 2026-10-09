import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Konva from "konva";
import { createCanvas } from "@/lib/image/raster";

vi.mock("@/lib/image/load", async (orig) => {
  const real = await orig<typeof import("@/lib/image/load")>();
  return {
    ...real,
    loadImageFile: vi.fn(async () => {
      const c = createCanvas(200, 100);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 200, 100);
      return { canvas: c, downscaled: false, originalWidth: 200, originalHeight: 100 };
    }),
  };
});

import ImageEditor from "@/tools/image-editor/ImageEditor";

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 800 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 500 });
});

const stage = () => Konva.stages[Konva.stages.length - 1];

/** Image coordinates -> screen coordinates, using the stage's current zoom/pan. */
function toScreen(x: number, y: number) {
  const s = stage();
  return { clientX: s.x() + x * s.scaleX(), clientY: s.y() + y * s.scaleY() };
}

function pointer(type: string, x: number, y: number, target: EventTarget) {
  const { clientX, clientY } = toScreen(x, y);
  const ev = new MouseEvent(type, { clientX, clientY, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(ev, "pointerId", { value: 1 });
  Object.defineProperty(ev, "pointerType", { value: "mouse" });
  act(() => { target.dispatchEvent(ev); });
}

function drag(from: [number, number], to: [number, number]) {
  const content = stage().content;
  pointer("pointerdown", from[0], from[1], content);
  pointer("pointermove", (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, content);
  pointer("pointermove", to[0], to[1], content);
  pointer("pointerup", to[0], to[1], window);
}

async function open() {
  const user = userEvent.setup({ applyAccept: false });
  render(<ImageEditor />);
  await user.upload(screen.getByLabelText("Choose an image file"), new File([new Uint8Array([1])], "a.png", { type: "image/png" }));
  await screen.findByText("200×100");
  return user;
}

const undoDisabled = () => (screen.getByText("Undo") as HTMLButtonElement).disabled;

describe("ImageEditor pointer interaction", () => {
  it("dispatches pointer events to the stage (sanity check of the harness)", async () => {
    await open();
    const spy = vi.fn();
    stage().on("pointerdown", spy);
    pointer("pointerdown", 10, 10, stage().content);
    expect(spy).toHaveBeenCalled();
    pointer("pointerup", 10, 10, window);
  });

  it("draws a rectangle that becomes an undoable annotation", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Rectangle" }));
    expect(undoDisabled()).toBe(true);
    drag([20, 20], [100, 60]);
    await waitFor(() => expect(undoDisabled()).toBe(false));
    const rects = stage().find("Rect").filter((n) => n.id() !== "" );
    expect(rects.length).toBe(1);
    expect(Math.round(rects[0].width())).toBe(80);
    expect(Math.round(rects[0].height())).toBe(40);
    await user.click(screen.getByText("Undo"));
    await waitFor(() => expect(stage().find("Rect").filter((n) => n.id() !== "").length).toBe(0));
  });

  it("brush strokes, arrows and ellipses are added", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Brush" }));
    drag([10, 10], [90, 40]);
    await user.click(screen.getByRole("button", { name: "Arrow" }));
    drag([10, 80], [150, 80]);
    await user.click(screen.getByRole("button", { name: "Ellipse" }));
    drag([120, 10], [180, 50]);
    await waitFor(() => {
      expect(stage().find("Line").length).toBe(1);
      expect(stage().find("Arrow").length).toBe(1);
      expect(stage().find("Ellipse").length).toBe(1);
    });
  });

  it("ignores accidental tiny shape drags", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Rectangle" }));
    drag([20, 20], [21, 21]);
    expect(undoDisabled()).toBe(true);
  });

  it("REDACT blacks out the dragged area in the real image data", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Redact" }));
    drag([40, 20], [100, 60]);
    await waitFor(() => expect(undoDisabled()).toBe(false));
    const photo = stage().findOne(".photo") as Konva.Image;
    const px = (x: number, y: number) => Array.from((photo.image() as HTMLCanvasElement).getContext("2d")!.getImageData(x, y, 1, 1).data);
    expect(px(70, 40)).toEqual([0, 0, 0, 255]);
    expect(px(5, 5)).toEqual([255, 255, 255, 255]);
    await user.click(screen.getByText("Undo"));
    await waitFor(() => {
      const p = stage().findOne(".photo") as Konva.Image;
      expect(Array.from((p.image() as HTMLCanvasElement).getContext("2d")!.getImageData(70, 40, 1, 1).data)).toEqual([255, 255, 255, 255]);
    });
  });

  it("crops using the on-screen box and Apply crop", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Crop" }));
    drag([50, 25], [150, 75]);
    const apply = await screen.findByText("Apply crop");
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false));
    await user.click(apply);
    expect(await screen.findByText("100×50")).toBeTruthy();
  });

  it("selects a drawn shape and deletes it with the keyboard", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Rectangle" }));
    drag([20, 20], [100, 60]);
    await waitFor(() => expect(undoDisabled()).toBe(false));
    await user.click(screen.getByRole("button", { name: "Select" }));
    const rect = stage().find("Rect").filter((n) => n.id() !== "")[0];
    act(() => { rect.fire("pointerdown", { evt: new MouseEvent("pointerdown") }, true); });
    await waitFor(() => expect((screen.getByText("Delete selected") as HTMLButtonElement).disabled).toBe(false));
    await user.keyboard("{Delete}");
    await waitFor(() => expect(stage().find("Rect").filter((n) => n.id() !== "").length).toBe(0));
  });

  it("types text onto the image", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Text" }));
    pointer("pointerdown", 30, 30, stage().content);
    pointer("pointerup", 30, 30, window);
    const input = await screen.findByLabelText("Text");
    await user.type(input, "Hello{Enter}");
    await waitFor(() => expect(stage().find("Text").length).toBe(1));
    expect((stage().find("Text")[0] as Konva.Text).text()).toBe("Hello");
  });

  it("keyboard undo/redo shortcuts work", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Rectangle" }));
    drag([20, 20], [100, 60]);
    await waitFor(() => expect(undoDisabled()).toBe(false));
    await user.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(undoDisabled()).toBe(true));
    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    await waitFor(() => expect(undoDisabled()).toBe(false));
  });
});
