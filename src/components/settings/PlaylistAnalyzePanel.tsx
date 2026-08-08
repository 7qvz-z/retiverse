"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArtistTagEditor,
  type TagEditMode,
} from "@/components/settings/ArtistTagEditor";
import { YouTubeConnectButton } from "@/components/setup/YouTubeConnectButton";
import type { ArtistCorrectionKind } from "@/lib/artist-extract/corrections";
import type {
  ArtistEvidence,
  PlaylistAnalysis,
  YoutubePlaylistSummary,
} from "@/lib/playlist/analysis-types";

type Props = {
  initialSelectedIds: string[];
  initialAnalysis: PlaylistAnalysis | null;
  channelId: string | null;
};

type StoredCorrection = {
  id: string;
  kind: ArtistCorrectionKind;
  raw_name: string;
  canonical_name: string | null;
  split_into: string[] | null;
  created_at: string;
};

type EditState = {
  name: string;
  mode: NonNullable<TagEditMode>;
  value: string;
};

type Snapshot = {
  artistNames: string[];
  unclassified: { name: string; reasons: string[] }[];
  similarPairs: { a: string; b: string; similarity: number }[];
  pickedArtists: string[];
  evidenceByName: Record<string, ArtistEvidence>;
};

function kindLabel(kind: ArtistCorrectionKind): string {
  switch (kind) {
    case "alias":
      return "統合/別名";
    case "rename":
      return "名前修正";
    case "reject":
      return "除外";
    case "confirm":
      return "確定";
    case "split":
      return "分割";
    default:
      return kind;
  }
}

function formatCorrectionSummary(c: StoredCorrection): string {
  switch (c.kind) {
    case "rename":
    case "alias":
      return `「${c.raw_name}」→「${c.canonical_name ?? "?"}」`;
    case "reject":
      return `「${c.raw_name}」を除外`;
    case "confirm":
      return `「${c.canonical_name || c.raw_name}」を確定`;
    case "split":
      return `「${c.raw_name}」→ ${(c.split_into ?? []).join(" / ")}`;
    default:
      return c.raw_name;
  }
}

