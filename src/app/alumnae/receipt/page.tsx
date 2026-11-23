import DonationReceipt from "./receipt";

export default async function DonationReceiptPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <DonationReceipt token={token} />;
}
