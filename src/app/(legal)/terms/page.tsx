import { LegalDocument } from "@/components/legal/LegalDocument";
import {
  APP_NAME,
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_OPERATOR,
} from "@/lib/constants";

export default function TermsPage() {
  return (
    <LegalDocument
      title="利用規約"
      updatedAt={LEGAL_LAST_UPDATED}
      sections={[
        {
          heading: "1. 適用",
          paragraphs: [
            `本利用規約（以下「本規約」）は、${LEGAL_OPERATOR}（以下「当方」）が提供する ${APP_NAME}（以下「本サービス」）の利用条件を定めるものです。ユーザーは本規約に同意のうえ本サービスを利用するものとします。`,
          ],
        },
        {
          heading: "2. サービス内容",
          paragraphs: [
            "本サービスは、ユーザーの気分・好み等に基づき YouTube 上の楽曲候補を検索し、プレイリストの生成や解析を支援する Web アプリケーションです。本サービスの機能・表示・仕様は予告なく変更・中断・終了することがあります。",
          ],
        },
        {
          heading: "3. アカウントと外部サービス",
          paragraphs: [
            "本サービスの利用には Google アカウントによるログインが必要です。YouTube へのプレイリスト作成・読み取り等を行う場合は、別途 YouTube 連携（OAuth）への同意が必要です。Google / YouTube の利用規約および API の利用制限（クォータ等）にも従うものとします。",
          ],
        },
        {
          heading: "4. 禁止事項",
          paragraphs: ["ユーザーは、本サービスの利用にあたり、次の行為をしてはなりません。"],
          bullets: [
            "法令または公序良俗に反する行為",
            "不正アクセス、リバースエンジニアリングその他サービスの妨害",
            "他者の権利（著作権・肖像権・プライバシー等）を侵害する行為",
            "YouTube や Google の規約・ポリシーに違反する行為",
            "当方または第三者に損害を与える行為",
          ],
        },
        {
          heading: "5. 知的財産",
          paragraphs: [
            "本サービスに関するプログラム、デザイン、テキスト等の権利は当方または正当な権利者に帰属します。YouTube 上の動画・楽曲・アートワーク等の権利は、各権利者に帰属します。",
          ],
        },
        {
          heading: "6. 免責",
          paragraphs: [
            "本サービスは現状有姿で提供されます。当方は、生成結果の正確性・完全性・特定目的適合性、外部 API の可用性、クォータ超過による機能制限、データ消失等について、法令上許容される最大限の範囲で保証せず、これらに起因する損害について責任を負いません（ただし、当方の故意または重過失による場合を除きます）。",
          ],
        },
        {
          heading: "7. 規約の変更",
          paragraphs: [
            "当方は、必要に応じて本規約を変更できます。変更後の規約は本サービス上に表示した時点から効力を生じるものとし、変更後に利用を継続した場合は同意したものとみなすことがあります。",
          ],
        },
        {
          heading: "8. 準拠法・管轄",
          paragraphs: [
            "本規約は日本法に準拠します。本サービスに関して紛争が生じた場合、当方の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。",
          ],
        },
        {
          heading: "9. お問い合わせ",
          paragraphs: [
            `本規約に関するお問い合わせは、${LEGAL_OPERATOR}（メール: ${LEGAL_CONTACT_EMAIL}）までご連絡ください。`,
          ],
        },
      ]}
    />
  );
}
