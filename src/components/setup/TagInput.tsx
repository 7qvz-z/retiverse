"use client";

import { KeyboardEvent, useState } from "react";

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
};

export function TagInput({ values, onChange, placeholder }: Props) {
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (values.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, tag]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div>
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-2xl border border-[#e8dfd0]/15 bg-[#14161c] px-3 py-2">
        {values.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(values.filter((v) => v !== tag))}
            className="inline-flex items-center gap-1 rounded-full bg-[#c9a66b] px-3 py-1 text-xs text-[#0a0b0d]"
          >
            {tag}
            <span aria-hidden>×</span>
          </button>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTag(draft)}
          placeholder={values.length === 0 ? placeholder : "追加…"}
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-[#e8dfd0]/35"
        />
      </div>
      <p className="mt-2 text-xs text-[#e8dfd0]/45">
        Enter または読点で追加。タグをクリックで削除。
      </p>
    </div>
  );
}
