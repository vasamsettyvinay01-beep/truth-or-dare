import { redirect } from "next/navigation";

/**
 * Supports invite links shaped as /join/ABC123 in addition to /join?code=ABC123.
 * Message apps often strip query strings, so both forms must resolve.
 */
export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const clean = (code || "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
  redirect(clean ? `/join?code=${clean}` : "/join");
}
