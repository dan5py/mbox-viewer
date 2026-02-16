import { Loader2Icon } from "lucide-react";

import { cn } from "~/lib/utils";

type SpinnerProps = React.ComponentProps<"svg"> & {
  label?: string;
};

function Spinner({ className, label = "Loading", ...props }: SpinnerProps) {
  return (
    <Loader2Icon
      role="status"
      aria-label={label}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
