"use client";

import type { ArtistEvidence } from "@/lib/playlist/analysis-types";

export type TagEditMode = null | "rename" | "split";

type Props = {
  name: string;
  variant: "confirmed" | "unclassified";
  evidence?: ArtistEvidence;
  reasons?: string[];
  picked?: boolean;
  maybeSame?: boolean;
  inMerge: boolean;
  busy: boolean;
  editMode: TagEditMode;
  editValue: string;
  onTogglePick?: () => void;
  onToggleMerge: () => void;
  onStartRename: () => void;
  onStartSplit: () => void;
  onReject: () => void;
  onConfirm?: () => void;
  onEditValueChange: (value: string) => void;
  onSubmitEdit: () => void;
  onCancelEdit: () => void;
};

function adoptedByLabel(adoptedBy: ArtistEvidence["adoptedBy"]): string | null {
  switch (adoptedBy) {
    case "alias":
      return "辞書";
    case "channel":
      return "チャンネル";
    case "multi":
      return "複数曲";
    case "high":
      return "タイトル";
    case "confirm":
      return "ユーザー確定";
    case "group":
      return "グループ";
    case "unit":
      return "ユニット";
    default:
      return null;
  }
}

export function formatEvidenceLine(evidence: ArtistEvidence): string {
  const title = evidence.sampleTitle?.trim() || "（曲名不明）";
  const channel = evidence.sampleChannel?.trim() || "（ch不明）";
  const n = evidence.occurrenceCount;
  return `由来: ${title} / ${channel}・${n}曲`;
}

export function ArtistTagEditor({
  name,
  variant,
  evidence,
  reasons,
  picked = false,
  maybeSame = false,
  inMerge,
  busy,
  editMode,
  editValue,
  onTogglePick,
  onToggleMerge,
  onStartRename,
  onStartSplit,
  onReject,
  onConfirm,
  onEditValueChange,
  onSubmitEdit,
  onCancelEdit,
}: Props) {
  const label = evidence ? adoptedByLabel(evidence.adoptedBy) : null;
  const isEditing = editMode !== null;

  return (
    <div className="flex max-w-full flex-col gap-1 rounded-xl border border-[#e8dfd0]/08 bg-[#14161c]/90 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-1">
        {variant === "confirmed" ? (
          <button
            type="button"
            onClick={onTogglePick}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              picked
                ? "bg-[#c9a66b] text-white"
                : maybeSame
                  ? "border-2 border-[#c47b2b] bg-[#c47b2b]/10 text-[#e8dfd0]"
                  : "border border-[#e8dfd0]/15 bg-[#14161c] text-[#e8dfd0]"
            }`}
          >
            {name}
          </button>
        ) : (
          <span className="rounded-full border border-dashed border-[#e8dfd0]/25 bg-[#14161c] px-3 py-1.5 text-xs text-[#e8dfd0]/70">
            {name}
          </span>
        )}

        {label ? (
          <span className="rounded-full bg-[#e8dfd0]/06 px-2 py-0.5 text-[10px] text-[#e8dfd0]/50">
            {label}
          </span>
        ) : null}

        <button
          type="button"
          title="統合用に選択"
          onClick={onToggleMerge}
          className={`rounded-full px-2 py-1 text-[10px] transition ${
            inMerge
              ? "bg-[#8b4513] text-white"
              : "border border-[#e8dfd0]/10 text-[#e8dfd0]/45"
          }`}
        >
          統
        </button>

        {variant === "unclassified" && onConfirm ? (
          <button
            type="button"
            title="これで合っている（確定に昇格）"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-full border border-[#c9a66b]/30 px-2 py-1 text-[10px] text-[#c9a66b] disabled:opacity-40"
          >
            確
          </button>
        ) : null}

        <button
          type="button"
          title="名前を修正"
          disabled={busy}
          onClick={onStartRename}
          className={`rounded-full px-2 py-1 text-[10px] transition disabled:opacity-40 ${
            editMode === "rename"
              ? "bg-[#c9a66b] text-white"
              : "border border-[#e8dfd0]/10 text-[#e8dfd0]/45"
          }`}
        >
          改
        </button>

        <button
          type="button"
          title="複数人に分割"
          disabled={busy}
          onClick={onStartSplit}
          className={`rounded-full px-2 py-1 text-[10px] transition disabled:opacity-40 ${
            editMode === "split"
              ? "bg-[#c9a66b] text-white"
              : "border border-[#e8dfd0]/10 text-[#e8dfd0]/45"
          }`}
        >
          分
        </button>

        <button
          type="button"
          title="これは違う（除外。あとから取り消しできます）"
          disabled={busy}
          onClick={onReject}
          className="rounded-full border border-[#b42318]/20 px-2 py-1 text-[10px] text-[#b42318] disabled:opacity-40"
        >
          ×
        </button>
      </div>

      {evidence ? (
        <p className="max-w-[28rem] truncate px-0.5 text-[10px] leading-snug text-[#e8dfd0]/45">
          {formatEvidenceLine(evidence)}
        </p>
      ) : null}

      {reasons && reasons.length > 0 ? (
        <p className="px-0.5 text-[10px] text-[#e8dfd0]/40">
          {reasons.join(" / ")}
        </p>
      ) : null}

      {isEditing ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmitEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            autoFocus
            placeholder={
              editMode === "rename" ? "正しい名前" : "A, B, C（カンマ区切り）"
            }
            className="min-w-[10rem] flex-1 rounded-lg border border-[#e8dfd0]/15 bg-[#14161c] px-2.5 py-1.5 text-xs outline-none focus:border-[#c9a66b]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={onSubmitEdit}
            className="rounded-full bg-[#c9a66b] px-3 py-1.5 text-[10px] text-white disabled:opacity-40"
          >
            {busy ? "保存中…" : "適用"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancelEdit}
            className="rounded-full border border-[#e8dfd0]/15 px-3 py-1.5 text-[10px] disabled:opacity-40"
          >
            キャンセル
          </button>
        </div>
      ) : null}
    </div>
  );
}
