import { LegalDocument } from "@/components/legal/LegalDocument";
import {
  APP_NAME,
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_OPERATOR,
} from "@/lib/constants";

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="プライバシーポリシー"
      updatedAt={LEGAL_LAST_UPDATED}
      sections={[
        {
          heading: "1. はじめに",
          paragraphs: [
            `${LEGAL_OPERATOR}（以下「当方」）は、${APP_NAME}（以下「本サービス」）におけるユーザーの個人情報の取扱いについて、以下のとおり定めます。`,
          ],
        },
        {
          heading: "2. 取得する情報",
          paragraphs: [
            "本サービスでは、提供にあたり次のような情報を取得・保存することがあります。",
          ],
          bullets: [
            "Google アカウントに紐づく識別情報、表示名、メールアドレス、プロフィール画像",
            "YouTube 連携に必要なアクセストークン・リフレッシュトークン、チャンネル ID",
            "好きなアーティスト・ジャンル、生成オプション等の設定情報",
            "プレイリスト生成・解析の履歴、利用状況に関するログ（API 利用量の推定記録を含む）",
            "設定で「天気を考慮」を有効にした場合の位置情報（天気取得のため。常時取得はしません）",
          ],
        },
        {
          heading: "3. 利用目的",
          paragraphs: ["取得した情報は、次の目的で利用します。"],
          bullets: [
            "ユーザー認証およびアカウント管理",
            "気分・好みに応じた YouTube プレイリストの生成・解析・保存",
            "YouTube Data API 等の外部サービス連携",
            "サービスの維持・改善、不正利用の防止、お問い合わせ対応",
          ],
        },
        {
          heading: "4. 第三者への提供",
          paragraphs: [
            "当方は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に販売しません。ただし、サービス提供のため次の事業者に必要な範囲で情報が処理されることがあります。",
          ],
          bullets: [
            "Google LLC（Google ログイン、YouTube Data API）",
            "Supabase（認証・データベース等のインフラ）",
          ],
        },
        {
          heading: "5. 保管とセキュリティ",
          paragraphs: [
            "当方は、取得した情報を適切な安全管理措置のもとで保管し、権限管理や通信の保護など、合理的な範囲で漏洩・改ざん・不正アクセスの防止に努めます。YouTube 連携トークン等の機微な情報は、サーバー側で管理し、クライアントから不要に露出しないよう設計しています。",
          ],
        },
        {
          heading: "6. 開示・訂正・削除等",
          paragraphs: [
            `ご自身の情報の開示、訂正、削除等をご希望の場合は、${LEGAL_OPERATOR}（${LEGAL_CONTACT_EMAIL}）までご連絡ください。本人確認のうえ、法令およびサービス運用上可能な範囲で対応します。`,
          ],
        },
        {
          heading: "7. 改定",
          paragraphs: [
            "本ポリシーの内容は、必要に応じて改定することがあります。重要な変更がある場合は、本サービス上での掲示等、適切な方法でお知らせします。改定後に本サービスを利用された場合、改定後の内容に同意したものとみなすことがあります。",
          ],
        },
        {
          heading: "8. お問い合わせ",
          paragraphs: [
            `本ポリシーに関するお問い合わせは、${LEGAL_OPERATOR}（メール: ${LEGAL_CONTACT_EMAIL}）までご連絡ください。`,
          ],
        },
      ]}
    />
  );
}