export function PlaylistAnalyzePanel({
  initialSelectedIds,
  initialAnalysis,
  channelId,
}: Props) {
  const [playlists, setPlaylists] = useState<YoutubePlaylistSummary[]>([]);
  const [selected, setSelected] = useState<string[]>(initialSelectedIds);
  const [analysis, setAnalysis] = useState<PlaylistAnalysis | null>(
    initialAnalysis,
  );
  const [pickedArtists, setPickedArtists] = useState<string[]>([]);
  const [mergePair, setMergePair] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [manualName, setManualName] = useState("");
  const [corrections, setCorrections] = useState<StoredCorrection[]>([]);
  const [correctionsOpen, setCorrectionsOpen] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addingExternal, setAddingExternal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [artistNames, setArtistNames] = useState<string[]>(() =>
    [...(initialAnalysis?.artists ?? [])].sort((a, b) =>
      a.localeCompare(b, "ja"),
    ),
  );
  const [unclassified, setUnclassified] = useState<
    { name: string; reasons: string[] }[]
  >(() => initialAnalysis?.unclassifiedArtists ?? []);
  const [similarPairs, setSimilarPairs] = useState<
    { a: string; b: string; similarity: number }[]
  >(() => initialAnalysis?.similarPairs ?? []);
  const [evidenceByName, setEvidenceByName] = useState<
    Record<string, ArtistEvidence>
  >(() => {
    const map: Record<string, ArtistEvidence> = {};
    for (const ev of initialAnalysis?.artistEvidence ?? []) {
      map[ev.name] = ev;
    }
    return map;
  });

  function syncFromAnalysis(next: PlaylistAnalysis | null) {
    setAnalysis(next);
    setPickedArtists([]);
    setMergePair([]);
    setEditState(null);
    const names = next?.artists ?? [];
    setArtistNames([...names].sort((a, b) => a.localeCompare(b, "ja")));
    setUnclassified(next?.unclassifiedArtists ?? []);
    setSimilarPairs(next?.similarPairs ?? []);
    const map: Record<string, ArtistEvidence> = {};
    for (const ev of next?.artistEvidence ?? []) {
      map[ev.name] = ev;
    }
    setEvidenceByName(map);
  }

  const loadPlaylists = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube/my-playlists");
      const data = (await res.json()) as {
        error?: string;
        playlists?: YoutubePlaylistSummary[];
      };
      if (!res.ok) throw new Error(data.error ?? "一覧の取得に失敗しました");
      setPlaylists(data.playlists ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "一覧の取得に失敗しました");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadCorrections = useCallback(async () => {
    try {
      const res = await fetch("/api/artist-corrections");
      const data = (await res.json()) as {
        error?: string;
        corrections?: StoredCorrection[];
      };
      if (!res.ok) return;
      setCorrections(data.corrections ?? []);
    } catch {
      // 一覧取得失敗は致命ではない
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/youtube/my-playlists");
        const data = (await res.json()) as {
          error?: string;
          playlists?: YoutubePlaylistSummary[];
        };
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "一覧の取得に失敗しました");
        setPlaylists(data.playlists ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "一覧の取得に失敗しました");
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/artist-corrections");
        const data = (await res.json()) as {
          error?: string;
          corrections?: StoredCorrection[];
        };
        if (cancelled || !res.ok) return;
        setCorrections(data.corrections ?? []);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allArtistNames = artistNames;
  const similarNameSet = useMemo(() => {
    const s = new Set<string>();
    for (const pair of similarPairs) {
      s.add(pair.a);
      s.add(pair.b);
    }
    return s;
  }, [similarPairs]);
  const allPicked = useMemo(
    () =>
      allArtistNames.length > 0 &&
      allArtistNames.every((a) => pickedArtists.includes(a)),
    [allArtistNames, pickedArtists],
  );

  function takeSnapshot(): Snapshot {
    return {
      artistNames: [...artistNames],
      unclassified: unclassified.map((u) => ({ ...u, reasons: [...u.reasons] })),
      similarPairs: similarPairs.map((p) => ({ ...p })),
      pickedArtists: [...pickedArtists],
      evidenceByName: { ...evidenceByName },
    };
  }

  function restoreSnapshot(snap: Snapshot) {
    setArtistNames(snap.artistNames);
    setUnclassified(snap.unclassified);
    setSimilarPairs(snap.similarPairs);
    setPickedArtists(snap.pickedArtists);
    setEvidenceByName(snap.evidenceByName);
  }

  function togglePlaylist(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
    setMessage(null);
  }

  function toggleArtist(name: string) {
    setPickedArtists((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name],
    );
    setMessage(null);
  }

  function toggleMergeTag(name: string) {
    setMergePair((prev) => {
      if (prev.includes(name)) return prev.filter((a) => a !== name);
      if (prev.length >= 2) return [prev[1], name];
      return [...prev, name];
    });
    setMessage(null);
  }

  async function postCorrection(body: {
    kind: ArtistCorrectionKind;
    rawName: string;
    canonicalName?: string;
    splitInto?: string[];
  }): Promise<StoredCorrection> {
    const res = await fetch("/api/artist-corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      error?: string;
      correction?: StoredCorrection;
    };
    if (!res.ok) throw new Error(data.error ?? "修正の保存に失敗しました");
    if (!data.correction) throw new Error("修正の保存結果が空です");
    return data.correction;
  }

  async function handleMerge(canonical: string) {
    if (mergePair.length !== 2) {
      setError("統合するにはタグを2つ選んでください");
      return;
    }
    const mergeFrom = mergePair.find((n) => n !== canonical);
    if (!mergeFrom) {
      setError("統合元のタグが見つかりません");
      return;
    }
    const snap = takeSnapshot();
    setBusy(true);
    setError(null);
    setMessage(null);

    setUnclassified((prev) =>
      prev.filter((item) => item.name !== mergeFrom && item.name !== canonical),
    );
    setSimilarPairs((prev) =>
      prev.filter((p) => {
        const involves =
          p.a === canonical ||
          p.a === mergeFrom ||
          p.b === canonical ||
          p.b === mergeFrom;
        return !involves;
      }),
    );
    setArtistNames((prev) => {
      const next = new Set(prev);
      next.add(canonical);
      next.delete(mergeFrom);
      return [...next].sort((a, b) => a.localeCompare(b, "ja"));
    });
    setPickedArtists((prev) => [
      ...new Set(prev.map((n) => (n === mergeFrom ? canonical : n))),
    ]);
    setMergePair([]);

    try {
      const res = await fetch("/api/artist-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonical, mergeFrom }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "統合に失敗しました");
      await loadCorrections();
      setMessage(
        `「${mergeFrom}」を「${canonical}」に統合し、修正として保存しました`,
      );
    } catch (e) {
      restoreSnapshot(snap);
      setError(e instanceof Error ? e.message : "統合に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(name: string) {
    const snap = takeSnapshot();
    setBusy(true);
    setError(null);
    setArtistNames((prev) => prev.filter((n) => n !== name));
    setUnclassified((prev) => prev.filter((u) => u.name !== name));
    setPickedArtists((prev) => prev.filter((n) => n !== name));
    setSimilarPairs((prev) =>
      prev.filter((p) => p.a !== name && p.b !== name),
    );
    setEditState((prev) => (prev?.name === name ? null : prev));
    try {
      const saved = await postCorrection({ kind: "reject", rawName: name });
      setCorrections((prev) => [saved, ...prev]);
      setMessage(
        `「${name}」を除外しました（取り消し可能。下の保存済み修正から戻せます）`,
      );
    } catch (e) {
      restoreSnapshot(snap);
      setError(e instanceof Error ? e.message : "除外に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function startRename(name: string) {
    setEditState({ name, mode: "rename", value: name });
    setError(null);
    setMessage(null);
  }

  function startSplit(name: string) {
    setEditState({
      name,
      mode: "split",
      value: name.includes("・") ? name.split("・").join(", ") : "",
    });
    setError(null);
    setMessage(null);
  }

  async function submitEdit() {
    if (!editState) return;
    const { mode, name, value } = editState;
    const trimmed = value.trim();
    if (!trimmed) {
      setError("入力が空です");
      return;
    }

    if (mode === "rename") {
      if (trimmed === name) {
        setEditState(null);
        return;
      }
      const snap = takeSnapshot();
      setBusy(true);
      setError(null);
      setArtistNames((prev) => {
        const s = new Set(prev.filter((n) => n !== name));
        s.add(trimmed);
        return [...s].sort((a, b) => a.localeCompare(b, "ja"));
      });
      setUnclassified((prev) => prev.filter((u) => u.name !== name));
      setPickedArtists((prev) =>
        prev.map((n) => (n === name ? trimmed : n)),
      );
      setEditState(null);
      try {
        const saved = await postCorrection({
          kind: "rename",
          rawName: name,
          canonicalName: trimmed,
        });
        setCorrections((prev) => [saved, ...prev]);
        setMessage(`「${name}」→「${trimmed}」に修正しました`);
      } catch (e) {
        restoreSnapshot(snap);
        setError(e instanceof Error ? e.message : "リネームに失敗しました");
      } finally {
        setBusy(false);
      }
      return;
    }

    const parts = trimmed
      .split(/[,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 2) {
      setError("分割にはカンマ区切りで2つ以上の名前が必要です");
      return;
    }
    const snap = takeSnapshot();
    setBusy(true);
    setError(null);
    setArtistNames((prev) => {
      const s = new Set(prev.filter((n) => n !== name));
      for (const p of parts) s.add(p);
      return [...s].sort((a, b) => a.localeCompare(b, "ja"));
    });
    setUnclassified((prev) => prev.filter((u) => u.name !== name));
    setEditState(null);
    try {
      const saved = await postCorrection({
        kind: "split",
        rawName: name,
        splitInto: parts,
      });
      setCorrections((prev) => [saved, ...prev]);
      setMessage(`「${name}」を ${parts.length} 名に分割しました`);
    } catch (e) {
      restoreSnapshot(snap);
      setError(e instanceof Error ? e.message : "分割に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmUnclassified(name: string) {
    const snap = takeSnapshot();
    setBusy(true);
    setError(null);
    setUnclassified((prev) => prev.filter((u) => u.name !== name));
    setArtistNames((prev) =>
      [...new Set([...prev, name])].sort((a, b) => a.localeCompare(b, "ja")),
    );
    try {
      const saved = await postCorrection({
        kind: "confirm",
        rawName: name,
        canonicalName: name,
      });
      setCorrections((prev) => [saved, ...prev]);
      setMessage(`「${name}」を確定タグに昇格しました`);
    } catch (e) {
      restoreSnapshot(snap);
      setError(e instanceof Error ? e.message : "昇格に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleManualAdd() {
    const name = manualName.trim();
    if (!name) {
      setError("追加するアーティスト名を入力してください");
      return;
    }
    if (artistNames.some((n) => n === name)) {
      setError(`「${name}」はすでに確定タグにあります`);
      return;
    }
    const snap = takeSnapshot();
    setBusy(true);
    setError(null);
    setUnclassified((prev) => prev.filter((u) => u.name !== name));
    setArtistNames((prev) =>
      [...new Set([...prev, name])].sort((a, b) => a.localeCompare(b, "ja")),
    );
    setManualName("");
    try {
      const saved = await postCorrection({
        kind: "confirm",
        rawName: name,
        canonicalName: name,
      });
      setCorrections((prev) => [saved, ...prev]);
      setMessage(`「${name}」を手動で追加しました`);
    } catch (e) {
      restoreSnapshot(snap);
      setManualName(name);
      setError(e instanceof Error ? e.message : "手動追加に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleUndoCorrection(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const prevList = corrections;
    setCorrections((list) => list.filter((c) => c.id !== id));
    try {
      const res = await fetch("/api/artist-corrections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "取り消しに失敗しました");
      setMessage(
        "修正を取り消しました。再解析すると反映されます。",
      );
    } catch (e) {
      setCorrections(prevList);
      setError(e instanceof Error ? e.message : "取り消しに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function selectAllArtists() {
    setPickedArtists(allArtistNames);
    setMessage(null);
  }

  function clearArtistSelection() {
    setPickedArtists([]);
    setMessage(null);
  }

  async function handleAnalyze() {
    if (selected.length === 0) {
      setError("解析するプレイリストを1つ以上選んでください");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/youtube/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistIds: selected }),
      });
      const data = (await res.json()) as {
        error?: string;
        analysis?: PlaylistAnalysis;
        artistCount?: number;
        videoCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "解析に失敗しました");
      syncFromAnalysis(data.analysis ?? null);
      await loadCorrections();
      setMessage(
        `解析完了: ${data.videoCount ?? 0}曲から候補 ${data.artistCount ?? 0} 件。追加したい人だけ選んでください。`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析に失敗しました");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleAddSelected() {
    if (pickedArtists.length === 0) {
      setError("追加するアーティストを選んでください");
      return;
    }
    setAdding(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/tastes/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artists: pickedArtists }),
      });
      const data = (await res.json()) as {
        error?: string;
        addedCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "追加に失敗しました");
      setMessage(
        `${data.addedCount ?? pickedArtists.length} 件を好きなアーティストに追加しました`,
      );
      setPickedArtists([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setAdding(false);
    }
  }

  async function handleAddExternal() {
    if (!externalUrl.trim()) {
      setError("プレイリストの URL または ID を入力してください");
      return;
    }
    setAddingExternal(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/youtube/saved-playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrId: externalUrl.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        playlist?: YoutubePlaylistSummary;
        alreadyExists?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "登録に失敗しました");
      setExternalUrl("");
      await loadPlaylists();
      if (data.playlist?.id) {
        setSelected((prev) =>
          prev.includes(data.playlist!.id)
            ? prev
            : [...prev, data.playlist!.id].slice(0, 5),
        );
      }
      setMessage(
        data.alreadyExists
          ? `「${data.playlist?.title ?? "プレイリスト"}」はすでに登録済みです`
          : `「${data.playlist?.title ?? "プレイリスト"}」を一覧に追加しました`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setAddingExternal(false);
    }
  }

  async function handleRemoveSaved(playlistId: string) {
    setRemovingId(playlistId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/youtube/saved-playlists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "削除に失敗しました");
      setSelected((prev) => prev.filter((id) => id !== playlistId));
      await loadPlaylists();
      setMessage("登録したプレイリストを一覧から外しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setRemovingId(null);
    }
  }

  const needsReconnect =
    Boolean(error) &&
    (error?.includes("トークン") ||
      error?.includes("連携") ||
      error?.includes("認証") ||
      error?.includes("権限") ||
      error?.includes("スコープ") ||
      error?.includes("許可"));

  function renderTagEditor(
    name: string,
    variant: "confirmed" | "unclassified",
    reasons?: string[],
  ) {
    const editingHere =
      editState?.name === name ? editState.mode : (null as TagEditMode);
    return (
      <ArtistTagEditor
        key={`${variant}:${name}`}
        name={name}
        variant={variant}
        evidence={evidenceByName[name]}
        reasons={reasons}
        picked={pickedArtists.includes(name)}
        maybeSame={similarNameSet.has(name)}
        inMerge={mergePair.includes(name)}
        busy={busy}
        editMode={editingHere}
        editValue={editState?.name === name ? editState.value : ""}
        onTogglePick={
          variant === "confirmed" ? () => toggleArtist(name) : undefined
        }
        onToggleMerge={() => toggleMergeTag(name)}
        onStartRename={() => startRename(name)}
        onStartSplit={() => startSplit(name)}
        onReject={() => void handleReject(name)}
        onConfirm={
          variant === "unclassified"
            ? () => void handleConfirmUnclassified(name)
            : undefined
        }
        onEditValueChange={(value) =>
          setEditState((prev) =>
            prev && prev.name === name ? { ...prev, value } : prev,
          )
        }
        onSubmitEdit={() => void submitEdit()}
        onCancelEdit={() => setEditState(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      {needsReconnect || !channelId ? (
        <section className="rounded-2xl border border-[#c9a66b]/25 bg-[#14161c] px-4 py-4">
          {error ? (
            <p className="text-sm text-[#b42318]">{error}</p>
          ) : (
            <p className="text-sm text-[#e8dfd0]/75">
              YouTube 連携がまだ完了していません。下のボタンから許可してください（ログインとは別の手順です）。
            </p>
          )}
          <div className="mt-4">
            <YouTubeConnectButton
              connected={false}
              channelId={channelId}
              returnTo="/settings/playlists"
            />
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void loadPlaylists()}
          className="rounded-full border border-[#e8dfd0]/20 bg-[#14161c] px-4 py-2 text-sm"
        >
          一覧を再読み込み
        </button>
        <button
          type="button"
          onClick={() => {
            setSelected([]);
            setMessage(null);
          }}
          disabled={selected.length === 0}
          className="rounded-full border border-[#e8dfd0]/15 px-4 py-2 text-sm disabled:opacity-40"
        >
          選択をすべて解除
          {selected.length > 0 ? `（${selected.length}）` : ""}
        </button>
        <p className="text-xs text-[#e8dfd0]/45">
          最大5件まで選択できます
          {selected.length > 0 ? ` · 現在 ${selected.length} 件選択中` : ""}
        </p>
      </div>

      <section className="space-y-2 rounded-2xl border border-[#e8dfd0]/10 bg-[#14161c]/80 px-4 py-4">
        <h2 className="text-sm font-medium text-[#e8dfd0]">
          他人のプレイリストを追加
        </h2>
        <p className="text-xs leading-relaxed text-[#e8dfd0]/55">
          YouTube
          に「保存」しただけでは API
          から取れません。公開プレイリストの URL か ID
          を貼ると、この一覧に載せて解析できます。
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://www.youtube.com/playlist?list=..."
            className="min-w-0 flex-1 rounded-xl border border-[#e8dfd0]/15 bg-[#14161c] px-3 py-2 text-sm outline-none focus:border-[#c9a66b]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAddExternal();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void handleAddExternal()}
            disabled={addingExternal || !externalUrl.trim()}
            className="rounded-full bg-[#c9a66b] px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {addingExternal ? "追加中…" : "一覧に追加"}
          </button>
        </div>
      </section>

      {loadingList ? (
        <p className="text-sm text-[#e8dfd0]/55">プレイリストを読み込み中…</p>
      ) : playlists.length === 0 ? (
        <p className="text-sm text-[#e8dfd0]/55">
          プレイリストが見つかりません。自分で作った PL
          か、上の欄から他人の公開 PL を追加してください。
        </p>
      ) : (
        <ul className="divide-y divide-[#e8dfd0]/10 border-y border-[#e8dfd0]/10">
          {playlists.map((playlist) => {
            const checked = selected.includes(playlist.id);
            const isSaved = playlist.source === "saved";
            return (
              <li key={playlist.id}>
                <div className="flex items-center gap-3 py-3">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePlaylist(playlist.id)}
                      className="h-4 w-4 accent-[#c9a66b]"
                    />
                    {playlist.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={playlist.thumbnailUrl}
                        alt=""
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-[#e8dfd0]/10" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="block truncate text-sm font-medium">
                          {playlist.title}
                        </span>
                        {isSaved ? (
                          <span className="shrink-0 text-[10px] tracking-wide text-[#c9a66b]">
                            保存
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-[#e8dfd0]/45">
                        {playlist.itemCount}曲
                      </span>
                    </span>
                  </label>
                  {isSaved ? (
                    <button
                      type="button"
                      onClick={() => void handleRemoveSaved(playlist.id)}
                      disabled={removingId === playlist.id}
                      className="shrink-0 text-xs text-[#e8dfd0]/45 underline-offset-2 hover:underline disabled:opacity-40"
                    >
                      {removingId === playlist.id ? "削除中…" : "外す"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void handleAnalyze()}
        disabled={analyzing || selected.length === 0}
        className="rounded-full bg-[#c9a66b] px-6 py-3 text-sm font-semibold text-[#0a0b0d] disabled:opacity-40"
      >
        {analyzing ? "解析中…" : "選択したプレイリストを解析"}
      </button>

      {error && !needsReconnect ? (
        <p className="text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-[#c9a66b]">{message}</p> : null}

      {analysis ? (
        <section className="space-y-4 rounded-2xl border border-[#e8dfd0]/10 bg-[#14161c]/85 px-4 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            解析結果
          </h2>
          <p className="text-xs text-[#e8dfd0]/45">
            対象: {analysis.playlistTitles.join(" / ")}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAllArtists}
              className="rounded-full border border-[#e8dfd0]/15 px-3 py-1.5 text-xs"
            >
              全選択（確定のみ）
            </button>
            <button
              type="button"
              onClick={clearArtistSelection}
              className="rounded-full border border-[#e8dfd0]/15 px-3 py-1.5 text-xs"
            >
              選択解除
            </button>
            <span className="self-center text-xs text-[#e8dfd0]/45">
              {pickedArtists.length} / {allArtistNames.length} 選択中
              {allPicked ? "（すべて）" : ""}
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[#e8dfd0]/70">
              確定タグ（{allArtistNames.length}）
            </h3>
            <div className="flex flex-col gap-2">
              {allArtistNames.length === 0 ? (
                <span className="text-xs text-[#e8dfd0]/45">候補なし</span>
              ) : (
                allArtistNames.map((artist) =>
                  renderTagEditor(artist, "confirmed"),
                )
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleManualAdd();
                  }
                }}
                placeholder="取りこぼしたアーティストを手動追加"
                className="min-w-[14rem] flex-1 rounded-lg border border-[#e8dfd0]/15 bg-[#14161c] px-3 py-2 text-sm outline-none focus:border-[#c9a66b]"
              />
              <button
                type="button"
                disabled={busy || !manualName.trim()}
                onClick={() => void handleManualAdd()}
                className="rounded-full border border-[#c9a66b]/40 px-4 py-2 text-xs text-[#c9a66b] disabled:opacity-40"
              >
                手動で追加
              </button>
            </div>
          </div>

          {similarPairs.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-[#c47b2b]/35 bg-[#c47b2b]/8 px-3 py-3">
              <h3 className="text-sm font-medium text-[#8b4513]">
                もしかして同じ？（{similarPairs.length}）
              </h3>
              <ul className="space-y-2">
                {similarPairs.map((pair) => (
                  <li
                    key={`${pair.a}__${pair.b}`}
                    className="flex flex-wrap items-center gap-2 text-xs"
                  >
                    <span className="rounded-full border border-[#c47b2b]/40 bg-[#14161c] px-2.5 py-1">
                      {pair.a}
                    </span>
                    <span className="text-[#e8dfd0]/40">≈</span>
                    <span className="rounded-full border border-[#c47b2b]/40 bg-[#14161c] px-2.5 py-1">
                      {pair.b}
                    </span>
                    <span className="text-[#e8dfd0]/45">
                      {Math.round(pair.similarity * 100)}%
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMergePair([pair.a, pair.b]);
                      }}
                      className="rounded-full border border-[#8b4513]/30 px-2.5 py-1 text-[#8b4513]"
                    >
                      統合する
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {unclassified.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-[#e8dfd0]/15 bg-[#e8dfd0]/4 px-3 py-3">
              <h3 className="text-sm font-medium text-[#e8dfd0]/70">
                未分類 / 要確認（{unclassified.length}）
              </h3>
              <p className="text-xs text-[#e8dfd0]/45">
                自動では音楽スタイルに追加しません。「確」で昇格、「×」で除外（あとから取り消し可）できます。
              </p>
              <div className="flex flex-col gap-2">
                {unclassified.map((item) =>
                  renderTagEditor(item.name, "unclassified", item.reasons),
                )}
              </div>
            </div>
          ) : null}

          {mergePair.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-[#8b4513]/25 bg-[#8b4513]/5 px-3 py-3">
              <p className="text-xs text-[#e8dfd0]/65">
                統合選択（茶色）: {mergePair.join(" ＋ ")}
                {mergePair.length < 2 ? "（もう1つ選んでください）" : ""}
              </p>
              {mergePair.length === 2 ? (
                <div className="flex flex-wrap gap-2">
                  <span className="self-center text-xs text-[#e8dfd0]/55">
                    正式名にする側:
                  </span>
                  {mergePair.map((name) => (
                    <button
                      key={name}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleMerge(name)}
                      className="rounded-full bg-[#8b4513] px-3 py-1.5 text-xs text-white disabled:opacity-40"
                    >
                      「{name}」に統合
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[#e8dfd0]/45">
              統=統合 / 改=名前を修正 / 分=複数人に分割 / ×=これは違う（取り消し可） /
              確=これで合っている。由来の曲名を見て曲名混入を除外してください。
            </p>
          )}

          <details
            className="rounded-xl border border-[#e8dfd0]/10 bg-[#14161c]/80 px-3 py-2"
            open={correctionsOpen}
            onToggle={(e) =>
              setCorrectionsOpen((e.target as HTMLDetailsElement).open)
            }
          >
            <summary className="cursor-pointer text-sm text-[#e8dfd0]/70">
              保存済みの修正（{corrections.length}）
            </summary>
            <div className="mt-2 space-y-2">
              {corrections.length === 0 ? (
                <p className="text-xs text-[#e8dfd0]/45">まだ修正はありません</p>
              ) : (
                <ul className="space-y-1.5">
                  {corrections.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="mr-2 rounded-full bg-[#e8dfd0]/06 px-2 py-0.5 text-[10px] text-[#e8dfd0]/55">
                          {kindLabel(c.kind)}
                        </span>
                        {formatCorrectionSummary(c)}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleUndoCorrection(c.id)}
                        className="rounded-full border border-[#e8dfd0]/15 px-2.5 py-1 text-[10px] disabled:opacity-40"
                      >
                        取り消し
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-[#e8dfd0]/40">
                取り消し後は「再解析すると反映されます」。
              </p>
            </div>
          </details>

          <button
            type="button"
            onClick={() => void handleAddSelected()}
            disabled={adding || pickedArtists.length === 0}
            className="rounded-full bg-[#c9a66b] px-5 py-2.5 text-sm font-semibold text-[#0a0b0d] disabled:opacity-40"
          >
            {adding
              ? "追加中…"
              : `確定から選んだ ${pickedArtists.length} 件を好きなアーティストに追加`}
          </button>

          <p className="text-xs text-[#e8dfd0]/45">
            解析済み曲ID: {analysis.videoIds.length}（生成時の重複回避にも使用）
          </p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/settings/tastes"
          className="text-[#c9a66b] underline-offset-2 hover:underline"
        >
          あなたの音楽スタイルを編集・一括削除へ
        </Link>
        <Link
          href="/settings"
          className="text-[#c9a66b] underline-offset-2 hover:underline"
        >
          設定に戻る
        </Link>
        <Link
          href="/"
          className="text-[#e8dfd0]/50 underline-offset-2 hover:underline"
        >
          ホーム
        </Link>
      </div>
    </div>
  );
}
