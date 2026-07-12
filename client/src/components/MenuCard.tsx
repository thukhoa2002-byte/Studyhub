type MenuCardProps = {
  title: string;
};

function MenuCard({ title }: MenuCardProps) {
  return (
    <button>
      {title}
    </button>
  );
}

export default MenuCard;