export function AddContactForm({
  phone,
  setPhone,
  name,
  setName,
  addError,
  adding,
  onSubmit,
}: {
  phone: string;
  setPhone: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  addError: string;
  adding: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="px-4 py-4 border-b border-white/5 glass animate-fade-in">
      <p className="text-xs text-muted-foreground mb-3">Добавить по номеру телефона</p>
      <input
        value={phone}
        onChange={e => setPhone(e.target.value)}
        placeholder="Номер телефона (+79991234567)"
        className="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none text-foreground placeholder-muted-foreground mb-2"
      />
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Имя (необязательно)"
        className="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none text-foreground placeholder-muted-foreground mb-2"
      />
      {addError && <p className="text-red-400 text-xs mb-2">{addError}</p>}
      <button
        onClick={onSubmit}
        disabled={adding || !phone.trim()}
        className="w-full grad-primary text-white rounded-xl py-2.5 text-sm font-semibold glow-primary transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {adding ? "Добавляем..." : "Добавить контакт"}
      </button>
    </div>
  );
}

export default AddContactForm;
