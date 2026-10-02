import Icon from "@/components/ui/icon";
import { avatarGrad, type Contact } from "@/lib/api";

export function ContactListItem({
  contact,
  onOpen,
  onCall,
  onRemove,
}: {
  contact: Contact;
  onOpen: (contact: Contact) => void;
  onCall: (contact: Contact) => void;
  onRemove: (contactId: number) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer group"
      onClick={() => onOpen(contact)}
    >
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0 ${avatarGrad(contact.id)}`}
      >
        {contact.name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{contact.name}</p>
        <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); onCall(contact); }}
          className="p-2 glass rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-colors"
        >
          <Icon name="Phone" size={15} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onRemove(contact.id); }}
          className="p-2 glass rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Icon name="UserMinus" size={15} />
        </button>
      </div>
    </div>
  );
}

export default ContactListItem;
