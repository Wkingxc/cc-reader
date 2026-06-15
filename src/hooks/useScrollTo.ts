import { useCallback } from "react";

export function useScrollTo() {
  const scrollTo = useCallback((uuid: string) => {
    const el = document.getElementById(`msg-${uuid}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-blue-400");
      setTimeout(() => el.classList.remove("ring-2", "ring-blue-400"), 2000);
    }
  }, []);

  return { scrollTo };
}
