import FabMenu from "@/components/messenger/FabMenu";

export default function ChatFab({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <FabMenu
      label="Создать или найти"
      items={[
        { key: "create", label: "Создать группу или канал", icon: "Plus", color: "text-violet-500", onClick: onCreate },
        { key: "join", label: "Найти по ссылке", icon: "Search", color: "text-cyan-600", onClick: onJoin },
      ]}
    />
  );
}
