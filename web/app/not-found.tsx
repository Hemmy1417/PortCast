import { LinkButton } from "@/components/bits";

export default function NotFound() {
  return (
    <div className="rounded-card border border-rule bg-deck p-8">
      <p className="h-lg">No berth here</p>
      <p className="mt-2 max-w-[50ch] text-[17px]">That page does not exist.</p>
      <div className="mt-6 flex gap-3">
        <LinkButton href="/markets">Browse markets</LinkButton>
        <LinkButton href="/" variant="secondary">The board</LinkButton>
      </div>
    </div>
  );
}
