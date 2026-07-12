interface Props {
  submitted: boolean;
  onSubmit: () => void;
}

export default function ScoreCard({
  submitted,
  onSubmit,
}: Props) {
  if (submitted) return null;

  return (
    <button
      onClick={onSubmit}
      className="mt-10 w-full rounded-xl bg-green-600 py-5 text-2xl font-bold text-white hover:bg-green-700"
    >
      NỘP BÀI
    </button>
  );
}