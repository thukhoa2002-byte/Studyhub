import SharedSelect, { type SharedSelectOption } from "./SharedSelect.tsx";

export type AnimatedDropdownOption = SharedSelectOption;

interface Props {
  value: string;
  options: AnimatedDropdownOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  name?: string;
  disabled?: boolean;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
}

/** @deprecated Use SharedSelect directly for new UI. Kept as a compatibility wrapper. */
export default function AnimatedDropdown({ value, options, onChange, ariaLabel = "Chọn một mục", name, disabled = false, triggerClassName = "", menuClassName = "", optionClassName = "" }: Props) {
  // Earlier callers positioned menus inside their cards. The shared select now uses a portal,
  // so legacy positioning utilities would fight the calculated viewport position.
  const visualMenuClassName = menuClassName.split(/\s+/).filter((className) => !/^(?:-?(?:left|right|top|bottom)|absolute|fixed|z-)/.test(className)).join(" ");
  return <SharedSelect
    value={value}
    options={options}
    onValueChange={onChange}
    ariaLabel={ariaLabel}
    name={name}
    disabled={disabled}
    triggerClassName={triggerClassName}
    menuClassName={visualMenuClassName}
    optionClassName={optionClassName}
  />;
}
