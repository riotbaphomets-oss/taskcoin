import { formatCoins } from "@/lib/wallet";

type Entry = {
  id: string;
  createdAt: Date;
  amount: number;
  type: string;
  status: string;
  availableAt: Date | null;
  note: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "Einzahlung",
  EARNING: "Verdienst",
  ESCROW_LOCK: "Budget gesperrt",
  ESCROW_RELEASE: "Budget zurückgebucht",
  WITHDRAWAL: "Auszahlung",
  WITHDRAWAL_REVERSAL: "Auszahlung zurückgebucht",
  ADJUSTMENT: "Gutschrift",
  FEE: "Gebühr",
};

export function LedgerList({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return <div className="empty"><h2>Noch keine Buchungen</h2><p>Deine Buchungen erscheinen hier.</p></div>;
  }
  const now = new Date();
  return (
    <div className="list">
      {entries.map((e) => (
        <div className="item" key={e.id}>
          <div>
            <h3>{TYPE_LABEL[e.type] ?? e.type}</h3>
            <p>
              {e.createdAt.toLocaleDateString("de-DE")}
              {e.note ? `, ${e.note}` : ""}
              {e.status === "PENDING" && e.availableAt && e.availableAt > now
                ? `, verfügbar ab ${e.availableAt.toLocaleDateString("de-DE")}`
                : ""}
            </p>
          </div>
          <span className={e.amount >= 0 ? "plus" : "minus"}>
            {e.amount >= 0 ? "+" : ""}{formatCoins(e.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}
