"use client";

import type { ReactNode } from "react";
import { downloadText } from "@/lib/download";
import { MAX_TEXT_CHARS } from "@/lib/limits";
import { CopyButton, buttonClass, fieldClass } from "./ui";

export interface ModeOption<T extends string> { id: T; label: string }

/** Shared layout for text-in, text-out tools: mode switch, options, input, live output, copy/swap/clear. */
export function ConverterPane<T extends string>(props: {
  idPrefix: string;
  modes: ModeOption<T>[];
  mode: T;
  onMode: (m: T) => void;
  options?: ReactNode;
  input: string;
  onInput: (v: string) => void;
  inputLabel: string;
  outputLabel: string;
  placeholder?: string;
  output: string;
  error?: string | null;
  onSwap?: () => void;
  downloadName?: string;
}) {
  const { idPrefix: p } = props;
  const empty = props.input === "";
  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Mode" className="flex flex-wrap gap-4 text-sm">
        {props.modes.map((m) => (
          <label key={m.id} className="flex items-center gap-2">
            <input type="radio" name={`${p}-mode`} checked={props.mode === m.id} onChange={() => props.onMode(m.id)} />
            {m.label}
          </label>
        ))}
      </div>
      {props.options && <div className="flex flex-wrap items-center gap-4 text-sm">{props.options}</div>}

      <div>
        <label htmlFor={`${p}-in`} className="mb-1 block text-sm font-medium">{props.inputLabel}</label>
        <textarea
          id={`${p}-in`}
          className={`${fieldClass} min-h-40`}
          value={props.input}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={props.placeholder}
          onChange={(e) => props.onInput(e.target.value.slice(0, MAX_TEXT_CHARS + 1))}
        />
      </div>

      <div role="status" aria-live="polite" className="min-h-5 text-sm">
        {props.error && !empty ? <span className="font-medium text-bad">{props.error}</span> : null}
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={`${p}-out`} className="text-sm font-medium">{props.outputLabel}</label>
          <div className="flex gap-2">
            <CopyButton text={props.output} disabled={!props.output} />
            {props.downloadName && (
              <button type="button" className={buttonClass} disabled={!props.output} onClick={() => downloadText(props.downloadName!, props.output)}>Download</button>
            )}
            {props.onSwap && (
              <button type="button" className={buttonClass} disabled={!props.output} onClick={props.onSwap}>Use as input</button>
            )}
            <button type="button" className={buttonClass} disabled={empty} onClick={() => props.onInput("")}>Clear</button>
          </div>
        </div>
        <textarea id={`${p}-out`} className={`${fieldClass} min-h-40`} value={props.output} readOnly spellCheck={false} />
      </div>
    </div>
  );
}
