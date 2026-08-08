from pathlib import Path

root = Path(r"d:\cursor\retiverse\src")
skip_names = {"GoogleLoginButton.tsx"}  # light button keeps dark text

changed = 0
for path in list(root.rglob("*.tsx")) + list(root.rglob("*.ts")):
    if path.name in skip_names:
        continue
    text = path.read_text(encoding="utf-8")
    orig = text

    text = text.replace("bg-[#f7f3ec]", "bg-[#0a0b0d]")
    text = text.replace("bg-[#1a1612] text-[#f4f0e8]", "bg-[#c9a66b] text-[#0a0b0d]")
    text = text.replace(
        "bg-[#1a1612] px-6 py-3 text-sm font-semibold text-[#f4f0e8]",
        "bg-[#c9a66b] px-6 py-3 text-sm font-semibold text-[#0a0b0d]",
    )
    text = text.replace(
        "bg-[#1a1612] px-6 py-4 text-sm font-semibold text-[#f4f0e8]",
        "bg-[#c9a66b] px-6 py-4 text-sm font-semibold text-[#0a0b0d]",
    )
    text = text.replace(
        "bg-[#1a1612] px-5 py-2.5 text-sm font-semibold text-[#f4f0e8]",
        "bg-[#c9a66b] px-5 py-2.5 text-sm font-semibold text-[#0a0b0d]",
    )
    text = text.replace(
        "bg-[#1a1612] px-5 py-2 text-sm font-semibold text-[#f4f0e8]",
        "bg-[#c9a66b] px-5 py-2 text-sm font-semibold text-[#0a0b0d]",
    )
    text = text.replace(
        "bg-[#1a1612] px-5 py-2.5 text-sm text-[#f4f0e8]",
        "bg-[#c9a66b] px-5 py-2.5 text-sm text-[#0a0b0d]",
    )
    text = text.replace(
        "bg-[#1a1612] px-3 py-1.5 text-xs text-[#f4f0e8]",
        "bg-[#c9a66b] px-3 py-1.5 text-xs text-[#0a0b0d]",
    )
    text = text.replace(
        "rounded-full bg-[#1a1612] text-xl text-[#f4f0e8]",
        "rounded-full bg-[#c9a66b] text-xl text-[#0a0b0d]",
    )
    text = text.replace("bg-[#1a1612]/", "bg-[#e8dfd0]/")
    text = text.replace("bg-[#1a1612]", "bg-[#c9a66b]")
    # remaining black ink -> readable cream
    text = text.replace("#1a1612", "#e8dfd0")
    text = text.replace("bg-white/80", "bg-[#14161c]/90")
    text = text.replace("bg-white/70", "bg-[#14161c]/85")
    text = text.replace("bg-white/60", "bg-[#14161c]/80")
    text = text.replace("hover:bg-white", "hover:bg-[#1a1d24]")
    text = text.replace("bg-white", "bg-[#14161c]")
    text = text.replace("#2a6f6a", "#c9a66b")
    text = text.replace("#1f4f4b", "#c9a66b")

    if text != orig:
        path.write_text(text, encoding="utf-8")
        changed += 1
        print(path.relative_to(root))

print("changed", changed)
