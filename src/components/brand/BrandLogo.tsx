import Image from "next/image";
import { APP_NAME } from "@/lib/constants";

type Variant = "mark" | "lockup" | "wordmark";

type Props = {
  variant?: Variant;
  className?: string;
  /** 表示幅（px） */
  width?: number;
  priority?: boolean;
};

const ASSETS: Record<
  Variant,
  { src: string; width: number; height: number; alt: string }
> = {
  mark: {
    src: "/brand/logo-mark.png",
    width: 1200,
    height: 1172,
    alt: `${APP_NAME} mark`,
  },
  lockup: {
    src: "/brand/logo-lockup.png",
    width: 1023,
    height: 1200,
    alt: APP_NAME,
  },
  wordmark: {
    src: "/brand/wordmark.png",
    width: 1200,
    height: 250,
    alt: APP_NAME,
  },
};

export function BrandLogo({
  variant = "lockup",
  className,
  width,
  priority = false,
}: Props) {
  const asset = ASSETS[variant];
  const displayWidth =
    width ??
    (variant === "mark" ? 96 : variant === "wordmark" ? 160 : 280);
  const displayHeight = Math.round(
    (displayWidth / asset.width) * asset.height,
  );

  return (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={displayWidth}
      height={displayHeight}
      priority={priority}
      className={className}
    />
  );
}
